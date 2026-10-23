-- 0017_clips.sql
-- What the finder offered, and what a person did about it.
--
-- Append-only by design: a re-run writes a fresh set of rows against its own
-- job_id rather than replacing the last one. That keeps the history of what was
-- offered when, and means no function here deletes anything — which also means
-- this migration can be applied without a person at the console.
--
-- The Studio reads the newest job's rows. People may change a clip's state
-- (approve it, reject it, swap one in from the reserve) and nothing else: the
-- finder's judgement is a record, not something to edit after the fact.

create table if not exists public.clips (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  episode_id    uuid not null references public.episodes(id) on delete cascade,
  job_id        uuid not null references public.jobs(id) on delete cascade,
  -- 1 is the strongest. Ranks run across the whole slate, chosen then reserve.
  rank          integer not null check (rank > 0),
  state         text not null check (state in ('chosen', 'reserve', 'approved', 'rejected')),
  -- Grace's four signals. The finder must claim one for every clip it offers.
  signal        text not null check (signal in ('standalone_idea', 'opening_line', 'surprising', 'personal')),
  score         numeric not null check (score >= 0 and score <= 100),
  start_s       numeric not null check (start_s >= 0),
  end_s         numeric not null,
  -- The first line out of her mouth, what was said, and why it clears the bar.
  hook          text not null,
  quote         text not null,
  reason        text not null,
  decided_at    timestamptz,
  decided_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  check (end_s > start_s),
  unique (job_id, rank)
);

create index if not exists clips_episode on public.clips (episode_id, created_at desc);
create index if not exists clips_ws on public.clips (workspace_id);
create index if not exists clips_job on public.clips (job_id, rank);

alter table public.clips enable row level security;

create policy clips_read on public.clips
  for select to authenticated using (private.is_member(workspace_id));
-- Only the worker writes clips, through its direct connection.
create policy clips_insert on public.clips
  for insert to authenticated with check (false);
create policy clips_update on public.clips
  for update to authenticated using (private.can_edit(workspace_id)) with check (private.can_edit(workspace_id));
create policy clips_delete on public.clips
  for delete to authenticated using (false);
