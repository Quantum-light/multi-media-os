# orchestrator (phase 2)
Claims jobs from the Postgres queue (Supabase Queues), runs agent steps, calls the workers, retries with backoff, writes job_events. Not built yet: nothing half-built on main.
