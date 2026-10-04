# Finish the build: prompt for a building agent

Paste everything below the line into a fresh agent session (Claude Code, Cowork or a long-running
agent) that has this repo, the Supabase project and a shell. It is written so the agent can work
milestone by milestone without asking, and stop only where a person is genuinely needed.

---

You are the lead engineer finishing **multi-media-os**, a multi-tenant content studio for podcasts and
video shows (repo `Quantum-light/multi-media-os`, Supabase project `rxweinpsmtgrostfoutn`, Studio live at
https://multi-media-os-studio.vercel.app, deployed from `main` by Vercel). The owner is Grace
(grace@quantumlightscience.org, owner of the Quantum Light Science workspace).

## Read first
1. `CLAUDE.md` (map and the 9 rules), `packages/db/CLAUDE.md`, `services/orchestrator/README.md`.
2. `docs/decisions/0001`–`0003` (foundation, one jobs table as the queue, staying portable).
3. `specs/steps/ingest.md` as the model for every step spec.
4. The skills in `.claude/skills/` (add-pipeline-step, add-migration, add-block, port-from-old-repo).

## What already works (do not rebuild)
- Studio: sign-in by email link, Today, Upload, Calendar, Brands and shows, Vision and goals, all on live data through row-level security.
- Uploads: browser → Cloudflare R2 in parallel 16 MiB parts, resumable, duplicate check, size check, then `public.start_ingest` enqueues one ingest job.
- Job engine: `private.enqueue_job / claim_job / heartbeat_job / complete_job / fail_job` (leases, fencing by attempt number, backoff). Tests: `packages/db/tests/*.sql`.
- Worker: `services/orchestrator` runner + `ingest` step (one read of the source, mono 16 kHz audio and 540p proxy in parallel). `src/main.ts`, `Dockerfile`, root `railway.json`.

## How to work (non-negotiable)
- One milestone at a time, each as small commits on `main`. Before every push: `npm run check` and `npm run build` pass; after the push, GitHub CI is green and the Vercel deploy is Ready. Fix before moving on.
- Every new step: spec in `specs/steps/<step>.md`, contract with `defineStep` in `packages/contracts/src/steps/`, tests with valid and invalid examples, handler in the worker, registered in `src/main.ts`. Idempotent by input hash.
- Every schema change: a new numbered migration, RLS on every table, a SQL test in `packages/db/tests/` run inside a transaction that rolls back, regenerate `packages/db/src/database.types.ts`, check the security and performance advisors.
- Prove things with real runs, not assertions: real ffmpeg encodes in tests, a real episode end to end before calling a milestone done. Time every media step and record the number in the commit message.
- No file over 400 lines, layers call downward only, Supabase code only behind its seam. Plain, calm UI copy; never black; Instrument Serif titles, Satoshi body, gold for actions.
- Never print, log, commit or ask for secrets in chat. Keys live only in Vercel, Railway and GitHub settings. If a key is missing, build against the interface with fakes, say exactly which setting is needed, and move on.
- Stop and ask a person only for: approving a migration that drops or rewrites data, spending money, publishing to a real channel for the first time, or a missing credential.

## Milestones to finish, in order, with what "done" means

**M3 Worker live.** Pipeline chaining: when a job succeeds, the next step for that show kind is enqueued (SQL, inside `complete_job` or a `private.advance_episode` called by it). On ingest success, record sha256 and duration on the source asset and insert the audio and proxy as `media_assets`; a second source with the same sha256 in the workspace flags the episode. Tighten RLS so editors can read but not write `jobs` and `job_events`. Deploy the worker to Railway. Done = an upload in the live Studio shows "Taking it in" then "Transcribing" in In the studio within a minute, with no human action.

**M4 Transcribe and understand.** `transcribe` sends only the audio key to AssemblyAI (speaker labels, word timings), stores the transcript; `cut` proposes removals (silences, false starts, retakes) as a cut list against the transcript, not a re-encode; `understand` (Anthropic) finds chapters, moments (story, claim, teaching, practice, question) with embeddings, themes, and pillar matches against the show's Vision; `write` drafts titles, description, chapters and captions in the brand voice. Golden test: one real Human Time with GG episode under `evals/golden/` with Grace's approved outputs; scores recorded per run. Done = a real episode reaches `review` with all text written, in under 10 minutes after upload for an 11-minute recording.

**M5 Review, the one gate.** `/review` lists episodes waiting; `/review/[episode]` shows the 540p preview with the cut list applied on playback, the text pieces side by side, every planned post per channel and time, and an agent chat that edits any piece (changes saved as versions, learned into the voice kit). One Approve schedules everything. Done = Grace approves an episode in one sitting without leaving the page.

**M6 Publish.** Render the master once (ffmpeg, cut list applied, chunked parallel encode), shorts and clips in parallel; publish through Zernio with each post's idempotency key; poll and write back live URLs; retries never double-post. Calendar and Today show it. Done = an approved episode goes out on YouTube, Instagram and Threads at its slots, live links back in the Studio.

**M7 Graphics.** HyperFrames blocks (lower-third, captions, chapter card, quote card, end card) bound to the brand kit and motion tokens, deterministic renders, snapshot tests for both QLS themes (add-block skill). Done = the Human Time master carries brand graphics that match the Studio's design canvas.

**M8 Grow.** Analytics into KPI evidence on Vision and goals (no hand-typed numbers left), Scout trend agents that suggest ideas built from what Grace has already said, the time constellation (themes, edges, holds for time anchors) in the Calendar, invites and workspace creation so other creators can join.

## Report after each milestone
What now works (as a person would notice it), the measured timings, what was tested and how, anything left for a person to do (named exactly), and the next milestone.
