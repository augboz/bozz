# Overnight dogfood loop

Autonomous overnight run. Simulated user personas dogfood Bozz through a headless
browser against the local dev server; "teams" (dev / product-ideas / marketing)
propose changes; changes are implemented and verified; a self-assessed CEO comfort
score gates each round. 3 rounds, aggressive change scope.

This ran while you were away. Nothing here is pushed. Everything is on the branch
`overnight/dogfood-loop` for you to review, keep, or throw away in the morning.

## How to review tomorrow

1. Read `FINAL-REPORT.md` first (top-level summary + comfort trajectory + keep/revert guide).
2. Per round: `round-N/feedback.md`, `round-N/team-plan.md`, `round-N/changes.md`, `round-N/ceo-review.md`.
3. `git log overnight/dogfood-loop` shows one commit per round (plus the WIP-preservation commit `434e371` at the base, which holds YOUR in-progress work untouched).
4. To throw it all away: `git checkout main` (your original tree is intact; the WIP snapshot is recoverable from commit 434e371).
5. To keep specific changes: cherry-pick or diff individual round commits.

## Method notes

- "Users" are simulated personas (no real humans overnight). They dogfood the
  actually-running app via the preview browser: real clicks, fills, snapshots,
  console + network checks. Friction is observed, not imagined.
- "CEO comfortable" is a self-assessed comfort score (0-10) with written rationale
  each round. The real CEO (you) overrides as you see fit.
- Guardrails held every round: never touched auth, payments, OAuth secrets,
  Supabase schema, CI, or release config. Build + typecheck kept green or the
  round's changes were reverted.
