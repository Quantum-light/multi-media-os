-- 0016_ideas.sql
-- The plan board's own rows. An idea is a line of the person's own words
-- written against a posting slot: what it serves (a pillar of that show's
-- compass), which show it is for, and the slot it is meant to fill.
--
-- Human-sourced first: nothing writes here but a person. When Scout agents
-- arrive they will propose into this table with created_by left null, so a
-- proposal is always distinguishable from something she wrote herself.

create table if not exists public.ideas (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  show_id       uuid not null references public.shows(id) on delete cascade,
  -- a pillar of the show's compass, kept as text so renaming a pillar on
  -- Vision never deletes the ideas written against it
  pillar        text not null,
  body          text not null,
  -- the instant of the posting slot this idea answers; null means it is an
  -- idea with no slot yet, which is still worth keeping
  slot_at       timestamptz,
  state         text not null default 'idea'
                  check (state in ('idea','planned','dropped')),
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists ideas_ws on public.ideas (workspace_id);
create index if not exists ideas_show_slot on public.ideas (show_id, slot_at);
create index if not exists ideas_slot on public.ideas (workspace_id, slot_at)
  where slot_at is not null;

alter table public.ideas enable row level security;

create policy ideas_read on public.ideas
  for select to authenticated
  using (private.is_member(workspace_id));

create policy ideas_insert on public.ideas
  for insert to authenticated
  with check (private.can_edit(workspace_id));

create policy ideas_update on public.ideas
  for update to authenticated
  using (private.can_edit(workspace_id))
  with check (private.can_edit(workspace_id));

create policy ideas_delete on public.ideas
  for delete to authenticated
  using (private.can_edit(workspace_id));
