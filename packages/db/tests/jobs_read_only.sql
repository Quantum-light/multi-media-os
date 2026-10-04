-- Jobs are read-only for people (0010): an editor sees progress, cannot change it,
-- and still starts ingest through the definer function. Always rolls back.
begin;
insert into auth.users (id, email) values ('50000000-0000-0000-0000-00000000000a', 'ed@test.local');
insert into public.workspaces (id, name, slug) values ('51000000-0000-0000-0000-000000000001', 'RO test', 'ro-test');
insert into public.members (workspace_id, user_id, role) values ('51000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-00000000000a', 'editor');
insert into public.brands (id, workspace_id, name, slug, brand_kit) values ('51000000-0000-0000-0000-000000000002', '51000000-0000-0000-0000-000000000001', 'B', 'b', '{}');
insert into public.shows (id, workspace_id, brand_id, name, slug, kind, theme) values ('51000000-0000-0000-0000-000000000003', '51000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000002', 'S', 's', 'video', '{}');
insert into public.episodes (id, workspace_id, show_id, state) values ('51000000-0000-0000-0000-000000000004', '51000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000003', 'uploading');
insert into public.media_assets (id, workspace_id, episode_id, kind, r2_key, bytes) values ('51000000-0000-0000-0000-000000000005', '51000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000004', 'source', 'ws/x/s.mp4', 10);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
do $$
declare n int; jid uuid;
begin
  jid := public.start_ingest('51000000-0000-0000-0000-000000000004');
  select count(*) into n from public.jobs where id = jid;
  if n <> 1 then raise exception '1: editor cannot read the job'; end if;
  select count(*) into n from public.job_events where job_id = jid;
  if n <> 1 then raise exception '1: editor cannot read job events'; end if;
  begin
    insert into public.jobs (workspace_id, episode_id, step, input_hash) values ('51000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000004', 'cut', 'x');
    raise exception '2: editor inserted a job';
  exception when insufficient_privilege then null;
  end;
  update public.jobs set status = 'succeeded' where id = jid;
  if found then raise exception '3: editor updated a job'; end if;
  begin
    insert into public.job_events (workspace_id, job_id, to_status) values ('51000000-0000-0000-0000-000000000001', jid, 'x');
    raise exception '4: editor inserted an event';
  exception when insufficient_privilege then null;
  end;
  -- Delete is checked by its policy text (a delete statement would wait for a console confirmation).
  select count(*) into n from pg_policy where polrelid in ('public.jobs'::regclass, 'public.job_events'::regclass) and polcmd = 'd' and pg_get_expr(polqual, polrelid) = 'false';
  if n <> 2 then raise exception '5: delete policies are not closed (%)', n; end if;
end $$;
select 'jobs read-only: all 5 checks passed' as result;
rollback;
