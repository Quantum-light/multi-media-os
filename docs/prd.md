# multi-media-os — what the product is

The requirements, not the schedule. `docs/build/plan.md` has the phases and
`docs/build/plan.json` proves what is actually done; `docs/build/system-map.md`
has each screen in detail. This file says what the thing has to be, so that when
those three disagree, there is something to settle it against.

## The problem

A creator records one thing and then needs thirty: an edit, a set of shorts,
titles, descriptions, captions, posts at the right times on five platforms, all
of it sounding like them. Doing that by hand takes longer than making the thing.
Handing it to someone else means explaining your taste every single time, and
getting it back slightly wrong.

Existing tools automate the mechanical half and lose the voice. The creator ends
up checking everything, which is the expensive part, so nothing is really saved.

## What this is

One system that takes a recording and carries it to published, where **the
creator's taste is written down, applied automatically, and improved by every
correction they make.** They approve once rather than supervising throughout.

It holds several brands, each with several shows, each with its own look, voice
and rhythm. A second brand is a row, not a rebuild.

## Who it is for

**Grace first, honestly.** Quantum Light Science: the Human Time with GG YouTube
show and the Journeys with Time podcast, with a tech brand after. Built for one
real creator with real episodes, because a system designed for an imagined one
is designed for nobody.

**Then other creators**, which is why nothing is hard-coded to her: brands,
shows, channels, styles, pillars and rhythms are all data, and the workspace is
multi-tenant from the first migration rather than retrofitted.

## The principles

1. **Human-sourced first.** Every published piece traces back to something a
   person actually recorded or wrote. The system cuts, arranges and phrases; it
   does not invent material and attribute it to her.
2. **One approval gate.** Upload runs everything; the creator approves once at
   Review; then it schedules. Not a checkpoint per step.
3. **Taste is data.** Brand kit, voice kit and saved styles are documents the
   creator can read and change, not prompts buried in code.
4. **The loop proposes, the person decides.** Corrections accumulate and the
   system suggests a new version of a style. It never rewrites taste on its own:
   a system that silently drifts toward its own average is how a brand turns to
   mush.
5. **A second brand is a row.** No per-show code.
6. **Nothing half-built is visible.** A screen that is not ready stays out of
   the rail.
7. **Nothing is claimed that is not proved.** Tests gate everything; a check
   that could not run reports as skipped, never as passed.
8. **No lock-in.** Database, sign-in, storage and the model each sit behind a
   seam (decision 0003).

## The three threads

Screens are views. These are the system, and every screen touches at least one.

- **The compass** — what each show is for: pillars, one goal, three objectives
  with evidence. Every step that writes words reads it, so output pulls towards
  the goal rather than merely reading well.
- **The style memory** — the brand kit (fonts, colours, motion, never-do), the
  voice kit (learned from edits) and the saved styles. Everything that writes or
  draws reads these; every correction at Review writes back to them.
- **The graph** — themes, moments, edges, time anchors, holds. Map, Calendar and
  Constellation are three views of one graph, never three features.

## The loop a person lives in

Vision sets the target → Map and Plan decide what to make → Upload and the
pipeline make it → Review approves it once → Calendar places it in time →
Analytics measures it against Vision → the style memory learns from every edit.

## What it must do

### Set up
- Create brands, shows and channels without a developer. Set each show's kind,
  rhythm, colours and where it posts.
- Write each show's compass: what it is, its mission, pillars, one goal, three
  objectives with KPIs that name where each number comes from.
- Write the brand kit, and save reusable styles by name.
- Invite other people into a workspace with a role.

### Make
- Take a multi-gigabyte recording without the Studio touching the bytes,
  resumable, and notice a duplicate before processing it twice.
- Transcribe, cut, understand, write, clip, storyboard, compose, render and
  publish, each step picked up automatically from the one before.
- Find the moments worth clipping and offer a ranked slate — 21 for Human Time,
  9–12 for the podcast — with the rest in reserve, never padded to hit a number.
- Apply the brand's styles to everything it cuts, writes and draws.

### Decide
- Show one episode whole: the preview with the cut applied, every written piece,
  every planned post, and a chat that edits any of it in words.
- Approve once, and schedule everything.
- Record every correction against the style that produced the thing corrected.

### Keep and learn
- A library where any recording can be opened at any time — how far it got, what
  it produced, what was said in it — including long after publishing.
- Propose improvements to a style from accumulated corrections, for acceptance.
- Search everything the creator has ever said.
- Measure what went out against what the show said it was for.

## Every screen

| Screen | What it is for |
| --- | --- |
| Today | What needs you, what is in the studio, the week ahead |
| Upload | Put a recording in |
| Episodes | The library: any recording, how far it got, what came out |
| Review | **The one gate.** Approve an episode in one sitting |
| Clip Studio | The ranked slate of shorts, the reserve, reorder and swap |
| Vision and goals | Each show's compass |
| Brands and shows | Brands, shows, channels — create and edit |
| Brand and style | The brand kit |
| Style Studio | Saved, reusable styles |
| Calendar | What goes out when, in layers per show and platform |
| Map | Search everything ever said |
| Plan and Trends | Ideas proposed from the creator's own material |
| Constellation | Themes through time; hold a piece for a moment |
| Analytics | Who it is for against who is watching |
| Settings | Account, workspace, team and invites, connected accounts, spend |

**Settings is a gap.** Invites exist in the database with no screen, there is
nowhere to see or revoke a connected channel, and nothing shows what the
pipeline has cost. For one person that is survivable; for anyone else it is not.

## What it must be, not just do

- **Multi-tenant from the first row.** Every table carries a workspace and
  row-level security. Proved by a test, not by inspection.
- **Fast enough to feel instant.** A 2 GB recording is taken in, hashed, and
  reduced to audio and a 540p preview in about twenty seconds. The old system
  took over thirty minutes for one step.
- **Honest when it fails.** A step that cannot run says which setting is missing
  and waits, rather than failing an episode. Reasons are in plain words.
- **Safe with money.** Every job records what it cost. Nothing may publish
  twice, whatever retries happen.
- **Safe with secrets.** Keys live in the host's settings only — never printed,
  logged or committed.
- **Never black.** Instrument Serif titles, Satoshi body, platinum glass, gold
  for actions. Each show keeps its own colour.

## Out of scope, deliberately

Writing material the creator never said. Generating a presenter. Cross-posting
other people's content. Being a video editor — the creator's taste is captured
as rules, not as a timeline to drag.

## Open decisions

The public name. Pricing and billing. Whether a creator can bring their own
model keys. Whether the podcast system stays separate or becomes one more show.
Mobile: approve from a phone, or desktop only.
