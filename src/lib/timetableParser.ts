/**
 * timetableParser — local, offline parsing of plain-English class lines into the
 * recurring CalendarNote shape that noteEvents() in lib/calendar.ts expands.
 *
 * No API keys, no network. Lets a student TYPE their timetable instead of
 * hunting for an .ics URL most can't produce — the single biggest activation
 * unblock.
 *
 * Each line is one class. Examples it handles:
 *   "Mon 9-11 BIO101 Room 3.21"
 *   "Wed 2pm Stats"
 *   "Fri 10-12 Lab"
 *   "Mon/Wed 14:00-15:30 Linear Algebra"
 *   "Tue & Thu 9am-10am Chemistry, B12"
 *
 * Grammar (lenient, order-tolerant for the day token, which must come first):
 *   <weekday(s)>  <time>[-<time>]  <title>  [room/location]
 *
 * weekday(s): one or more of Mon/Tue/Wed/Thu/Fri/Sat/Sun (3-letter or full),
 *             separated by "/", "&", "," or "and" — e.g. "Mon/Wed", "Tue & Thu".
 * time:       "9", "9am", "2pm", "14:00", "9.30", with an optional end after a
 *             "-", "–", "to" — e.g. "9-11", "2pm", "14:00-15:30", "10 to 12".
 * title:      everything after the time up to an optional room.
 * room:       a trailing ", <room>" OR a trailing "Room <x>" / "Rm <x>" token.
 *
 * The output uses startMin/endMin (minutes from local midnight) + repeat
 * (weekdays as Date.getDay() values 0=Sun…6=Sat, plus a default term window),
 * exactly the recurring CalendarNote contract the rest of the app already
 * expands and renders. No schema changes.
 */

/** A parsed class, ready to become a recurring CalendarNote (term + colour added by the caller). */
export interface ParsedClass {
  title: string;
  /** Weekdays as Date.getDay() values: 0=Sun … 6=Sat. Always ≥1 entry. */
  weekdays: number[];
  /** Start time, minutes from local midnight. */
  startMin: number;
  /** End time, minutes from local midnight. Defaults to start + 60 when absent. */
  endMin: number;
  /** Optional room / location. */
  location?: string;
}

// Map every spelling we accept → Date.getDay() index (0=Sun … 6=Sat).
const DAY_TO_INDEX: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

/** A day token at the start of a line: one or more weekday words joined by / & , and. */
const DAY_WORD = '(?:mon(?:day)?|tue(?:s|sday)?|wed(?:s|nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)';
const DAY_GROUP_RE = new RegExp(
  `^\\s*((?:${DAY_WORD})(?:\\s*(?:/|&|,|\\+|and)\\s*${DAY_WORD})*)`,
  'i',
);

/**
 * Parse a single time token ("9", "9am", "2pm", "14:00", "9.30", "9:30pm")
 * into minutes from midnight, or null if it doesn't look like a time.
 */
function parseTime(raw: string, meridiemHint?: 'am' | 'pm'): number | null {
  const m = raw.trim().toLowerCase().match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const mer = (m[3] as 'am' | 'pm' | undefined) ?? meridiemHint;
  if (h > 23 || min > 59) return null;
  if (mer === 'pm' && h < 12) h += 12;
  else if (mer === 'am' && h === 12) h = 0;
  return h * 60 + min;
}

// A time token, optionally with am/pm. Used to find the time span in the line.
const TIME_TOK = '\\d{1,2}(?:[:.]\\d{2})?\\s*(?:am|pm)?';
// start[ - / to / – end ]
const TIME_SPAN_RE = new RegExp(
  `(${TIME_TOK})\\s*(?:-|–|—|to|until|till|–|~)\\s*(${TIME_TOK})|(${TIME_TOK})`,
  'i',
);

/** Pull a trailing room/location out of a title, returning { title, location }. */
function extractRoom(rest: string): { title: string; location?: string } {
  let s = rest.trim();

  // Explicit "Room 3.21" / "Rm 12" / "@ B12" / "in Room X" trailing token.
  const roomRe = /\s+(?:@|at\s+|in\s+)?(?:room|rm)\.?\s*([\w.\-/]+)\s*$/i;
  const rm = s.match(roomRe);
  if (rm) {
    return { title: s.slice(0, rm.index).trim(), location: `Room ${rm[1]}` };
  }
  // "@ B12" without the word "room".
  const at = s.match(/\s+@\s*([\w.\-/]+)\s*$/);
  if (at) {
    return { title: s.slice(0, at.index).trim(), location: at[1] };
  }
  // Trailing ", <room>" — the simplest "Title, Room" convention.
  const comma = s.lastIndexOf(',');
  if (comma > 0) {
    const after = s.slice(comma + 1).trim();
    // Treat a short trailing fragment as a room rather than part of the title.
    if (after && after.split(/\s+/).length <= 3) {
      return { title: s.slice(0, comma).trim(), location: after };
    }
  }
  return { title: s };
}

