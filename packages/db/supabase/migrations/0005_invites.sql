-- 0005 invites: a person is added to a workspace by email before they sign up.
-- When they first sign in, the trigger turns each open invite into membership.

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner', 'editor', 'approver', 'viewer')),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, email)
);

create index invites_email on public.invites (lower(email)) where accepted_at is null;

alter table public.invites enable row level security;

create policy invites_read on public.invites for select to authenticated
  using (private.is_member(workspace_id));
create policy invites_insert on public.invites for insert to authenticated
  with check (private.can_edit(workspace_id));
create policy invites_update on public.invites for update to authenticated
  using (private.can_edit(workspace_id)) with check (private.can_edit(workspace_id));
create policy invites_delete on public.invites for delete to authenticated
  using (private.can_edit(workspace_id));

create or replace function private.accept_invites()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.members (workspace_id, user_id, role)
  select i.workspace_id, new.id, i.role
  from public.invites i
  where lower(i.email) = lower(new.email) and i.accepted_at is null
  on conflict do nothing;

  update public.invites
  set accepted_at = now()
  where lower(email) = lower(new.email) and accepted_at is null;

  return new;
end
$$;

revoke execute on function private.accept_invites() from public, anon, authenticated;

create trigger on_auth_user_created_accept_invites
  after insert on auth.users
  for each row execute function private.accept_invites();

-- The founding owner of the QLS workspace.
insert into public.invites (workspace_id, email, role)
select id, 'quantai@quantumlightscience.org', 'owner' from public.workspaces where slug = 'qls'
on conflict do nothing;
