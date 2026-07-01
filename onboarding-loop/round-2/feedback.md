# Round 2 — board critique of the built first-run

Three reviewers read the round-1 code: a QA engineer (adversarial bug hunt), the
Maya persona (re-runs the flow she previously rage-quit), and the Head of Design
(craft). Consensus: the core complaint is **substantially fixed** — a new user now
lands calm on the Briefing and is taught one real action by doing it, and the
worked example kills the blank-box quit-point. But real issues remain.

## QA engineer — defects found (all addressed in round 3 unless noted)
- **Blocker (assessed FALSE POSITIVE):** "the dim covers the Quick-add modal." The
  SpotlightOverlay cuts a hole (no dim panel) over the target rect; the modal card
  sits inside that hole, below the 72px instruction bar, so it is fully reachable.
  Verified geometrically + this exact pattern ships in the production Quicks tour.
  No change made (changing a shared modal's z-index was higher-risk than the bug).
- **Blocker (REAL): mobile hang.** No `quick-add` anchor exists on the mobile layout
  and the action steps have no timer, so the walk hangs forever. Fixed: first-run is
  desktop-only (Bozz is desktop-first; "no mobile app" is a brand boundary).
- **Major: `onFirstRunEnd` gated on the live prop at exit** could strand dismissal.
  Fixed: gate on an `autoStarted` ref + a `firstRunEnded` once-guard.
- **Major: quit mid-walk suppressed onboarding forever.** Fixed: a persisted
  `firstRunTourPending` flag re-arms the walk next (desktop) launch; pre-feature
  users never set it, so they are never re-triggered; `showOnboarding` now also
  respects `firstRunTour` so a resume always has a host to render.
- Minors (card-flash coupling, empty-briefing self-recovery, no test pinning the
  example parses): example parse verified live against the real parser module.

## Maya persona — still-holding gaps
- The captured item lands in Quicks, so "your morning is ready" rang hollow — the
  loop didn't visibly close. (Addressed: payoff reworked; see below. Full
  "reveal the captured item in the brief" deferred — capture goes to Quicks by
  design, not the Today brief.)
- **Student framing accumulates** ("classes", "Biology", "Room 2.14", "timetable").
  Fixed: role-neutral example + copy, heading "Add your week".

## Head of Design — craft
- Kill "capturing" jargon in step 2. Fixed.
- Hide the "1 / N" counter on first run only (it rebrands a calm moment as a
  procedure). Fixed.
- Step 1 forced 3.8s dim feels controlling. Fixed: click-anywhere-to-continue +
  2.5s floor.
- Step 4 ends on a dark screen (hides the very thing to trust). Fixed: dropped the
  4th dimmed step; the walk now lifts the overlay and reveals the real, un-dimmed
  morning with a quiet self-fading sign-off pill.
- Worked example: static input->chip is ideal; no typing animation (off-brand).
  Tie the example's first line to the placeholder's first line. Fixed.
