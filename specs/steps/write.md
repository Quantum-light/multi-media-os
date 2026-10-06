# Step: write

**Purpose.** Draft everything that is published as text, in the brand's voice and only from what the
creator said: three title options, the YouTube description, the chapter list, one caption per
connected platform.

**Input** (`WriteInput` = `UnderstandOutput`), plus the cut list from the episode's `cut` result.
**Output** (`WriteOutput`): title (the first option), title options, description, chapters on the edited
timeline and as "0:00 Welcome" lines, captions, the model used.

**How.** `@mmos/agents` `runWrite`. Chapters move onto the edited timeline (the cuts before them are
subtracted) and follow YouTube's rules (first at 0:00, at least three, each 10 s or longer, otherwise
none). The prompt carries the voice kit, the creator's recent corrections (`voice_lessons`, newest 20) and
the Vision. Every agent prompt holds the human-sourced line: no invented stories, opinions, claims or quotes.
Platform limits are in the contract (`TEXT_LIMITS`); a draft over a limit fails its checks and retries.

**Recorded.** `private.record_write` saves each piece to `public.pieces` with version 1 in
`public.piece_versions` (author `agent`). A later redraft is kept as a version but never replaces a piece a
person or the chat has edited.

**Cost budget.** About 2p per episode.
