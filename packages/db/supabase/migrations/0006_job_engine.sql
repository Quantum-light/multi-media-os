-- 0006 job engine: the Postgres queue every pipeline step runs through.
-- One table (public.jobs) is both the queue and the record. Workers claim with
-- FOR UPDATE SKIP LOCKED and hold a lease; the attempt number is a fencing token,
-- so a worker that lost its lease can never complete or extend someone else's run.
-- Called only by the orchestrator over a direct database connection.

alter table public.jobs
  add column input jsonb not null default '{}'::jsonb,
  add column run_after timestamptz not null default now(),
  add constraint jobs_step_known check (step in (
    'ingest', 'transcribe', 'cut', 'understand', 'write', 'clip',
    'storyboard', 'compose', 'render', 'review', 'publish'));

create index jobs_claimable on public.jobs (run_after, created_at) where status = 'queued';
create index jobs_leased on public.jobs (lease_until) where status = 'running';

-- Enqueue is idempotent: the same episode, step and input hash is one job.
-- A succeeded job is returned as it is (its saved output is the answer);
-- a failed or cancelled one is put back in the queue with fresh attempts.
create or replace function private.enqueue_job(p_episode uuid, p_step text, p_input jsonb, p_input_hash text)
returns public.jobs language plpgsql set search_path = '' as $$
declare
  j public.jobs;
  ws uuid;
  prev text;
begin
  select workspace_id into ws from public.episodes where id = p_episode;
  if ws is null then raise exception 'episode % not found', p_episode; end if;

  insert into public.jobs (workspace_id, episode_id, step, input, input_hash)
  values (ws, p_episode, p_step, p_input, p_input_hash)
  on conflict (episode_id, step, input_hash) do nothing
  returning * into j;

  if j.id is not null then
    insert into public.job_events (workspace_id, job_id, from_status, to_status, note)
    values (j.workspace_id, j.id, null, 'queued', 'enqueued');
    return j;
  end if;

  select * into j from public.jobs
  where episode_id = p_episode and step = p_step and input_hash = p_input_hash
  for update;

  if j.status in ('failed', 'cancelled') then
    prev := j.status;
    update public.jobs
    set status = 'queued', attempts = 0, error = null, lease_until = null, run_after = now()
    where id = j.id
    returning * into j;
    insert into public.job_events (workspace_id, job_id, from_status, to_status, note)
    values (j.workspace_id, j.id, prev, 'queued', 'enqueued again');
  end if;
  return j;
end
$$;

-- Claims the next ready job (or one whose lease ran out) for the given steps.
-- Leases that ran out on the final attempt are failed first, never retried forever.
create or replace function private.claim_job(p_worker text, p_steps text[], p_lease_seconds int default 300, p_max_attempts int default 3)
returns setof public.jobs language plpgsql set search_path = '' as $$
declare
  j public.jobs;
  prev text;
begin
  with dead as (
    update public.jobs
    set status = 'failed', error = 'Lease ran out on the final attempt', lease_until = null
    where status = 'running' and lease_until < now() and attempts >= p_max_attempts
    returning id, workspace_id
  )
  insert into public.job_events (workspace_id, job_id, from_status, to_status, note)
  select workspace_id, id, 'running', 'failed', 'lease ran out on the final attempt' from dead;

  select * into j from public.jobs
  where ((status = 'queued' and run_after <= now()) or (status = 'running' and lease_until < now()))
    and step = any (p_steps)
  order by run_after, created_at
  limit 1
  for update skip locked;

  if not found then return; end if;

  prev := j.status;
  update public.jobs
  set status = 'running', attempts = attempts + 1, error = null,
      lease_until = now() + make_interval(secs => p_lease_seconds)
  where id = j.id
  returning * into j;

  insert into public.job_events (workspace_id, job_id, from_status, to_status, note)
  values (j.workspace_id, j.id, prev, 'running',
          case when prev = 'running' then 'reclaimed by ' else 'claimed by ' end || p_worker || ' (attempt ' || j.attempts || ')');
  return next j;
end
$$;

-- Extends the lease while work continues. False means the lease was lost: stop.
create or replace function private.heartbeat_job(p_job uuid, p_attempt int, p_lease_seconds int default 300)
returns boolean language plpgsql set search_path = '' as $$
begin
  update public.jobs set lease_until = now() + make_interval(secs => p_lease_seconds)
  where id = p_job and status = 'running' and attempts = p_attempt;
  return found;
end
$$;

-- Saves the output. False means the lease was lost and the output is discarded.
create or replace function private.complete_job(p_job uuid, p_attempt int, p_output jsonb, p_cost_pence int default 0)
returns boolean language plpgsql set search_path = '' as $$
declare
  ws uuid;
begin
  update public.jobs
  set status = 'succeeded', output = p_output, lease_until = null, error = null,
      cost_pence = cost_pence + greatest(p_cost_pence, 0)
  where id = p_job and status = 'running' and attempts = p_attempt
  returning workspace_id into ws;
  if ws is null then return false; end if;
  insert into public.job_events (workspace_id, job_id, from_status, to_status, note)
  values (ws, p_job, 'running', 'succeeded', null);
  return true;
end
$$;

-- Records a failure. Retryable failures go back in the queue with backoff
-- (30s, 60s, 120s ... capped at 30 minutes) until attempts run out.
-- Returns the new status, or null when the lease was already lost.
create or replace function private.fail_job(p_job uuid, p_attempt int, p_error text, p_retryable boolean default true, p_max_attempts int default 3, p_cost_pence int default 0)
returns text language plpgsql set search_path = '' as $$
declare
  j public.jobs;
  next_status text;
begin
  select * into j from public.jobs where id = p_job and status = 'running' and attempts = p_attempt for update;
  if not found then return null; end if;

  next_status := case when p_retryable and j.attempts < p_max_attempts then 'queued' else 'failed' end;
  update public.jobs
  set status = next_status, error = left(p_error, 2000), lease_until = null,
      cost_pence = cost_pence + greatest(p_cost_pence, 0),
      run_after = case when next_status = 'queued'
                       then now() + make_interval(secs => least(30 * power(2, j.attempts - 1), 1800))
                       else run_after end
  where id = p_job;

  insert into public.job_events (workspace_id, job_id, from_status, to_status, note)
  values (j.workspace_id, p_job, 'running', next_status, left(p_error, 500));
  return next_status;
end
$$;

revoke execute on function private.enqueue_job(uuid, text, jsonb, text) from public, anon, authenticated;
revoke execute on function private.claim_job(text, text[], int, int) from public, anon, authenticated;
revoke execute on function private.heartbeat_job(uuid, int, int) from public, anon, authenticated;
revoke execute on function private.complete_job(uuid, int, jsonb, int) from public, anon, authenticated;
revoke execute on function private.fail_job(uuid, int, text, boolean, int, int) from public, anon, authenticated;
