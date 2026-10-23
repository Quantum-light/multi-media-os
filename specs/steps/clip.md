# Step: clip (the viral finder)

**Purpose.** Find the shorts for an episode: the passages that would hold up on their own,
chosen against Grace's four signals rather than against "engagement".

**Signals** (`ClipSignal`, packages/contracts/src/clip.ts). A clip claims exactly one, the
strongest where more than one fits:
`standalone_idea` a complete thought needing no context; `opening_line` a first sentence
that would stop a scroll; `surprising` it cuts against what people assume; `personal`
candid, funny, or out of her own life.

**Input** (`ClipInput` = `WriteOutput`), plus the episode's `understand` and `cut` results
and the transcript document that `understand` names.

**How it runs.**
1. The target comes from the show: a `clipsPerEpisode` setting on the show when it has one,
   otherwise 21 for a video show and 12 for a podcast. This wants to become a real per-show
   column on `public.shows`; `clipTarget` in services/orchestrator/src/steps/shorts.ts is
   the seam for it.
2. One paid pass (`offer_clips`, a forced tool): the model reads the transcript with the
   cuts already taken out and offers candidates as `ScoredClip`s — a signal, a score out of
   100, the hook word for word, the quote and a one-sentence reason. It is asked for half
   again as many as the target (32 for 21, 18 for 12), because selection drops overlaps and
   anything under the bar.
3. Grounding: a candidate whose quote was not really said, or which runs past the end of the
   recording, is dropped before anything is counted.
4. `selectClips` (services/orchestrator/src/clips/select.ts) decides: ranks by score, keeps
   one clip per moment, gives every signal that found something a place, then fills by
   score. What is left over is the reserve.
5. The slate is written to `public.clips`, one row per chosen and reserve clip against this
   job's id, ranked 1 upwards across the whole slate, state `chosen` or `reserve`. The table
   is append-only: a re-run writes its own fresh set and deletes nothing.

**Output** (`ClipOutput`): `target`, `proposed`, `chosen`, `reserve`, `shortfall`, `model`.
Counts only — the slate itself is in the table, so Review reads it there.

**Rules.** The slate is never padded: a shortfall is reported, and an episode that gave
nothing writes no rows and says so. The model is asked for clips of 15 to 90 seconds and
selection accepts 8 to 90, two cuts of one moment count
as one clip, and no clip is offered without a signal, a hook and a reason.

**Tests.** services/orchestrator/src/steps/shorts.test.ts (the step, on `FakeLlm`) and
src/clips/select.test.ts (the deciding).
