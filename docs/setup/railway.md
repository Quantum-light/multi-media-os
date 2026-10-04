# Railway: where the worker runs

The worker (`services/orchestrator`) claims jobs from the database and does the media work.
Railway builds it from `services/orchestrator/Dockerfile` (ffmpeg included) because the root
`railway.json` says so.

## One-time setup (about five minutes, in the Railway dashboard)
1. railway.com → **New Project** → **Deploy from GitHub repo** → `Quantum-light/multi-media-os`.
   Railway reads `railway.json` and builds the worker. The first deploy will fail on purpose
   until the variables below exist; that is fine.
2. Service → **Variables** → add:
   - `DATABASE_URL`: Supabase → **Connect** (top bar) → **Session pooler** connection string
     (port 5432). It contains the database password; paste it here only.
   - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` (same values as in Vercel; see `r2.md`).
   - Optional: `R2_JURISDICTION=eu` if the bucket is EU-jurisdiction; `LEASE_SECONDS` (default 300).
3. Service → **Settings** → **Region**: EU West (Amsterdam), next to the database and storage.
4. Service → **Settings** → **Resources**: 4 vCPU / 8 GB is the sensible start for 1080p work.
   More cores make the preview and (later) the master encode faster.
5. Redeploy. Logs should show `[worker] <name> ready: ingest` and then nothing until an upload lands.

## What a healthy log looks like
```
[worker] worker-abc ready: ingest
[worker] ingest 6f1d… succeeded
```
`queue error: … (backing off)` means the database is unreachable (wrong `DATABASE_URL`, or
the project is paused); the worker retries on its own.

## Scaling
One worker claims one job at a time. Run more replicas for parallel episodes; the queue's
leases make that safe. The CLI (`railway login`, `railway up`) is optional; the dashboard is enough.
