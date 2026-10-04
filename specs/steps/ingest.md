# Step: ingest

**Purpose.** Turn an uploaded source recording into everything later steps need, reading the
large file once: its facts (duration, size, frame size, frame rate, audio), a checksum, a
small audio file for transcription, and a low-resolution preview copy for decisions.

**Input** (`IngestInput`): the source asset id, its storage key and its size in bytes.

**Output** (`IngestOutput`): `sha256`, `durationS`, `video` (width, height, fps) or null for
audio-only, `audioKey` (mono 16 kHz audio for transcription, tens of MB), `proxyKey`
(540p preview for cut decisions and Review, null for audio-only).

**Speed rules.**
- The worker streams the source from R2 to local disk once; every derived file is made from
  that local copy. Nothing downloads the source again.
- Audio extraction copies or lightly encodes audio only; the proxy uses a fast preset.
- Checksum is computed while streaming, not in a second pass.

**Failure.** A file that is not audio or video fails at once (not retryable). Network and
storage errors retry with backoff (the job engine's rules).

**Duplicates.** The upload checks a quick fingerprint before any bytes move; ingest records
the full sha256, and a second episode with the same sha256 in one workspace is flagged for Review.

**Cost budget.** Compute only; no paid API calls.
