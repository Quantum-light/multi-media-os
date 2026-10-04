-- Tenant isolation test (anti-clunk: tested, not assumed).
-- Creates two workspaces with one member each, then proves each member sees
-- only their own rows. Runs inside a transaction and always rolls back.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

insert into public.workspaces (id, name, slug) values
  ('10000000-0000-0000-0000-00000000000a', 'Workspace A', 'test-a'),
  ('10000000-0000-0000-0000-00000000000b', 'Workspace B', 'test-b');

insert into public.members (workspace_id, user_id, role) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'owner'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'viewer');

insert into public.brands (workspace_id, name, slug, brand_kit) values
  ('10000000-0000-0000-0000-00000000000a', 'Brand A', 'brand-a', '{}'),
  ('10000000-0000-0000-0000-00000000000b', 'Brand B', 'brand-b', '{}');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

do $$ begin
  if (select count(*) from public.brands) <> 1 then raise exception 'A sees % brands, expected 1', (select count(*) from public.brands); end if;
  if exists (select 1 from public.brands where slug = 'brand-b') then raise exception 'A can see workspace B'; end if;
end $$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

do $$ begin
  if (select count(*) from public.brands) <> 1 then raise exception 'B sees % brands, expected 1', (select count(*) from public.brands); end if;
  begin
    insert into public.brands (workspace_id, name, slug, brand_kit) values ('10000000-0000-0000-0000-00000000000b', 'Nope', 'nope', '{}');
    raise exception 'viewer B was allowed to write';
  exception when insufficient_privilege then null;
  end;
end $$;

select 'tenant isolation: passed' as result;
rollback;
