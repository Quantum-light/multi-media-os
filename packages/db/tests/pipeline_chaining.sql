-- Pipeline chaining test: ingest success records the recording and starts transcribe;
-- the chain runs through the automatic steps and stops at Review; podcasts skip the
-- video-only steps; a repeated recording is flagged; a final failure marks the episode.
-- Always rolls back. (now() is fixed inside a transaction, so order comes from the event log.)
begin;

insert into public.workspaces (id, name, slug) values ('40000000-0000-0000-0000-000000000001', 'Chain test', 'chain-test');
insert into public.brands (id, workspace_id, name, slug, brand_kit) values
  ('40000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', 'B', 'b', '{}');
insert into public.shows (id, workspace_id, brand_id, name, slug, kind, theme) values
  ('40000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', 'Video', 'v', 'video', '{}'),
  ('40000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', 'Pod', 'p', 'podcast', '{}');
insert into public.episodes (id, workspace_id, show_id, state) values
  ('40000000-0000-0000-0000-000000000010', '40000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', 'ingesting'),
  ('40000000-0000-0000-0000-000000000011', '40000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000004', 'ingesting'),
  ('40000000-0000-0000-0000-000000000012', '40000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', 'ingesting');
insert into public.media_assets (id, workspace_id, episode_id, kind, r2_key, bytes) values
  ('40000000-0000-0000-0000-000000000020', '40000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000010', 'source', 'ws/x/episodes/10/source/a.mp4', 100),
  ('40000000-0000-0000-0000-000000000021', '40000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000011', 'source', 'ws/x/episodes/11/source/b.m4a', 100),
  ('40000000-0000-0000-0000-000000000022', '40000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000012', 'source', 'ws/x/episodes/12/source/c.mp4', 100);

do $$
declare
  ep_v constant uuid := '40000000-0000-0000-0000-000000000010';
  ep_p constant uuid := '40000000-0000-0000-0000-000000000011';
  ep_d constant uuid := '40000000-0000-0000-0000-000000000012';
  sha constant text := repeat('a', 64);
  j public.jobs; c public.jobs; st text; n int; steps text[];
  ingest_out jsonb := jsonb_build_object('sha256', sha, 'durationS', 660, 'video', jsonb_build_object('width',1920,'height',1080,'fps',30), 'audioKey', 'ws/x/episodes/10/derived/audio.m4a', 'proxyKey', 'ws/x/episodes/10/derived/proxy-540p.mp4');
