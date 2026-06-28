# Round 1 — changes shipped

Theme: fix the first-run cliff. A brand-new user no longer lands on a blank canvas.

## Files changed (src only, 5 files, +188/-10)

- `src/components/widgets/registry.tsx` — added `StarterTemplate` type and
  `STARTER_TEMPLATES` (Student / Freelancer / Just the essentials), built only
  from account-free ready widgets. `DEFAULT_HOME` left empty (unchanged behavior).
- `src/components/sections/HomeView.tsx` — new `HomeEmptyState` component (hero
  carrying the "your morning, in 90 seconds" promise, primary "add your first
  widget" CTA that jumps straight into the add flow, one-click starter templates,
  and a "show the getting-started guide" re-entry link). Rendered on the empty
  home in both desktop and mobile paths. Added a time-aware greeting on the
  populated home. Labeled the desktop Edit button ("Edit" / "Done") to match mobile.
  Added `applyTemplate` and `startAdding` helpers and an `onReplayWalkthroughs` prop.
- `src/components/Dashboard.tsx` — passes the existing `replayWalkthroughs` handler
  into HomeView.
- `src/components/sections/InboxView.tsx` — removed the em dash from the Quicks
  empty state (brand-voice fix) and tightened the sentence.
- `src/components/QuickAddModal.tsx` — warmer idle placeholder ("what's on your mind?").

## Findings addressed

- [HIGH] Empty home with no empty state -> fixed (HomeEmptyState).
- [HIGH] Add-widget undiscoverable -> primary CTA + labeled Edit button.
- [MED] No way back into onboarding -> "show the getting-started guide" link.
- [MED] First screen wastes the "90 seconds" promise -> hero + starter templates.
- Brand bug (em dash in Quicks copy) -> fixed.

## Verification (live, in the running app)

- `npx tsc --noEmit` -> exit 0, no errors.
- Reloaded preview, dismissed onboarding -> empty state renders with hero, primary
  CTA, all three templates, and the re-entry link. Edit button now labeled.
- Clicked "Student" -> 4 widgets applied (today, upcomingDeadlines, pomodoro,
  quickAdd) with unique keys; empty state replaced by the grid; daily greeting
  appeared.
- Console: no errors at any step.

Screenshots were unavailable (headless screenshot hung on this machine); evidence
is DOM-level via the preview eval/console tools.
