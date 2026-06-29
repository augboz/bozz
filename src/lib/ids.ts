// Monotonic id generator for tasks and inbox items.
//
// These used to be minted with `Date.now()`. When several items are created in
// the same millisecond (e.g. "Add all" filing multiple rambled tasks into one
// topic, or rapid Enter-Enter capture) they got identical ids, which collide as
// React keys and make edit/delete/drag hit the wrong row. nextId() returns a
// strictly increasing integer, so ids never collide even in a tight loop, while
// staying time-ordered (and numeric, matching TopicItem.id / InboxItem.id).
let _last = 0;

export function nextId(): number {
  const now = Date.now();
  _last = now > _last ? now : _last + 1;
  return _last;
}
