-- 0011_styles.sql
-- Style Studio: a named, reusable look that can be applied to a render.
-- A style is saved once and reused like a skill: pick it on a show, an
-- episode or a single clip, and the render step reads it instead of
-- carrying prompt text around in job inputs.

create table if not exists public.styles (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  brand_id      uuid references public.brands(id) on delete set null,
  slug          text not null,
  name          text not null,
  kind          text not null default 'video'
                  check (kind in ('video','image','motion','voice')),
  -- what the style actually is, in the shape @mmos/contracts validates
  recipe        jsonb not null default '{}'::jsonb,
  -- free-text guidance the model sees, kept separate from the recipe so a
  -- prompt can be edited without touching the structured settings
  prompt        text not null default '',
  never_do      text[] not null default '{}',
  -- a style can be retired without breaking episodes that used it
  archived_at   timestamptz,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists styles_unique_slug
  on public.styles (workspace_id, slug);

create index if not exists styles_ws on public.styles (workspace_id);
create index if not exists styles_brand on public.styles (brand_id)
  where brand_id is not null;

alter table public.styles enable row level security;

create policy styles_read on public.styles
  for select to authenticated
  using (private.is_member(workspace_id));

create policy styles_insert on public.styles
  for insert to authenticated
  with check (private.can_edit(workspace_id));

create policy styles_update on public.styles
  for update to authenticated
  using (private.can_edit(workspace_id))
  with check (private.can_edit(workspace_id));

create policy styles_delete on public.styles
  for delete to authenticated
  using (private.can_edit(workspace_id));

-- keep updated_at honest
create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- clock_timestamp(), not now(): now() is frozen at transaction start, so
  -- two edits in one transaction would record the same updated_at.
  new.updated_at := clock_timestamp();
  return new;
end
$$;

drop trigger if exists styles_touch on public.styles;
create trigger styles_touch before update on public.styles
  for each row execute function private.touch_updated_at();
