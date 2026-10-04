# 0002 Job engine: one Postgres table, SKIP LOCKED leases

Date: 4 October 2026 · Status: accepted

## Decision
Pipeline jobs live in `public.jobs`, which is both the queue and the record. Workers call
`private.claim_job` (FOR UPDATE SKIP LOCKED, a lease, the attempt number as a fencing token),
`heartbeat_job`, `complete_job` and `fail_job`. Enqueue is idempotent on (episode, step, input hash).

## Why not Supabase Queues (pgmq)
The plan named pgmq. A separate message queue would mean two sources of truth (the message and
the jobs row) that must be kept in step, and the Studio already reads `jobs` for progress.
With one table, a job's state, attempts, cost and output are always in one row, and every change
writes a `job_events` line. At our volume (tens of jobs per episode) one indexed table is ample.

## Consequences
- Revisit if claim latency or lock contention shows up (hundreds of concurrent workers).
- The functions are not callable through the public API; workers use a direct database connection.
