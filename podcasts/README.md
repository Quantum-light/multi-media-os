# podcasts — the podcast system inside multi-media-os

Kept apart from the main multi-media-os code (apps, packages, services). One reusable **engine**, and one folder per **show**.
Journeys with Time is the first show. A new podcast, or a new way of sharing an existing one, is a new or changed show folder.

```
podcasts/
  engine/                      reusable for every show
    run.mjs                    one episode in → clips out
    lib/                       transcribe · pick · direct · art-direct · render · review page · zernio · captivate · fal
    scripts/                   schedule · brand-lab · animate-plates · scene-sheet
  shows/
    journeys-with-time/
      show.json                name, host credit, lockup, Captivate show, Zernio accounts, caption voice, schedule
      brand/                   brand.json (the brand style, versioned) · CHANGELOG.md · plates/ · lab/ rounds · candidates/
      rules/clip-rules.md      how this show's clips are chosen
      template/                this show's visual template (Remotion): scenes, captions, cards, lockup
      public/  out/            working media and each episode's clips (kept out of git)
  .env                         keys (never in git, never in chat)
```

## Make clips from an episode
```
cd podcasts
npm install                                    # once
npm run clips -- "/path/to/episode.wav"        # default show: journeys-with-time
npm run clips -- "/path/to/episode.wav" --show <another-show>
```
Steps: transcribe (AssemblyAI) → pick 9–12 clips (Claude, `rules/clip-rules.md`) → direct a scene change every 3–6 s →
art-direct an atmosphere per shot (approved plates + new candidates in the brand's style, fal) → render (the show's template) →
`out/<episode>/review.html` opens to watch everything. Each step caches its result, so re-runs never pay twice.

## Approve, then schedule (nothing posts without approval)
```
npm run schedule -- the-new-science-of-time --approved 1,2,5 --start 2026-10-27     # dry run: captions + dates to check
npm run schedule -- the-new-science-of-time --approved 1,2,5 --start 2026-10-27 --go
```
Captions use the show's voice, call to action and hashtags from `show.json`, and only the show's own Zernio accounts
(pin exact ones in `show.json → zernio.account_ids`). Full episodes live on Captivate → Spotify and all podcast apps.

## Evolve the brand
`npm run lab -- <round>` renders a round of atmospheres (defined in `brand/lab/<round>.json`) through the template for approval.
Approved plates go into `brand.json` with the reason, rejections become never-do rules, and the version + changelog move on.
`npm run animate-plates` turns approved stills into slow loops. `npm run scene-sheet` shows every line-work scene at a glance.

## Add a new show
Copy `shows/journeys-with-time` to `shows/<new-id>`, then change `show.json`, `brand/brand.json`, `rules/clip-rules.md`
and the template. The engine does not change.

Keys in `.env`: ANTHROPIC_API_KEY, ASSEMBLYAI_API_KEY, FAL_KEY, ZERNIO_API_KEY, CAPTIVATE_USER_ID, CAPTIVATE_API_KEY, CAPTIVATE_SHOW_ID.