/** Parse the leading day group ("Mon/Wed", "Tue & Thu") into getDay() indices. */
function parseDays(group: string): number[] {
  const out: number[] = [];
  for (const tok of group.split(/\s*(?:\/|&|,|\+|and)\s*/i)) {
    const idx = DAY_TO_INDEX[tok.trim().toLowerCase()];
    if (idx != null && !out.includes(idx)) out.push(idx);
  }
  return out;
}

/**
 * Parse one plain-English class line into a ParsedClass, or null if it doesn't
 * have at least a day + a time + a title.
 */
export function parseClassLine(line: string): ParsedClass | null {
  const raw = line.trim();
  if (!raw) return null;

  // 1. Leading weekday group (required, must be at the start).
  const dayMatch = raw.match(DAY_GROUP_RE);
  if (!dayMatch) return null;
  const weekdays = parseDays(dayMatch[1]);
  if (weekdays.length === 0) return null;

  // Everything after the day group.
  let after = raw.slice(dayMatch[0].length).trim();
  // Drop a leading "at"/"from" ("Mon at 9-11 …", "Fri from 10 to 12 …").
  after = after.replace(/^(?:at|from)\s+/i, '');

  // 2. Time span (required).
  const tMatch = after.match(TIME_SPAN_RE);
  if (!tMatch || tMatch.index == null) return null;

  const startRaw = tMatch[1] ?? tMatch[3];
  const endRaw = tMatch[2];
  if (!startRaw) return null;

  // If only the end carries am/pm ("9-11am", "2-4pm"), share it with the start.
  const endMer = endRaw?.toLowerCase().match(/(am|pm)$/)?.[1] as 'am' | 'pm' | undefined;
  let startMin = parseTime(startRaw, endMer);
  if (startMin == null) return null;

  let endMin: number;
  if (endRaw) {
    const e = parseTime(endRaw);
    endMin = e ?? startMin + 60;
  } else {
    endMin = startMin + 60;
  }
  // Guard against a 12h-clock end that lands before the start (e.g. "11-1"
  // means 11:00–13:00 in a timetable). Bump the end by 12h once.
  if (endMin <= startMin) {
    if (endMin + 12 * 60 > startMin && endMin + 12 * 60 <= 24 * 60) endMin += 12 * 60;
    else endMin = startMin + 60;
  }
  startMin = Math.max(0, Math.min(24 * 60 - 1, startMin));
  endMin = Math.max(startMin + 5, Math.min(24 * 60, endMin));

  // 3. Title = everything after the matched time span, with the room split off.
  const afterTime = after.slice(tMatch.index + tMatch[0].length).trim()
    .replace(/^[-–—,:·]+\s*/, '');
  const { title, location } = extractRoom(afterTime);

  if (!title) return null;

  return { title, weekdays, startMin, endMin, location };
}

/**
 * Parse a multi-line block (one class per line) into ParsedClasses, skipping
 * lines that don't parse. Lines may also be separated by ";" for one-line entry.
 */
export function parseTimetable(text: string): ParsedClass[] {
  const lines = (text ?? '')
    .split(/[\n;]+/)
    .map(l => l.trim())
    .filter(Boolean);
  const out: ParsedClass[] = [];
  for (const line of lines) {
    const parsed = parseClassLine(line);
    if (parsed) out.push(parsed);
  }
  return out;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Mon · Wed" day summary for a parsed class (Mon-first ordering for display). */
export function formatDays(weekdays: number[]): string {
  // Display Mon→Sun even though storage is Sun=0.
  const order = [1, 2, 3, 4, 5, 6, 0];
  return order.filter(d => weekdays.includes(d)).map(d => DAY_LABELS[d]).join(' · ');
}

/** "09:00–11:00" time range label for a parsed class. */
export function formatTimeRange(startMin: number, endMin: number): string {
  const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  return `${fmt(startMin)}–${fmt(endMin)}`;
}
