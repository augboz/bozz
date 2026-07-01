# First-2-minutes onboarding loop — final report

Ran autonomously on branch `onboarding/first-2-min` (off `main` after v0.1.50).
**3 rounds**, each a board meeting + an implementation pass, verified (tsc +
production build green every round) and committed. **Nothing was pushed** — the
released app (v0.1.50) is untouched. Everything here is for you to review, keep,
or discard.

Scope was exactly what you asked for: **solely the first 2 minutes of a brand-new
user**, making the start walkthrough more obvious, more interactive, and showing a
worked example of exactly what to do. I made every product call myself.

## The core finding
The interactive teach-by-doing tutor **already existed** in the codebase (the
`Onboarding.tsx` spotlight engine: it dims the app, rings the real control, and
advances only when you actually do the thing) — and it **shipped switched off**.
`finishWelcome` dismissed it the moment it should have fired, so a new user was
asked three setup questions and then dumped on a silent Board grid. All five
round-1 reviewers independently converged on this. The whole complaint was: the
good tutorial was built, then hidden.

## What changed (3 commits on the branch)
1. **Land on the morning, not a grid.** Brand-new accounts open on the Briefing
   ("your morning in 90 seconds"), the north-star surface, instead of the
   customisable Board.
2. **The tutor runs by default now.** After the welcome steps, ONE short guided
   walk auto-runs on the user's real data: reveal the morning -> "get a thought out
   of your head, click Quick add" -> "type anything, press Enter" -> the overlay
   lifts and a calm self-fading pill signs off ("Your morning is ready. See you
   tomorrow."). It teaches the single core action by doing it, is one-click
   skippable, and never repeats.
3. **The timetable step shows a worked example.** Instead of a blank box with four
   confusing placeholder formats (the #1 quit-point), it shows one example line and
   the REAL parsed chip it produces, with an opt-in "Use this example" button.

## How each round worked
- **Round 1** — a 5-seat board (2 first-run personas, Head of Design, CPO, CEO)
  critiqued the current flow. I synthesised, then built: briefing landing, the
  `firstRun` walk, the worked example. `round-1/{feedback,changes}.md`.
- **Round 2** — a QA engineer (adversarial bug hunt), the Maya persona (re-ran the
  flow), and the Head of Design reviewed the built code. `round-2/feedback.md`.
- **Round 3** — fixed the real bugs and applied the craft polish. `round-3/changes.md`.

## What round 2 caught and round 3 fixed
- **Mobile hang** (real): first-run is now desktop-only (Bozz is desktop-first).
- **Finalisation robustness**: dismissal now saves exactly once via a ref guard.
- **Quit-mid-walk lost onboarding forever**: a persisted `firstRunTourPending` flag
  now resumes it next launch; pre-feature users are never re-triggered.
- **Two forced timed dims felt controlling**: step 1 is click-to-continue; the
  payoff no longer ends on a dark screen — the overlay lifts to the real morning.
- **"capturing" jargon** removed; **"1/N" counter hidden** on first run.
- **Student framing** ("classes", "Biology", "Room 2.14", "timetable") swapped for
  role-neutral copy and a "Team meeting" example — the primary user is a knowledge
  worker, not only a student.
- One reported "blocker" (dim covers the Quick-add modal) was assessed a false
  positive: the spotlight cuts a hole the modal sits inside, and the pattern already
  ships in the production Quicks tour.

## Honest caveats
- The brand-new first-run walk was **not force-triggered in a live browser**: the
  dev session is a signed-in, Supabase-synced account, and faking a brand-new state
  (or replaying tours) would have written to that real account. Verification was
  tsc + full production build (green every round), live parser/module checks against
  the running dev server, no console errors on the existing-account path, adversarial
  code review, and reuse of the production-proven quick-add spotlight pattern. To see
  it for real, sign in with a fresh account (or clear this account's data) and run
  `npm run tauri dev`.
- Personas are simulated, not real humans — treat the UX findings as strong
  hypotheses, not proof.
- No auth/payments/OAuth/Supabase schema/CI/release config were touched. Existing
  users are unaffected (they still land on the Board; the welcome/first-run only
  fires for genuinely brand-new accounts).

## Final board sign-off
A closing CEO review of the whole diff returned **GO-WITH-NITS, 8/10**. It confirmed
the brief is answered on all three words — "obvious" (a full-screen spotlight you
can't miss, vs. the old silent grid), "interactive" (advances only when you do the
thing), and "example of exactly what to do" (the ringed Quick add + the real parsed
timetable chip) — and that every brand guardrail is clean (no gimmicks, no fake
data, one-click skippable, no scope creep). Its nits: (1) validate one genuine
brand-new run before merge (see caveats); (2) the captured item lands in Quicks, not
the brief, so I softened the payoff pill to promise the recurring morning rather than
over-claim the current screen; (3) a possible one-frame "dim with no ring" on a cold,
slow first launch (self-heals; the engine polls the DOM and degrades to a full dim
rather than crashing).

## One thing left for you (product call)
Maya's deepest ask was to make the *captured item itself* appear in the morning
brief so the loop closes visibly on screen. It currently lands in Quicks (by
design — capture-now-sort-later), not the Today brief. Surfacing captured Quicks in
the Briefing is a real improvement but a bigger change to the brief's contents, so I
left it for you rather than expand scope mid-loop.

## How to review / keep / discard
- Per round: `onboarding-loop/round-N/`. Whole diff: `onboarding-loop/full.diff` or
  `git diff main onboarding/first-2-min -- src/`.
- **Keep all:** merge the branch, then cut a release when happy.
- **Keep some:** the three `feat` commits are ordered and independent-ish
  (round1 = the feature, round3 = polish on top).
- **Discard:** `git checkout main` — nothing was pushed.
