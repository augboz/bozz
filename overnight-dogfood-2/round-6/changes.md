# Round 6 — changes shipped

Theme: deepen the one knife for the real primary user (22-38 knowledge worker).
"Morning in 90 seconds" → "week in 90 seconds", reach the user before they open
the app, and make the keyboard run the product. (Grades/freelancer/AI-scheduling
deliberately NOT built — off-strategy per the locked direction.)

## Changes (9 modified + 3 new)
1. **"This Week" landing** (NEW `sections/WeekView.tsx`; `Dashboard.tsx`,
   `BriefingView.tsx`, `HomeView.tsx`, `SettingsView.tsx`, `types.ts`,
   `widgets/context.ts`): a third home landing (`homeLanding: briefing|week|board`)
   fusing recurring classes + deadline chips (on their due day) + plan into Mon-Sun
   columns with a weekend toggle and free/busy markers, so heavy days and free gaps
   are visible at a glance. Pure composition over a new `weekEvents` ctx window.
2. **Ctrl+K command palette that DOES things** (NEW `lib/commands.ts`;
   `lib/search.ts`, `SearchModal.tsx`, `Dashboard.tsx`, `PomodoroWidget.tsx`):
   search now indexes topics + tasks, and typed verbs execute via existing engines:
   "add task <text> > Topic", "deadline <text> friday", "expense 12 coffee",
   "start pomodoro", "go to <topic/section>", "file all predicted". Jump-to preserved.
3. **Proactive LOCAL deadline nudges** (NEW `lib/deadlineNudges.ts`; `Dashboard.tsx`):
   free, on-device morning digest + day-before/morning-of per-deadline nudges via
   the Tauri notification plugin (web Notification fallback), permission-aware,
   deduped, NOT behind the Plus gate. Reaches the user before they open the app.

## Verification
- `npx tsc --noEmit` → exit 0; `npm run build` clean.
- Live (fresh server): Briefing/Week/Board all render, no error boundary; Week view
  shows 7-day lanes with deadlines + free/busy + weekend toggle; Ctrl+K opens and
  parses commands ("add task review notes > Travel" → Add task → Travel action);
  returning-user state intact; console clean. (Test data added then removed.)

## Strategy note
The board (CEO) re-centred on the locked primary user and vetoed off-strategy work
(freelancer suite, AI auto-scheduling) and deferred the student Grades tracker to
wave two. This round's scope reflects that correction.
