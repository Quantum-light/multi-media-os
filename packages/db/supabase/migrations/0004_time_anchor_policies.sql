-- 0004 PENDING: needs Grace's approval in the Supabase prompt (it drops a policy).
-- One permissive policy per action on time_anchors (performance advisor), and
-- Supabase's own rls_auto_enable helper no longer callable through the API (security advisor).
drop policy time_anchors_write on public.time_anchors;
create policy time_anchors_insert on public.time_anchors for insert to authenticated
  with check (workspace_id is not null and private.can_edit(workspace_id));
create policy time_anchors_update on public.time_anchors for update to authenticated
  using (workspace_id is not null and private.can_edit(workspace_id))
  with check (workspace_id is not null and private.can_edit(workspace_id));
create policy time_anchors_delete on public.time_anchors for delete to authenticated
  using (workspace_id is not null and private.can_edit(workspace_id));
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
