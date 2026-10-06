# Step: understand

**Purpose.** Map the episode: where it turns (chapters), the moments worth reusing (story,
claim, teaching, practice, question), its themes, and which of the show's pillars it serves.

**Input** (`UnderstandInput` = `CutOutput`). **Output** (`UnderstandOutput`): summary, chapters and
moments on the source timeline, themes (name and slug), pillar matches (score 0 to 1 and one line of
evidence), the model used.

**How.** `@mmos/agents` `runUnderstand`: the transcript, with cut words left out and each line marked with
its source time, plus the show's Vision, goes to Anthropic (`ANTHROPIC_MODEL`, default `claude-sonnet-5-5`)
with one forced tool whose schema is the contract. The answer is then held to the recording:
- a moment survives only if at least 70% of its quoted words occur in the transcript between its times;
- pillars must be the show's own pillar names; chapters stay inside the recording, at least 10 s apart.

**Recorded.** `private.record_understand` replaces the episode's `moments`, upserts `themes` for the brand,
and links episode → theme (`edges`, `same_theme`).

**Not yet.** Moment embeddings (the `moments.embedding` column) need an embeddings provider; Anthropic has
none. Left empty until one is chosen (decision needed).

**Failure.** A refused key or rejected request fails at once; an answer that fails its checks retries.
**Cost budget.** About 5p for an 11-minute episode, 20p for an hour.
