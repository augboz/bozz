import ICAL from 'ical.js';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import type { CalendarEvent, CalendarFeed } from './types';

// Recurring events are expanded across a bounded window so navigating the
// calendar within ~a year needs no re-fetch, while keeping parsing bounded.
const DAY = 86_400_000;
const EXPAND_BACK_DAYS = 60;
const EXPAND_FWD_DAYS = 400;
const MAX_OCCURRENCES = 500;

/** Parse an iCal string into bounded, expanded events. */
export function parseICal(text: string, feedId: string, color: string): CalendarEvent[] {
  const comp = new ICAL.Component(ICAL.parse(text));
  const vevents = comp.getAllSubcomponents('vevent');

  const now = Date.now();
  const rangeStart = now - EXPAND_BACK_DAYS * DAY;
  const rangeEnd = now + EXPAND_FWD_DAYS * DAY;
  const out: CalendarEvent[] = [];

  for (const ve of vevents) {
    const ev = (() => {
      try { return new ICAL.Event(ve); } catch { return null; }
    })();
    if (!ev || !ev.startDate) continue;

    const title = ev.summary || '(no title)';
    const allDay = ev.startDate.isDate ?? false;

    if (ev.isRecurring()) {
      const it = ev.iterator();
      let next = it.next();
      let count = 0;
      while (next && count < MAX_OCCURRENCES) {
        const startMs = next.toJSDate().getTime();
        if (startMs > rangeEnd) break;
        count++;
        if (startMs >= rangeStart) {
          let endMs: number | null = null;
          try {
            endMs = ev.getOccurrenceDetails(next).endDate.toJSDate().getTime();
          } catch {
            endMs = null;
          }
          out.push({
            id: `${feedId}:${ev.uid}:${startMs}`,
            title, start: startMs, end: endMs, allDay, color, source: 'ical',
          });
        }
        next = it.next();
      }
    } else {
      const startMs = ev.startDate.toJSDate().getTime();
      if (startMs < rangeStart || startMs > rangeEnd) continue;
      out.push({
        id: `${feedId}:${ev.uid}:${startMs}`,
        title, start: startMs,
        end: ev.endDate ? ev.endDate.toJSDate().getTime() : null,
        allDay, color, source: 'ical',
      });
    }
  }
  return out;
}

/** Fetch (via Tauri, bypassing CORS) and parse a single feed. */
export async function fetchFeed(feed: CalendarFeed, color: string): Promise<CalendarEvent[]> {
  const res = await tauriFetch(feed.url, { method: 'GET' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  return parseICal(text, feed.id, color);
}
