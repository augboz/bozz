# Round 3 — changes shipped

Theme: connect the seams. The engine existed; this round wires it into one loop.

## Changes (9 modified + 3 new)
1. **Real timetable IS onboarding** (`lib/coldStart.ts`, new
   `onboarding/WelcomeTimetable.tsx`, `WelcomeColdStart.tsx`, `Dashboard.tsx`):
   removed the FAKE seeded tasks; after the cold-start choice, a "Paste your
   timetable link" step (reuses AddFeedForm + the webcal→https importer, with a
   "where do I find this?" helper) fills the real calendar + Today. Skippable;
   brand-new-account only.
2. **Unified "what's due" stream** (`widgets/util.ts`, `widgets/context.ts`,
   `Dashboard.tsx`): `deadlineEntries()` now also surfaces deadline-like calendar
   events (all-day, or titles matching exam/deadline/due/submission/coursework/
   assignment/quiz/test), via a new `upcomingEvents` (next 14d) ctx field, deduped
   against topic deadlines. The Deadlines widget + Today Priorities can finally see
   imported exams. (Calendar string-ids mapped to stable negative numeric ids so
   they can't collide with real item ids.)
3. **Topic-free deadline capture + dead-end fix** (`Dashboard.tsx`, new
   `widgets/DeadlineQuickAdd.tsx`, `QuickAddModal.tsx`, `InboxView.tsx`,
   `widgets/context.ts`): `addDeadline()` files "essay due fri 5pm" with no topic
   (predicted topic, else a lazily-created "Deadlines" bucket) — works on a
   zero-topic account. An "+ add a deadline" affordance sits under Today Priorities
   and in the Deadlines widget. Quicks "no topics yet" wall now offers inline
   "new topic from this quick".
4. **Day-2 heartbeat coach chip** (new `onboarding/HomeCoachChip.tsx`): one ranked,
   dismissible "NEXT STEP" suggestion on Home (Add your timetable / N quicks to
   sort / Plan your day / Connect your inbox), routing via setActiveSection;
   dismissal persists per day.

## Verification
- `npx tsc --noEmit` → exit 0.
- Live (clean reload): home renders, no error boundary, console clean. Coach chip
  shows "Add your timetable" on a feedless account; the "add a deadline" affordance
  is present; a topic-free captured deadline ("Stats essay due") appears in Today
  Priorities end to end.
- Defended against the prior "X is not iterable" crash class (`?? []` guards in
  deadlineEntries).

## Deferred to Round 4+
- A glanceable weekly TimetableWidget on the home grid.
- Grades & GPA tracker (per-module assessments, weighted average, target calc).
- The fuller active "good morning" ritual (vs the lighter coach chip shipped here).
