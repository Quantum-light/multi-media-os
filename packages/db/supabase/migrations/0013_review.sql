-- 0013 Review, the one gate: people edit drafts (every change a version, every change a
-- lesson for the voice kit), see where each post will go and when, and approve once.
-- Three definer functions are the only doors; the tables stay read-only to people.

-- Approving is for owners and approvers; editors edit.
create or replace function private.can_approve(ws uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members m where m.workspace_id = ws and m.user_id = (select auth.uid())
                 and m.role in ('owner', 'approver'));
$$;
revoke execute on function private.can_approve(uuid) from public, anon;
grant execute on function private.can_approve(uuid) to authenticated;

-- Saves new text for a piece as the next version, and records the change as a voice lesson.
-- p_source is 'person' (typed in Review) or 'chat' (the Review chat, at the person's request).
create or replace function public.save_piece(p_piece uuid, p_body text, p_source text default 'person', p_note text default null)
returns int language plpgsql security definer set search_path = '' as $$
declare
  p public.pieces;
  brand uuid;
  next_v int;
  v_body text := btrim(coalesce(p_body, ''));
begin
  select * into p from public.pieces where id = p_piece for update;
  if p.id is null or not private.can_edit(p.workspace_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_source not in ('person', 'chat') then raise exception 'unknown source %', p_source using errcode = '22023'; end if;
  if length(v_body) = 0 or length(v_body) > 10000 then raise exception 'text must be 1 to 10000 characters' using errcode = '22023'; end if;
  if v_body = p.body then return p.version; end if;

  select max(version) + 1 into next_v from public.piece_versions where piece_id = p.id;
  insert into public.piece_versions (workspace_id, piece_id, version, body, author, author_id, note)
  values (p.workspace_id, p.id, next_v, v_body, p_source, (select auth.uid()), left(p_note, 300));
  update public.pieces set body = v_body, version = next_v, updated_at = now() where id = p.id;

  select s.brand_id into brand from public.episodes e join public.shows s on s.id = e.show_id where e.id = p.episode_id;
  insert into public.voice_lessons (workspace_id, brand_id, piece_kind, platform, before, after, source)
  values (p.workspace_id, brand, p.kind, nullif(p.platform, ''), p.body, v_body, p_source);
  return next_v;
end
$$;
revoke execute on function public.save_piece(uuid, text, text, text) from public, anon;
grant execute on function public.save_piece(uuid, text, text, text) to authenticated;

-- The next free posting slots for an episode, one per connected channel of its show.
-- Slots are the show's weekly times ({day, time, tz}); a slot already used by this show is skipped.
create or replace function public.plan_posts(p_episode uuid)
returns table (channel_id uuid, platform text, handle text, scheduled_for timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  ws uuid;
  v_show uuid;
  slot_at timestamptz;
begin
  select e.workspace_id, e.show_id into ws, v_show from public.episodes e where e.id = p_episode;
  if ws is null or not private.is_member(ws) then raise exception 'not allowed' using errcode = '42501'; end if;

  select min(t) into slot_at
  from public.shows s,
       jsonb_array_elements(s.slots) sl,
       generate_series(0, 20) d,
       lateral (select ((((now() at time zone (sl ->> 'tz'))::date + d) + (sl ->> 'time')::time) at time zone (sl ->> 'tz')) as t) cand
  where s.id = v_show
    and lower(to_char((now() at time zone (sl ->> 'tz'))::date + d, 'dy')) = lower(sl ->> 'day')
    and cand.t > now() + interval '2 hours'
    and not exists (select 1 from public.posts po join public.episodes e2 on e2.id = po.episode_id
                    where e2.show_id = v_show and po.scheduled_for = cand.t and po.status in ('scheduled', 'published') and po.episode_id <> p_episode);

  return query
  select c.id, c.platform, c.handle, coalesce(
           (select po.scheduled_for from public.posts po where po.episode_id = p_episode and po.channel_id = c.id),
           slot_at)
  from public.show_channels sc join public.channels c on c.id = sc.channel_id
  where sc.show_id = v_show and c.status = 'connected'
  order by c.platform;
end
$$;
revoke execute on function public.plan_posts(uuid) from public, anon;
grant execute on function public.plan_posts(uuid) to authenticated;

-- One post per channel per episode, so approving twice never doubles anything.
create unique index posts_episode_channel on public.posts (episode_id, channel_id);

-- The one Approve: schedules every planned post and moves the episode on. Returns posts scheduled.
create or replace function public.approve_episode(p_episode uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare
  e public.episodes;
  n int;
begin
  select * into e from public.episodes where id = p_episode for update;
  if e.id is null or not private.can_approve(e.workspace_id) then raise exception 'not allowed' using errcode = '42501'; end if;
  if e.state = 'approved' then return 0; end if;
  if e.state <> 'review' then raise exception 'episode is not waiting for review (it is %)', e.state using errcode = '22023'; end if;
  if not exists (select 1 from public.pieces where episode_id = p_episode and kind = 'title') then
    raise exception 'episode has no title yet' using errcode = '22023';
  end if;

  insert into public.posts (workspace_id, episode_id, channel_id, platform, scheduled_for, status, idempotency_key)
  select e.workspace_id, p_episode, pp.channel_id, pp.platform, pp.scheduled_for, 'scheduled', 'post-' || gen_random_uuid()::text
  from public.plan_posts(p_episode) pp
  where pp.scheduled_for is not null
  on conflict (episode_id, channel_id) do nothing;
  get diagnostics n = row_count;

  update public.episodes set state = 'approved', title = (select body from public.pieces where episode_id = p_episode and kind = 'title'),
         description = (select body from public.pieces where episode_id = p_episode and kind = 'description')
  where id = p_episode;
  return n;
end
$$;
revoke execute on function public.approve_episode(uuid) from public, anon;
grant execute on function public.approve_episode(uuid) to authenticated;
