# Step: cut

**Purpose.** Propose what to take out (long pauses, filler sounds, stutters, retakes) as a cut
list on the source timeline. Nothing is re-encoded; render applies the list once, after Review.

**Input** (`CutInput` = `TranscribeOutput`). **Output** (`CutOutput`): the transcript key, duration, the
cuts (start, end, reason, the words removed), seconds removed and kept.

**Rules** (`services/orchestrator/src/edit/cut-plan.ts`, deterministic: the same transcript always
gets the same list):
- Pauses over 1.0 s are shortened, keeping 0.3 s either side.
- Filler sounds (um, uh, er, erm, hmm) go.
- A word said twice within 1.2 s ("I I think") loses the first, except doubles that are often right ("had had", "that that").
- A retake is the same 3 to 8 words said again within 15 s; the first attempt goes (at most 20 s per retake).
- Overlapping cuts merge, the more telling reason wins; touching cuts stay separate so Review shows each reason.

**Failure.** A missing transcript retries. **Cost budget.** Compute only.
