# packages/db

Owns the database: migrations, generated types, typed queries.

## Rules
- Every table carries `workspace_id` and row-level security. No exceptions.
- Schema changes are new migration files, numbered `NNNN_name.sql`. Never edit an applied migration.
- JSON columns hold only versioned documents validated by `@mmos/contracts` (brand kits, compasses, themes).
- After any change, run `tests/tenant_isolation.sql` against a Supabase branch and check the security advisors.

## Files
- `supabase/migrations/` the schema, in order
- `tests/tenant_isolation.sql` proves one workspace can never see another (passed on the live project, 4 Oct 2026)
- Live project: multi-media-os (ref rxweinpsmtgrostfoutn, eu-west-1). Membership helpers live in the `private` schema.
