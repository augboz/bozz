# Round 1 — discovery + board meeting

Board average satisfaction: **5/10**. Board wants more rounds (yes).

## What personas + the competitive lens surfaced
Simulated users (first-year student, freelancer, non-techy, power user) plus a
competitive lens (vs Notion/Sunsama/Akiflow/Things) read the real code and
converged on one theme: **Bozz looks great but doesn't yet literally deliver
"your morning in 90 seconds."**

Concrete, code-grounded findings:
- New accounts open to `DEFAULT_HOME = []` plus a 4-walkthrough card. The "Student"
  starter drops widgets but seeds ZERO topics/data, so the user lands on empty
  shells ("No events today / Nothing planned today").
- The Today widget reads ONLY the hand-curated `dailyPlan[todayKey]`, so it stays
  empty until the user manually opens the planner every morning (no one will).
- Deadlines are structurally weak: `TopicItem.deadline` is unix-ms-at-local-
  midnight with no time-of-day, and there's no recurrence model, so the app
  literally cannot represent a repeating class (a student's #1 need).

## Board verdicts (per member)
- **CEO (5/10):** Stop being timid. Make the home earn its promise on minute one
  (auto morning brief) and make the deadline tracker trustworthy. Cold-start that
  builds the dashboard FOR the student. Grades/GPA as a stretch stickiness hook.
- **CTO (5/10):** The engine (offline NLP parser, topic/stage model, ical RRULE
  expander) is stronger than the product. Three structural gaps: deadlines hard-
  coded to midnight, no recurring-event model, Today reads only the manual plan.
  Fixes are high-leverage and self-contained, not rewrites. Not signing off.
- **CMO / Head of Design / COO:** aligned on the wow-moment (a narrated brief),
  delight/polish, and focusing Plus value. (One board seat returned a malformed
  stub this round and was discounted.)

## A/B experiments (what simulated users preferred)
For the top priorities we generated variant approaches and had user personas vote:
- Cold start + Today: users preferred **"Conversational Quickstart → topics-as-data,
  Brief replaces the empty Today"** (Tom) and **"Pick-a-Life-Template gallery +
  standalone narrated Brief hero"** (Sam). Signal: a guided/templated quickstart
  that seeds real data, paired with a narrated Brief, beats an empty grid.

## Agenda chosen for Round 1
1. Auto morning brief (Today aggregates real signals, not just the manual plan).
2. Trustworthy deadlines: optional time-of-day + live urgency countdown.
3. Faster triage: one-tap "Accept all predicted" in Quicks.
(Cold-start conversational quickstart, recurring timetable, and Grades/GPA are
sequenced into later rounds per the board.)
