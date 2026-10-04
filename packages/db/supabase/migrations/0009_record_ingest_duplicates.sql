-- 0009: a knowingly re-uploaded recording must not fail ingest.
-- media_unique_source_sha (0001) allows one source per checksum per workspace, so the
-- twin is found first; the duplicate is flagged and keeps no checksum, and the index
-- stays as the hard guarantee that a checksum names one episode.
create or replace function private.record_ingest(p_job public.jobs)
returns void language plpgsql set search_path = '' as $$
declare
  src_id uuid := (p_job.input ->> 'assetId')::uuid;
  sha text := p_job.output ->> 'sha256';
  dur numeric := (p_job.output ->> 'durationS')::numeric;
  twin uuid;
begin
  select a.episode_id into twin from public.media_assets a
  where a.workspace_id = p_job.workspace_id and a.kind = 'source' and a.sha256 = sha
    and a.episode_id is not null and a.episode_id <> p_job.episode_id
  order by a.created_at limit 1;

  if twin is null then
    update public.media_assets set sha256 = sha, duration_s = dur where id = src_id;
  else
    update public.media_assets set duration_s = dur where id = src_id;
    insert into public.job_events (workspace_id, job_id, from_status, to_status, note)
    values (p_job.workspace_id, p_job.id, 'succeeded', 'succeeded', 'duplicate of episode ' || twin::text);
    update public.episodes set flags = array_append(flags, 'duplicate_of:' || twin::text)
    where id = p_job.episode_id and not ('duplicate_of:' || twin::text) = any (flags);
  end if;

  insert into public.media_assets (workspace_id, episode_id, kind, r2_key, duration_s)
  values (p_job.workspace_id, p_job.episode_id, 'audio', p_job.output ->> 'audioKey', dur)
  on conflict do nothing;

  if p_job.output ->> 'proxyKey' is not null then
    insert into public.media_assets (workspace_id, episode_id, kind, r2_key, duration_s)
    values (p_job.workspace_id, p_job.episode_id, 'edit', p_job.output ->> 'proxyKey', dur)
    on conflict do nothing;
  end if;
end
$$;
