-- 0002 membership helpers move out of the exposed API schema (security advisor).
-- Policies keep working because they reference the functions, not their names.
create schema if not exists private;
grant usage on schema private to authenticated;
alter function public.is_member(uuid) set schema private;
alter function public.can_edit(uuid) set schema private;
revoke execute on function private.is_member(uuid) from public, anon;
revoke execute on function private.can_edit(uuid) from public, anon;
grant execute on function private.is_member(uuid) to authenticated;
grant execute on function private.can_edit(uuid) to authenticated;
