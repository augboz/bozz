import { platformFetch } from './http';
import { isTauri } from './platform';
/**
 * Apple Calendar (iCloud CalDAV) event fetcher.
 *
 * Flow:
 *  1. Read the app-specific password from OS keychain (written by IntegrationsBlock).
 *  2. PROPFIND / to discover the current-user-principal URL.
 *  3. PROPFIND principal to get calendar-home-set.
 *  4. PROPFIND home with Depth:1 to list individual calendars.
 *  5. REPORT each calendar with a time-range filter to get VEVENTs.
 *  6. Parse the embedded iCal data and return CalendarEvent[].
 */


import { secretGet } from './oauth/keyring';
import type { CalendarEvent } from './types';

const CALDAV_BASE = 'https://caldav.icloud.com';

// ── Auth ──────────────────────────────────────────────────────────────────────

function basicAuth(email: string, password: string): string {
  return 'Basic ' + btoa(`${email}:${password}`);
}

async function getPassword(email: string): Promise<string | null> {
  try {
    return await secretGet(`caldav:${email}`);
  } catch {
    return null;
  }
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

async function caldavRequest(
  method: string,
  url: string,
  auth: string,
  depth: string,
  body: string,
): Promise<{ status: number; text: string }> {
  const res = await platformFetch(url, {
    method,
    headers: {
      Authorization: auth,
      'Content-Type': 'application/xml; charset=utf-8',
      Depth: depth,
    },
    body,
  });
  const text = await res.text();
  return { status: res.status, text };
}

// ── XML helpers (use DOMParser — available in Tauri WebView) ──────────────────

function parseXML(str: string): Document {
  return new DOMParser().parseFromString(str, 'text/xml');
}

function resolveHref(href: string): string {
  if (href.startsWith('http')) return href;
  return `${CALDAV_BASE}${href.startsWith('/') ? '' : '/'}${href}`;
}

// ── CalDAV discovery ──────────────────────────────────────────────────────────

async function discoverPrincipal(auth: string): Promise<string> {
  const { status, text } = await caldavRequest(
    'PROPFIND',
    `${CALDAV_BASE}/`,
    auth,
    '0',
    `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:">
  <D:prop><D:current-user-principal /></D:prop>
</D:propfind>`,
  );

  if (status !== 207 && status !== 200 && status !== 204) {
    throw new Error(`iCloud CalDAV discovery failed (${status})`);
  }

  const doc = parseXML(text);
  // current-user-principal > href
  const elements = doc.getElementsByTagName('current-user-principal');
  if (elements.length > 0) {
    const hrefs = elements[0].getElementsByTagName('href');
    if (hrefs.length > 0) {
      const href = hrefs[0].textContent?.trim();
      if (href) return resolveHref(href);
    }
  }

  // Fallback: try parsing href directly from text with a simple regex
  const m = text.match(/<[Dd]:?href[^>]*>([^<]*\/principal\/?[^<]*)<\/[Dd]:?href>/i);
  if (m) return resolveHref(m[1].trim());

  throw new Error('Could not find current-user-principal in iCloud CalDAV response');
}

async function getCalendarHome(principalUrl: string, auth: string): Promise<string> {
  const { status, text } = await caldavRequest(
    'PROPFIND',
    principalUrl,
    auth,
    '0',
    `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop><C:calendar-home-set /></D:prop>
</D:propfind>`,
  );

  if (status !== 207 && status !== 200) {
    throw new Error(`Could not read principal (${status})`);
  }

  const doc = parseXML(text);

  // calendar-home-set > href
  const homeEls = doc.getElementsByTagName('calendar-home-set');
  if (homeEls.length > 0) {
    const hrefs = homeEls[0].getElementsByTagName('href');
    if (hrefs.length > 0) {
      const href = hrefs[0].textContent?.trim();
      if (href) return resolveHref(href);
    }
  }

  // Fallback regex
  const m = text.match(/<[^:>]*:?href[^>]*>([^<]*\/calendars\/[^<]+)<\/[^:>]*:?href>/i);
  if (m) return resolveHref(m[1].trim());

  throw new Error('Could not find calendar-home-set in iCloud CalDAV response');
}

// ── Calendar listing ──────────────────────────────────────────────────────────

const FALLBACK_COLORS = [
  '#7da7d9', '#c9a8d4', '#d4b896', '#a8c4a0',
  '#c7a1a1', '#a1bdc7', '#d9c47d', '#d49ea8',
];

interface AppleCalendar {
  url: string;
  displayName: string;
  color: string;
}

async function listCalendars(homeUrl: string, auth: string): Promise<AppleCalendar[]> {
  const { status, text } = await caldavRequest(
    'PROPFIND',
    homeUrl,
    auth,
    '1',
    `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:A="http://apple.com/ns/ical/">
  <D:prop>
    <D:resourcetype />
    <D:displayname />
    <A:calendar-color />
  </D:prop>
</D:propfind>`,
  );

  if (status !== 207 && status !== 200) {
    throw new Error(`Could not list calendars (${status})`);
  }

  const doc = parseXML(text);
  const responses = Array.from(doc.getElementsByTagName('response'));
  const calendars: AppleCalendar[] = [];
  let colorIdx = 0;

  for (const resp of responses) {
    // Must be a calendar collection (resourcetype contains 'calendar')
    const resourcetype = resp.getElementsByTagName('resourcetype')[0];
    if (!resourcetype) continue;
    const rtXML = resourcetype.innerHTML ?? resourcetype.textContent ?? '';
    const isCalendar = rtXML.toLowerCase().includes('calendar');
    if (!isCalendar) continue;

    // Skip scheduling-inbox / scheduling-outbox / notification
    if (rtXML.toLowerCase().includes('inbox') || rtXML.toLowerCase().includes('outbox')) continue;

    const hrefEl = resp.getElementsByTagName('href')[0];
    if (!hrefEl?.textContent?.trim()) continue;
    const url = resolveHref(hrefEl.textContent.trim());

    const nameEl = resp.getElementsByTagName('displayname')[0];
    const displayName = nameEl?.textContent?.trim() || 'Calendar';

    // apple calendar-color is #RRGGBBAA — strip alpha
    const colorEl = resp.getElementsByTagName('calendar-color')[0];
    let color = colorEl?.textContent?.trim() ?? '';
    if (color.startsWith('#') && color.length === 9) color = color.slice(0, 7);
    if (!color) color = FALLBACK_COLORS[colorIdx++ % FALLBACK_COLORS.length];

    calendars.push({ url, displayName, color });
  }

  return calendars;
}

// ── Event fetching via REPORT ─────────────────────────────────────────────────

async function fetchCalendarEvents(
  calUrl: string,
  auth: string,
  color: string,
  timeMin: Date,
  timeMax: Date,
): Promise<CalendarEvent[]> {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace('.000', '');

  const { status, text } = await caldavRequest(
    'REPORT',
    calUrl,
    auth,
    '1',
    `<?xml version="1.0" encoding="utf-8"?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag />
    <C:calendar-data />
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">
        <C:time-range start="${fmt(timeMin)}" end="${fmt(timeMax)}" />
      </C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>`,
  );

  if (status !== 207 && status !== 200) return [];

  const doc = parseXML(text);
  const responses = Array.from(doc.getElementsByTagName('response'));
  const events: CalendarEvent[] = [];

  for (const resp of responses) {
    // Find calendar-data elements (may have namespace prefix)
    let icalData = '';
    const calDataEls = resp.getElementsByTagName('calendar-data');
    if (calDataEls.length > 0) {
      icalData = calDataEls[0].textContent ?? '';
    }
    // Fallback: look for it in the raw inner text if DOMParser stripped ns
    if (!icalData) {
      const html = resp.innerHTML ?? '';
      const cdMatch = html.match(/<[^>]*calendar-data[^>]*>([\s\S]*?)<\/[^>]*calendar-data>/i);
      if (cdMatch) icalData = cdMatch[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    }

    if (!icalData.includes('BEGIN:VEVENT')) continue;
    const parsed = parseVEvents(icalData, color);
    events.push(...parsed);
  }

  return events;
}

// ── iCal VEVENT parser ────────────────────────────────────────────────────────

function unfold(ical: string): string {
  // RFC 5545 line-folding: CRLF followed by space/tab continues the previous line
  return ical.replace(/\r?\n[ \t]/g, '');
}

function icalProp(block: string, prop: string): string {
  // Matches PROP[:;]... : value (with optional parameters before the colon)
  const re = new RegExp(`^${prop}(?:;[^:]*)?:(.*)$`, 'im');
  const m = unfold(block).match(re);
  return m?.[1]?.trim() ?? '';
}

function parseICalDate(val: string): Date | null {
  if (!val) return null;
  // Strip TZID parameter if present in the value (shouldn't be, but guard)
  const clean = val.replace(/[^0-9TZ]/g, '');
  if (clean.length === 8) {
    // DATE: YYYYMMDD — all-day
    return new Date(
      +clean.slice(0, 4),
      +clean.slice(4, 6) - 1,
      +clean.slice(6, 8),
    );
  }
  if (clean.length >= 15) {
    const y = +clean.slice(0, 4);
    const mo = +clean.slice(4, 6) - 1;
    const d = +clean.slice(6, 8);
    const h = +clean.slice(9, 11);
    const mi = +clean.slice(11, 13);
    const s = +clean.slice(13, 15);
    if (val.endsWith('Z') || clean.endsWith('Z')) return new Date(Date.UTC(y, mo, d, h, mi, s));
    return new Date(y, mo, d, h, mi, s);
  }
  return null;
}

function parseVEvents(ical: string, color: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const vevents = ical.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? [];

  for (const block of vevents) {
    const status = icalProp(block, 'STATUS');
    if (status === 'CANCELLED') continue;

    const uid = icalProp(block, 'UID');
    const summary = icalProp(block, 'SUMMARY') || '(no title)';

    // DTSTART may include a TZID param: DTSTART;TZID=America/New_York:20260601T100000
    const dtstartRaw = icalProp(block, 'DTSTART');
    const dtendRaw = icalProp(block, 'DTEND');

    const start = parseICalDate(dtstartRaw);
    if (!start) continue;

    const end = dtendRaw ? parseICalDate(dtendRaw) : null;
    const allDay = !dtstartRaw.includes('T');

    events.push({
      id: `apple:${uid || crypto.randomUUID()}`,
      title: summary,
      start: start.getTime(),
      end: end ? end.getTime() : null,
      allDay,
      color,
      source: 'ical',
    });
  }

  return events;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function fetchAppleCalEvents(email: string, overrideColor?: string): Promise<CalendarEvent[]> {
  if (!isTauri()) throw new Error('Apple Calendar requires the desktop app — not available on web.');

  const password = await getPassword(email);
  if (!password) throw new Error(`No Apple Calendar password stored for ${email} — try reconnecting in Settings.`);

  const auth = basicAuth(email, password);

  // 1. Discover principal
  const principalUrl = await discoverPrincipal(auth);

  // 2. Get calendar home
  const homeUrl = await getCalendarHome(principalUrl, auth);

  // 3. List calendars
  const calendars = await listCalendars(homeUrl, auth);
  if (calendars.length === 0) return [];

  // 4. Fetch events — past 60 days through the next 60 days, so the calendar
  // shows recent past events as well as upcoming ones.
  const timeMin = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const timeMax = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

  const allEvents: CalendarEvent[] = [];
  for (const cal of calendars) {
    try {
      const evs = await fetchCalendarEvents(cal.url, auth, overrideColor ?? cal.color, timeMin, timeMax);
      allEvents.push(...evs);
    } catch (e) {
      console.warn(`[caldav] Failed to fetch calendar "${cal.displayName}":`, e);
    }
  }

  return allEvents;
}
