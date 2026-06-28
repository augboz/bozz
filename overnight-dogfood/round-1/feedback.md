# Round 1 — user feedback (fresh batch)

Method: each persona's session was driven live through the running app (preview
browser at localhost:1420, dev auth bypass on). Findings below are observed, not
imagined: button inventories, body text, view transitions, and console were
captured per screen. Screenshots were unavailable (headless screenshot hung on
this machine), so evidence is DOM-level.

## Personas (batch A, first-time users)

- **Maya, 20, uni student.** Wants one place for uni deadlines, tasks, timetable.
  Tech-comfortable but impatient. Judges an app in the first 60 seconds.
- **Tom, 26, freelance designer.** Juggles 4 clients. Lives in tabs. Skeptical of
  "another dashboard". Will bounce if setup feels like work.
- **Priya, 19, first year, not techy.** On a laptop. Needs to be told what to do
  next at every step or she stalls.

## What worked

- Onboarding "Getting started" with 4 ordered walkthroughs reads clearly and sets
  expectations. Maya liked the "do them in order" framing.
- Quicks has a genuinely good empty state: "Nothing here yet... Quicks is your
  scratchpad... tap Quick add (or press Ctrl+B)". It tells you what it is AND what
  to do next. This is the bar.
- Apps / Connect a service screen is clean and honest (e.g. Apple Calendar clearly
  says "desktop app only"). Tom trusted it.

## Friction (the real findings)

1. **[HIGH] The home view has no empty state.** After dismissing "Getting started",
   a brand-new user lands on a blank canvas: just the sidebar and an unlabeled
   pencil icon. No heading, no "your home is empty", no prompt. Priya stalled
   completely ("is it broken? is it loading?"). Maya clicked around for the add
   button. Quicks does this right; Home does not. `HomeView.tsx` renders the grid
   with zero items and nothing else.

2. **[HIGH] Adding a first widget is undiscoverable.** The "Add widget" button only
   appears AFTER you enter edit mode, and edit mode is a bare pencil icon
   (`<Pencil>` with no visible label on desktop, only aria-label). So the path to
   the core action is: spot pencil -> click -> find "Add widget". Tom: "I shouldn't
   have to hunt for how to put something on my own dashboard."

3. **[MED] Dismissing onboarding is a one-way feeling.** "Dismiss getting started"
   removes the only scaffolding and drops you onto the empty home (see #1). The
   onboarding copy says you can "re-run any of them any time" but from the empty
   home there's no visible way back in.

4. **[MED] Empty home wastes the strongest moment.** Bozz's promise is "your morning
   in 90 seconds". The first screen after setup is the one moment to show that
   promise, and right now it shows nothing. No suggested starter layout, no "add
   Today + Tasks + Calendar to get going".

5. **[LOW] Onboarding headings aren't semantic.** "Getting started" / "WALKTHROUGH 1"
   are styled divs, not h1/h2/h3 (heading query returned empty). Minor a11y/SEO-ish
   gap; screen-reader users get no heading landmarks.

## Persona one-liners

- Maya: "Good bones, but the first screen after setup is empty and I didn't know
  what to do. Give me a starter layout."
- Tom: "Make the main action obvious. I'm not entering 'edit mode' to add my first
  thing."
- Priya: "I dismissed the help and then the screen was blank. I thought it broke."
