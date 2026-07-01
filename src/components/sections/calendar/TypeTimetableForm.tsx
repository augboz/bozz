/**
 * TypeTimetableForm — TYPE your classes instead of pasting an .ics URL.
 *
 * The single highest-leverage activation unblock: most students can't produce a
 * calendar subscription link, but everyone can type "Mon 9-11 BIO101 Room 3.21".
 * Lines are parsed offline (lib/timetableParser) into the recurring CalendarNote
 * shape noteEvents() already expands, with a live preview before confirm.
 *
 * Reused by the onboarding welcome step and the Calendar "Add timetable" panel,
 * so there is one parser + one UI for typing a timetable everywhere.
 */

import { useMemo, useState } from 'react';
import { CalendarPlus, Check, ArrowRight, Pencil } from 'lucide-react';
import type { CalendarNote, Theme } from '../../../lib/types';
import { parseTimetable, formatDays, formatTimeRange } from '../../../lib/timetableParser';
import ColorBankPicker from '../../shared/ColorBankPicker';

const DEFAULT_CLASS_COLORS = ['#7da7d9', '#c9a8d4', '#b8c7a1', '#d4b896', '#c7a1a1', '#a1bdc7'];
const DAY_MS = 24 * 60 * 60 * 1000;

function localMidnight(d: Date): number {
  const n = new Date(d); n.setHours(0, 0, 0, 0); return n.getTime();
}

/** Build the recurring CalendarNotes from typed lines (term window + colour applied). */
export function buildTimetableNotes(text: string, color: string): Omit<CalendarNote, 'id'>[] {
  const parsed = parseTimetable(text);
  if (parsed.length === 0) return [];
  // Default term window: today → +16 weeks (a typical semester). The user can
  // edit individual classes later in the Calendar.
  const termStart = localMidnight(new Date());
  const termEnd = termStart + 16 * 7 * DAY_MS;
  return parsed.map(p => ({
    title: p.title,
    date: termStart,
    startMin: p.startMin,
    endMin: p.endMin,
    color,
    location: p.location,
    repeat: { weekdays: p.weekdays, termStart, termEnd },
  }));
}

/** The single worked example shown before the user types, so they see exactly
 *  what to write and what it turns into. Role-neutral (Bozz's primary user is a
 *  knowledge worker, not only a student). Kept parseable so the preview chip is real. */
const DEFAULT_EXAMPLE = 'Mon 9-11 Team meeting Room 4';

