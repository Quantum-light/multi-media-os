-- start_ingest test: an editor's upload becomes exactly one ingest job; viewers and
-- outsiders are refused. Runs the upload inserts through row-level security as the
-- editor, the way the Studio does. Always rolls back.
begin;

insert into auth.users (id, email) values
  ('30000000-0000-0000-0000-00000000000a', 'editor@test.local'),
  ('30000000-0000-0000-0000-00000000000b', 'viewer@test.local'),
  ('30000000-0000-0000-0000-00000000000c', 'outsider@test.local');
insert into public.workspaces (id, name, slug) values ('31000000-0000-0000-0000-000000000001', 'Ingest test', 'ingest-test');
insert into public.members (workspace_id, user_id, role) values
  ('31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-00000000000a', 'editor'),
  ('31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-00000000000b', 'viewer');
insert into public.brands (id, workspace_id, name, slug, brand_kit) values
  ('31000000-0000-0000-0000-000000000002', '31000000-0000-0000-0000-000000000001', 'B', 'b', '{}');
insert into public.shows (id, workspace_id, brand_id, name, slug, kind, theme) values
  ('31000000-0000-0000-0000-000000000003', '31000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000002', 'S', 's', 'video', '{}');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

-- The editor creates the episode and its source asset through RLS, as the upload API does.
insert into public.episodes (id, workspace_id, show_id, title, state) values
  ('31000000-0000-0000-0000-000000000004', '31000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000003', 'Raw take', 'uploading');
insert into public.media_assets (id, workspace_id, episode_id, kind, r2_key, bytes, quick_fingerprint) values
  ('31000000-0000-0000-0000-000000000005', '31000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000004',
   'source', 'ws/31000000-0000-0000-0000-000000000001/episodes/31000000-0000-0000-0000-000000000004/source/raw.mp4', 2300000000, 'qf1:abc');

do $$
declare j1 uuid; j2 uuid; st text; n int;
begin
  j1 := public.start_ingest('31000000-0000-0000-0000-000000000004');
  j2 := public.start_ingest('31000000-0000-0000-0000-000000000004');
  if j1 is null or j1 <> j2 then raise exception '1: two calls made two jobs'; end if;
  select state into st from public.episodes where id = '31000000-0000-0000-0000-000000000004';
  if st <> 'ingesting' then raise exception '2: episode is %', st; end if;
  select count(*) into n from public.jobs where episode_id = '31000000-0000-0000-0000-000000000004' and step = 'ingest' and status = 'queued'
    and input ->> 'key' like 'ws/31000000-0000-0000-0000-000000000001/%' and (input ->> 'bytes')::bigint = 2300000000;
  if n <> 1 then raise exception '3: expected one queued ingest job with the source input, got %', n; end if;
end $$;

select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
do $$ begin
  perform public.start_ingest('31000000-0000-0000-0000-000000000004');
  raise exception '4: a viewer started ingest';
exception when insufficient_privilege then null;
end $$;

select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
do $$ begin
  perform public.start_ingest('31000000-0000-0000-0000-000000000004');
  raise exception '5: an outsider started ingest';
exception when insufficient_privilege then null;
end $$;

reset role;
do $$ begin
  if has_function_privilege('anon', 'public.start_ingest(uuid)', 'execute') then raise exception '6: anon can call start_ingest'; end if;
end $$;

select 'start_ingest: all 6 checks passed' as result;
rollback;
