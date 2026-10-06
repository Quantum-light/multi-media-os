---
name: add-screen
description: Build or finish one Studio screen from the system map. Use for any page in apps/studio, and before touching the navigation rail.
---

One screen per change. The map (`docs/build/system-map.md`) says what it is for, what it reads
and writes, and the test that says it is done. If the map is wrong, fix the map in the same change.

1. **Read first**: the screen's entry in `docs/build/system-map.md`, and its artboard in the design
   canvas (listed there). Match the drawn layout where it exists; it was designed with a person in mind.
2. **Data**: one function per screen in `apps/studio/src/lib/data/<screen>.ts`, exported from
   `lib/data.ts`. One call per screen. It reads as the signed-in person, so row-level security decides
   what comes back. Never reach for `@supabase/*` outside `lib/supabase`.
3. **Shaping**: anything that turns rows into what the page shows goes in `<screen>.build.ts`, pure,
   with tests next to it. Time zones, empty states and bad data are tested there, not in the page.
4. **Writing**: a server action in the screen's folder. Validate against the contract in
   `@mmos/contracts` before writing, and turn a failed check into sentences a person can act on
   ("Mission is still empty"), never a stack trace. Scope every update to the person's workspace.
5. **Empty states are the screen**, not an afterthought. A screen with nothing in it says what would
   put something there, and offers the action.
6. **Look**: never black. Instrument Serif titles, Satoshi body, gold for actions, glass panels.
   Plain, calm copy: say what happened, not what the system did.
7. **The rail**: add the screen only once it is finished. A half-built page stays out (rule 7).
8. **Check**: `npm run check`, `npm run build`, then `npm run check:e2e`. Then the brand-reviewer and
   architecture-reviewer agents. Push only when all are green.
