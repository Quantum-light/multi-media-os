-- Review test (0013): editors save drafts as versions and teach the voice kit; viewers cannot;
-- the plan finds the next free slot per channel; only owners and approvers approve, once.
-- Always rolls back.
begin;

insert into auth.users (id, email) values
  ('70000000-0000-0000-0000-00000000000a', 'owner@review.test'),
  ('70000000-0000-0000-0000-00000000000b', 'editor@review.test'),
  ('70000000-0000-0000-0000-00000000000c', 'viewer@review.test');
insert into public.workspaces (id, name, slug) values ('71000000-0000-0000-0000-000000000001', 'Review test', 'review-test');
insert into public.members (workspace_id, user_id, role) values
  ('71000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-00000000000a', 'owner'),
  ('71000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-00000000000b', 'editor'),
  ('71000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-00000000000c', 'viewer');
insert into public.brands (id, workspace_id, name, slug, brand_kit) values ('71000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000001', 'B', 'b', '{}');
-- Slots every day of the week at 09:00 Makassar time, so a free slot always exists within a day.
insert into public.shows (id, workspace_id, brand_id, name, slug, kind, theme, slots) values
  ('71000000-0000-0000-0000-000000000003', '71000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000002', 'Show', 's', 'video', '{}',
   (select jsonb_agg(jsonb_build_object('day', d, 'time', '09:00', 'tz', 'Asia/Makassar')) from unnest(array['mon','tue','wed','thu','fri','sat','sun']) d));
insert into public.channels (id, workspace_id, platform, handle, zernio_account_id) values
  ('71000000-0000-0000-0000-000000000005', '71000000-0000-0000-0000-000000000001', 'youtube', '@show', 'acc1'),
  ('71000000-0000-0000-0000-000000000006', '71000000-0000-0000-0000-000000000001', 'threads', '@show', null);
insert into public.show_channels (workspace_id, show_id, channel_id) values
  ('71000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000003', '71000000-0000-0000-0000-000000000005'),
  ('71000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000003', '71000000-0000-0000-0000-000000000006');
insert into public.episodes (id, workspace_id, show_id, state) values ('71000000-0000-0000-0000-000000000004', '71000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000003', 'review');
insert into public.pieces (id, workspace_id, episode_id, kind, platform, body) values
  ('71000000-0000-0000-0000-000000000010', '71000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000004', 'title', '', 'Draft title'),
  ('71000000-0000-0000-0000-000000000011', '71000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000004', 'description', '', 'Draft description');
insert into public.piece_versions (workspace_id, piece_id, version, body, author) values
  ('71000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000010', 1, 'Draft title', 'agent'),
  ('71000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000011', 1, 'Draft description', 'agent');

set local role authenticated;

-- 1. an editor saves: new version, current text, a voice lesson; empty text is refused
select set_config('request.jwt.claims', '{"sub":"70000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
do $$
declare v int; n int; t text;
begin
  v := public.save_piece('71000000-0000-0000-0000-000000000010', '  The watch my grandmother gave me ', 'person');
  if v <> 2 then raise exception '1: expected version 2, got %', v; end if;
  select body into t from public.pieces where id = '71000000-0000-0000-0000-000000000010';
  if t <> 'The watch my grandmother gave me' then raise exception '1: body is %', t; end if;
  select count(*) into n from public.voice_lessons where before = 'Draft title' and after = 'The watch my grandmother gave me' and source = 'person' and piece_kind = 'title';
  if n <> 1 then raise exception '1: voice lesson not recorded'; end if;
  v := public.save_piece('71000000-0000-0000-0000-000000000010', 'The watch my grandmother gave me', 'chat');
  if v <> 2 then raise exception '1: saving the same text made a new version'; end if;
  begin
    perform public.save_piece('71000000-0000-0000-0000-000000000010', '   ', 'person');
    raise exception '1: empty text was saved';
  exception when invalid_parameter_value then null;
  end;
  -- 2. an editor sees the plan but cannot approve
  select count(*) into n from public.plan_posts('71000000-0000-0000-0000-000000000004') where scheduled_for > now() + interval '2 hours' and scheduled_for < now() + interval '26 hours + 2 hours';
  if n <> 2 then raise exception '2: expected both channels planned within a day, got %', n; end if;
  begin
    perform public.approve_episode('71000000-0000-0000-0000-000000000004');
    raise exception '2: an editor approved';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 3. a viewer can read but not edit
select set_config('request.jwt.claims', '{"sub":"70000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.piece_versions where piece_id = '71000000-0000-0000-0000-000000000010';
  if n <> 2 then raise exception '3: viewer sees % versions', n; end if;
  begin
    perform public.save_piece('71000000-0000-0000-0000-000000000011', 'Viewer text', 'person');
    raise exception '3: a viewer edited';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 4. the owner approves once: one scheduled post per channel at the planned slot, the episode moves on
select set_config('request.jwt.claims', '{"sub":"70000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
do $$
declare n int; st text; ti text;
begin
  n := public.approve_episode('71000000-0000-0000-0000-000000000004');
  if n <> 2 then raise exception '4: expected 2 posts scheduled, got %', n; end if;
  select state, title into st, ti from public.episodes where id = '71000000-0000-0000-0000-000000000004';
  if st <> 'approved' or ti <> 'The watch my grandmother gave me' then raise exception '4: episode is % / %', st, ti; end if;
  select count(distinct idempotency_key) into n from public.posts where episode_id = '71000000-0000-0000-0000-000000000004' and status = 'scheduled';
  if n <> 2 then raise exception '4: expected 2 distinct idempotency keys, got %', n; end if;
  n := public.approve_episode('71000000-0000-0000-0000-000000000004');
  if n <> 0 then raise exception '4: approving twice scheduled % more', n; end if;
  select count(*) into n from public.plan_posts('71000000-0000-0000-0000-000000000004') p join public.posts po on po.channel_id = p.channel_id and po.scheduled_for = p.scheduled_for;
  if n <> 2 then raise exception '4: the plan no longer matches the scheduled posts'; end if;
end $$;

select 'review: all 4 checks passed' as result;
rollback;
