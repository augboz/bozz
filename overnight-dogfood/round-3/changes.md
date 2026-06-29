# Round 3 — changes shipped (final round)

Theme: correctness + polish + finish the a11y sweep. A QA agent hunted for bugs
that bite once real data is present; the high-value ones are fixed.

## Files changed (6 files incl. 1 new, +37/-13 in src, plus new lib/ids.ts)

- `src/lib/ids.ts` (NEW) — `nextId()`, a strictly-increasing id generator.
- `src/components/Dashboard.tsx` — use `nextId()` for inbox + topic item ids (3 sites).
- `src/components/widgets/TopicTodosWidget.tsx` — use `nextId()` for new task ids.
- `src/components/QuickAddModal.tsx` — fixed the typed-submit precedence bug
  (submit now matches what the input displays), use `nextId()` in "Add all",
  and show "nothing to add" instead of closing silently on an all-blank review.
- `src/components/widgets/UpcomingDeadlinesWidget.tsx` — include overdue items and
  group them under an "Overdue" heading (the per-item overdue styling was dead code).
- `src/components/SearchModal.tsx` — applied the useFocusTrap hook + dialog semantics.

## Findings addressed (from the Round 3 QA agent)

- [HIGH] Duplicate item ids from `Date.now()` in tight loops (e.g. "Add all" filing
  several tasks into one topic) caused React key collisions and wrong-row
  edit/delete/drag. Fixed with a shared monotonic id generator.
- [MED] Overdue deadlines were filtered out of the deadlines widget (its overdue
  styling was unreachable). Now overdue items show, grouped and alert-styled.
- [Deferred-from-R2, now fixed] QuickAddModal typed-submit committed a value that
  could differ from what the user saw. Display and submit now use the same source.
- [MED] "Add all" with all-blank cards closed silently (looked like a lost
  capture). Now it says "nothing to add".
- a11y: SearchModal is now a focus-trapping dialog too.

## Deferred (logged, not done; low risk to leave)
- InboxRow seeds local deadline/text once on mount; a background data refresh can
  leave it stale (QA #4).
- Greeting/"today" can go stale if the app is left open across a time boundary (#6).
- Budget modals could still adopt the focus-trap hook.

## Verification (live)

- `npx tsc --noEmit` -> exit 0.
- Fresh dev server, desktop width: app renders, no server errors, no console
  warnings (specifically no duplicate-key warnings).
- Empty state + Student starter template still work (R1 regression), 4 widgets
  with unique ids, deadlines widget renders without crashing (overdue path).
- Capture loop end to end: Ctrl+B opens the dialog, typed text shows correctly,
  Enter commits, item lands in Quicks. Two rapid captures produce two distinct
  rows (id-collision fix holds).
