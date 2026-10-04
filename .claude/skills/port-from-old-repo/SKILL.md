---
name: port-from-old-repo
description: Bring a proven piece across from youtube-gg-systems-1 or qls-media-systems. Use whenever old code is the reference for new work.
---

Old code is reference only (anti-clunk rule 12). Never copy whole files.

1. Name the piece and its new home from the Migration table in the build plan.
2. Read the old implementation and write down its real behaviour, including edge cases its comments mention.
3. Write the new contract first, then rewrite the logic to it in small files.
4. Prove parity: run the old and new on the same golden episode and compare outputs.
5. Note in the pull request what was deliberately not carried over and why.
