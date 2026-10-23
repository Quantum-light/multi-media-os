-- 0018_one_loop.sql
-- One record of a correction.
--
-- Until now the same fact was written twice: `voice_lessons` (0013) kept a
-- before and after for written pieces, and `style_edits` (0012) was built to
-- keep a correction of anything — a cut, a piece of copy, a clip, a graphic, a
-- posting time — against the style that produced it. Two half-records teach
-- nothing: the distil step reads `style_edits`, so a correction recorded only
-- as a voice lesson is a correction the loop can never learn from.
--
-- From here `public.style_edits` is the one record. Every correction a person
-- makes in Review lands there through `private.record_correction`, which is the
-- only insert into that table and the one place a new kind of correction is
-- added. `voice_lessons` becomes a reading of the same rows
-- (`public.voice_lesson_feed`), not a second record of them.
--
-- `public.save_piece` (0015) is not touched: it is applied and Review depends
-- on it. `public.save_piece_edit` wraps it, so the version and the correction
-- are written in one transaction. Nothing here deletes anything.

-- ---------- which style claims a thing ----------

-- The style that produced what is being corrected, or null when nothing claims
-- it yet. A step claims its style by naming it as `styleId` in the job output;
-- no step does that today, so this returns null for now and starts answering
-- the moment one does, without another function being written. This is the one
-- place that question is asked.
create or replace function private.claiming_style(p_episode uuid, p_subject text)
returns uuid language sql stable set search_path = '' as $$
  with named as materialized (
    select j.output ->> 'styleId' as style_id
    from public.jobs j
    where j.episode_id = p_episode
      and j.status = 'succeeded'
      and j.step = case p_subject
                     when 'copy' then 'write'
                     when 'cut' then 'cut'
                     when 'clip' then 'clip'
                     when 'graphic' then 'storyboard'
                     else ''
                   end
      and j.output ->> 'styleId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    order by j.created_at desc
    limit 1
  )
  select s.id from named n join public.styles s on s.id = n.style_id::uuid;
$$;
revoke execute on function private.claiming_style(uuid, text) from public, anon, authenticated;

-- ---------- the one place a correction lands ----------

-- Writes one row of public.style_edits and nothing else. The vocabulary of
-- subjects lives in that table's check constraint, so a new kind of correction
-- is added there and here it simply works.
create or replace function private.record_correction(
  p_workspace uuid,
  p_episode uuid,
  p_subject text,
  p_proposed jsonb,
  p_accepted jsonb,
  p_note text default null,
  p_style uuid default null
) returns uuid language plpgsql set search_path = '' as $$
declare v_id uuid;
begin
  insert into public.style_edits (workspace_id, style_id, episode_id, subject, proposed, accepted, note, created_by)
  values (
    p_workspace,
    coalesce(p_style, private.claiming_style(p_episode, p_subject)),
    p_episode,
    p_subject,
    coalesce(p_proposed, '{}'::jsonb),
    coalesce(p_accepted, '{}'::jsonb),
    left(coalesce(p_note, ''), 300),
    (select auth.uid())
  )
  returning id into v_id;
  return v_id;
exception when check_violation then
  raise exception 'there is no such kind of correction as %', p_subject using errcode = '22023';
end
$$;
revoke execute on function private.record_correction(uuid, uuid, text, jsonb, jsonb, text, uuid)
  from public, anon, authenticated;

-- ---------- the door from Review ----------

-- Records a correction a person made to something that is not written copy: a
-- cut, a clip, a graphic, a posting time. Copy goes through save_piece_edit
-- below, because a correction to copy is also a version of a piece.
-- Returns the new edit, or null when nothing actually changed.
create or replace function public.record_correction(
  p_episode uuid,
  p_subject text,
  p_proposed jsonb,
  p_accepted jsonb,
  p_note text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare ws uuid;
begin
  select workspace_id into ws from public.episodes where id = p_episode;
  if ws is null or not private.can_edit(ws) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_proposed is null or p_accepted is null then
    raise exception 'a correction needs what was proposed and what was accepted' using errcode = '22023';
  end if;
  if p_proposed = p_accepted then return null; end if;
  return private.record_correction(ws, p_episode, p_subject, p_proposed, p_accepted, p_note);
end
$$;
revoke execute on function public.record_correction(uuid, text, jsonb, jsonb, text) from public, anon;
grant execute on function public.record_correction(uuid, text, jsonb, jsonb, text) to authenticated;

-- Saves new text for a piece and records the correction, in one transaction.
-- public.save_piece does the saving, exactly as it already does; this adds the
-- one record. Review calls this instead of save_piece.
create or replace function public.save_piece_edit(
  p_piece uuid,
  p_body text,
  p_source text default 'person',
  p_note text default null
) returns int language plpgsql security definer set search_path = '' as $$
declare
  p public.pieces;
  v_version int;
  v_body text := btrim(coalesce(p_body, ''));
begin
  select * into p from public.pieces where id = p_piece;
  if p.id is null then raise exception 'not allowed' using errcode = '42501'; end if;

  -- save_piece checks the person's role, keeps the version and refuses text
  -- that is empty or too long. Its answer is the version that is now current.
  v_version := public.save_piece(p_piece, p_body, p_source, p_note);
  if v_body = p.body then return v_version; end if;

  perform private.record_correction(
    p.workspace_id,
    p.episode_id,
    'copy',
    jsonb_build_object('kind', p.kind, 'platform', p.platform, 'body', p.body),
    jsonb_build_object('kind', p.kind, 'platform', p.platform, 'body', v_body),
    p_note
  );
  return v_version;
end
$$;
revoke execute on function public.save_piece_edit(uuid, text, text, text) from public, anon;
grant execute on function public.save_piece_edit(uuid, text, text, text) to authenticated;

-- ---------- what the voice kit reads ----------

-- The corrections to written copy, shaped the way the voice kit wants them.
-- A reading of style_edits, not a second record of it. security_invoker keeps
-- row-level security on style_edits in force for whoever selects from it.
create or replace view public.voice_lesson_feed
with (security_invoker = true) as
  select
    se.id,
    se.workspace_id,
    s.brand_id,
    se.accepted ->> 'kind' as piece_kind,
    nullif(se.accepted ->> 'platform', '') as platform,
    se.proposed ->> 'body' as before,
    se.accepted ->> 'body' as after,
    se.note,
    se.created_at
  from public.style_edits se
  join public.episodes e on e.id = se.episode_id
  join public.shows s on s.id = e.show_id
  where se.subject = 'copy'
    and se.accepted ? 'body';

revoke all on public.voice_lesson_feed from public, anon, authenticated;
grant select on public.voice_lesson_feed to authenticated;

comment on view public.voice_lesson_feed is
  'Corrections to written copy, read from public.style_edits. The voice kit reads this.';

comment on table public.voice_lessons is
  'Superseded by public.style_edits (subject = copy); read public.voice_lesson_feed instead. public.save_piece still writes a row here, so no reader depends on it and nothing is lost. Dropping the table changes an applied function, so it waits for a person at the console.';

comment on table public.style_edits is
  'The one record of a correction a person made: the style that produced the thing (null when nothing claims it), the episode, the subject, what was proposed, what was accepted, their note. Written only by private.record_correction. Read by the distil step, which proposes a new style version and never applies one.';
