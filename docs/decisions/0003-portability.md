# 0003 Staying portable beyond Supabase

Date: 4 October 2026 · Status: accepted

## Decision
Supabase is our host for Postgres and sign-in today, not a dependency of the product's design.
Everything Supabase-specific sits behind one of four seams, so moving later is a contained job,
not a rewrite.

| Seam | Today | Where it lives | Moving means |
| --- | --- | --- | --- |
| Database | Supabase Postgres | `packages/db` (plain SQL migrations, no Supabase-only extensions besides pgvector, which every major host offers) | `pg_dump` / restore to any Postgres (AWS RDS or Aurora, Neon, Crunchy, self-hosted) |
| Sign-in | Supabase Auth (magic links) | `apps/studio/src/lib/supabase/*`, `middleware.ts`, the `auth.users` trigger in 0005 | Swap to another identity provider (for example WorkOS, Clerk, Better Auth). Row-level security keeps working because policies read the user id through `private.is_member` / `private.can_edit`; those two helpers are the only place to change how the id is read |
| Studio data access | supabase-js over PostgREST | `apps/studio/src/lib/data/*` and `lib/uploads/db.ts` only | Replace those query functions with a SQL client; screens never see the difference (one call per screen) |
| Files | Cloudflare R2 (S3 API) | `lib/uploads/store.ts`, workers | Any S3-compatible store (AWS S3, Backblaze, Wasabi, MinIO): change the endpoint and keys |

The workers already talk plain Postgres over a direct connection, and the job engine is ordinary
SQL functions, so they move with the database untouched.

## Rules that keep it true
- No Supabase Storage, Edge Functions or Realtime in the core. If a live feature needs push updates,
  it goes behind an interface with a polling fallback.
- No `@supabase/*` import outside `apps/studio/src/lib/supabase`, `middleware.ts` and `app/auth` (enforced by the layer rules). `lib/data` and `lib/uploads/db.ts` use the client through that adapter.
- Every schema change is a SQL migration in this repo, never a dashboard edit.

## When to move
When cost, data residency, enterprise customers' requirements or scale make it worth it. The likely
first step is keeping Supabase Auth while moving Postgres to a dedicated host, or the reverse.
