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
- `0011_styles.sql` adds `public.styles` for Style Studio: a saved, reusable look (slug unique per workspace, `kind` constrained, `recipe` validated by `StyleDoc`/`StyleRecipe`, retired with `archived_at` rather than deleted). Applied live 9 Oct 2026; `tests/styles.sql` passed against it the same day.
- `private.touch_updated_at()` uses `clock_timestamp()`, not `now()`: `now()` is frozen at transaction start, so two edits in one transaction would record the same `updated_at` and the test for it could never fail honestly.
- `rls_auto_enable()` had `execute` revoked from `public`, `anon` and `authenticated` on 7 Oct 2026 — it was reachable from the public REST API. `start_ingest` stays callable by signed-in users, which is intended.
- Still open: `time_anchors_write` is `for all`, so it is evaluated on reads too. Splitting it needs a `drop policy`, so it waits for a person at the console.

- `0011_agent_outputs.sql`: transcripts, pieces (one current text per title, description, chapters, caption), piece_versions (every version, by agent, person or chat), voice_lessons; `advance_episode` records transcribe, understand (moments, themes, edges) and write. Test: `tests/agent_outputs.sql`.
- `0012_review.sql`: `public.save_piece` (the only way to edit a draft: new version plus a voice lesson), `public.plan_posts` (next free slot per connected channel), `public.approve_episode` (owners and approvers; schedules one post per channel, idempotent), `private.can_approve`. Test: `tests/review.sql`.
