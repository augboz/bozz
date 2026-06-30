# Round 5 — changes shipped

Theme: kill the last activation gate, and give deadlines a real home.

## Changes (7 modified + 3 new)
1. **Type-your-timetable** (NEW `lib/timetableParser.ts`,
   `sections/calendar/TypeTimetableForm.tsx`; `WelcomeTimetable.tsx`,
   `CalendarView.tsx`, `Dashboard.tsx`): an offline parser turns plain-English
   class lines ("Mon 9-11 BIO101 Room 3.21", "Wed 2pm Stats", "Tue & Thu 14:00-15:30")
   into recurring CalendarNotes (weekdays + start/end + room + term), with a live
   preview. Added as the DEFAULT "Type my classes" tab in the welcome timetable
   step and mirrored in the Calendar add flow. Removes the .ics gate that blocked
   most students.
2. **First-class Deadlines hub** (NEW `sections/DeadlinesView.tsx`; `Dashboard.tsx`,
   `types.ts`, `themes.ts`): a sidebar "Deadlines" section listing all deadlines
   across topics + imported calendar, grouped Overdue / This week / This month /
   Later, with per-module colour filter chips and inline topic-free add. A separate
   120-day window powers "Later" (the 14-day widget window is untouched).
3. **Always-on "Add a deadline" bar on the Briefing** (`BriefingView.tsx`): a
   full-width inline-parsing input with a confirmable date chip, routed via addDeadline.
4. **Multi-select cold-start** (`WelcomeColdStart.tsx`, `Dashboard.tsx`): seed
   several real colour-coded topics at once (each with keywords) so predictTopic /
   Accept-all work from the first capture.

## Verification
- `npx tsc --noEmit` → exit 0.
- Live (clean reload): Deadlines section renders ("2 open", grouped buckets with
  dates + urgency), nav both ways works; briefing add-deadline bar present;
  type-timetable preview parses correctly; returning-user layout intact; console
  clean, no error boundary. (Implementer added then fully removed its test data.)

## Deferred to Round 6
- Grades & GPA tracker (per-module assessments, weighted average, target calc) —
  the all-term stickiness hook, now the top remaining bet.
- Polish / accessibility pass.
