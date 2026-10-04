---
name: add-block
description: Add or change a HyperFrames composition block (lower-third, caption style, chapter card, quote card, image-story scene, end card). Use for any graphic that appears in output video.
---

1. Spec the block in `specs/blocks/<block>.md`: what it shows, its variables, its timing, which brand-kit values it binds to.
2. Build it as a HyperFrames HTML block in `packages/compositions/blocks/<block>/` with named variables only; colours and fonts come from the brand kit, timings from `@mmos/brand` motion tokens.
3. No `Math.random()`: renders must be identical every time.
4. Add a render snapshot test for both QLS themes.
5. Ask the brand-reviewer agent to review, then the architecture-reviewer.
