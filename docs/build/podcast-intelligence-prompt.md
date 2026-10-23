# Podcast intelligence: prompt for a building agent

Paste everything below the line into a fresh agent session (Claude Code, Cowork or a long-running agent) that has
this repo, both Supabase projects and a shell on Grace's Mac. It works stage by stage and stops only where Grace
must decide.

---

You are the engineer connecting **the podcast system** to **the graph** in multi-media-os, so that everything Grace
has said, the themes, claims and tags in it, and every visual and post made from it, is stored in Postgres and becomes a
layer of intelligence across her shows. Journeys with Time (the Quantum Light Science podcast by Grace Gold) is the
first show. Owner: Grace (grace@quantumlightscience.org).

## Read first
1. `CLAUDE.md` (the rules), `packages/db/CLAUDE.md`, `docs/build/system-map.md` (the three threads: compass, style
   memory, **the graph** — themes, edges, time_anchors, holds, moments; Map, Calendar and Constellation are views of it).
2. `podcasts/README.md` — the podcast engine (`podcasts/engine`) and the show folder (`podcasts/shows/journeys-with-time`:
   `show.json`, `brand/brand.json`, `rules/`, `template/`). The engine is kept apart from the main code on purpose:
   it is reusable for any podcast, and each show brings its own brand, rules and template. Keep it that way.
3. What the engine already writes per episode in `podcasts/shows/<show>/out/<episode>/`: `transcript.json` (words and
   sentences in ms), `plan.json` (clips, scores, publishing order, claims to check), `directions.json` (scene per shot),
   `art-plan.json` + `art.json` (atmosphere per shot, new plates), `captions.json`, `schedule.json` (Zernio post ids).

## What exists (do not rebuild)
- **multi-media-os database** (Supabase `rxweinpsmtgrostfoutn`): `workspaces`, `brands` (Quantum Light Science),
  `shows` (journeys-with-time, human-time-with-gg), `channels`, `show_channels`, `episodes`, `media_assets`, `moments`
  (with `embedding`), `themes`, `edges` (from_kind/from_id → to_kind/to_id, kind, weight), `time_anchors`, `holds`,
  `posts`, `styles`, `jobs`. Graph tables are empty. RLS is by workspace.
- **Quantum Light Science system database** (Supabase `uqxwzkspktrmydgxhwxi`, repo `qls-systems`): the sovereign
  knowledge platform. `media_content` (media registry, empty), `media_canon_links`, `content_chunks`, `canon_scientific`,
  `terminology`, plus `qa_claims` (technology-forecast claims — a different thing; do not reuse it for spoken claims).
  Its CLAUDE.md covenant applies: all QLS content is TOP SECRET, no autonomous publication, Grace decides canon.
  `supabase/migrations/014_media_mapping.sql` there is a draft from an earlier session; replace it with the slim bridge below.
- **Episodes on disk:** `~/Documents/Claude/Projects/QLS Podcast/QLS episodes/` (29 WAV recordings, many named by date).
  **Published on Captivate** (→ Spotify): "The New Science of Time" (Apr 2026) and
  "Quantum Light, Spacetime & the Substrate Beneath Reality" (Aug 2026, S1E2). Captivate client: `podcasts/engine/lib/captivate.mjs`.
- Keys live in `podcasts/.env` (never print, log, commit or paste them).

## Stage 1 — Store the intelligence in multi-media-os (one migration, additive)
Add, following the repo's migration rules (numbered file, RLS by workspace on every table, SQL test in a rolled-back
transaction, regenerate `database.types.ts`, run the advisors):
- `claims` — episode_id, moment_id?, clip_id?, text, spoken_text, claim_type (established_science | qls_framework |
  forward_looking | personal_experience | health_wellbeing | other), start_s, end_s, needs_check, check_note,
  review_status (unreviewed | verified | frame_as_view | reword | rejected), embedding, stable `claim_key`.
- `tags` + `taggings` — Grace's own tag vocabulary (name, slug, kind) and what each tag is on (episode, moment, clip, claim, plate).
- `clips` — episode_id, number, title, start_s, end_s, length_band, beat, scores, publish_order, why, status
  (draft | approved | rejected | scheduled | published), video_key, brand_version.
- `shots` — clip_id, index, at_s, scene, label, spoken_text, plate_id.
- `visual_plates` — show_id, slug, status (approved | candidate | rejected), means, prompt, style_ref, decision_reason,
  brand_version, still_key, loop_key.
- Use the existing `themes` (per brand) and `edges` for every relationship: episode→theme, moment→theme, claim→theme,
  clip→theme, plate→theme, claim→claim (supports / contradicts / extends), theme→theme.
- Two read views for any frontend: `clip_overview`, `theme_overview`. Frontends read views and tables only, so the
  Studio or any redesign keeps working.

## Stage 2 — Understand every episode (no rendering)
For each recording in the episodes folder (and each Captivate episode):
1. Register it: `episodes` row for journeys-with-time (title, recorded_at from the file name, duration, Captivate id and
   published date where it matches), `media_assets` with the fingerprint so duplicates are caught.
2. Transcribe with the engine (`npm run clips -- <file> --plan` already transcribes and picks; reuse its cache).
3. Extract, with Claude, into the tables above: themes (reuse existing slugs before inventing new ones), claims (typed and
   checked), moments (the strongest passages, with embeddings for Map search), and tags from Grace's vocabulary.
   **Ask Grace where her existing tags live** (Obsidian vaults, the QLS system's `topic_tags` / `terminology`, Captivate)
   and import them first, so extraction uses her words.
4. Write a sync step in the engine, `npm run sync -- <episode>`, that upserts everything the engine produced
   (transcript → moments, plan → clips, directions/art → shots and plates, captions/schedule → posts). Idempotent by key.

## Stage 3 — Decide the release order (Grace approves)
From the graph, propose the order in which unreleased episodes go out: open with the most universal ideas, build concepts
in dependency order (an idea is introduced before episodes that rely on it), alternate themes so neighbours differ, and
keep the strongest episodes early. Show it as a short table (order, title, main themes, why here). Grace approves or
reorders; then set `episodes.number` and planned dates, and each episode's clips follow its release in the schedule.
Full episodes are published on Captivate only after Grace approves the description and links.

## Stage 4 — Bridge into the Quantum Light Science system (one-way, read-only for multi-media-os)
Replace the draft `qls-systems/supabase/migrations/014_media_mapping.sql` with a slim, additive bridge:
episodes → `media_content` (media_type 'podcast', series 'Journeys with Time', transcript, `source_file`), themes and
reviewed claims → `media_canon_links` / a `media_claims` table that can link to `canon_scientific` and `terminology`.
Only claims Grace has reviewed cross over. Nothing in the QLS system is ever published from here.

## Stage 5 — Prove it
Run Stages 2–4 on the two published episodes end to end, then show Grace: the themes across both, the claims to review,
the proposed release order for the rest, and one search in Map that finds a passage by meaning.

## How to work
- Small commits on a branch; `npm run check` green before every push. Never touch `podcasts/` engine behaviour without
  keeping `npm run clips` working on the two published episodes.
- Every live database change: show Grace the migration first; destructive statements need her explicit yes.
- Stop and ask only for: where her tags live, the release order, canon links, and anything that would publish.
