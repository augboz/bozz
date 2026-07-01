# Round 1 — changes

Goal: make the first-2-minutes tutorial obvious, interactive, and show a worked
example of exactly what to do. Implemented the board's synthesised direction.

## What changed

1. **Brand-new accounts land on the Briefing, not the Board.**
   `Dashboard.tsx` load effect: for `brandNewAccount`, `homeLanding = 'briefing'`
   (the "your morning in 90 seconds" surface the north star promises), marked
   migrated so it sticks. Existing users are untouched (still Board).

2. **The interactive tutor now runs by default (it used to ship disabled).**
   - `finishWelcome` no longer sets `onboardingDismissed = true`. Instead it starts
     ONE short guided walk (`firstRunTour`) and keeps the guide mounted.
   - New `firstRun` flow in `Onboarding.tsx` (4 beats, reuses the existing
     SpotlightOverlay engine): (1) ring the Briefing — "this is your morning";
     (2) ring Quick add — "click it to try"; (3) ring the Quick-add modal — "type
     anything and press Enter"; (4) full-screen calm payoff — "that is it, see you
     tomorrow." Advances on the user's REAL actions; skippable via the Exit button.
   - `autoStartFlow` + `onFirstRunEnd` props auto-run it once and finalise dismissal
     on ANY exit (finished or skipped), so it never repeats. New `data-onb`
     anchor `briefing-today` on `BriefingView`.

3. **Timetable step: a worked example instead of a blank box (the #1 quit-point).**
   `TypeTimetableForm` gains a "Type it like this" strip (shown while empty) that
   renders the example line AND the real parsed chip it produces, plus a one-tap
   "Use this example, then edit it" button (opt-in, never auto-filled — honours the
   CEO "no fake data" rule). Placeholder simplified from 4 conflicting formats to
   one consistent format. Enabled via `showExample` from `WelcomeTimetable`, whose
   copy now sets up the payoff ("watch your morning build itself").

## Guardrails honoured (CEO)
No extra welcome screens; one-click skippable; no persistent fake data; calm tone,
one honest payoff line, no confetti/gamification; the four setup tours stay exactly
where they were (opt-in, Settings "Replay walkthroughs").

## Verification
- `tsc --noEmit`: exit 0.
- `npm run build`: exit 0 (built in ~14s).
- Live dev render on the existing dev account: no console errors, no layout
  regression, still lands on Board (welcome/first-run correctly does NOT fire for
  an established account).
- First-run visual walk not forced in-browser: the shared dev session is signed in
  with Supabase-synced data, and faking a brand-new account would have risked that
  data. The flow reuses the already-proven quick-add → quick-add-modal spotlight
  pattern; logic verified by reading + typecheck. Rounds 2-3 board-review the diff.
