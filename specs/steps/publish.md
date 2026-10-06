# Step: publish

**Purpose.** Hand one approved post to Zernio, which schedules it on the channel.

**Input** (`PublishInput`): our post id, platform, the channel's Zernio account id, the text, an optional title
(YouTube), media links, the time, and the post's own idempotency key.
**Output** (`PublishOutput`): Zernio's post id, status, the live link once known, and whether it was a dry run.

**Safety.**
- The worker uses `FakePublisher` unless it is given the live Zernio client.
- The live client only runs for episodes listed in `PUBLISH_LIVE_EPISODES` (comma-separated episode ids).
  Grace adds an episode there only when she gives the go-ahead for that episode. Empty means nothing posts.
- Every create sends `Idempotency-Key: <post's key>`; Zernio replays the first answer for the same key, so a
  retry never double-posts.
- Not registered in the worker until M6 (render). Today it runs only in tests.

**Failure.** A refused key or a rejected post fails at once; outages and rate limits retry.

**Check.** At start the worker lists Zernio's connected accounts once (read-only) and logs, per channel,
whether its saved account id is connected.
