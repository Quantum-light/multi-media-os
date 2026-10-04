---
name: add-pipeline-step
description: Add or change a step in the episode pipeline (ingest, transcribe, cut, understand, write, clip, storyboard, compose, render, review, publish). Use whenever work touches what a step takes in or produces.
---

1. Edit the spec in `specs/steps/<step>.md` first: purpose, input, output, failure behaviour, cost budget.
2. In `packages/contracts/src/steps/<step>.ts`, declare it with `defineStep({ name, input, output })`. Input and output are Zod schemas; no `any`, no loose JSON.
3. Add contract tests next to it: one valid example, one invalid example per rule.
4. Add fixtures under `evals/golden/<show>/<episode>/<step>/` when the step's output can be compared.
5. Implement in the owning service (orchestrator, media-worker or render-worker), reading and writing only the contract types.
6. The step must be idempotent: same input hash returns the saved output.
7. Run `npm run check`, then ask the architecture-reviewer agent to review.
