-- packages/db/tests/one_loop.sql
-- Proves there is one record of a correction (0018): every correction a person
-- makes lands in public.style_edits, with the style that produced the thing
-- when something claims it, and the voice kit reads the same rows. Rolls back.
begin;

insert into auth.users (id, email) values
  ('80000000-0000-0000-0000-00000000000a', 'editor@oneloop.test'),
  ('80000000-0000-0000-0000-00000000000b', 'viewer@oneloop.test');
insert into public.workspaces (id, name, slug) values ('81000000-0000-0000-0000-000000000001', 'One loop test', 'one-loop-test');
insert into public.members (workspace_id, user_id, role) values
  ('81000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-00000000000a', 'editor'),
  ('81000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-00000000000b', 'viewer');
insert into public.brands (id, workspace_id, name, slug, brand_kit)
  values ('81000000-0000-0000-0000-000000000002', '81000000-0000-0000-0000-000000000001', 'B', 'b', '{}');
insert into public.shows (id, workspace_id, brand_id, name, slug, kind, theme, slots)
  values ('81000000-0000-0000-0000-000000000003', '81000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000002', 'Show', 's', 'video', '{}', '[]'::jsonb);
insert into public.episodes (id, workspace_id, show_id, state)
  values ('81000000-0000-0000-0000-000000000004', '81000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000003', 'review');
insert into public.pieces (id, workspace_id, episode_id, kind, platform, body) values
  ('81000000-0000-0000-0000-000000000010', '81000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000004', 'title', '', 'Draft title'),
  ('81000000-0000-0000-0000-000000000011', '81000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000004', 'caption', 'instagram', 'Draft caption');
insert into public.piece_versions (workspace_id, piece_id, version, body, author) values
  ('81000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000010', 1, 'Draft title', 'agent'),
  ('81000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000011', 1, 'Draft caption', 'agent');
insert into public.styles (id, workspace_id, brand_id, slug, name, prompt)
  values ('81000000-0000-0000-0000-000000000020', '81000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000002', 'how-i-title', 'How I title', 'Short, no colon.');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"80000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

do $$
declare v int; n int; e public.style_edits;
begin
  -- 1. an edit to copy is saved as a version and recorded once as a correction
  v := public.save_piece_edit('81000000-0000-0000-0000-000000000010', '  The watch my grandmother gave me ', 'person', 'no colons');
  if v <> 2 then raise exception '1 FAIL: expected version 2, got %', v; end if;
  select count(*) into n from public.style_edits where episode_id = '81000000-0000-0000-0000-000000000004';
  if n <> 1 then raise exception '1 FAIL: expected one correction, found %', n; end if;
  select * into e from public.style_edits where episode_id = '81000000-0000-0000-0000-000000000004';
  if e.subject <> 'copy' then raise exception '1 FAIL: subject is %', e.subject; end if;
  if e.proposed ->> 'body' <> 'Draft title' then raise exception '1 FAIL: proposed is %', e.proposed ->> 'body'; end if;
  if e.accepted ->> 'body' <> 'The watch my grandmother gave me' then raise exception '1 FAIL: accepted is %', e.accepted ->> 'body'; end if;
  if e.accepted ->> 'kind' <> 'title' then raise exception '1 FAIL: kind is %', e.accepted ->> 'kind'; end if;
  if e.note <> 'no colons' then raise exception '1 FAIL: the note was not kept'; end if;
  if e.created_by <> '80000000-0000-0000-0000-00000000000a' then raise exception '1 FAIL: the wrong person is recorded'; end if;
  if e.folded_into is not null then raise exception '1 FAIL: a new correction is already folded in'; end if;
  -- nothing claims the title style yet, so the correction waits without one
  if e.style_id is not null then raise exception '1 FAIL: a style was claimed that nothing claims'; end if;

  -- 2. saving the same text again changes nothing and records nothing
  v := public.save_piece_edit('81000000-0000-0000-0000-000000000010', 'The watch my grandmother gave me', 'person');
  if v <> 2 then raise exception '2 FAIL: the same text made version %', v; end if;
  select count(*) into n from public.style_edits where episode_id = '81000000-0000-0000-0000-000000000004';
  if n <> 1 then raise exception '2 FAIL: the same text recorded a second correction'; end if;

  -- 3. a correction to something that is not copy goes through the same door
  if public.record_correction('81000000-0000-0000-0000-000000000004', 'cut',
       '{"startS":4}'::jsonb, '{"startS":7}'::jsonb, 'let her finish the breath') is null then
    raise exception '3 FAIL: the cut correction was not recorded';
  end if;
  select count(*) into n from public.style_edits
   where episode_id = '81000000-0000-0000-0000-000000000004' and subject = 'cut' and note = 'let her finish the breath';
  if n <> 1 then raise exception '3 FAIL: expected one cut correction, found %', n; end if;
  -- a correction that changed nothing is not a correction
  if public.record_correction('81000000-0000-0000-0000-000000000004', 'clip',
       '{"rank":1}'::jsonb, '{"rank":1}'::jsonb) is not null then
    raise exception '3 FAIL: an unchanged clip was recorded as a correction';
  end if;

  -- 4. a kind of correction the record does not know is refused
  begin
    perform public.record_correction('81000000-0000-0000-0000-000000000004', 'vibes', '{}'::jsonb, '{"a":1}'::jsonb);
    raise exception '4 FAIL: an unknown subject was accepted';
  exception when invalid_parameter_value then null;
  end;
