-- 0014 record_understand, the real one.
--
-- Split out of 0013 because it deletes an episode's previous moments and edges before
-- writing the new ones — a re-run is a fresh reading, not an append — and a delete needs
-- a person to confirm it at the Supabase console. Until this is applied, 0013's stub
-- raises an error naming this file, so an understand job fails loudly instead of quietly
-- recording nothing.
--
-- To apply: paste this file into the Supabase SQL editor and run it.

-- Moments and themes replace the episode's previous ones (a re-run is a fresh reading).
create or replace function private.record_understand(p_job public.jobs)
returns void language plpgsql set search_path = '' as $$
declare
  o jsonb := p_job.output;
  brand uuid;
  t jsonb;
  theme_id uuid;
begin
  if not (o ? 'moments') then return; end if;
  select s.brand_id into brand from public.episodes e join public.shows s on s.id = e.show_id where e.id = p_job.episode_id;

  delete from public.moments where episode_id = p_job.episode_id;
  insert into public.moments (workspace_id, episode_id, start_s, end_s, kind, text)
  select p_job.workspace_id, p_job.episode_id, (m ->> 'startS')::numeric, (m ->> 'endS')::numeric, m ->> 'kind', m ->> 'quote'
  from jsonb_array_elements(o -> 'moments') m;

  delete from public.edges where workspace_id = p_job.workspace_id and from_kind = 'episode' and from_id = p_job.episode_id and created_by = 'understand';
  for t in select * from jsonb_array_elements(coalesce(o -> 'themes', '[]')) loop
    insert into public.themes (workspace_id, brand_id, name, slug)
    values (p_job.workspace_id, brand, t ->> 'name', t ->> 'slug')
    on conflict (workspace_id, slug) do update set name = public.themes.name
    returning id into theme_id;
    insert into public.edges (workspace_id, from_kind, from_id, to_kind, to_id, kind, created_by)
    values (p_job.workspace_id, 'episode', p_job.episode_id, 'theme', theme_id, 'same_theme', 'understand');
  end loop;
end
$$;

