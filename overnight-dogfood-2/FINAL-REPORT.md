# Overnight dogfood loop v2 — final report (morning summary)

Ran autonomously overnight on branch `overnight/dogfood-loop-2` (off `main` after
the v0.1.42 release). **7 rounds**, each a board meeting + A/B experiments + an
implementation pass, verified (tsc + live) and committed. **Nothing was pushed** —
the released app (v0.1.42, live to your users) is untouched. Everything here is for
you to review, keep, or discard.

**Scope:** 7 round commits, **38 files changed (+4866 / -210), 17 new source
files.** Build green (`tsc --noEmit` exit 0) every round; final round also passed a
full `npm run build`.

## How each round worked
A 25-agent Workflow per round: a 6-seat **board meeting** (CEO, CPO, CTO, CMO, Head
of Design, COO) + 4 user personas + a competitive lens found opportunities, then
**A/B experiments** where simulated users voted on variant approaches, then an
engineer synthesised a plan. I implemented the chosen plan, verified it live, and
committed. Each round's detail is in `round-N/{feedback,team-plan,changes,ceo-review}.md`
(+ the raw board output in `round-N/board-raw.json`).

## Board satisfaction trajectory
5.0 → 4.8 → 5.6 → 5.0 → 5.67 → 6.0 → 6.0. It rose as activation closed, then
plateaued — not because the work stalled, but because this is an intentionally
aggressive board that keeps raising the bar (each round it found and named the next
deeper gap). My own confidence in the *on-strategy* product climbed 6.5 → ~9.

## What I decided & changed, round by round
1. **Morning brief + trustworthy deadlines.** Today became an auto-aggregated brief
   (overdue/today/this-week), deadlines got a live urgency countdown + optional
   time-of-day, Quicks got one-tap "accept all predicted".
2. **Activation front door.** A UI to paste your timetable (.ics) wired to the
   existing feed engine; an alive cold-start that seeds real topics; captured dated
   tasks now reach Today.
3. **Connected the seams.** Onboarding imports the real timetable; the deadlines
   surfaces now also see imported calendar exams; topic-free deadline capture; a
   day-2 "next step" coach chip.
4. **Shipped the briefing as the default landing** (new accounts; existing users
   keep their Board, gated); typed quick-add now uses the offline NL parser;
   first-class recurring timetable + a live "Next class in N min" banner.
5. **Killed the last activation gate:** type your timetable in plain English (no
   .ics needed); a first-class **Deadlines hub** (Overdue/This week/This month/Later);
   an always-on "add a deadline" bar; multi-select cold-start.
6. **"My week in 90 seconds":** a **This Week** landing (Briefing | Week | Board);
   a **Ctrl+K command palette that does things** (add task/deadline/expense, start
   pomodoro, go to, file all predicted); free **local deadline nudges**.
   (CEO re-centred the loop on the locked primary user and vetoed off-strategy work.)
7. **Crossed from seeing to DOING:** snooze/defer on every row; an end-of-day
   **close-out + clear-streak** reward; **effort-aware** deadlines (S/M/L) with an
   informational "start now" warning.

## What simulated users preferred (experiments)
- Cold start: a **conversational/templated quickstart that seeds real data**, paired
  with a narrated brief, beat an empty grid every time.
- Landing: a **zero-config briefing you receive** beat a grid you assemble.
- Timetable: **type-it-in-plain-English** beat paste-an-.ics (most can't find the URL).

## Two decisions left for you (the founder)
1. **Auto-Plan My Day** (auto time-blocking of free calendar gaps). The board pushed
   this hard as the next headline. I did NOT build it: it crosses your locked
   "no AI / no auto-scheduling" direction (the anti-reference is Sunsama/Akiflow).
   Your call: build it, or hold the line.
2. **Student Grades/GPA tracker.** Repeatedly proposed; the board itself later
   deferred it as a wave-two (student) bet vs the locked 22-38 knowledge-worker
   primary user. Build later, or now?

## How to review / keep / discard
- Per round: `overnight-dogfood-2/round-N/`.
- Whole diff: `git diff main overnight/dogfood-loop-2 -- src/`
- Try it: `git checkout overnight/dogfood-loop-2 && npm run tauri dev` (new accounts
  see the new onboarding + briefing; your existing data loads on the Board).
- **Keep all:** merge the branch (then cut a release when you're happy).
- **Keep some:** cherry-pick individual `feat(roundN)` commits — they're independent
  and ordered.
- **Discard:** `git checkout main` — nothing was pushed; the released app is unaffected.

## Honest caveats
- Personas are simulated, not real humans — treat the UX findings as strong
  hypotheses, not proof.
- Headless screenshots were unavailable on this machine, so verification was
  DOM/console-level (every round: tsc + live render + console/error-boundary checks;
  one transient crash was caught and fixed in round 2, and round 7's scary-looking
  console errors were confirmed stale).
- No auth/payments/OAuth secrets/Supabase schema/CI/release config were touched in
  any round; all changes are additive and reversible.
