-- 0011 agent outputs: what transcribe, understand and write produce, saved where the Studio
-- can read it, in the same transaction as the job's success (via private.advance_episode).
-- People read all of it; nobody writes these tables directly. Edits to drafts arrive in 0012
-- through one definer function that keeps every version.

create table public.transcripts (
  episode_id uuid primary key references public.episodes(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null,
  provider_ref text not null,
  language text not null,
  duration_s numeric not null,
  word_count int not null,
  speakers text[] not null default '{}',
  -- The full document (word timings) lives in storage under this key.
  storage_key text not null,
  text text not null,
  created_at timestamptz not null default now()
);
create index transcripts_workspace on public.transcripts (workspace_id);

-- One current text per piece: the title, the description, the chapter list, one caption per platform.
create table public.pieces (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  episode_id uuid not null references public.episodes(id) on delete cascade,
  kind text not null check (kind in ('title', 'description', 'chapters', 'caption')),
  -- '' for pieces that belong to the episode rather than one platform.
  platform text not null default '',
  body text not null,
  version int not null default 1,
  options text[] not null default '{}',
  updated_at timestamptz not null default now(),
  unique (episode_id, kind, platform)
);
create index pieces_workspace on public.pieces (workspace_id);

-- Every version ever saved, who made it, and why.
create table public.piece_versions (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  piece_id uuid not null references public.pieces(id) on delete cascade,
  version int not null,
  body text not null,
  author text not null check (author in ('agent', 'person', 'chat')),
  author_id uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  unique (piece_id, version)
);
create index piece_versions_workspace on public.piece_versions (workspace_id);
create index piece_versions_author on public.piece_versions (author_id);

-- What the voice kit learns: a draft and what the creator (or the chat, at their word) changed it to.
create table public.voice_lessons (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  piece_kind text not null,
  platform text,
  before text not null,
  after text not null,
  source text not null check (source in ('person', 'chat')),
  created_at timestamptz not null default now()
);
create index voice_lessons_brand on public.voice_lessons (brand_id, created_at desc);
create index voice_lessons_workspace on public.voice_lessons (workspace_id);

do $$
declare t text;
begin
  foreach t in array array['transcripts', 'pieces', 'piece_versions', 'voice_lessons'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (private.is_member(workspace_id))', t || '_read', t);
  end loop;
end $$;

-- ---------- recording what each step learned ----------

create or replace function private.record_transcribe(p_job public.jobs)
returns void language plpgsql set search_path = '' as $$
declare o jsonb := p_job.output;
begin
  if not (o ? 'transcriptKey') then return; end if;
  insert into public.transcripts (episode_id, workspace_id, provider, provider_ref, language, duration_s, word_count, speakers, storage_key, text)
  values (p_job.episode_id, p_job.workspace_id, o ->> 'provider', o ->> 'providerRef', o ->> 'language', (o ->> 'durationS')::numeric,
          (o ->> 'wordCount')::int, array(select jsonb_array_elements_text(coalesce(o -> 'speakers', '[]'))), o ->> 'transcriptKey', coalesce(o ->> 'text', ''))
  on conflict (episode_id) do update set
    provider = excluded.provider, provider_ref = excluded.provider_ref, language = excluded.language, duration_s = excluded.duration_s,
    word_count = excluded.word_count, speakers = excluded.speakers, storage_key = excluded.storage_key, text = excluded.text, created_at = now();
end
$$;

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

-- Saves one draft. A piece someone has edited keeps their words; the new draft is still kept as a version.
create or replace function private.put_piece(p_job public.jobs, p_kind text, p_platform text, p_body text, p_options text[] default '{}')
returns void language plpgsql set search_path = '' as $$
declare
  p public.pieces;
  last_author text;
  next_v int;
begin
  if p_body is null or p_body = '' then return; end if;
  insert into public.pieces (workspace_id, episode_id, kind, platform, body, options)
  values (p_job.workspace_id, p_job.episode_id, p_kind, p_platform, p_body, p_options)
  on conflict (episode_id, kind, platform) do nothing
  returning * into p;
  if p.id is not null then
    insert into public.piece_versions (workspace_id, piece_id, version, body, author, note)
    values (p.workspace_id, p.id, 1, p_body, 'agent', 'first draft');
    return;
  end if;

  select * into p from public.pieces where episode_id = p_job.episode_id and kind = p_kind and platform = p_platform for update;
  if p.body = p_body then return; end if;
  -- pieces.version names the version that is current; the redraft is always kept.
  select author into last_author from public.piece_versions where piece_id = p.id and version = p.version;
  select max(version) + 1 into next_v from public.piece_versions where piece_id = p.id;
  insert into public.piece_versions (workspace_id, piece_id, version, body, author, note)
  values (p.workspace_id, p.id, next_v, p_body, 'agent', 'redrafted');
  if last_author = 'agent' then
    update public.pieces set body = p_body, options = p_options, version = next_v, updated_at = now() where id = p.id;
  end if;
end
$$;

create or replace function private.record_write(p_job public.jobs)
returns void language plpgsql set search_path = '' as $$
declare
  o jsonb := p_job.output;
  c jsonb;
begin
  if not (o ? 'title') then return; end if;
  perform private.put_piece(p_job, 'title', '', o ->> 'title', array(select jsonb_array_elements_text(coalesce(o -> 'titleOptions', '[]'))));
  perform private.put_piece(p_job, 'description', '', o ->> 'description');
  perform private.put_piece(p_job, 'chapters', '', o ->> 'chaptersText');
  for c in select * from jsonb_array_elements(coalesce(o -> 'captions', '[]')) loop
    perform private.put_piece(p_job, 'caption', c ->> 'platform', c ->> 'body');
  end loop;
  update public.episodes set
    title = coalesce(title, o ->> 'title'),
    description = coalesce(description, o ->> 'description'),
    chapters = case when chapters = '[]'::jsonb then coalesce(o -> 'chapters', '[]'::jsonb) else chapters end
  where id = p_job.episode_id;
end
$$;

-- advance_episode (0008) now also records what transcribe, understand and write produced.
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
  elsif p_job.step = 'transcribe' then
    perform private.record_transcribe(p_job);
  elsif p_job.step = 'understand' then
    perform private.record_understand(p_job);
  elsif p_job.step = 'write' then
    perform private.record_write(p_job);
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

revoke execute on function private.record_transcribe(public.jobs) from public, anon, authenticated;
revoke execute on function private.record_understand(public.jobs) from public, anon, authenticated;
revoke execute on function private.put_piece(public.jobs, text, text, text, text[]) from public, anon, authenticated;
revoke execute on function private.record_write(public.jobs) from public, anon, authenticated;
