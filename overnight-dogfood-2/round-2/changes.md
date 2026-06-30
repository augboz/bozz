# Round 2 — changes shipped

Theme: open the front door. Make a brand-new student reach a populated, personal
dashboard, and let them paste their timetable.

## Changes
1. **"Add your timetable" front door** (NEW `sections/calendar/AddFeedForm.tsx`;
   `sections/calendar/CalendarView.tsx`; `Dashboard.tsx`): the calendar-feed
   pipeline (fetchFeed/parseICal, merge into grid + Today) was fully built but had
   NO UI. Added an empty-state card + an "Add timetable" header button + a slide-in
   form that takes a webcal/https .ics URL (webcal→https rewrite, validates by
   fetching, inline errors), names+colours it, and adds it via `setCalendarFeeds`
   (the first and only UI caller). Classes now fill the calendar + Today in seconds.
2. **Alive-on-first-paint cold-start** (NEW `lib/coldStart.ts`,
   `onboarding/WelcomeColdStart.tsx`; `Dashboard.tsx`): after the theme pick, a
   brand-new account gets a "What are you here for?" chip step (Uni / Job hunt /
   Gym / Work). Choosing one auto-creates a real colour-coded topic (reusing the
   Worlds machinery) WITH a description + keywords (so predictTopic works from
   capture #1), seeds 2-3 sample timed deadlines so Today/Upcoming/mini-calendar
   light up, and applies the matching starter layout. Skippable; brand-new-account
   only (existing users unaffected).
3. **Close the capture→Today gap** (`widgets/TodayWidget.tsx`): the "My plan"
   section now merges in tasks due today/overdue (from the computed priorities),
   deduped against the manual plan, so a captured+dated+triaged task reaches the
   morning view without the manual planner ritual. Hardened TasksSection (prios
   defaults to []) after verification caught a transient HMR crash.

## Verification
- `npx tsc --noEmit` → exit 0.
- Live: Calendar shows the "Add your timetable" card + button; home/Today render
  with no error boundary after a clean reload (the transient `prios` HMR error
  during edits is gone and defended against).

## Deferred to Round 3 (board P4 + next)
- Friction-free "Add a deadline" surface (title + due + optional course → auto Uni
  topic) from Today header / empty calendar / quick-add; "Create topic & file" in Quicks.