end $$;

-- The write step claims the style it used. Only the worker writes jobs, so this
-- row goes in with the role the test started as.
reset role;
insert into public.jobs (workspace_id, episode_id, step, input_hash, status, output)
values ('81000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000004', 'write', 'h1', 'succeeded',
        '{"styleId":"81000000-0000-0000-0000-000000000020"}'::jsonb);
set local role authenticated;

do $$
declare v int; n int; st uuid; b text; a text;
begin
  -- 5. the correction is recorded against the style that claims the thing
  v := public.save_piece_edit('81000000-0000-0000-0000-000000000011', 'The watch, and what she said about it', 'person');
  if v <> 2 then raise exception '5 FAIL: expected version 2, got %', v; end if;
  select style_id into st from public.style_edits
   where episode_id = '81000000-0000-0000-0000-000000000004' and accepted ->> 'kind' = 'caption';
  if st <> '81000000-0000-0000-0000-000000000020' then
    raise exception '5 FAIL: the correction was not recorded against the style that wrote the piece';
  end if;

  -- 6. the voice kit reads the copy corrections from the same rows
  select count(*) into n from public.voice_lesson_feed where brand_id = '81000000-0000-0000-0000-000000000002';
  if n <> 2 then raise exception '6 FAIL: expected two voice lessons in the feed, found %', n; end if;
  select before, after into b, a from public.voice_lesson_feed where piece_kind = 'caption';
  if b <> 'Draft caption' or a <> 'The watch, and what she said about it' then
    raise exception '6 FAIL: the feed reads % to %', b, a;
  end if;
  select count(*) into n from public.voice_lesson_feed where piece_kind = 'caption' and platform = 'instagram';
  if n <> 1 then raise exception '6 FAIL: the feed lost the platform'; end if;
  select count(*) into n from public.voice_lesson_feed where piece_kind = 'title' and platform is null;
  if n <> 1 then raise exception '6 FAIL: a piece that belongs to the episode has a platform'; end if;
end $$;

-- 7. someone who may read but not edit records nothing
select set_config('request.jwt.claims', '{"sub":"80000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
do $$
declare n int;
begin
  begin
    perform public.record_correction('81000000-0000-0000-0000-000000000004', 'cut', '{"startS":1}'::jsonb, '{"startS":2}'::jsonb);
    raise exception '7 FAIL: a viewer recorded a correction';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.save_piece_edit('81000000-0000-0000-0000-000000000010', 'Viewer text', 'person');
    raise exception '7 FAIL: a viewer edited a piece';
  exception when insufficient_privilege then null;
  end;
  select count(*) into n from public.style_edits where episode_id = '81000000-0000-0000-0000-000000000004';
  if n <> 3 then raise exception '7 FAIL: expected three corrections, found %', n; end if;
end $$;

select 'one loop: all 7 checks passed' as result;
rollback;
