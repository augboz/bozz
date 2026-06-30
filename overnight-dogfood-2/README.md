# Overnight dogfood loop v2 (aggressive)

Second autonomous loop, bigger than the first: **5 rounds**, larger team fan-out
(dev / product-ideas / marketing / QA-a11y / design-polish), and bolder, more
aggressive changes per round.

Branch: `overnight/dogfood-loop-2` (off `main` after v0.1.42). Nothing pushed.
Everything here is for you to review, keep, or discard in the morning.

## How to review
1. Read `FINAL-REPORT.md` first (summary + comfort trajectory + keep/revert guide).
2. Per round: `round-N/{feedback,team-plan,changes,ceo-review}.md`.
3. `git log overnight/dogfood-loop-2` shows one commit per round.
4. Keep all: merge the branch. Keep one round: cherry-pick its commit. Discard: `git checkout main`.

## Method
- Simulated user personas dogfood the running app via the preview browser (real
  clicks/fills/snapshots/console). Findings are observed, not imagined.
- Each round: dogfood -> 5 team agents propose -> synthesize -> implement
  aggressively -> verify (tsc + live) -> self-assessed CEO comfort gate -> commit.
- Guardrails: never touch auth, payments, OAuth secrets, Supabase schema, CI, or
  release config. Build kept green or the round reverts. Bolder feature swings than
  loop v1, but each change self-contained and reversible.
