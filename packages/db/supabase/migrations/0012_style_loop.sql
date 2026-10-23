-- 0012_style_loop.sql
-- The style memory loop: styles keep their history, and every correction a
-- person makes in Review is recorded against the style that produced the thing
-- they corrected. Those corrections are what a later `distil` step reads when
-- it proposes a new version — it never rewrites a style on its own.

-- ---------- versions ----------

create table if not exists public.style_versions (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  style_id      uuid not null references public.styles(id) on delete cascade,
  version       integer not null check (version > 0),
  name          text not null,
  prompt        text not null,
  never_do      text[] not null default '{}',
  recipe        jsonb not null default '{}'::jsonb,
  -- who or what made this version, and why
  source        text not null check (source in ('person', 'learned', 'distilled')),
  note          text not null default '',
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (style_id, version)
);

create index if not exists style_versions_style on public.style_versions (style_id, version desc);
create index if not exists style_versions_ws on public.style_versions (workspace_id);

-- ---------- corrections ----------

create table if not exists public.style_edits (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  style_id      uuid references public.styles(id) on delete set null,
  episode_id    uuid references public.episodes(id) on delete cascade,
  -- what was being corrected: a cut, a piece of writing, a clip choice
  subject       text not null check (subject in ('cut', 'copy', 'clip', 'graphic', 'schedule')),
  -- what the system put forward, and what the person made it instead
  proposed      jsonb not null,
  accepted      jsonb not null,
  -- the person's own words, when they gave them
  note          text not null default '',
  -- set once a distilled version has taken this edit into account
  folded_into   uuid references public.style_versions(id) on delete set null,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists style_edits_ws on public.style_edits (workspace_id);
create index if not exists style_edits_style on public.style_edits (style_id) where style_id is not null;
create index if not exists style_edits_episode on public.style_edits (episode_id) where episode_id is not null;
-- the query the distil step runs: what has this style been told that it has not learned yet
create index if not exists style_edits_unfolded on public.style_edits (style_id, created_at) where folded_into is null;

-- ---------- row level security ----------

alter table public.style_versions enable row level security;
alter table public.style_edits enable row level security;

create policy style_versions_read on public.style_versions
  for select to authenticated using (private.is_member(workspace_id));
create policy style_versions_insert on public.style_versions
  for insert to authenticated with check (private.can_edit(workspace_id));
-- history is history: a version is never edited or deleted from the Studio
create policy style_versions_update on public.style_versions
  for update to authenticated using (false) with check (false);
create policy style_versions_delete on public.style_versions
  for delete to authenticated using (false);

create policy style_edits_read on public.style_edits
  for select to authenticated using (private.is_member(workspace_id));
create policy style_edits_insert on public.style_edits
  for insert to authenticated with check (private.can_edit(workspace_id));
create policy style_edits_update on public.style_edits
  for update to authenticated using (private.can_edit(workspace_id)) with check (private.can_edit(workspace_id));
create policy style_edits_delete on public.style_edits
  for delete to authenticated using (private.can_edit(workspace_id));

-- ---------- keeping a version whenever a style changes ----------

create or replace function private.record_style_version()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  next_version integer;
begin
  -- Only the parts that change the output are worth a version. Renaming a
  -- style or moving it to another brand is not a change of style.
  if tg_op = 'UPDATE'
     and new.prompt is not distinct from old.prompt
     and new.never_do is not distinct from old.never_do
     and new.recipe is not distinct from old.recipe then
    return new;
  end if;

  select coalesce(max(version), 0) + 1 into next_version
  from public.style_versions where style_id = new.id;

  insert into public.style_versions (workspace_id, style_id, version, name, prompt, never_do, recipe, source, created_by)
  values (new.workspace_id, new.id, next_version, new.name, new.prompt, new.never_do, new.recipe, 'person', new.created_by);

  return new;
end
$$;

revoke all on function private.record_style_version() from public, anon, authenticated;

drop trigger if exists styles_keep_history on public.styles;
create trigger styles_keep_history after insert or update on public.styles
  for each row execute function private.record_style_version();
