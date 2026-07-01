# Round 1 — board meeting on the first 2 minutes

Scope (founder brief): the start-of-app walkthrough must be **way more obvious**, **more
interactive**, and **show an example of exactly what to do** so a new user learns HOW to
do something. Solely the first 2 minutes.

Five parallel lenses reviewed the real code: two first-run personas (Maya, 26,
knowledge worker; Leo, 20, student), Head of Design, CPO (activation), CEO (strategy).

## Consensus (all five)
1. **The interactive tutor already exists and ships DISABLED.** `Onboarding.tsx` has a
   spotlight engine that dims the app, rings the real control, and advances only when the
   user does the action. `finishWelcome` (`Dashboard.tsx` ~437) sets `onbDismissed = true`
   at the exact moment it should fire, so a new user never sees it. **This is the whole
   founder complaint in one line: the interactive tutor was built, then hidden.**
2. **The timetable step is a blank-box quit-point.** Both personas stall there: a textarea
   with 4 different placeholder formats reads as "which one is right?" and the one hard rule
   (start each line with a day) is only shown *after* they fail. Fix: pre-fill an editable
   worked example with the live preview already showing.
3. **New users land on the Board (a widget grid to edit), not the Briefing** ("your morning
   in 90 seconds") the north star promises. Design + CPO: land brand-new accounts on the
   Briefing so the promise is the first thing they see.
4. **No payoff beat.** Cold-start + timetable actually populate the morning, but the flow
   never says "look, that's your actual day." The aha is manufactured and thrown away.

## Tension
- Personas + Design + CPO: turn ON a short teach-by-doing action on the user's real data.
- CEO: veto a heavy separate tour; no persistent fake data; one-click skip; calm tone;
  don't push time-to-populated-board past 90s; don't force performing a task to proceed.

## Decision (mine, autonomous)
The founder explicitly asked for interactive + a worked example, so ONE guided action stays
— bounded by every CEO guardrail:
- Reuse the existing spotlight engine; add ONE short `firstRun` flow, not the 4-flow tour.
- On the user's REAL data. No persistent fake data — the timetable worked example is a
  template that clears the moment the user types.
- Always one-click skippable (engine already has a visible Exit); non-blocking.
- Calm tone, one honest payoff sentence, no confetti/gamification/progress bars.
- No new welcome *screens* — the guided action happens on the landing, not as a modal.

## Round 1 build list
A. Brand-new accounts land on the **Briefing**, not the Board (`Dashboard.tsx` load effect).
B. **Pre-filled, editable worked example** in the timetable box + live preview showing;
   clears on first edit; copy reframed to set up the payoff (`TypeTimetableForm`,
   `WelcomeTimetable`).
C. New **`firstRun`** flow in `Onboarding.tsx`: step 1 reveals "this is your morning"
   (the legend/payoff the CEO approved), step 2 is the interactive "capture your first
   thing" on Quick add (the core action both personas asked for), then a calm done line.
D. `finishWelcome` starts the `firstRun` tour instead of dismissing it; finalizes dismissal
   on completion; keeps the Settings "Replay walkthroughs" path (the 4 setup tours) separate.
E. Spotlight anchors on the Briefing so step 1 has something real to ring.
