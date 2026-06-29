# Round 2 — team plan

Three teams again (dev, product/ideas, and a dedicated QA/accessibility audit).
Very strong convergence: accessibility of modals was independently flagged HIGH by
all three.

## Consensus picks
1. **A11y modal foundation** (all 3): no overlay in the app sets role="dialog" or
   aria-modal; no focus trap; Escape is inconsistent (the topic modal had NO Escape
   at all). Build one reusable `useFocusTrap` hook + `dialogProps`, apply to the
   topic/folder modal first, then QuickAddModal.
2. **Kill "(unnamed)"** (dev + product): new topics render the literal "(unnamed)"
   before naming, which reads as a bug. Use "New topic" and reliably focus the
   name field.
3. **Quick add reachable when collapsed** (dev + product): the Quick add button is
   gated behind `!sidebarCollapsed`, so collapsed users (and web users with no
   global Ctrl+B) have no visible capture entry.
4. **Action-oriented empty states** (all 3): several widgets are flat dead ends;
   match the "Open calendar ->" pattern Today already uses.
5. **Semantic headings** (a11y + dev): onboarding titles are styled divs, not h1/h2.

## QA/a11y audit also caught (logged for later)
- A real correctness bug in QuickAddModal: typed-submit precedence is inverted vs
  what the input displays (`text || partial` on submit, `partial || text` on
  display). Deferred to Round 3 to verify carefully before touching submit logic.
- SearchModal and budget modals would also benefit from the hook (lower traffic).

## What was chosen for Round 2
- `src/hooks/useFocusTrap.ts` (new): focus trap + Escape + focus restore + `dialogProps`.
- Applied to TopicFolderEditModal and QuickAddModal (role/aria-modal/aria-labelledby,
  Escape, focus restore). Reliable name-field focus + aria-labels on icon/colour buttons.
- "(unnamed)" -> "New topic" across all 7 topic call sites.
- Icon-only Quick add in the collapsed sidebar bottom toolbar.
- `EmptyWidget` gained an optional inline action; wired UpcomingDeadlines empty
  state to route to Quicks; warmer TopicTodos empty copy.
- Semantic headings (h2 "Getting started", h1 "Welcome to Bozz") + a second em-dash
  brand fix in the welcome copy.

Deferred: the QuickAddModal submit precedence bug, SearchModal/budget-modal a11y,
the predicted-topic "aha" toast, inline triage-from-Quicks. Candidates for Round 3.