begin
  -- 1. ingest success records the recording and starts transcribe
  j := private.enqueue_job(ep_v, 'ingest', jsonb_build_object('assetId', '40000000-0000-0000-0000-000000000020', 'key', 'k', 'bytes', 100), 'ingest:20');
  select * into c from private.claim_job('w', array['ingest']);
  if not private.complete_job(c.id, c.attempts, ingest_out) then raise exception '1: complete refused'; end if;
  select state into st from public.episodes where id = ep_v;
  if st <> 'processing' then raise exception '1: episode is %, expected processing', st; end if;
  select count(*) into n from public.media_assets where episode_id = ep_v and ((kind = 'source' and sha256 = sha and duration_s = 660) or (kind = 'audio' and r2_key like '%audio.m4a') or (kind = 'edit' and r2_key like '%proxy-540p.mp4'));
  if n <> 3 then raise exception '1: expected source+audio+edit assets recorded, got %', n; end if;
  select count(*) into n from public.jobs where episode_id = ep_v and step = 'transcribe' and status = 'queued' and input = ingest_out;
  if n <> 1 then raise exception '1: transcribe not queued with the ingest output'; end if;

  -- 2. the video chain runs through storyboard, then stops at Review
  for i in 1..6 loop
    select * into c from private.claim_job('w', array['transcribe','cut','understand','write','clip','storyboard']);
    if c.id is null then raise exception '2: nothing to claim at round %', i; end if;
    perform private.complete_job(c.id, c.attempts, jsonb_build_object('from', c.step));
  end loop;
  select array_agg(jb.step order by (select min(e.id) from public.job_events e where e.job_id = jb.id)) into steps from public.jobs jb where jb.episode_id = ep_v;
  if steps <> array['ingest','transcribe','cut','understand','write','clip','storyboard'] then raise exception '2: video chain was %', steps; end if;
  select state into st from public.episodes where id = ep_v;
  if st <> 'review' then raise exception '2: episode is %, expected review', st; end if;
  select * into c from private.claim_job('w', array['compose','render','publish']);
  if c.id is not null then raise exception '2: a step past the Review gate was queued (%)', c.step; end if;

  -- 3. podcasts skip clip and storyboard
  j := private.enqueue_job(ep_p, 'ingest', jsonb_build_object('assetId', '40000000-0000-0000-0000-000000000021', 'key', 'k', 'bytes', 100), 'ingest:21');
  select * into c from private.claim_job('w', array['ingest']);
  perform private.complete_job(c.id, c.attempts, jsonb_build_object('sha256', repeat('b', 64), 'durationS', 100, 'video', null, 'audioKey', 'ws/x/episodes/11/derived/audio.m4a', 'proxyKey', null));
  for i in 1..4 loop
    select * into c from private.claim_job('w', array['transcribe','cut','understand','write','clip','storyboard']);
    perform private.complete_job(c.id, c.attempts, jsonb_build_object('from', c.step));
  end loop;
  select array_agg(jb.step order by (select min(e.id) from public.job_events e where e.job_id = jb.id)) into steps from public.jobs jb where jb.episode_id = ep_p;
  if steps <> array['ingest','transcribe','cut','understand','write'] then raise exception '3: podcast chain was %', steps; end if;
  select state into st from public.episodes where id = ep_p;
  if st <> 'review' then raise exception '3: podcast episode is %', st; end if;
  select count(*) into n from public.media_assets where episode_id = ep_p and kind = 'edit';
  if n <> 0 then raise exception '3: a podcast got a video proxy asset'; end if;

  -- 4. the same recording again is flagged as a duplicate of the first episode
  j := private.enqueue_job(ep_d, 'ingest', jsonb_build_object('assetId', '40000000-0000-0000-0000-000000000022', 'key', 'k', 'bytes', 100), 'ingest:22');
  select * into c from private.claim_job('w', array['ingest']);
  perform private.complete_job(c.id, c.attempts, ingest_out);
  if not exists (select 1 from public.episodes where id = ep_d and ('duplicate_of:' || ep_v::text) = any (flags)) then raise exception '4: duplicate not flagged'; end if;
  if exists (select 1 from public.media_assets where id = '40000000-0000-0000-0000-000000000022' and sha256 is not null) then raise exception '4: duplicate took the checksum'; end if;
  if exists (select 1 from public.episodes where id = ep_v and flags <> '{}') then raise exception '4: the original was flagged too'; end if;

  -- 5. a final failure marks the episode failed; a retryable one does not
  select * into c from private.claim_job('w', array['transcribe']);
  st := private.fail_job(c.id, c.attempts, 'provider down');
  if st <> 'queued' then raise exception '5: expected queued, got %', st; end if;
  select state into st from public.episodes where id = ep_d;
  if st <> 'processing' then raise exception '5: retryable failure changed the episode to %', st; end if;
  update public.jobs set run_after = now() where id = c.id;
  select * into c from private.claim_job('w', array['transcribe']);
  st := private.fail_job(c.id, c.attempts, 'input is not audio', false);
  if st <> 'failed' then raise exception '5: expected failed, got %', st; end if;
  select state into st from public.episodes where id = ep_d;
  if st <> 'failed' then raise exception '5: episode is %, expected failed', st; end if;
end $$;

select 'pipeline chaining: all 5 checks passed' as result;
rollback;
