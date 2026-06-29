# Round 3 — team plan (final)

This round was correctness-led, so instead of three idea teams it ran a single
QA/polish agent to hunt for bugs that only show up with real data, while the known
deferred items from Round 2 were fixed directly.

## QA agent findings (prioritized)
1. [HIGH] `Date.now()` id collisions when several items are created in the same ms
   ("Add all" into one topic; rapid capture). Causes duplicate React keys and
   wrong-row edit/delete/drag. -> shared `nextId()` helper.
2. [HIGH] Same collision in TopicTodosWidget.addItem and Dashboard inbox paths.
   -> same helper, wired everywhere.
3. [MED] Overdue deadlines filtered out of the deadlines widget; its overdue
   styling was dead code. -> include overdue, group under "Overdue".
4. [MED] InboxRow seeds local state once on mount; background refresh can leave it
   stale. -> DEFERRED (lower confidence/higher touch).
5. [MED] "Add all" with all-blank cards closes silently. -> fixed (feedback).
6. [LOW] Greeting/"today" stale if app left open across a boundary. -> DEFERRED.
7. [LOW] Minor "Quicks" copy-casing inconsistency. -> DEFERRED (taste call).
8. [INFO] Confirmed no em-dash brand violations remain in rendered copy.

## Plus the deferred-from-Round-2 item
- QuickAddModal typed-submit precedence bug. -> fixed and verified.
- SearchModal a11y. -> done with the existing hook.

## Chosen for Round 3
Fixes 1, 2, 3, 5, the deferred submit bug, and SearchModal a11y. Items 4, 6, 7 were
consciously left for the human to decide on, documented above so nothing is lost.
