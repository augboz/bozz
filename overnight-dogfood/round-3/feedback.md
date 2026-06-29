# Round 3 — feedback (returning + new batch, data present)

Final round. Focus shifted from first-run to "does it hold up once you actually
use it". Returning personas now had topics, widgets and captured quicks; a new
QA-minded persona stress-read the loop with data present.

## Returning users (saw Rounds 1-2)
- **Maya:** "Everything from before stuck. I rambled three uni tasks into my Uni
  topic and they all filed correctly." (This path was the duplicate-id bug, now
  fixed; before, multiple tasks filed in the same instant collided.)
- **Tom:** "Quick capture from the collapsed sidebar is the thing I use most now."

## New user (QA-minded)
- **Dev/QA persona** read the loop with data present and found the real issues:
  duplicate ids when filing multiple tasks at once, and overdue deadlines silently
  vanishing from the deadlines widget (the most urgent items disappearing).

## Findings (all fixed this round)
1. [HIGH] Duplicate item ids in tight loops -> wrong-row edits/deletes. Fixed.
2. [MED] Overdue deadlines excluded from the deadlines widget. Fixed (now grouped
   under "Overdue").
3. [MED] Typed quick-add could submit a value different from what was shown. Fixed.
4. [MED] "Add all" with all-blank cards closed with no feedback. Fixed.

## Regression
Rounds 1-2 changes all still work: empty state, starter templates, greeting,
accessible topic/quick-add modals, "New topic" naming, collapsed Quick add.
