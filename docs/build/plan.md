# The phased build

What is left, in the order that unblocks things. `plan.json` beside this file is
the same plan as something a machine can check — run `npm run check:plan` and it
proves each item against the repo and the live database rather than taking the
plan's word for it. **Keep the two in step:** when an item is finished, mark it
`done` in `plan.json`; the checker will tell you when you have forgotten.

`docs/build/system-map.md` has the screen-by-screen design.

The rule running through all of it: **nothing is built that cannot be proved.**
Every step talks to a port, so it is tested against a fake and works the day its
key arrives.

---

## Phase 1 — everything that needs no keys · done, 23 Oct 2026

The transcript as its own document in R2, because every later step reads it and
a long episode runs to hundreds of kilobytes. The transcribe step behind a
`Transcriber` port with AssemblyAI behind that. The clip contracts carrying the
four signals. `selectClips`, the deterministic half of the finder. Migration
0012, the style loop.

**Episodes** (`/episodes`) — the library the design was missing. Every recording,
how far it got, each step's state and reason for stopping, the files, and the
transcript to read. Review is a decision about one episode at one moment; this
is where you look at anything, any time.

The worker now registers a step only when it can actually be done: without its
key the handler is left out and those jobs wait in the queue. Registering it
regardless would fail every job on arrival and mark the episode failed.

## Phase 2 — the words

1. **transcribe runs** once `ASSEMBLYAI_API_KEY` is in Railway.
2. **cut** — silence, ums, false starts, tangents, against the show's episode
   style. The output is a cut list, not a render: cheap to redo, cheap to preview.
3. **understand** — themes, claims, moments. Fills the graph tables that Map,
   Plan and Constellation read.
4. **clip** — the model proposes candidates; `selectClips` decides the slate.
5. **write** — titles, descriptions, captions, posts, in the brand's voice.

## Phase 3 — Review

The one gate. The 540p preview with the cut applied on playback, every written
piece side by side, every planned post, and the agent chat that edits any of it
in words. One Approve schedules everything.

**Every correction made here writes a `style_edits` row.** That is the loop
closing: from here the system has a record of where it was wrong.

Then **Clip Studio** — the ranked board, the chosen slate, the reserve.

## Phase 4 — the loop learns

`distil` reads the corrections a style has collected and **proposes** a new
version. Accept or decline; it never rewrites a style on its own, because a
system that silently drifts toward its own average is how a brand turns to mush.

`learn_style` derives a style from a finished edit and the recording it came
from, instead of asking a person to describe themselves.

## Phase 5 — out into the world

**compose** and **render** — the heaviest remaining piece, and what
`services/render-worker` and `services/media-worker` are empty folders waiting
for. Then **publish** through Zernio against each show's slots, with retries
that cannot double-post. The `posts` table is already built for it.

## Phase 6 — the long view

**Map**, **Plan and Trends**, **Constellation**, **Analytics**. These want a
body of episodes behind them, so they come last by nature rather than by
preference.

## Alongside

Migration 0004 (it drops a policy, so it waits for a person at the console).
Calendar layers. Resend SMTP, to end the hourly sign-in limit. Cost ceilings —
`jobs.cost_pence` is recorded and nothing caps it.

## What only a person can do

| | |
| --- | --- |
| `ASSEMBLYAI_API_KEY` in Railway | Phase 2 starts |
| `ANTHROPIC_API_KEY` in Railway | the rest of Phase 2 |
| The show's styles, into Style Studio | written in a working session, pasted in |
| Zernio key | Phase 5 |

Scope is Quantum Light Science for now — Human Time with GG and Journeys with
Time. Tech Prophecy Time joins as a third show once its own style settles.
