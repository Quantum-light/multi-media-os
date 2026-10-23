# Golden set
Ten real episodes per show with their approved outputs. Every change to an agent, prompt or step is
scored against these, and scores must not drop. Episodes are chosen by Grace.

## Layout
```
evals/golden/<show>/show.json                 the show as the agents see it (name, brand, Vision, voice kit, platforms)
evals/golden/<show>/<episode>/approved.json   what was published: title, description, chapters (and the URL)
evals/golden/<show>/<episode>/transcript.json made on the first run, so later runs never pay to transcribe again
evals/golden/<show>/<episode>/scores.jsonl    one line per run: scores, timings, cost, model
evals/golden/<show>/<episode>/runs/*.json     the drafts each run produced
```
The raw recording is never committed (it is large and private); keep it in R2 or on your machine and pass
it once with `--audio`.

## Running
From `services/orchestrator`, with the keys from Railway:
```
railway run npx tsx scripts/eval-golden.ts ../../evals/golden/human-time-with-gg/<episode> --audio ~/path/to/audio.m4a   # first time
railway run npx tsx scripts/eval-golden.ts ../../evals/golden/human-time-with-gg/<episode>                               # every run after
```

## Scores (`services/orchestrator/src/evals/score.ts`)
- `chapterRecall`: share of published chapters with a drafted chapter within 30 s.
- `chapterCountRatio`: drafted chapters per published chapter (1 is ideal).
- `titleOverlap`: best key-word overlap between a title option and the published title.
- `descriptionCoverage`: share of the published description's key words the draft also uses.
- `overall`: the mean, with the count ratio folded to 0-1. Watch this one.
