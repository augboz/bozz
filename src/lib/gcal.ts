import { platformFetch } from './http';
/**
 * Google Calendar API helper.
 * Reads the stored OAuth token from keyring and fetches the next 60 days of events
 * across all of the user's calendars.
 */


import { secretGet, secretSet } from './oauth/keyring';
import type { CalendarEvent } from './types';

const CLIENT_ID = import.meta.env.VITE_GCAL_CLIENT_ID as string | undefined;
const API_BASE  = (import.meta.env.VITE_API_URL as string | undefined) ?? 'https://life-bozz.vercel.app';

// These must match the keys written by connectGoogle() in src/lib/oauth/google.ts
function storageKey(suffix: 'access' | 'refresh'): string {
  return `gcal:${CLIENT_ID}:${suffix}`;
}

async function getAccessToken(): Promise<string | null> {
  if (!CLIENT_ID) return null;
  try { return await secretGet(storageKey('access')); }
  catch { return null; }
}

async function refreshAccessToken(): Promise<string | null> {
  if (!CLIENT_ID) return null;
  try {
    const refresh = await secretGet(storageKey('refresh'));
    if (!refresh) return null;

    const res = await platformFetch(`${API_BASE}/api/google-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'refresh', refresh_token: refresh, client_id: CLIENT_ID }),
    });
    if (!res.ok) return null;

    const json = (await res.json()) as { access_token?: string };
    if (!json.access_token) return null;

    await secretSet(storageKey('access'), json.access_token);
    return json.access_token;
  } catch { return null; }
}

const FALLBACK_COLORS = [
  '#7da7d9', '#c9a8d4', '#d4b896', '#a8c4a0',
  '#c7a1a1', '#a1bdc7', '#d9c47d', '#d49ea8',
];

export async function fetchGCalEvents(overrideColor?: string): Promise<CalendarEvent[]> {
  let token = await getAccessToken();
  if (!token) throw new Error('No Google Calendar token found — try disconnecting and reconnecting in Settings → Integrations.');

  const get = (url: string, t: string) =>
    platformFetch(url, { headers: { Authorization: `Bearer ${t}` } });

  // Fetch calendar list — refresh on 401
  let listRes = await get('https://www.googleapis.com/calendar/v3/users/me/calendarList', token);
  if (listRes.status === 401) {
    token = await refreshAccessToken();
    if (!token) throw new Error('Google Calendar token expired and could not be refreshed — please reconnect in Settings.');
    listRes = await get('https://www.googleapis.com/calendar/v3/users/me/calendarList', token);
  }
  if (!listRes.ok) {
    const body = await listRes.text().catch(() => '');
    throw new Error(`Google Calendar API error ${listRes.status}: ${body.slice(0, 200)}`);
  }

  const { items: cals = [] } = (await listRes.json()) as {
    items?: Array<{ id: string; backgroundColor?: string; summary?: string }>;
  };

  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

  const events: CalendarEvent[] = [];
  let colorIdx = 0;

  for (const cal of cals) {
    const params = new URLSearchParams({
      timeMin, timeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
    });

    const evRes = await get(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?${params}`,
      token,
    );
    if (!evRes.ok) continue;

    const { items: evItems = [] } = (await evRes.json()) as {
      items?: Array<{
        id?: string;
        summary?: string;
        status?: string;
        start?: { dateTime?: string; date?: string };
        end?:   { dateTime?: string; date?: string };
      }>;
    };

    const color = overrideColor ?? cal.backgroundColor ?? FALLBACK_COLORS[colorIdx++ % FALLBACK_COLORS.length];

    for (const ev of evItems) {
      if (ev.status === 'cancelled') continue;
      const startStr = ev.start?.dateTime ?? ev.start?.date;
      if (!startStr) continue;
      const endStr = ev.end?.dateTime ?? ev.end?.date;
      const allDay = !ev.start?.dateTime;

      events.push({
        id: `gcal:${ev.id ?? crypto.randomUUID()}`,
        title: ev.summary ?? '(no title)',
        start: new Date(startStr).getTime(),
        end: endStr ? new Date(endStr).getTime() : null,
        allDay,
        color,
        source: 'ical',
      });
    }
  }

  return events;
}
