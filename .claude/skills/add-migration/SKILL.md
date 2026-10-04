---
name: add-migration
description: Change the database schema. Use for any new table, column, index, policy or function.
---

1. Add `packages/db/supabase/migrations/NNNN_short_name.sql` with the next number. Never edit an applied migration.
2. Every new table: `workspace_id uuid not null references public.workspaces(id) on delete cascade`, row-level security enabled, read policy with `private.is_member(workspace_id)`, write policies with `private.can_edit(workspace_id)`.
3. Functions: `security definer` only when needed, always `set search_path = ''`.
4. JSON columns only for versioned documents that have a schema in `@mmos/contracts`.
5. Apply to a Supabase branch first, run `packages/db/tests/tenant_isolation.sql`, then check the security and performance advisors.
6. Regenerate types. Migrations always need a person to approve (autonomy rule).
