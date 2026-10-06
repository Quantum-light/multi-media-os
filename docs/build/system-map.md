# The system map

Every screen of multi-media-os, what it is for, what it reads and writes, what it depends on,
and the test that says it is done. Agents build from this file. When the map and the code
disagree, fix one of them in the same change.

Design canvas (the drawn version): https://claude.ai/artifact/A3hxVAxg7vsTk4gw7SjQp6

## The three threads

Screens are views; these three are the system. Every screen touches at least one.

1. **The compass** — `shows.compass`, validated by `Compass` in `@mmos/contracts`. What the show
   is, its pillars, one goal, three objectives with evidence. Every step that writes words reads
   it, so output pulls towards the goal rather than merely reading well.
2. **The style memory** — `brands.brand_kit` (fonts, colours, motion, style words, never-do),
   `brands.voice_kit` (learned from edits), and the prompt library (named, reusable styles).
   Everything that writes or draws reads these; every human edit in Review writes back to them.
   This is the self-improving loop.
3. **The graph** — `themes`, `edges`, `time_anchors`, `holds`, `moments`. Map, Calendar and
   Constellation are three views of this one graph, never three separate features.

## The loop a person lives in

Vision sets the target → Map and Plan decide what to make → Upload and the pipeline make it →
Review approves it once → Calendar and Constellation place it in time → Analytics measures it
against Vision → the style memory learns from every edit.

## The screens

Status: **live** (built and deployed) · **thin** (built, simpler than designed) · **planned**.

### 1. Today — `/` — live
The morning view: what needs you, what is in the studio, the week ahead, whether anything is stuck.
Reads episodes, jobs, posts, shows. Writes nothing.
Done: a person can tell in five seconds whether anything needs them.

### 2. Upload — `/upload` — live
Drop a recording; it goes to R2 in parallel parts, resumable, duplicate-checked, then starts the pipeline.
Writes `episodes`, `media_assets`, calls `start_ingest`. Not on the original canvas; added for M2.
Done: a 2 GB file uploads without the Studio touching the bytes, and resumes after a dropped connection.

### 3. Vision and goals — `/vision` — live
Per show: what it is, mission, how you see it, vision, pillars, one goal, three objectives with KPIs
and where each number comes from. Reads and writes `shows.compass` through the contract.
Done: Grace can write a show's vision from nothing and change it later, and unfinished parts come
back as plain sentences.

### 4. Brands, shows and channels — `/shows` — thin
Designed: create and edit brands, shows and channels; one account carries several shows.
Built: read-only view. Needs create and edit so a second brand is a row, not a rebuild.
Reads/writes `brands`, `shows`, `channels`, `show_channels`.
Done: Grace adds the tech brand, its show and its channels without anyone's help.

### 5. Calendar — `/calendar` — thin
Designed: layers per show and platform, themes, and the story arc across weeks.
Built: month grid with posts and moments in time.
Reads `posts`, `shows`, `time_anchors`, later `themes` and `edges`.
Done: Grace can see a month as story, not just as dates, and switch layers.

### 6. Review, with the agent chat — `/review`, `/review/[episode]` — planned
**The one gate.** The 540p preview with the cut list applied on playback, every written piece side
by side, every planned post per channel and time, and a chat that edits any piece in words.
One Approve schedules everything. Every edit is saved as a version and folded into the voice kit.
Reads episodes, jobs, moments, posts, brand kit, voice kit. Writes the edited pieces, versions,
voice kit, and on approve the posts and the render jobs.
Depends on: M4 (something to review).
Done: Grace approves an episode in one sitting without leaving the page.

### 7. Clip Studio — `/review/[episode]/clip/[clip]` — planned
The same thing at clip scale: which moment, which crop, which caption style, with the agent chat.
Reads moments, the proxy, the brand kit. Writes the clip's cut and style.
Depends on: Review.
Done: Grace reshapes a short by talking to it, and the preview updates without a render.

### 8. Brand and style — `/brand` — planned
Fonts, colours, motion, style words, the never-do list. The brand kit, edited by a person.
Reads/writes `brands.brand_kit` through the `BrandKit` contract.
Depends on: nothing. Build it early: it raises the quality of everything the agents write.
Done: Grace changes a colour or adds a never-do, and the next render and the next draft obey it.

### 9. Style Studio — `/brand/styles` — planned
AI video styles and the prompt library: named, reusable instructions ("my hook style", "how I open
an episode"). A style is a name, when to use it, and the instruction. Saved styles are offered in
Review and Clip Studio.
Reads/writes a `styles` table (planned) and `brands.voice_kit`.
Depends on: Brand and style.
Done: Grace saves how she opens an episode once, and later applies it by name.

### 10. Map — `/map` — planned
Search everything she has ever said: transcripts, moments, themes, across every show. The source of
human-sourced ideas.
Reads `moments` (with embeddings), `episodes`, `themes`.
Depends on: M4 (transcripts and moments exist).
Done: Grace finds the thing she said about time in an episode she cannot name.

### 11. Plan and Trends — `/plan` — planned
The plan board, with Scout agents proposing ideas built from what she has already said, each tied to
a pillar and a slot.
Reads the graph, the compass, Scout output. Writes planned pieces.
Depends on: Map, and the compass.
Done: every suggestion names the thing of hers it grew from.

### 12. Constellation — `/constellation` — planned
Content through time, in three dimensions: themes as orbits, connections as threads, moments in
time as anchors. Hold a piece for a future moment; resurface an old one when its moment comes.
Reads `edges`, `themes`, `time_anchors`, `holds`. Writes holds and edges.
Depends on: the graph having something in it.
Done: Grace holds a piece for the winter solstice and it appears in the plan when the time comes.

### 13. Analytics: audience fit — `/analytics` — planned
Who the show is for against who is actually watching, and the real numbers behind every KPI on
Vision and goals. No hand-typed numbers left.
Reads platform analytics, `posts`, the compass. Writes KPI evidence.
Depends on: M6 (things published), and platform analytics.
Done: every number on Vision and goals can be opened to its source.

### Shared: the rail
Pages not finished stay out of it. That rule is why the Studio has never shown a broken page.

## Build order

Two lanes that do not touch the same files.

**Spine** (needs the keys): worker live → M4 transcribe, cut, understand, write → M5 Review and
Clip Studio → M6 publish → M7 graphics.

**Surface** (no keys needed): Brand and style → Style Studio → Brands, shows and channels
(create and edit) → Calendar layers → Map → Plan → Constellation → Analytics.

Surface items that depend on the spine (Map, Plan, Constellation, Analytics) wait for it, and are
built against fixtures first so the screen is ready the day the data arrives.
