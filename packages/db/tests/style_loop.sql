-- packages/db/tests/style_loop.sql
-- Proves styles keep their history and corrections are recorded. Rolls back.
begin;
do $$
declare ws uuid; s_id uuid; n int; v1 uuid;
begin
  insert into public.workspaces (name, slug) values ('T', 'test-' || gen_random_uuid()) returning id into ws;

  -- 1. saving a style records version 1 on its own
  insert into public.styles (workspace_id, slug, name, prompt)
  values (ws, 'how-i-open', 'How I open', 'Hold two beats.') returning id into s_id;
  select count(*) into n from public.style_versions where style_id = s_id;
  if n <> 1 then raise exception '1 FAIL: expected one version after insert, found %', n; end if;

  -- 2. renaming is not a change of style, so it makes no version
  update public.styles set name = 'How I open an episode' where id = s_id;
  select count(*) into n from public.style_versions where style_id = s_id;
  if n <> 1 then raise exception '2 FAIL: a rename made a version'; end if;

  -- 3. changing the instruction does
  update public.styles set prompt = 'Hold three beats.' where id = s_id;
  select count(*) into n from public.style_versions where style_id = s_id;
  if n <> 2 then raise exception '3 FAIL: expected two versions, found %', n; end if;

  -- 4. so does changing the never-do list or the recipe
  update public.styles set never_do = array['no zoom'] where id = s_id;
  update public.styles set recipe = '{"pace":"slow"}'::jsonb where id = s_id;
  select count(*) into n from public.style_versions where style_id = s_id;
  if n <> 4 then raise exception '4 FAIL: expected four versions, found %', n; end if;

  -- 5. versions are numbered in order and carry the words of that version
  select count(*) into n from public.style_versions where style_id = s_id and version = 4 and prompt = 'Hold three beats.';
  if n <> 1 then raise exception '5 FAIL: version 4 does not hold the current instruction'; end if;

  -- 6. a correction can be recorded and later marked as folded in
  select id into v1 from public.style_versions where style_id = s_id and version = 1;
  insert into public.style_edits (workspace_id, style_id, subject, proposed, accepted, note)
  values (ws, s_id, 'cut', '{"startS":4}'::jsonb, '{"startS":7}'::jsonb, 'later');
  select count(*) into n from public.style_edits where style_id = s_id and folded_into is null;
  if n <> 1 then raise exception '6 FAIL: the correction was not waiting to be learned'; end if;
  update public.style_edits set folded_into = v1 where style_id = s_id;
  select count(*) into n from public.style_edits where style_id = s_id and folded_into is null;
  if n <> 0 then raise exception '6 FAIL: the correction did not fold in'; end if;

  -- 7. an unknown subject is refused
  begin
    insert into public.style_edits (workspace_id, style_id, subject, proposed, accepted)
    values (ws, s_id, 'vibes', '{}'::jsonb, '{}'::jsonb);
    raise exception '7 FAIL: unknown subject accepted';
  exception when check_violation then null;
  end;

  -- 8. both tables carry row level security with a policy per action
  select count(*) into n from pg_policy p join pg_class c on c.oid = p.polrelid
   where c.relname in ('style_versions','style_edits');
  if n <> 8 then raise exception '8 FAIL: expected 8 policies, found %', n; end if;
  select count(*) into n from pg_class where relname in ('style_versions','style_edits') and relrowsecurity;
  if n <> 2 then raise exception '8 FAIL: row level security not enabled on both'; end if;

  raise notice 'style loop: 8/8 checks passed';
end
$$;
rollback;
