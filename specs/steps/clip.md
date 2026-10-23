# Step: clip (video shows)

**Purpose.** Choose up to five short-form candidates from the creator's own moments.

**Input** (`ClipInput` = `WriteOutput`), plus the episode's `understand` and `cut` results.
**Output** (`ClipOutput`): clips on the source timeline, 15 to 90 s, with kind, title (the first sentence of
the quote) and the quote.

**Rules.** Stories first, then teaching, practice, claims, questions; never overlapping; a moment more than
30% inside the cut list is skipped; short moments are widened to 15 s. Deterministic, no paid call.
