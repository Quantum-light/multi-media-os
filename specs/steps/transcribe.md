# Step: transcribe

**Purpose.** Turn the episode's speech into words with timings and speakers, so every later
step can point at exactly what the creator said and when.

**Input** (`TranscribeInput` = `IngestOutput`): the audio key made by ingest (and the rest of ingest's facts).

**Output** (`TranscribeOutput`): `transcriptKey` (the full `TranscriptDoc` in storage: every word with
start, end, confidence and speaker, plus utterances), provider and its reference, language,
duration, word count, speakers, and the plain text for Review and search.

**How.** The worker signs a six-hour read link to the small mono 16 kHz audio file and hands only
that link to AssemblyAI (`speech_models` Universal-3.5 Pro then Universal-2, language detection,
speaker labels, filler words kept for the cut step, the show and brand names as key terms). No
bytes pass through the worker. It polls every 3 s, up to 30 minutes.

**Recorded.** `private.record_transcribe` writes `public.transcripts` (one row per episode) in the
same transaction as the job's success.

**Failure.** A refused key, a rejected request or audio AssemblyAI cannot read fails at once.
Network errors and AssemblyAI outages retry with the engine's backoff.

**Cost budget.** About 25p an hour of audio (set `pencePerHour` when prices change). Recorded on the job.

**Settings.** `ASSEMBLYAI_API_KEY` (Railway). Optional `ASSEMBLYAI_BASE_URL=https://api.eu.assemblyai.com` to keep audio in the EU.
