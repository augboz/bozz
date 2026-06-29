# Round 2 — changes shipped

Theme: the core daily loop + accessibility. Make creating a topic, capturing, and
triaging feel finished and work for keyboard users.

## Files changed (13 files, +82/-24)

- `src/hooks/useFocusTrap.ts` (NEW) — reusable accessibility hook: traps Tab inside
  an overlay, closes on Escape via a document-level listener, restores focus to the
  opener on close. Plus a `dialogProps(label)` helper for role/aria-modal.
- `src/components/TopicFolderEditModal.tsx` — now a real dialog: role="dialog",
  aria-modal, aria-labelledby the title, Escape closes it (it had NO Escape before),
  focus traps inside, name field reliably focused + selected on open, aria-labels on
  the icon/colour buttons.
- `src/components/QuickAddModal.tsx` — same dialog semantics + focus trap; replaced
  the focus-dependent inline Escape with the document-level one from the hook.
- `src/components/Dashboard.tsx` — icon-only Quick add button in the collapsed
  sidebar bottom toolbar (capture is now reachable when collapsed / on web).
- "(unnamed)" -> "New topic" across all 7 topic label sites: Dashboard.tsx,
  SidebarEditNav.tsx, QuickAddModal.tsx, InboxView.tsx, SettingsView.tsx,
  WorldsView.tsx, calendar/CalendarView.tsx.
- `src/components/shared/Widget.tsx` — `EmptyWidget` gained optional `actionLabel`/
  `onAction` for an inline next-step link.
- `src/components/widgets/UpcomingDeadlinesWidget.tsx` — empty state now offers
  "capture one ->" routing to Quicks.
- `src/components/widgets/TopicTodosWidget.tsx` — warmer empty copy ("No tasks yet.
  Add your first one below.").
- `src/components/onboarding/Onboarding.tsx` + `WelcomeThemePicker.tsx` — semantic
  headings (h2 "Getting started", h1 "Welcome to Bozz") and a second em-dash brand
  fix in the welcome copy.

## Findings addressed

- [HIGH] Modals inaccessible (keyboard focus escaped, no dialog role, unreliable
  Escape) -> useFocusTrap + dialog semantics on the two core modals.
- [MED] "(unnamed)" reads as a bug -> "New topic" + reliable name focus.
- [MED] Quick capture invisible when collapsed -> collapsed toolbar button.
- [LOW-MED] Dead-end empty states -> action-oriented (UpcomingDeadlines) + warmer copy.
- a11y: non-semantic onboarding headings -> real h1/h2. Second em dash -> fixed.

## Verification (live)

- `npx tsc --noEmit` -> exit 0.
- Created a topic live: modal is now `role="dialog" aria-modal` with
  `aria-labelledby="topic-modal-title"`, the Name field is focused on open, the
  sidebar shows "New topic" (no "(unnamed)"), and **Escape closes the modal** (it
  could not before).
- At desktop width with the sidebar collapsed, the icon-only Quick add button is
  visible in the bottom toolbar.
- After restarting the dev server (a transient vite cache error during the bulk
  rename cleared on restart): no server errors, no browser console errors.

Note: a real correctness bug in QuickAddModal's typed-submit precedence (surfaced
by the QA agent) was logged and deferred to Round 3 for careful handling.
