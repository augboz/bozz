# Round 1 — changes shipped

Theme: make the home literally deliver the morning brief, and make deadlines trustworthy.

## Changes (8 src files)
1. **Today widget = auto morning brief** (`TodayWidget.tsx`, `widgets/util.ts`):
   added a narrated summary line ("N overdue · N due today · next event HH:MM",
   with a "nothing pressing — a clear morning" fallback) and an always-on
   **Priorities** section that auto-aggregates real signals via `deadlineEntries`
   (overdue → due-today → due-this-week). Kept Events + the manual **My plan**
   section and the showEvents/showTasks toggles.
2. **UpcomingDeadlines live urgency countdown** (`UpcomingDeadlinesWidget.tsx`):
   per-item relative label ("overdue 2d", "due today", "in 4h", "in 3d") coloured
   by urgency (overdue=alert, ≤48h=amber, else accent); sorts by precise due time.
3. **Optional time-of-day on deadlines** (migration-safe) (`types.ts`,
   `widgets/util.ts`, `DatePicker.tsx`, `DeadlineControl.tsx`, `TopicTodosWidget.tsx`):
   added `dueMin?: number|null` (minutes from midnight; null = all-day, identical
   to old behaviour). DatePicker can set a time; DeadlineControl shows it; a
   `dueTimestamp()` helper computes the precise due time for the countdown.
4. **Quicks one-tap triage** (`InboxView.tsx`): "Accept all predicted" button
   files every predicted item to its predicted topic at once; Enter on a row files
   it to the selected destination.

## Verification
- `npx tsc --noEmit` → exit 0.
- Live: Today widget renders the new brief (summary + Priorities/Events/My plan),
  no console errors.

## Deferred to later rounds (board priorities)
- Conversational/templated cold-start that seeds real topics + sample deadlines
  (the user-preferred experiment variant).
- Recurring timetable (recur model + ical expansion + "Add a class" + TimetableWidget).
- Grades & GPA tracker (all-term stickiness hook).
- Surface time-of-day at more capture points; theme token for the amber warning colour.
