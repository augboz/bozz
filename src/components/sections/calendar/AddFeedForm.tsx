/**
 * AddFeedForm — the "Add your timetable" front door.
 *
 * Takes a webcal:// or https .ics URL, fetches + parses it via the EXISTING
 * fetchFeed pipeline, lets the user name + colour it, and hands the finished
 * CalendarFeed back up through onAdd → setCalendarFeeds so the calendar grid and
 * Today fill immediately. This is the only UI that calls setCalendarFeeds.
 *
 * webcal:// → https:// rewrite is handled here so a user can paste the URL their
 * university gives them verbatim. A failed fetch/parse shows a clear inline error
 * instead of silently adding a dead feed.
 */

import { useState } from 'react';
import { X, CalendarDays, Loader2 } from 'lucide-react';
import type { CalendarFeed, Theme } from '../../../lib/types';
import { fetchFeed } from '../../../lib/ical';
import ColorBankPicker from '../../shared/ColorBankPicker';

// Mirrors the FEED_COLORS bank in Dashboard so a freshly-added feed gets a
// sensible default even before the user picks one.
const DEFAULT_FEED_COLORS = ['#7da7d9', '#c9a8d4', '#b8c7a1', '#d4b896', '#c7a1a1', '#a1bdc7'];

/** Rewrite a webcal:// URL to https:// (the scheme calendars hand out, but fetch can't speak). */
function normalizeFeedUrl(raw: string): string {
  const url = raw.trim();
  if (/^webcal:\/\//i.test(url)) return url.replace(/^webcal:\/\//i, 'https://');
  return url;
}

/** Best-effort name from the URL host, used when the user leaves the name blank. */
function nameFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host || 'Timetable';
  } catch {
    return 'Timetable';
  }
}

export default function AddFeedForm({
  t, colorBank, onAdd, onClose,
}: {
  t: Theme;
  colorBank: string[];
  /** Called with the validated, ready-to-store feed. The parent adds it via setCalendarFeeds. */
  onAdd: (feed: CalendarFeed) => void;
  onClose: () => void;
}) {
  const bank = colorBank.length > 0 ? colorBank : DEFAULT_FEED_COLORS;
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [color, setColor] = useState(bank[0] ?? DEFAULT_FEED_COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const cleanUrl = normalizeFeedUrl(url);
    if (!cleanUrl) { setError('Paste your timetable link first.'); return; }
    if (!/^https?:\/\//i.test(cleanUrl)) {
      setError('That doesn’t look like a calendar link — it should start with webcal:// or https://');
      return;
    }
    setBusy(true);
    setError(null);

    const feed: CalendarFeed = {
      id: `feed-${Date.now().toString(36)}`,
      label: name.trim() || nameFromUrl(cleanUrl),
      url: cleanUrl,
    };

    try {
      // Validate by actually fetching + parsing through the existing pipeline.
      // The parent's refreshFeeds() re-fetches and caches once the feed lands,
      // so we don't keep these events — we just prove the URL resolves + parses.
      // A valid-but-empty calendar (e.g. term hasn't started) is fine: the fetch
      // succeeded, so we add it rather than blocking the user.
      await fetchFeed(feed, color);
      onAdd(feed);
      onClose();
    } catch (e) {
      setError(
        `Couldn’t load that calendar (${e instanceof Error ? e.message : String(e)}). ` +
        'Check the link, or copy the "subscribe / ICS" URL from your timetable.',
      );
      setBusy(false);
    }
  };

  return (
    <div style={{
      background: t.panel, border: `1px solid ${t.border}`, borderRadius: '12px',
      padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
          fontSize: '0.78rem', color: t.textMuted, letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          <CalendarDays size={13} strokeWidth={1.6} /> Add your timetable
        </span>
        <button onClick={onClose} style={iconBtn(t)} aria-label="Close"><X size={14} strokeWidth={1.5} /></button>
      </div>

      <div style={{ fontSize: '0.78rem', color: t.textDim, lineHeight: 1.5, margin: '-0.2rem 0 0.1rem' }}>
        Paste the calendar subscription link from your university or work timetable
        (it starts with <code style={{ fontSize: '0.72rem' }}>webcal://</code> or <code style={{ fontSize: '0.72rem' }}>https://…​.ics</code>).
        Your classes drop straight onto the calendar and into Today.
      </div>

      <div>
        <div style={fieldLabel(t)}>Calendar link</div>
        <input
          autoFocus
          value={url}
          onChange={e => { setUrl(e.target.value); setError(null); }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (!busy) void submit(); } }}
          placeholder="webcal://… or https://….ics"
          style={inputStyle(t)}
        />
      </div>

      <div>
        <div style={fieldLabel(t)}>Name (optional)</div>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (!busy) void submit(); } }}
          placeholder="e.g. Lectures, Shifts…"
          style={inputStyle(t)}
        />
      </div>

      <div>
        <div style={fieldLabel(t)}>Colour</div>
        <ColorBankPicker
          bank={bank}
          selected={color}
          onChange={(c) => { if (c) setColor(c); }}
          allowNone={false}
          swatchSize={16}
        />
      </div>

      {error && (
        <div style={{
          background: t.alertBg, border: `1px solid ${t.alertBorder}`, borderRadius: '8px',
          padding: '0.5rem 0.7rem', fontSize: '0.74rem', color: t.alert, lineHeight: 1.5,
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={() => { if (!busy) void submit(); }}
          disabled={busy || !url.trim()}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            background: color, border: 'none', borderRadius: '7px', color: '#fff',
            padding: '0.5rem 1.1rem', fontFamily: 'inherit', fontSize: '0.82rem',
            fontWeight: 500, cursor: busy || !url.trim() ? 'default' : 'pointer',
            opacity: busy || !url.trim() ? 0.5 : 1,
          }}
        >
          {busy && <Loader2 size={13} strokeWidth={2} style={{ animation: 'bozz-spin 0.8s linear infinite' }} />}
          {busy ? 'Checking…' : 'Add timetable'}
        </button>
        <button onClick={onClose} style={ghostBtn(t)}>Cancel</button>
      </div>
      <style>{`@keyframes bozz-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── Local styles (match CalendarView's helpers) ───────────────────────────────

const fieldLabel = (t: Theme): React.CSSProperties => ({
  fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase',
  color: t.textDim, marginBottom: '0.35rem',
});

const inputStyle = (t: Theme): React.CSSProperties => ({
  width: '100%', boxSizing: 'border-box',
  background: t.input, border: `1px solid ${t.border}`, borderRadius: '7px',
  padding: '0.5rem 0.75rem', color: t.text, fontSize: '0.85rem',
  fontFamily: 'inherit', outline: 'none',
});

const ghostBtn = (t: Theme): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
  background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px',
  padding: '0.5rem 0.9rem', color: t.textMuted, cursor: 'pointer',
  fontSize: '0.78rem', fontFamily: 'inherit', fontWeight: 300,
});

const iconBtn = (t: Theme): React.CSSProperties => ({
  background: 'transparent', border: 'none', cursor: 'pointer',
  color: t.textMuted, padding: '0.2rem', display: 'flex', alignItems: 'center',
  borderRadius: '4px',
});
