# Round 3 — board meeting

Board average satisfaction: **5.6/10** (up from ~4.8; rising as activation landed).
Board still wants more.

## The board's framing
"We have a 9/10 engine wired into a 5/10 loop. This round is about CONNECTING what
already exists, not building new pillars." Three seams verified unconnected:

1. **Activation lies about what Bozz is.** Cold-start seeds FAKE tasks the student
   must delete (coldStart.ts) and never asks for her real timetable at first run,
   even though AddFeedForm + the webcal→https importer already exist.
2. **The "deadlines" widget is blind to her calendar.** `deadlineEntries()` ingests
   ONLY topic items; imported exams/coursework from the feed flow into the grid +
   Today events but NEVER into priorities()/Upcoming deadlines. One question, two
   answers, two screens.
3. **No loop after day 1, and a zero-topic dead end.** A returning user lands on a
   silent grid with no "what now"; a brand-new account can't even log a deadline
   without first owning a topic (Quicks dead-ends at "no topics yet").

## Agenda chosen for Round 3 (the four "spines")
1. **Real timetable IS onboarding** — after the cold-start choice, "Paste your
   timetable link" (reuse AddFeedForm); remove the fake sample tasks.
2. **Unified "what's due"** — deadlineEntries()/Today/Upcoming also ingest
   deadline-like calendar events (all-day or title matches exam/due/coursework…).
3. **Topic-free deadline capture** — log "essay due fri 5pm" with no topic (auto
   bucket); fix the Quicks "no topics yet" wall with inline "new topic from this".
4. **Day-2 heartbeat** — a dismissible, state-aware "next step" coach chip on Home.

(Note: one A/B experiment agent hit a StructuredOutput retry cap this round; the
board verdicts and plan were unaffected.)