export default function TypeTimetableForm({
  t, colorBank, onAddNotes, onClose, autoFocus = true, compact = false,
  exampleLine = DEFAULT_EXAMPLE, showExample = false,
}: {
  t: Theme;
  colorBank: string[];
  /** Hand the freshly-built recurring notes up to be appended to calendarNotes. */
  onAddNotes: (notes: Omit<CalendarNote, 'id'>[]) => void;
  onClose: () => void;
  autoFocus?: boolean;
  /** Slightly tighter spacing when embedded (onboarding overlay). */
  compact?: boolean;
  /** The worked-example line demonstrated above the box (shown while it's empty). */
  exampleLine?: string;
  /** Show the "type it like this" worked example (the first-run onboarding uses it). */
  showExample?: boolean;
}) {
  const bank = colorBank.length > 0 ? colorBank : DEFAULT_CLASS_COLORS;
  const [text, setText] = useState('');
  const [color, setColor] = useState(bank[0] ?? DEFAULT_CLASS_COLORS[0]);

  // Parse the worked example once so the demo chip below shows the REAL result
  // the parser would produce, not a hand-drawn mock.
  const example = useMemo(() => parseTimetable(exampleLine)[0] ?? null, [exampleLine]);

  // Live preview — reparse on every keystroke (cheap, all-offline).
  const parsed = useMemo(() => parseTimetable(text), [text]);
  // Lines that have content but didn't parse, so we can nudge the user.
  const unparsedCount = useMemo(() => {
    const lines = text.split(/[\n;]+/).map(l => l.trim()).filter(Boolean);
    return Math.max(0, lines.length - parsed.length);
  }, [text, parsed.length]);

  const submit = () => {
    const notes = buildTimetableNotes(text, color);
    if (notes.length === 0) return;
    onAddNotes(notes);
    onClose();
  };

  return (
    <div style={{
      background: t.panel, border: `1px solid ${t.border}`, borderRadius: '12px',
      padding: compact ? '1rem' : '1.25rem',
      display: 'flex', flexDirection: 'column', gap: '0.8rem',
      textAlign: 'left',
    }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
        fontSize: '0.78rem', color: t.textMuted, letterSpacing: '0.1em', textTransform: 'uppercase',
      }}>
        <CalendarPlus size={13} strokeWidth={1.6} /> Type your week
      </div>

      <div style={{ fontSize: '0.78rem', color: t.textDim, lineHeight: 1.5, margin: '-0.2rem 0 0' }}>
        One per line. We work out the day, time and place for you.
      </div>

      {/* Worked example — shows the format succeeding BEFORE the user types, so
          the one hard rule (start with a day) is taught by showing, not by an
          error after they fail. Only while the box is empty; the live preview
          takes over the moment they type. One-tap "Use this" fills the box so
          they can edit it into their own class (opt-in — never auto-filled). */}
      {showExample && example && text.trim() === '' && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '0.5rem',
          background: t.bgAlt, border: `1px dashed ${t.border}`, borderRadius: '9px',
          padding: '0.6rem 0.7rem',
        }}>
          <div style={{ fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.textDim }}>
            Type it like this
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <code style={{
              fontSize: '0.8rem', color: t.text, background: t.input,
              border: `1px solid ${t.border}`, borderRadius: '6px', padding: '0.28rem 0.5rem',
            }}>{exampleLine}</code>
            <ArrowRight size={14} strokeWidth={1.8} color={t.textDim} style={{ flexShrink: 0 }} />
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              background: t.panel, border: `1px solid ${t.border}`,
              borderLeft: `3px solid ${color}`, borderRadius: '6px', padding: '0.28rem 0.55rem',
            }}>
              <span style={{ fontSize: '0.8rem', color: t.text, fontWeight: 500 }}>{example.title}</span>
              <span style={{ fontSize: '0.66rem', color: t.textMuted }}>{formatDays(example.weekdays)}</span>
              <span style={{ fontSize: '0.66rem', color: t.textMuted }}>{formatTimeRange(example.startMin, example.endMin)}</span>
              {example.location && <span style={{ fontSize: '0.64rem', color: t.textDim }}>{example.location}</span>}
            </span>
          </div>
          <button
            onClick={() => setText(exampleLine)}
            style={{
              alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
              background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '7px',
              padding: '0.3rem 0.6rem', color: t.textMuted, cursor: 'pointer',
              fontSize: '0.72rem', fontFamily: 'inherit',
            }}
          >
            <Pencil size={12} strokeWidth={1.7} /> Use this example
          </button>
        </div>
      )}

      <textarea
        autoFocus={autoFocus}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          // Cmd/Ctrl+Enter confirms; plain Enter makes a new line (multi-class).
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); }
        }}
        placeholder={'Mon 9-11 Team meeting Room 4\nWed 2-4 Gym\nThu 6-7 Football'}
        rows={compact ? 4 : 5}
        style={{
          width: '100%', boxSizing: 'border-box',
          background: t.input, border: `1px solid ${t.border}`, borderRadius: '8px',
          padding: '0.6rem 0.75rem', color: t.text, fontSize: '0.85rem',
          fontFamily: 'inherit', outline: 'none', resize: 'vertical', lineHeight: 1.6,
        }}
      />

      {/* Live preview of the parsed classes */}
      {parsed.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <div style={{ fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.textDim }}>
            {parsed.length} event{parsed.length === 1 ? '' : 's'} found
          </div>
          {parsed.map((p, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '0.55rem',
              background: t.bgAlt, border: `1px solid ${t.border}`,
              borderLeft: `3px solid ${color}`, borderRadius: '7px',
              padding: '0.4rem 0.6rem',
            }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ fontSize: '0.82rem', color: t.text, fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.title}
              </span>
              <span style={{ fontSize: '0.68rem', color: t.textMuted, flexShrink: 0 }}>{formatDays(p.weekdays)}</span>
              <span style={{ fontSize: '0.68rem', color: t.textMuted, flexShrink: 0 }}>{formatTimeRange(p.startMin, p.endMin)}</span>
              {p.location && (
                <span style={{ fontSize: '0.66rem', color: t.textDim, flexShrink: 0 }}>{p.location}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {text.trim() && parsed.length === 0 && (
        <div style={{ fontSize: '0.72rem', color: t.textDim, lineHeight: 1.5 }}>
          Couldn’t read an event yet. Start each line with a day, e.g.{' '}
          <code style={{ fontSize: '0.7rem' }}>Mon 9-11 Team meeting</code>.
        </div>
      )}
      {parsed.length > 0 && unparsedCount > 0 && (
        <div style={{ fontSize: '0.7rem', color: t.textDim }}>
          {unparsedCount} line{unparsedCount === 1 ? '' : 's'} skipped. Each one needs a day + a time.
        </div>
      )}

      <div>
        <div style={{ fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.textDim, marginBottom: '0.35rem' }}>
          Colour
        </div>
        <ColorBankPicker
          bank={bank}
          selected={color}
          onChange={(c) => { if (c) setColor(c); }}
          allowNone={false}
          swatchSize={16}
        />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={submit}
          disabled={parsed.length === 0}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            background: color, border: 'none', borderRadius: '7px', color: '#fff',
            padding: '0.5rem 1.1rem', fontFamily: 'inherit', fontSize: '0.82rem',
            fontWeight: 500, cursor: parsed.length === 0 ? 'default' : 'pointer',
            opacity: parsed.length === 0 ? 0.5 : 1,
          }}
        >
          <Check size={14} strokeWidth={2} />
          {parsed.length > 0 ? `Add ${parsed.length} event${parsed.length === 1 ? '' : 's'}` : 'Add to your week'}
        </button>
        <button onClick={onClose} style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
          background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px',
          padding: '0.5rem 0.9rem', color: t.textMuted, cursor: 'pointer',
          fontSize: '0.78rem', fontFamily: 'inherit', fontWeight: 300,
        }}>Cancel</button>
      </div>
    </div>
  );
}
