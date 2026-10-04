-- Job engine test: enqueue, claim, lease, fencing, retry with backoff, final failure.
-- Runs inside a transaction and always rolls back. now() is fixed inside a
-- transaction, so time passing is simulated by moving lease_until and run_after.
begin;

insert into public.workspaces (id, name, slug) values ('20000000-0000-0000-0000-000000000001', 'Job test', 'job-test');
insert into public.brands (id, workspace_id, name, slug, brand_kit) values
  ('20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'B', 'b', '{}');
insert into public.shows (id, workspace_id, brand_id, name, slug, kind, theme) values
  ('20000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'S', 's', 'video', '{}');
insert into public.episodes (id, workspace_id, show_id) values
  ('20000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003');

do $$
declare
  ep constant uuid := '20000000-0000-0000-0000-000000000004';
  a public.jobs; b public.jobs; c public.jobs;
  st text; n int;
begin
  -- 1. enqueue is idempotent
  a := private.enqueue_job(ep, 'transcribe', '{"lang":"en"}', 'hash-aaaaaaaaaaaaaaaa');
  b := private.enqueue_job(ep, 'transcribe', '{"lang":"en"}', 'hash-aaaaaaaaaaaaaaaa');
  if a.id <> b.id then raise exception '1: same input made two jobs'; end if;
  if a.status <> 'queued' then raise exception '1: new job is %', a.status; end if;

  -- 2. unknown steps are refused
  begin
    perform private.enqueue_job(ep, 'dance', '{}', 'hash-bbbbbbbbbbbbbbbb');
    raise exception '2: unknown step accepted';
  exception when check_violation then null;
  end;

  -- 3. claim only for steps the worker handles
  select * into c from private.claim_job('w1', array['render']);
  if c.id is not null then raise exception '3: claimed a step the worker does not handle'; end if;

  -- 4. claim takes the lease; a second worker gets nothing
  select * into c from private.claim_job('w1', array['transcribe'], 60);
  if c.id <> a.id or c.status <> 'running' or c.attempts <> 1 then raise exception '4: bad claim %', row_to_json(c); end if;
  select * into b from private.claim_job('w2', array['transcribe'], 60);
  if b.id is not null then raise exception '4: two workers hold one job'; end if;

  -- 5. fencing: a wrong attempt number cannot heartbeat or complete
  if private.heartbeat_job(a.id, 99) then raise exception '5: stale heartbeat accepted'; end if;
  if private.complete_job(a.id, 99, '{}') then raise exception '5: stale completion accepted'; end if;
  if not private.heartbeat_job(a.id, 1, 60) then raise exception '5: real heartbeat refused'; end if;

  -- 6. retryable failure goes back to the queue with backoff, not straight away
  st := private.fail_job(a.id, 1, 'provider timed out');
  if st <> 'queued' then raise exception '6: expected queued, got %', st; end if;
  select * into c from private.claim_job('w1', array['transcribe']);
  if c.id is not null then raise exception '6: backoff ignored'; end if;
  update public.jobs set run_after = now() where id = a.id;

  -- 7. second attempt; its lease runs out; a third worker reclaims it
  select * into c from private.claim_job('w1', array['transcribe']);
  if c.attempts <> 2 then raise exception '7: expected attempt 2, got %', c.attempts; end if;
  update public.jobs set lease_until = now() - interval '1 second' where id = a.id;
  select * into c from private.claim_job('w3', array['transcribe']);
  if c.id <> a.id or c.attempts <> 3 then raise exception '7: expired lease not reclaimed %', row_to_json(c); end if;

  -- 8. the old worker (attempt 2) cannot complete; the current one can
  if private.complete_job(a.id, 2, '{"text":"stale"}') then raise exception '8: lost lease completed'; end if;
  if not private.complete_job(a.id, 3, '{"text":"hello"}', 12) then raise exception '8: completion refused'; end if;
  select * into c from public.jobs where id = a.id;
  if c.status <> 'succeeded' or c.output ->> 'text' <> 'hello' or c.cost_pence <> 12 then raise exception '8: bad final row %', row_to_json(c); end if;

  -- 9. enqueueing the same input again returns the saved result, no new work
  b := private.enqueue_job(ep, 'transcribe', '{"lang":"en"}', 'hash-aaaaaaaaaaaaaaaa');
  if b.status <> 'succeeded' or b.id <> a.id then raise exception '9: finished work redone'; end if;

  -- 10. non-retryable failure stops at once; enqueue again revives it
  a := private.enqueue_job(ep, 'cut', '{}', 'hash-cccccccccccccccc');
  select * into c from private.claim_job('w1', array['cut']);
  st := private.fail_job(c.id, 1, 'input does not match contract', false);
  if st <> 'failed' then raise exception '10: non-retryable was %', st; end if;
  if private.fail_job(c.id, 1, 'again') is not null then raise exception '10: failed twice'; end if;
  b := private.enqueue_job(ep, 'cut', '{}', 'hash-cccccccccccccccc');
  if b.status <> 'queued' or b.attempts <> 0 then raise exception '10: not revived %', row_to_json(b); end if;

  -- 11. a lease that runs out on the final attempt fails instead of looping
  update public.jobs set status = 'running', attempts = 3, lease_until = now() - interval '1 second' where id = b.id;
  select * into c from private.claim_job('w1', array['cut']);
  if c.id is not null then raise exception '11: exhausted job claimed again'; end if;
  select * into c from public.jobs where id = b.id;
  if c.status <> 'failed' then raise exception '11: exhausted job is %', c.status; end if;

  -- 12. every transition left an event
  select count(*) into n from public.job_events e join public.jobs j on j.id = e.job_id where j.episode_id = ep and j.step = 'transcribe';
  if n <> 6 then raise exception '12: expected 6 events for the transcribe job, got %', n; end if;

end $$;

select 'job engine: all 12 checks passed' as result;
rollback;
