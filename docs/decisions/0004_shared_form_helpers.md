# 0004 — One way to build a screen a person types into

**Date** 9 October 2026 · **Status** accepted

## The problem

Vision and goals was the first editable screen, and it grew its own field
components, its own CSS module and its own "turn a contract complaint into a
sentence" function. Brand and style, Style Studio and the Brands and shows forms
would each have grown a fourth, fifth and sixth copy.

## The decision

New editable screens use:

- `src/components/Form.tsx` — `Line`, `Word`, `Choice`, `Colour`, `WordList`,
  `Problems`, `Saved`, `Actions`
- `src/components/Form.module.css` — the look of every box a person types into
- `src/lib/save.ts` — `SaveResult`, `problemsFrom`, `slugify`

A save action validates with its contract, maps the issues through
`problemsFrom`, scopes the write to `workspace_id` and lets row-level security
decide the rest. The same shape every time.

## What is still outstanding

`app/(studio)/vision` keeps its own `edit.module.css` and its own `readable()`.
It works and it is covered by tests, so it was not rewritten blind. Whoever next
touches Vision should move it onto the shared three and delete its copies — at
which point this section goes away.

## Why not a form library

Nothing here needs one. The fields are plain inputs, the validation already
lives in `@mmos/contracts`, and a library would be a second source of truth
about what a valid document is.
