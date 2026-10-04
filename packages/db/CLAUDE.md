# packages/db

Owns the database: migrations, generated types, typed queries.

## Rules
- Every table carries `workspace_id` and row-level security. No exceptions.
- Schema changes are new migration files, numbered `NNNN_name.sql`. Never edit an applied migration.
- JSON columns hold only versioned documents validated by `@mmos/contracts` (brand kits, compasses, themes).
- After any change, run `tests/tenant_isolation.sql` against a Supabase branch and check the security advisors.

## Files
- `supabase/migrations/` the schema, in order
- `supabase/seed/qls.sql` the Quantum Light Science workspace, safe to run twice
- `src/database.types.ts` generated from the live schema; never edit by hand, regenerate after every migration (exempt from the 400-line rule)
- `src/index.ts` the only entry point: `Database`, `Tables`, and the episode states the Studio understands
- `tests/tenant_isolation.sql` proves one workspace can never see another (passed on the live project, 4 Oct 2026)
- Live project: multi-media-os (ref rxweinpsmtgrostfoutn, eu-west-1). Membership helpers live in the `private` schema.
- `tests/job_engine.sql` proves the queue rules (enqueue, claim, lease, fencing, backoff, final failure); passed on the live project, 4 Oct 2026
- `tests/start_ingest.sql`, `tests/pipeline_chaining.sql`, `tests/jobs_read_only.sql`: the Studio's door into the engine, the automatic chain (ingest → … → Review gate, podcasts skip video steps, duplicates flagged, final failure marks the episode), and that people can read but never write jobs. All passed live, 4 Oct 2026.
- Chain order lives in `private.step_sequence(kind)`; the automatic steps in `private.is_auto_step`. Change those, and nothing else, to change the pipeline order.
- A `drop policy` cannot be applied through the tooling without a person at the console; `alter policy … (false)` was used in 0010 instead.
- Pending: `0004_time_anchor_policies.sql` is written but not yet applied (it drops a policy, so it waits for a person to approve).
