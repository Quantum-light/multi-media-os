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

There is no `main` yet on purpose: the worker process ships with the first real
step handler (nothing half-built on main). Adding one: the `add-pipeline-step` skill,
then `defineHandler({ step, run })`.
