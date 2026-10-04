-- 0007 start_ingest: the one door from the Studio into the job engine.
-- A signed-in editor calls it after their upload completes. It checks they can edit the
-- episode's workspace, moves the episode from uploading to ingesting, and enqueues the
-- ingest job (idempotent: calling it twice is one job). The queue functions themselves
-- stay private.

create or replace function public.start_ingest(p_episode uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  ws uuid;
  src record;
  j public.jobs;
begin
  select workspace_id into ws from public.episodes where id = p_episode;
  if ws is null or not private.can_edit(ws) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  select id, r2_key, bytes into src
  from public.media_assets
  where episode_id = p_episode and kind = 'source'
  order by created_at desc
  limit 1;
  if src.id is null or src.bytes is null then
    raise exception 'episode has no uploaded source' using errcode = 'P0002';
  end if;

  update public.episodes set state = 'ingesting' where id = p_episode and state = 'uploading';

  j := private.enqueue_job(
    p_episode, 'ingest',
    jsonb_build_object('assetId', src.id, 'key', src.r2_key, 'bytes', src.bytes),
    'ingest:' || src.id::text);
  return j.id;
end
$$;

revoke execute on function public.start_ingest(uuid) from public, anon;
grant execute on function public.start_ingest(uuid) to authenticated;
