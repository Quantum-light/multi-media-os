# 0005 One record of a correction

Date: 23 October 2026 · Status: accepted

## Decision
`public.style_edits` is the one record of a correction a person makes. Every correction lands there
and nowhere else: the style that produced the thing (null until something claims it), the episode,
the subject, what was proposed, what was accepted, and their note.

`voice_lessons` (0013) kept the same fact for written pieces only, with no style, no episode and no
`folded_into`. The distil step reads `style_edits`, so a correction recorded only as a voice lesson
is a correction the loop can never learn from, and a loop that learns only about words cannot learn
about cuts or clips. The general record wins; the voice kit now reads it rather than keeping its own
copy, through the view `public.voice_lesson_feed` (the copy corrections, shaped the way the voice kit
wants them).

| | Where it goes | How it gets there |
| --- | --- | --- |
| Text in Review, typed or through the chat | `style_edits`, subject `copy` | `public.save_piece_edit`, which calls `public.save_piece` and then records the correction in the same transaction |
| A cut, a clip, a graphic, a posting time | `style_edits`, their own subject | `public.record_correction`, one server action returning `SaveResult` |
| What the voice kit reads | `public.voice_lesson_feed` | a view of `style_edits` where the subject is `copy` |

The vocabulary of subjects lives in one place, the check constraint on `style_edits`. The insert
lives in one place, `private.record_correction`. Which style claims a thing is asked in one place,
`private.claiming_style`: a step claims its style by naming `styleId` in its job output, so no step
needs a function of its own and nothing invents a claim that was never made.

## What this rules out
- **A table per kind of correction.** No `cut_edits`, no `clip_notes`. A new kind of correction is a
  new subject on the existing check constraint and a call to the existing door.
- **A second write of the same fact.** The voice kit reads corrections; it does not collect them.
- **Guessing which style produced something.** A correction with no claimed style is recorded with
  `style_id` null and waits. Attributing it to the brand's likeliest style would teach the wrong
  style, which is exactly the silent drift principle 4 forbids.
- **The loop applying what it learns.** `folded_into` stays null until a distil step proposes a
  version and a person accepts it. Nothing here writes a style.

## Rules that keep it true
- `public.save_piece` is untouched. It is applied and Review depends on it; `save_piece_edit` wraps
  it instead of replacing it, so the correction and the version are one transaction or neither.
- `voice_lessons` keeps its rows and `save_piece` keeps writing them, because dropping the table
  means changing an applied function. Nothing reads it any more. The drop is a later migration with
  a person at the console.
- Review writes through a server action, which calls one definer function, which checks the person's
  role. No table is written from the Studio directly.

## What is not proved yet
The cut and clip steps have never run, so no job output names a `styleId` and every correction
recorded so far carries `style_id` null. The database test proves the claim is picked up the moment
a step makes one, with a `write` job that names its style; it does not prove that any step will.
