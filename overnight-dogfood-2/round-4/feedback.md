# Round 4 — board meeting

Board average satisfaction: **5/10** (the board reframed and found a deeper gap;
still wants more).

## The reframe
"We have built a powerful engine and bolted it to the wrong chassis. We ship the
morning brief as a KIT, not a briefing." The board's point: the pieces exist
(parser, TodayWidget brief, cold-start) but the user must ASSEMBLE the promise
instead of RECEIVING it.

Three concrete dead-ends verified:
1. The morning brief is one optional card on an empty `DEFAULT_HOME = []` grid —
   the user has to discover and place it. It should be the default landing.
2. The offline NL parser is wired ONLY to voice: typing "essay due friday for bio"
   into quick-add stores the literal string with no date/topic — the magic is
   invisible exactly when a typing-first student would feel it.
3. Onboarding still teaches the tool (four spotlight walkthroughs) instead of
   delivering the outcome; and CalendarNote has no recurrence/location, so the
   "your real classes fill Today" promise dead-ends at one-off ICS events.

## Agenda chosen for Round 4
1. **Briefing as the default landing surface** — full-width Today brief is the
   first screen for new accounts; the grid demotes to an optional "Board".
   (Gated so returning users' saved layouts are untouched.)
2. **Typed quick-add = the NL parser** — run extractDeadline + predictTopic on the
   typed string with an inline confirm chip + auto-route on high confidence.
3. **First-class recurring timetable** — recurring CalendarNote (weekday + time +
   room), client-side expansion, location in Today, + a "Next: BIO101 · 14:00 · in
   18 min" banner.
4. **Replace the four-walkthrough gate** with a 60-second outcome setup (timetable
   → first 3 deadlines → "here's your morning").
