# orchestrator

Runs pipeline steps. Every step is a job in `public.jobs`; this service claims one,
checks its input against the step's contract, runs the handler under a lease,
checks the output, and saves it. The rules live in the database
(`packages/db/supabase/migrations/0006_job_engine.sql`) and are proven by
`packages/db/tests/job_engine.sql`; `src/testing/memory-queue.ts` mirrors them for fast tests.

- Same episode, step and input hash is one job: finished work is never redone.
- A worker holds a lease and beats every third of it. The attempt number fences:
  a worker that lost its lease cannot save or extend anything.
- Ordinary errors retry with backoff (30s, 60s, 120s … 30 min cap) up to three attempts.
  `NonRetryableError`, bad input and bad output fail at once.

## Running
`src/main.ts` is the worker process. It needs `DATABASE_URL` (Supabase direct connection) and the
`R2_*` settings. In production it runs on Railway from `Dockerfile` (ffmpeg included); the root `railway.json`
points Railway at it. Locally: `npm start` with those variables set.

## Steps it runs today
- **ingest** (`src/steps/ingest.ts`): reads the source once while hashing it, then makes mono 16 kHz
  audio and a 540p preview in parallel. Tested end to end on generated 1080p video.

Adding a step: the `add-pipeline-step` skill, then `defineHandler({ step, run })` and register it in `main.ts`.
