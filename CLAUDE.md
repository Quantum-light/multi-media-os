# multi-media-os

One content system for podcasts and video shows, across many brands. A creator connects raw recordings and their style; the system cuts, writes, designs and schedules, and the creator approves once at Review. Human-sourced first: every published piece traces back to something a person recorded or wrote.

The full build plan lives in the Claude Doc "multi-media-os — Build Plan". This file is the map for anyone (person or agent) working in the repo.

## Layout
| Folder | Owns |
| --- | --- |
| `apps/studio` | The one interface (Next.js 15, React 19, plain CSS). Data only through `src/lib/data.ts`, one call per screen; it reads as the signed-in person so row-level security decides what they see. Pure shaping lives in `*.build.ts` files with tests. |
| `packages/contracts` | Zod schemas for every step, job and document. The source of truth. Depends on nothing internal. |
| `packages/brand` | Studio tokens, brand kits, motion tokens, the thread. |
| `packages/db` | Supabase migrations, isolation tests, generated types. |
| `services/*` | Orchestrator, media worker, render worker. Phase 2. |
| `evals/golden` | Real episodes with approved outputs, used as regression tests. |
| `docs/decisions` | One short record per architecture decision. |
| `specs` | The spec pack. Every change starts by editing a spec. |

## Rules (enforced in CI; a red check never merges)
1. Layers call downward only: apps → packages; packages never import apps. `npm run check:deps`.
2. No source file over 400 lines. `npm run check:size`. Split, never squeeze.
3. Every pipeline step has the same shape: `defineStep({ name, input, output })` in contracts, plus tests and fixtures. Use the `add-pipeline-step` skill.
4. Schema first. New tables are new migrations with row-level security, then the isolation test.
5. One way to do each thing. A second way needs a decision record in `docs/decisions`.
6. Tests gate everything: `npm run check` before every pull request.
7. Nothing half-built on main. Pages not ready stay out of the rail.
8. Never black in Studio. Instrument Serif titles, Satoshi body, gold for actions.
9. Never print, echo or commit secrets. Keys live in Vercel, Railway and GitHub settings only.

## Commands
```
npm ci --include=dev
npm run dev        # Studio on http://localhost:3200
npm run check      # size, layers, types, tests
```

## Autonomy
Level 0 today: every pull request is reviewed by a person. Migrations, auth, billing, publishing and these rules always need a person.
