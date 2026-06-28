# Round 1 — team plan

Three teams (subagents) each explored the codebase and proposed fixes for the
first-run findings. Strong convergence across all three.

## Dev team (top picks)
- Add a Home empty state mirroring the Quicks pattern (HIGH).
- Label the desktop Edit button + surface "Add widget" without entering edit mode (HIGH).
- One-click starter layout via a new STARTER constant, applied with setItems (MED-HIGH).
- Wire the existing replayWalkthroughs into HomeView for onboarding re-entry (MED).

## Product / ideas team (top picks)
- One-click starter templates ("Student" / "Freelancer" / "Just the essentials") = highest activation lever.
- A real Home empty state (replace the blank grid).
- Label the edit affordance; make add discoverable.
- (Deferred) progressive disclosure / categories in the Add panel; a "finish setup" checklist; smarter per-widget empty states.

## Marketing / copy team (top picks)
- Warm first-run home hero carrying the "your morning, in 90 seconds" promise.
- Time-aware greeting above the grid (good morning/afternoon/evening).
- Caught a real brand bug: the Quicks empty state used an em dash, which violates the no-em-dash brand voice. Fixed.
- Sharper QuickAdd placeholder ("what's on your mind?").
- (Deferred) warmer Today-widget empty copy; benefit-led onboarding card 3.

## What was chosen for Round 1 (cohesive first-run bundle)
1. New `HomeEmptyState` component (hero + primary add CTA + starter templates + onboarding re-entry), rendered on the empty home in both desktop and mobile paths.
2. Three starter templates in the widget registry, applied in one click.
3. Labeled desktop Edit button ("Edit" / "Done") to match mobile.
4. Time-aware greeting on the populated home.
5. Copy fixes: removed the em dash from the Quicks empty state; warmer QuickAdd placeholder.

Deferred items (Add-panel categories, setup checklist, per-widget empty states,
Today copy) are logged here as candidates for later rounds.
