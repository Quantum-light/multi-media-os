-- 0001 foundation: accounts, brands, shows, channels, episodes, media, jobs,
-- posts, and the time constellation graph. Multi-tenant from the first row:
-- every table carries workspace_id and row-level security.

create extension if not exists vector with schema extensions;

-- ---------- accounts ----------
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  plan text not null default 'founder',
  created_at timestamptz not null default now()
);

create table public.members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'approver', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- Membership checks run as definer with an empty search path, so policies stay
-- fast and cannot be redirected by a crafted search_path.
create or replace function public.is_member(ws uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members m where m.workspace_id = ws and m.user_id = (select auth.uid()));
$$;

create or replace function public.can_edit(ws uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members m where m.workspace_id = ws and m.user_id = (select auth.uid())
                 and m.role in ('owner', 'editor', 'approver'));
$$;

-- ---------- brands and shows ----------
create table public.brands (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  slug text not null,
  brand_kit jsonb not null,
  voice_kit jsonb,
  compass jsonb,
  created_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

create table public.shows (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  slug text not null,
  kind text not null check (kind in ('podcast', 'video', 'both')),
  theme jsonb not null,
  slots jsonb not null default '[]',
  approval_mode text not null default 'review_all' check (approval_mode in ('review_all', 'auto_high_score', 'hands_off')),
  compass jsonb,
  created_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  platform text not null,
  handle text not null,
  zernio_account_id text,
  status text not null default 'connected' check (status in ('connected', 'disconnected')),
  unique (workspace_id, platform, handle)
);

-- One account can carry several shows across brands.
create table public.show_channels (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  show_id uuid not null references public.shows(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  carries text[] not null default '{}',
  primary key (show_id, channel_id)
);

-- ---------- episodes and media ----------
create table public.episodes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  show_id uuid not null references public.shows(id) on delete cascade,
  number int,
  state text not null default 'ingesting',
  title text,
  description text,
  chapters jsonb not null default '[]',
  recorded_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  episode_id uuid references public.episodes(id) on delete cascade,
  kind text not null check (kind in ('source', 'edit', 'master', 'clip', 'audio', 'image', 'render')),
  r2_key text not null,
  sha256 text,
  quick_fingerprint text,
  duration_s numeric,
  bytes bigint,
  created_at timestamptz not null default now()
);
-- The same recording can never be uploaded twice into one workspace.
create unique index media_unique_source_fingerprint on public.media_assets (workspace_id, quick_fingerprint) where kind = 'source';
create unique index media_unique_source_sha on public.media_assets (workspace_id, sha256) where kind = 'source' and sha256 is not null;

-- ---------- pipeline ----------
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  episode_id uuid not null references public.episodes(id) on delete cascade,
  step text not null,
  input_hash text not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  attempts int not null default 0,
  lease_until timestamptz,
  error text,
  output jsonb,
  cost_pence int not null default 0,
  created_at timestamptz not null default now(),
  unique (episode_id, step, input_hash)
);
create index jobs_ready on public.jobs (status, lease_until) where status in ('queued', 'running');

create table public.job_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  from_status text,
  to_status text not null,
  note text,
  at timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  episode_id uuid not null references public.episodes(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete restrict,
  platform text not null,
  scheduled_for timestamptz not null,
  status text not null default 'draft' check (status in ('draft', 'waiting_review', 'scheduled', 'published', 'failed')),
  idempotency_key text not null unique,
  zernio_post_id text,
  live_url text,
  created_at timestamptz not null default now()
);

-- ---------- time constellation ----------
create table public.themes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete cascade,
  name text not null,
  slug text not null,
  unique (workspace_id, slug)
);

create table public.moments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  episode_id uuid not null references public.episodes(id) on delete cascade,
  start_s numeric not null,
  end_s numeric not null check (end_s > start_s),
  kind text not null check (kind in ('story', 'claim', 'teaching', 'practice', 'question')),
  text text not null,
  embedding extensions.vector(1536)
);

create table public.edges (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  from_kind text not null,
  from_id uuid not null,
  to_kind text not null,
  to_id uuid not null,
  kind text not null check (kind in ('same_theme', 'follows_on', 'answers', 'contradicts', 'part_of_arc', 'held_for', 'resurfaced_at')),
  weight real not null default 1,
  created_by text not null default 'system',
  created_at timestamptz not null default now()
);
create index edges_from on public.edges (workspace_id, from_kind, from_id);
create index edges_to on public.edges (workspace_id, to_kind, to_id);

-- Global anchors (clocks changing, solstices, New Year) have no workspace.
create table public.time_anchors (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  name text not null,
  date date not null,
  recurrence text not null default 'none' check (recurrence in ('none', 'yearly')),
  scope text not null check (scope in ('global', 'workspace', 'brand'))
);

create table public.holds (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  piece_kind text not null,
  piece_id uuid not null,
  anchor_id uuid not null references public.time_anchors(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------- row-level security ----------
alter table public.workspaces enable row level security;
create policy workspaces_read on public.workspaces for select to authenticated using (public.is_member(id));

alter table public.members enable row level security;
create policy members_read on public.members for select to authenticated using (public.is_member(workspace_id));

do $$
declare t text;
begin
  foreach t in array array['brands','shows','channels','show_channels','episodes','media_assets','jobs','job_events','posts','themes','moments','edges','holds']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_member(workspace_id))', t || '_read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.can_edit(workspace_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.can_edit(workspace_id)) with check (public.can_edit(workspace_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.can_edit(workspace_id))', t || '_delete', t);
  end loop;
end $$;

alter table public.time_anchors enable row level security;
create policy time_anchors_read on public.time_anchors for select to authenticated
  using (workspace_id is null or public.is_member(workspace_id));
create policy time_anchors_write on public.time_anchors for all to authenticated
  using (workspace_id is not null and public.can_edit(workspace_id))
  with check (workspace_id is not null and public.can_edit(workspace_id));
