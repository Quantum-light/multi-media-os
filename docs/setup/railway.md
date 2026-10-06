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
   - `ASSEMBLYAI_API_KEY` (transcribe), `ANTHROPIC_API_KEY` (understand, write), `ZERNIO_API_KEY` (publishing, M6).
   - Optional: `R2_JURISDICTION=eu` if the bucket is EU-jurisdiction; `LEASE_SECONDS` (default 300);
     `ANTHROPIC_MODEL` (default `claude-sonnet-5-5`); `ASSEMBLYAI_BASE_URL=https://api.eu.assemblyai.com` to keep audio in the EU;
     `PUBLISH_LIVE_EPISODES` (episode ids Grace has cleared to post for real; leave empty).
   - The password inside `DATABASE_URL` must be letters and numbers only: symbols would need URL-encoding.
     When the password changes, replace the whole value, never the middle of it.
3. Service → **Settings** → **Region**: EU West (Amsterdam), next to the database and storage.
4. Service → **Settings** → **Resources**: 4 vCPU / 8 GB is the sensible start for 1080p work.
   More cores make the preview and (later) the master encode faster.
5. Redeploy. Logs should show `[worker] <name> ready: ingest, cut, clip, storyboard, transcribe, understand, write`,
   one `[zernio]` line per channel, and then nothing until an upload lands. In the database the worker shows up in
   `pg_stat_activity` as `application_name = 'mmos-worker <name>'`.

## What a healthy log looks like
```
[worker] worker-abc ready: ingest, cut, clip, storyboard, transcribe, understand, write
[zernio] youtube @HumanTimewithGG: connected in Zernio
[worker] ingest 6f1d… succeeded
[worker] transcribe 81aa… succeeded
```
`queue error: … (backing off)` means the database is unreachable (wrong `DATABASE_URL`, or
the project is paused); the worker retries on its own.

## Scaling
One worker claims one job at a time. Run more replicas for parallel episodes; the queue's
leases make that safe. The CLI (`railway login`, `railway up`) is optional; the dashboard is enough.
