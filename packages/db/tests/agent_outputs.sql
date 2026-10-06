-- Agent outputs test (0011): transcribe, understand and write record what they made, in the
-- same transaction as the job; a redraft never overwrites a person's edit; people of another
-- workspace see none of it and nobody writes these tables directly. Always rolls back.
begin;

insert into auth.users (id, email) values
  ('60000000-0000-0000-0000-00000000000a', 'owner@agents.test'),
  ('60000000-0000-0000-0000-00000000000b', 'stranger@agents.test');
insert into public.workspaces (id, name, slug) values
  ('61000000-0000-0000-0000-000000000001', 'Agents test', 'agents-test'),
  ('61000000-0000-0000-0000-000000000009', 'Other', 'agents-other');
insert into public.members (workspace_id, user_id, role) values
  ('61000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-00000000000a', 'owner'),
  ('61000000-0000-0000-0000-000000000009', '60000000-0000-0000-0000-00000000000b', 'owner');
insert into public.brands (id, workspace_id, name, slug, brand_kit) values ('61000000-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000001', 'B', 'b', '{}');
insert into public.shows (id, workspace_id, brand_id, name, slug, kind, theme) values ('61000000-0000-0000-0000-000000000003', '61000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000002', 'Pod', 'p', 'podcast', '{}');
insert into public.episodes (id, workspace_id, show_id, state) values ('61000000-0000-0000-0000-000000000004', '61000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000003', 'processing');

do $$
declare
  ep constant uuid := '61000000-0000-0000-0000-000000000004';
  c public.jobs; j public.jobs; n int; t text; v int;
  tr jsonb := '{"transcriptKey":"ws/x/derived/transcript.json","provider":"assemblyai","providerRef":"tr_1","language":"en","durationS":660,"wordCount":1800,"speakers":["A","B"],"text":"A: Welcome to Human Time."}';
  un jsonb := '{"transcriptKey":"k","durationS":660,"model":"m","summary":"s","chapters":[{"startS":0,"title":"Welcome"}],
    "moments":[{"startS":12,"endS":40,"kind":"story","quote":"When I was nine","why":"w"},{"startS":100,"endS":130,"kind":"claim","quote":"Time is shared","why":"w"}],
    "themes":[{"name":"Shared time","slug":"shared-time"}],"pillars":[]}';
  wr jsonb := '{"title":"The watch","titleOptions":["The watch","Time we share"],"description":"About time.","chapters":[{"atS":0,"title":"Welcome"}],"chaptersText":"0:00 Welcome","model":"m",
    "captions":[{"platform":"instagram","body":"One hour, phone away."},{"platform":"threads","body":"Time is a gift."}]}';
