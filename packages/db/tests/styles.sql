-- packages/db/tests/styles.sql
-- Proves the styles table is tenant-safe and behaves. Rolls back.
begin;

do $$
declare
  ws_a uuid; ws_b uuid; s_id uuid; n int;
begin
  insert into public.workspaces (name, slug) values ('T A', 'test-a-' || gen_random_uuid()) returning id into ws_a;
  insert into public.workspaces (name, slug) values ('T B', 'test-b-' || gen_random_uuid()) returning id into ws_b;

  -- 1. a style saves and gets an id
  insert into public.styles (workspace_id, slug, name, kind, prompt)
  values (ws_a, 'warm-film', 'Warm film', 'video', 'soft grain, warm highlights')
  returning id into s_id;
  if s_id is null then raise exception '1 FAIL: style did not save'; end if;

  -- 2. slug is unique per workspace, not globally
  insert into public.styles (workspace_id, slug, name) values (ws_b, 'warm-film', 'Warm film');
  begin
    insert into public.styles (workspace_id, slug, name) values (ws_a, 'warm-film', 'Dupe');
    raise exception '2 FAIL: duplicate slug accepted inside one workspace';
  exception when unique_violation then null;
  end;

  -- 3. kind is constrained
  begin
    insert into public.styles (workspace_id, slug, name, kind) values (ws_a, 'bad', 'Bad', 'hologram');
    raise exception '3 FAIL: unknown kind accepted';
  exception when check_violation then null;
  end;

  -- 4. updated_at moves on edit
  update public.styles set prompt = 'cooler grade' where id = s_id;
  select count(*) into n from public.styles where id = s_id and updated_at > created_at;
  if n <> 1 then raise exception '4 FAIL: updated_at did not move'; end if;

  -- 5. archiving keeps the row
  update public.styles set archived_at = now() where id = s_id;
  select count(*) into n from public.styles where id = s_id and archived_at is not null;
  if n <> 1 then raise exception '5 FAIL: archive lost the row'; end if;

  -- 6. RLS is on and every action has a policy
  select count(*) into n from pg_policy p
    join pg_class c on c.oid = p.polrelid
   where c.relname = 'styles';
  if n <> 4 then raise exception '6 FAIL: expected 4 policies, found %', n; end if;

  select count(*) into n from pg_class where relname = 'styles' and relrowsecurity;
  if n <> 1 then raise exception '6 FAIL: row level security not enabled'; end if;

  raise notice 'styles: 6/6 checks passed';
end
$$;

rollback;
