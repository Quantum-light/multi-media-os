-- 0008 pipeline chaining: a finished step starts the next one, in SQL, so no worker
-- needs to know the order. Ingest also records what it learned about the recording.
-- The chain runs to the Review gate and stops; approval (M5) starts compose → render → publish.

-- Things Review should know about an episode, e.g. 'duplicate_of:<episode id>'.
alter table public.episodes add column flags text[] not null default '{}';

-- The order every episode runs through. Podcasts skip the video-only steps.
create or replace function private.step_sequence(p_kind text)
returns text[] language sql immutable set search_path = '' as $$
  select case when p_kind = 'podcast'
    then array['ingest','transcribe','cut','understand','write','compose','render','publish']
    else array['ingest','transcribe','cut','understand','write','clip','storyboard','compose','render','publish']
  end
$$;

-- Steps that run on their own after upload. Everything from compose on waits for a person.
create or replace function private.is_auto_step(p_step text)
returns boolean language sql immutable set search_path = '' as $$
  select p_step in ('ingest','transcribe','cut','understand','write','clip','storyboard')
$$;

-- What ingest learned: checksum and duration on the source, the derived files as assets,
-- and a flag if the same recording already exists in this workspace.
create or replace function private.record_ingest(p_job public.jobs)
returns void language plpgsql set search_path = '' as $$
declare
  src_id uuid := (p_job.input ->> 'assetId')::uuid;
  sha text := p_job.output ->> 'sha256';
  dur numeric := (p_job.output ->> 'durationS')::numeric;
  twin uuid;
begin
  update public.media_assets set sha256 = sha, duration_s = dur where id = src_id;

  insert into public.media_assets (workspace_id, episode_id, kind, r2_key, duration_s)
  values (p_job.workspace_id, p_job.episode_id, 'audio', p_job.output ->> 'audioKey', dur)
  on conflict do nothing;

  if p_job.output ->> 'proxyKey' is not null then
    insert into public.media_assets (workspace_id, episode_id, kind, r2_key, duration_s)
    values (p_job.workspace_id, p_job.episode_id, 'edit', p_job.output ->> 'proxyKey', dur)
    on conflict do nothing;
  end if;

  select a.episode_id into twin from public.media_assets a
  where a.workspace_id = p_job.workspace_id and a.kind = 'source' and a.sha256 = sha
    and a.episode_id is not null and a.episode_id <> p_job.episode_id
  order by a.created_at limit 1;
  if twin is not null then
    insert into public.job_events (workspace_id, job_id, from_status, to_status, note)
    values (p_job.workspace_id, p_job.id, 'succeeded', 'succeeded', 'duplicate of episode ' || twin::text);
    update public.episodes set flags = array_append(flags, 'duplicate_of:' || twin::text)
    where id = p_job.episode_id and not ('duplicate_of:' || twin::text) = any (flags);
  end if;
end
$$;

-- After a success: enqueue the next automatic step with this step's output as its input,
-- or hand the episode to Review when the automatic steps are done.
create or replace function private.advance_episode(p_job public.jobs)
returns void language plpgsql set search_path = '' as $$
declare
  kind text;
  seq text[];
  pos int;
  nxt text;
begin
  select s.kind into kind from public.episodes e join public.shows s on s.id = e.show_id where e.id = p_job.episode_id;
  if kind is null then return; end if;

  if p_job.step = 'ingest' then
    perform private.record_ingest(p_job);
    update public.episodes set state = 'processing' where id = p_job.episode_id and state in ('uploading', 'ingesting');
  end if;

  seq := private.step_sequence(kind);
  pos := array_position(seq, p_job.step);
  if pos is null or pos >= array_length(seq, 1) then return; end if;
  nxt := seq[pos + 1];

  if private.is_auto_step(nxt) then
    perform private.enqueue_job(p_job.episode_id, nxt, p_job.output, nxt || ':' || md5(p_job.output::text));
  elsif private.is_auto_step(p_job.step) then
    update public.episodes set state = 'review' where id = p_job.episode_id and state = 'processing';
  end if;
end
$$;

-- complete_job now advances the episode in the same transaction: a success and its
-- consequence can never be separated by a crash.
create or replace function private.complete_job(p_job uuid, p_attempt int, p_output jsonb, p_cost_pence int default 0)
returns boolean language plpgsql set search_path = '' as $$
declare
  j public.jobs;
begin
  update public.jobs
  set status = 'succeeded', output = p_output, lease_until = null, error = null,
      cost_pence = cost_pence + greatest(p_cost_pence, 0)
  where id = p_job and status = 'running' and attempts = p_attempt
  returning * into j;
  if j.id is null then return false; end if;
  insert into public.job_events (workspace_id, job_id, from_status, to_status, note)
  values (j.workspace_id, j.id, 'running', 'succeeded', null);
  perform private.advance_episode(j);
  return true;
end
$$;

-- A final failure marks the episode so Today can say "needs a look".
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

  if next_status = 'failed' then
    update public.episodes set state = 'failed' where id = j.episode_id and state in ('ingesting', 'processing');
  end if;
  return next_status;
end
$$;

revoke execute on function private.step_sequence(text) from public, anon, authenticated;
revoke execute on function private.is_auto_step(text) from public, anon, authenticated;
revoke execute on function private.record_ingest(public.jobs) from public, anon, authenticated;
revoke execute on function private.advance_episode(public.jobs) from public, anon, authenticated;
