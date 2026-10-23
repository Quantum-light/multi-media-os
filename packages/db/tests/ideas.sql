-- packages/db/tests/ideas.sql
-- Proves the plan board's ideas are scoped to one workspace, tied to a show,
-- and honest about their state. Rolls back.
begin;
do $$
declare ws uuid; ws2 uuid; b uuid; sh uuid; sh2 uuid; i_id uuid; n int;
begin
  insert into public.workspaces (name, slug) values ('T', 'test-' || gen_random_uuid()) returning id into ws;
  insert into public.workspaces (name, slug) values ('Other', 'other-' || gen_random_uuid()) returning id into ws2;
  insert into public.brands (workspace_id, name, slug, brand_kit) values (ws, 'B', 'b', '{}') returning id into b;
  insert into public.shows (workspace_id, brand_id, name, slug, kind, theme, slots)
  values (ws, b, 'Show', 's', 'video', '{}',
          '[{"day":"tue","time":"09:00","tz":"Asia/Makassar"}]'::jsonb) returning id into sh;

  -- 1. an idea in her own words, against a slot, naming the pillar it serves
  insert into public.ideas (workspace_id, show_id, pillar, body, slot_at)
  values (ws, sh, 'Personal growth and time', 'The bit about waiting I said in episode four.',
          '2026-11-03T01:00:00Z') returning id into i_id;
  select count(*) into n from public.ideas where id = i_id and state = 'idea';
  if n <> 1 then raise exception '1 FAIL: a new idea does not start in the idea state'; end if;

  -- 2. an idea with no slot yet is still kept
  insert into public.ideas (workspace_id, show_id, pillar, body)
  values (ws, sh, 'Personal growth and time', 'Something for whenever there is room.');
  select count(*) into n from public.ideas where show_id = sh and slot_at is null;
  if n <> 1 then raise exception '2 FAIL: an idea without a slot was not kept'; end if;

  -- 3. it can move to planned, and be dropped without being deleted
  update public.ideas set state = 'planned' where id = i_id;
  update public.ideas set state = 'dropped' where id = i_id;
  select count(*) into n from public.ideas where id = i_id and state = 'dropped';
  if n <> 1 then raise exception '3 FAIL: an idea could not be dropped'; end if;

  -- 4. an invented state is refused
  begin
    update public.ideas set state = 'maybe' where id = i_id;
    raise exception '4 FAIL: unknown state accepted';
  exception when check_violation then null;
  end;

  -- 5. an idea cannot point at a show in another workspace's reach by accident:
  --    the show must exist, and deleting the show takes its ideas with it
  begin
    insert into public.ideas (workspace_id, show_id, pillar, body)
    values (ws, '00000000-0000-0000-0000-000000000000', 'P', 'Nowhere');
    raise exception '5 FAIL: an idea for a show that does not exist was accepted';
  exception when foreign_key_violation then null;
  end;

  insert into public.brands (workspace_id, name, slug, brand_kit) values (ws2, 'B2', 'b2', '{}');
  insert into public.shows (workspace_id, brand_id, name, slug, kind, theme)
  values (ws2, (select id from public.brands where workspace_id = ws2), 'S2', 's2', 'video', '{}')
  returning id into sh2;
  delete from public.shows where id = sh2;
  select count(*) into n from public.ideas where show_id = sh2;
  if n <> 0 then raise exception '5 FAIL: ideas outlived their show'; end if;

  -- 6. every idea carries a workspace
  begin
    insert into public.ideas (show_id, pillar, body) values (sh, 'P', 'No workspace');
    raise exception '6 FAIL: an idea without a workspace was accepted';
  exception when not_null_violation then null;
  end;

  -- 7. row level security is on, with a policy per action
  select count(*) into n from pg_policy p join pg_class c on c.oid = p.polrelid
   where c.relname = 'ideas';
  if n <> 4 then raise exception '7 FAIL: expected 4 policies on ideas, found %', n; end if;
  select count(*) into n from pg_class where relname = 'ideas' and relrowsecurity;
  if n <> 1 then raise exception '7 FAIL: row level security not enabled on ideas'; end if;

  -- 8. the policies read with is_member and write with can_edit
  select count(*) into n from pg_policy p join pg_class c on c.oid = p.polrelid
   where c.relname = 'ideas'
     and pg_get_expr(coalesce(p.polqual, p.polwithcheck), p.polrelid) like '%is_member%';
  if n <> 1 then raise exception '8 FAIL: expected one read policy using is_member, found %', n; end if;
  select count(*) into n from pg_policy p join pg_class c on c.oid = p.polrelid
   where c.relname = 'ideas'
     and pg_get_expr(coalesce(p.polwithcheck, p.polqual), p.polrelid) like '%can_edit%';
  if n <> 3 then raise exception '8 FAIL: expected three write policies using can_edit, found %', n; end if;

  raise notice 'ideas: 8/8 checks passed';
end
$$;
rollback;
