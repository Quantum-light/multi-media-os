-- 0010: the Studio reads job progress; only the worker (direct connection, private.*
-- functions) changes jobs and events. Editors keep select; the write policies now
-- allow nothing. (Altered rather than dropped: a drop needs a person at the console.)
alter policy jobs_insert on public.jobs with check (false);
alter policy jobs_update on public.jobs using (false) with check (false);
alter policy jobs_delete on public.jobs using (false);
alter policy job_events_insert on public.job_events with check (false);
alter policy job_events_update on public.job_events using (false) with check (false);
alter policy job_events_delete on public.job_events using (false);
