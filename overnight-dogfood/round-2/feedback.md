# Round 2 — user feedback (returning + new batch)

Method: live dogfood of the core daily loop (create a topic, capture a quick,
triage) plus a returning-user pass against Round 1's changes.

## Returning users (batch A, saw Round 1)

- **Maya:** "The starter layout fixed my first complaint. I clicked Student and
  had a real dashboard. Now: I made a topic and the sidebar said '(unnamed)' for a
  second, which looked broken until I typed a name."
- **Tom:** "Empty home is sorted. The labeled Edit button is obvious now. Quick
  capture is great once you know Ctrl+B, but with the sidebar collapsed I couldn't
  see where 'Quick add' was."

## New users (batch B, first time)

- **Sam, 23, job-hunting grad.** Created a "Job hunt" topic. The topic edit modal
  (name / icon / colour / stages) is genuinely nice. But it opened without grabbing
  focus and Escape did not feel wired, so he reached for the mouse.
- **Lena, 21, keyboard-first.** Tried to set up by keyboard. The topic/folder edit
  modal is not a semantic dialog (no role="dialog", no focus trap), so Tab moved
  focus behind it into the page. She bounced.

## Verified working (returning-user regression pass)

- Round 1 empty state, starter templates, labeled Edit button, greeting, and the
  fixed Quicks copy (no em dash) all render live and persist across reload.
- Topic creation works end to end; the topic shows in the sidebar immediately.

## Friction (Round 2 findings)

1. **[HIGH] Modals are not accessible.** The topic/folder edit modal has no
   `role="dialog"`, no `aria-modal`, no focus trap, and Escape-to-close is not
   reliable. Keyboard and screen-reader users can tab out of it into the page
   behind. This recurs: onboarding headings are also non-semantic (Round 1 #5).
   Accessibility is a cross-cutting gap.

2. **[MED] A freshly created topic reads as "(unnamed)".** Before you type a name,
   the sidebar literally shows "(unnamed)", which looks like a bug. The name field
   should auto-focus and the placeholder should carry the weight.

3. **[MED] Quick capture is hard to find when the sidebar is collapsed.** The
   "Quick add" entry only shows expanded; collapsed users rely on Ctrl+B with no
   visible hint. On web there is no global shortcut, so this is the only capture
   path and it is invisible.

4. **[LOW-MED] Some widget empty states are dead ends.** Several widgets render a
   flat "nothing yet" with no action. Today already links out well ("Open calendar",
   "Plan your day"); others should match that bar (deferred from Round 1).

## Persona one-liners

- Lena: "I could not set up a topic with the keyboard. The dialog let my focus
  escape behind it."
- Sam: "Lovely topic editor, but it did not take focus and Escape did nothing."
- Maya: "'(unnamed)' in the sidebar made me think I broke something."
