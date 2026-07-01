# Round 3 — changes (polish + hardening)

Applied the Round 2 board findings. Two buckets: bug hardening (QA) and craft
polish (Maya + Design).

## Hardening (QA)
- **Mobile no longer hangs:** the first-run walk is desktop-only (`autoStartFlow`
  gated on `!isMobile`; `finishWelcome` finalises immediately on mobile and just
  lands on the Briefing). The walk needs the desktop sidebar's Quick add anchor.
- **Finalisation is robust:** `exitWalk` now decides "was this the auto first-run"
  from an `autoStarted` ref + a `firstRunEnded` once-guard, not the live prop, so
  `onboardingDismissed` is always saved exactly once (finished or skipped).
- **Resume after quit-mid-walk:** new persisted `firstRunTourPending` flag, set in
  `finishWelcome`, cleared in `finishFirstRunTour`. The load effect re-arms the walk
  (desktop only) when it's still pending, so a mid-walk quit no longer loses
  onboarding forever. `showOnboarding` now also respects `firstRunTour` so a resumed
  walk always has a host to render. Pre-feature users never set the flag → never
  re-triggered.

## Craft (Maya + Design)
- **Removed the two forced timed dims** that felt controlling:
  - Step 1 (reveal) is now **click-anywhere-to-continue** with a 2.5s floor (was a
    forced 3.8s dim), with a faint "click anywhere to continue" hint.
  - Step 4 (payoff) is **gone as a dimmed step**. The walk ends after the capture and
    the overlay lifts to reveal the real, un-dimmed morning with a quiet, self-fading
    sign-off pill ("Your morning is ready. See you tomorrow.").
- **Hid the "1 / N" counter on the first run only** (kept on the opt-in tours) so the
  first moment reads as one calm hint, not a numbered procedure.
- **Copy:** killed the "capturing" jargon in step 2 ("One thing worth knowing: get a
  thought out of your head fast..."); tightened step 1; subtitle no longer
  over-promises motion ("Your morning fills itself in.").
- **De-studented** (primary user is a knowledge worker): example is now
  `Mon 9-11 Team meeting Room 4` (verified it parses), placeholder matches its first
  line, heading "Add your timetable" -> "Add your week", tab "Type my classes" ->
  "Type it in", and the shared form's "class/classes" copy -> "event(s)" / neutral.
- Ghost button: "Use this example, then edit it" -> "Use this example"; swapped the
  WandSparkles icon (too magic/salesy) for a Pencil.

## Verification
- `tsc --noEmit`: exit 0. `npm run build`: exit 0.
- Live: the real `timetableParser` module parses the new example + all placeholder
  lines (checked against the running dev server); the edited module imports cleanly;
  the app renders with no console errors on the existing-account path.
- The brand-new first-run walk was not force-triggered in-browser (the dev session
  is a signed-in, Supabase-synced account; faking brand-new state or replaying tours
  would have written to that real account). Reasoning + QA code-review + the reuse of
  the production-proven quick-add -> quick-add-modal spotlight pattern stand in for it.
