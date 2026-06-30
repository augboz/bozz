# Round 4 — changes shipped

Theme: ship the briefing, not the kit. Make the promise something the user RECEIVES.

## Changes (8 modified + 1 new)
1. **Briefing as a default landing surface** (NEW `sections/BriefingView.tsx`;
   `Dashboard.tsx`, `HomeView.tsx`, `SettingsView.tsx`, `types.ts`): full-width
   zero-config Today brief as the home landing. New `AppearancePrefs.homeLanding`
   ('briefing'|'board'). Brand-new accounts default to Briefing; existing users
   default to Board and their saved layout/choice always wins (verified: returning
   account still loads Board intact). Briefing/Board toggle in the Home header +
   a Settings segmented control.
2. **Typed quick-add uses the NL parser** (`widgets/QuickAddWidget.tsx`): the typed
   string is now parsed (parseVoiceTasks) with an inline confirm chip (clean text +
   predicted-topic pill + deadline pill); on submit it auto-routes (predicted topic
   → addTopicItem; else dated → addDeadline; else Quicks). Manual date override +
   "→ Quicks" escape hatch kept. Verified: "essay due friday for travel" → {Travel,
   Fri} → filed → surfaced in the brief.
3. **First-class recurring timetable + Next-class banner** (`types.ts`,
   `lib/calendar.ts`, `widgets/TodayWidget.tsx`, `sections/calendar/CalendarView.tsx`):
   recurring CalendarNote (weekdays + start/end + room/location + term window),
   expanded client-side in noteEvents (bounded 30d, like topicDeadlineEvents);
   `location` on CalendarEvent shown in Today; a persistent "Next: TITLE · 14:00 ·
   Room · in 18 min" banner (updates every 30s). One-off notes unchanged; an
   "Add a class" (repeats weekly) flow added to the calendar event form.
4. **Demote the four-walkthrough gate** (`Dashboard.tsx`): new accounts land on the
   populated Briefing instead of being gated by the spotlight tours; tours stay
   re-runnable from Settings. (Spotlight machinery left intact — high-risk area.)

## Verification
- `npx tsc --noEmit` → exit 0.
- Live (clean reload): existing account loads Board with layout intact, no error
  boundary, console clean; Briefing toggle renders the full brief and back; typed
  NL captures surface in Priorities.

## Deferred to Round 5+
- Grades & GPA tracker (the all-term stickiness hook the board keeps flagging).
- A fuller active "good morning" ritual; calendar "Add a class" form browser soak.
