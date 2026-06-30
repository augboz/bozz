# Round 5 — board meeting

Board average satisfaction: **5.67/10** (up from 5; CPO 6, CTO 7 — rising). Wants more.

## What the board prioritized (it pivoted back to activation, not Grades)
The board re-focused on the last big activation leak rather than the Grades/GPA
stretch:
- **The timetable is gated behind an .ics URL most students can't produce.**
  WelcomeTimetable only accepts a feed URL with "Settings → Secret iCal address"
  help text. A skipper's cold-start seeds an EMPTY topic, so the Briefing says
  "nothing pressing — a clear morning" forever. The headline feature silently dies
  for the median new user.
- **Deadlines (the #1 student job) have no home.** addDeadline() already does
  topic-free dated capture, but the only entry points are collapsed buttons buried
  in two widgets, and there's no "all my deadlines by date" surface (Today caps at
  this-week, Upcoming at 7 days, upcomingEvents at 14 days).
- predictTopic is inert until a topic scores, so "Accept all predicted" is dead on
  a fresh single-topic account.

## Agenda chosen for Round 5
1. **Type-your-timetable** — a "Build/type my classes" tab (default) that parses
   plain-English class lines into recurring CalendarNotes (noteEvents already
   expands them). The real unblock.
2. **First-class Deadlines hub** — a sidebar "Deadlines" section: one chronological
   list across all topics + calendar, grouped Overdue/This week/This month/Later,
   colour filter chips, inline add (term-spanning window).
3. **Always-on "Add a deadline" bar** on the Briefing (inline NL parse).
4. **Multi-select cold-start** — seed several real topics so predictTopic works
   from capture #1.

(Note: one board seat returned a malformed stub again and was discounted; the
substantive CEO/CPO/CMO verdicts were aligned. Grades/GPA remains queued.)