begin
  -- 1. transcribe success stores the transcript and queues cut
  j := private.enqueue_job(ep, 'transcribe', '{"audioKey":"a"}', 'tr:1');
  select * into c from private.claim_job('w', array['transcribe']);
  perform private.complete_job(c.id, c.attempts, tr);
  select count(*) into n from public.transcripts where episode_id = ep and word_count = 1800 and speakers = array['A','B'] and storage_key like '%transcript.json';
  if n <> 1 then raise exception '1: transcript not recorded'; end if;
  if not exists (select 1 from public.jobs where episode_id = ep and step = 'cut' and status = 'queued') then raise exception '1: cut not queued'; end if;

  -- 2. understand records moments and themes, and a re-run replaces rather than doubles them
  select * into c from private.claim_job('w', array['cut']);
  perform private.complete_job(c.id, c.attempts, '{"transcriptKey":"k","durationS":660,"cuts":[],"removedS":0,"keptS":660}');
  for i in 1..2 loop
    if i = 2 then j := private.enqueue_job(ep, 'understand', '{"again":true}', 'understand:again'); end if;
    select * into c from private.claim_job('w', array['understand']);
    perform private.complete_job(c.id, c.attempts, un);
  end loop;
  select count(*) into n from public.moments where episode_id = ep;
  if n <> 2 then raise exception '2: expected 2 moments, got %', n; end if;
  select count(*) into n from public.edges e join public.themes th on th.id = e.to_id where e.from_id = ep and th.slug = 'shared-time' and th.brand_id = '61000000-0000-0000-0000-000000000002';
  if n <> 1 then raise exception '2: expected one theme edge, got %', n; end if;

  -- 3. write saves every piece as version 1 and hands the podcast to Review
  select * into c from private.claim_job('w', array['write']);
  if c.input <> un then raise exception '3: write was not queued with the understand output'; end if;
  perform private.complete_job(c.id, c.attempts, wr);
  select count(*) into n from public.pieces where episode_id = ep;
  if n <> 5 then raise exception '3: expected 5 pieces (title, description, chapters, 2 captions), got %', n; end if;
  select count(*) into n from public.piece_versions pv join public.pieces p on p.id = pv.piece_id where p.episode_id = ep and pv.version = 1 and pv.author = 'agent';
  if n <> 5 then raise exception '3: expected 5 first drafts, got %', n; end if;
  if not exists (select 1 from public.pieces where episode_id = ep and kind = 'title' and options = array['The watch','Time we share']) then raise exception '3: title options lost'; end if;
  select state into t from public.episodes where id = ep;
  if t <> 'review' then raise exception '3: episode is %, expected review', t; end if;
  if not exists (select 1 from public.episodes where id = ep and title = 'The watch' and chapters = '[{"atS":0,"title":"Welcome"}]') then raise exception '3: episode title/chapters not set'; end if;

  -- 4. a redraft replaces an untouched draft but never a person's edit
  update public.pieces set body = 'My own title', version = 2 where episode_id = ep and kind = 'title';
  insert into public.piece_versions (workspace_id, piece_id, version, body, author) select workspace_id, id, 2, 'My own title', 'person' from public.pieces where episode_id = ep and kind = 'title';
  j := private.enqueue_job(ep, 'write', un, 'write:2');
  select * into c from private.claim_job('w', array['write']);
  perform private.complete_job(c.id, c.attempts, jsonb_set(jsonb_set(wr, '{title}', '"A redraft"'), '{description}', '"Redrafted description."'));
  select body, version into t, v from public.pieces where episode_id = ep and kind = 'title';
  if t <> 'My own title' or v <> 2 then raise exception '4: person edit overwritten (% v%)', t, v; end if;
  if not exists (select 1 from public.piece_versions pv join public.pieces p on p.id = pv.piece_id where p.episode_id = ep and p.kind = 'title' and pv.version = 3 and pv.body = 'A redraft') then raise exception '4: redraft not kept as a version'; end if;
  select body, version into t, v from public.pieces where episode_id = ep and kind = 'description';
  if t <> 'Redrafted description.' or v <> 2 then raise exception '4: untouched draft not updated (% v%)', t, v; end if;
end $$;

-- 5. people of the workspace read it; strangers see nothing; nobody writes directly
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"60000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.pieces;
  if n <> 5 then raise exception '5: owner sees % pieces', n; end if;
  select count(*) into n from public.transcripts;
  if n <> 1 then raise exception '5: owner cannot read the transcript'; end if;
  begin
    insert into public.pieces (workspace_id, episode_id, kind, body) values ('61000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000004', 'title', 'x');
    raise exception '5: owner wrote a piece directly';
  exception when insufficient_privilege then null;
  end;
  update public.pieces set body = 'sneaky';
  if found then raise exception '5: owner updated a piece directly'; end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"60000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
do $$
declare n int;
begin
  select (select count(*) from public.pieces) + (select count(*) from public.piece_versions) + (select count(*) from public.transcripts) + (select count(*) from public.voice_lessons) into n;
  if n <> 0 then raise exception '5: a stranger sees % rows', n; end if;
end $$;

select 'agent outputs: all 5 checks passed' as result;
rollback;
