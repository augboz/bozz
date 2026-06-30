# Round 2 — board meeting

Board average satisfaction: **~4.8/10** (flat vs round 1, board wants more).

Why flat after round 1 shipped real improvements: the board verified a deeper,
more fundamental blocker that dominates everything else.

## The headline finding (verified in code)
**The calendar-feed pipeline is fully built and working but has NO UI.**
`calendarFeeds` state, `fetchFeed`/`parseICal` (src/lib/ical.ts), recurring
expansion, and merge into the grid + Today all exist, yet `setCalendarFeeds` is
only ever called from storage hydration in Dashboard.tsx. So the primary persona
(a uni student whose #1 stated need is "one place for my timetable") literally
cannot get her timetable in. "A Ferrari engine with no ignition and no fuel."

Compounding:
- Brand-new account = theme picker over a blank canvas (DEFAULT_HOME = [], zero
  topics), empty sidebar, empty calendar.
- The smart NLP is inert until a topic exists: `predictTopic` returns null when
  `topics.length === 0`, so Quicks prediction + Accept-all do nothing for exactly
  the new user who needs them.
- Round 1's Today brief helped, but the task list still reads only the manual
  `dailyPlan[todayKey]`, so a captured+dated task silently never reaches Today.

## Board verdicts
- **CEO (5):** "We have built a beautiful, deeply-plumbed engine with no front
  door. We fix the front door before we decorate more rooms."
- **CPO (4):** "High ceiling, broken floor. This round must close the activation
  loop or nothing else matters."
- **CTO (5):** "We shipped dead plumbing (the feed pipeline). Wire it to UI."

## Agenda chosen for Round 2 (ranked by the board)
1. **P1 Add-your-timetable front door** — UI to paste a webcal/.ics URL → existing
   fetchFeed → fills calendar + Today in ~30s. (Plumbing 100% done; pure wiring.)
2. **P2 Alive-on-first-paint cold-start** — replace theme-only welcome with a 2-3
   question quickstart that auto-creates a real topic (Worlds machinery) + seeds
   sample deadlines + applies the Student layout. Un-gates predictTopic.
3. **P3 Close capture→Today gap** — Today auto-includes tasks due today/overdue,
   not just the manual plan.
(P4 friction-free "Add a deadline" surface deferred to Round 3.)
