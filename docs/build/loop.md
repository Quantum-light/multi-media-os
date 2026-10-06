# The build loop

A prompt for a long-running agent. It builds the system from the map, one piece at a time, and
proves the whole thing still works after each one. Paste it whole into a session that has this
repo, the Supabase project and a shell.

Two agents can run this at once **only** in different lanes (see the map's build order). The spine
lane touches `services/`, `packages/db` and the pipeline steps. The surface lane touches
`apps/studio`. Neither edits the other's files; both edit the map, so pull before you push.

---

You are building **multi-media-os** to production, from `docs/build/system-map.md`.

Your lane: **<spine | surface>**. Work only in that lane's files.

Read first: `CLAUDE.md`, `docs/build/system-map.md`, `.claude/skills/`, `docs/decisions/`.

## The loop

Repeat until the lane's items are all live, or you hit a stop.

1. **Pick.** The first item in your lane's build order that is not yet live and whose dependencies
   are live. Say which one and why it is next, in one line.
2. **Spec.** If the map's entry is thin, thicken it first: what a person does there, what it reads
   and writes, and the test that says it is done. The map is the spec.
3. **Build.** Use the `screen-builder` agent for a Studio screen, the `add-pipeline-step` skill for
   a step, `add-migration` for schema. Small commits as you go.
4. **Prove.** Use the `release-checker` agent. It must come back with no failures, and it must say
   which checks were skipped and why. For anything touching the pipeline, put a real episode
   through and report the measured times.
5. **Record.** Update that item's status in the map, in the same commit as the work. Push. Confirm
   GitHub CI is green and, for Studio work, that the Vercel deploy is Ready.
6. **Report, then go again.** Four lines: what a person can now do that they could not before, the
   numbers you measured, what you tested and how, and what is next. Then start at 1.

## Stop and ask only for

- A missing credential. Name the exact setting and where it goes. Then build the next thing that
  does not need it, against a fake, so the work is ready when the key arrives.
- A migration that drops or rewrites data.
- Spending money, or publishing to a real channel for the first time.
- Three failed attempts at the same thing. Say what you tried, what happened, and what you would
  try next. Do not keep going round.

## Never

- Leave a half-built page in the rail.
- Weaken a test, widen a layer rule or delete a check to turn a run green.
- Claim something works that you have not seen work. A check that could not run is skipped, not passed.
- Print, log or commit a secret.
- Invent data to make a screen look finished.

## What "production" means here

Not "the code is written". It means: Grace uploads a recording, the system cuts, writes and designs
it, she approves once, it goes out on schedule, the live links come back, and the numbers land on
Vision and goals. Every loop should move that sentence closer to true, and you should be able to
say which part of it you moved.
