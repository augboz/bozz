import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  format, addMonths, addWeeks, addDays, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday,
} from 'date-fns';
import { ChevronLeft, ChevronRight, X, Plus, Clock, Calendar, CalendarPlus, Keyboard, Trash2 } from 'lucide-react';
import type {
  CalendarEvent, CalendarFeed, CalendarNote, CalendarViewMode, Theme, Topic,
} from '../../../lib/types';
import { topicDeadlineEvents, noteEvents, eventsOnDay } from '../../../lib/calendar';
import { SectionHeader } from '../../shared/ui';
import ColorBankPicker from '../../shared/ColorBankPicker';
import AddFeedForm from './AddFeedForm';
import TypeTimetableForm from './TypeTimetableForm';

interface CalendarViewProps {
  t: Theme;
  feedEvents: CalendarEvent[];
  /** The user's subscribed ICS feeds (timetables). Drives the empty-state card. */
  calendarFeeds?: CalendarFeed[];
  /** Add a validated feed (from the "Add your timetable" front door). */
  onAddFeed?: (feed: CalendarFeed) => void;
  topics?: Topic[];
  onAddTopicItem?: (topicId: string, text: string, deadline: number) => void;
  calendarNotes?: CalendarNote[];
  onCalendarNotesChange?: (notes: CalendarNote[]) => void;
  calendarConnections?: import('../../../lib/types').CalendarConnection[];
  onCalendarConnectionsChange?: (next: import('../../../lib/types').CalendarConnection[]) => void;
  gcalError?: string | null;
  appleCalError?: string | null;
  tbOffset?: number;
  colorBank?: string[];
  /** When set/changed (by a click on a specific event elsewhere), focus the
   *  calendar on that date in DAY mode and open its day panel. */
  focusRequest?: { date: number; mode?: CalendarViewMode };
}

const WEEK_OPTS = { weekStartsOn: 1 } as const;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Time grid config
const GRID_START_HOUR = 6;   // 6 AM
const GRID_END_HOUR   = 22;  // 10 PM
const HOUR_PX = 56;          // pixels per hour


// ── Helpers ───────────────────────────────────────────────────────────────────

function minToLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function localMidnight(d: Date): number {
  const n = new Date(d); n.setHours(0, 0, 0, 0); return n.getTime();
}

/**
 * Map a note-derived CalendarEvent back to its underlying CalendarNote id.
 * noteEvents() builds ids as `note:<noteId>` (one-off) or `note:<noteId>:<dayMs>`
 * (one per recurring occurrence). Note ids never contain ':', so the id is the
 * single segment after the `note:` prefix. Returns null for non-note events
 * (feed/deadline), which are read-only and have no deletable note.
 */
function noteIdFromEvent(e: CalendarEvent): string | null {
  if (e.source !== 'note' || !e.id.startsWith('note:')) return null;
  return e.id.slice('note:'.length).split(':')[0] || null;
}

// ── Event creation form ───────────────────────────────────────────────────────

function CreateEventForm({
  t, defaultDate, defaultStartMin, onSave, onClose, colorBank,
}: {
  t: Theme;
  defaultDate: Date;
  defaultStartMin?: number;
  onSave: (note: Omit<CalendarNote, 'id'>) => void;
  onClose: () => void;
  colorBank: string[];
}) {
  const bank = colorBank;
  const [title, setTitle] = useState('');
  const [allDay, setAllDay] = useState(defaultStartMin == null);
  const [startMin, setStartMin] = useState(defaultStartMin ?? 9 * 60);
  const [endMin, setEndMin] = useState((defaultStartMin ?? 9 * 60) + 60);
  const [color, setColor] = useState(bank[0] ?? '#7da7d9');
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState('');
  // Recurring class (timetable) fields — off by default, so a plain event is
  // saved exactly as before (one-off, no `repeat`).
  const [repeats, setRepeats] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>([defaultDate.getDay()]);
  // Default term window: today → +16 weeks (a typical semester). User can edit.
  const [termStart, setTermStart] = useState(localMidnight(defaultDate));
  const [termEnd, setTermEnd] = useState(localMidnight(defaultDate) + 16 * 7 * 24 * 60 * 60 * 1000);
  const titleRef = useRef<HTMLInputElement>(null);

  const toggleWeekday = (d: number) =>
    setWeekdays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort());

  const save = () => {
    if (!title.trim()) return;
    // A repeating class is always timed (a weekly all-day class makes no sense),
    // so force a start/end if the user left it all-day.
    const useAllDay = repeats ? false : allDay;
    onSave({
      title: title.trim(),
      date: localMidnight(defaultDate),
      startMin: useAllDay ? null : startMin,
      endMin: useAllDay ? null : endMin,
      color,
      notes: notes.trim() || undefined,
      location: location.trim() || undefined,
      repeat: repeats && weekdays.length > 0
        ? { weekdays, termStart, termEnd }
        : undefined,
    });
    onClose();
  };

  return (
    <div style={{
      background: t.panel, border: `1px solid ${t.border}`, borderRadius: '12px',
      padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.78rem', color: t.textMuted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          New event · {format(defaultDate, 'd MMM')}
        </span>
        <button onClick={onClose} style={iconBtnStyle(t)}>
          <X size={14} strokeWidth={1.5} />
        </button>
      </div>

      <input
        ref={titleRef}
        autoFocus
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && save()}
        placeholder="Event title…"
        style={inputStyle(t)}
      />

      {/* All-day toggle — hidden when repeating (a weekly class is always timed) */}
      {!repeats && (
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={allDay}
            onChange={e => setAllDay(e.target.checked)}
            style={{ accentColor: color }}
          />
          <span style={{ fontSize: '0.8rem', color: t.textMuted }}>All-day</span>
        </label>
      )}

      {/* Repeat weekly (timetable class) toggle */}
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={repeats}
          onChange={e => { setRepeats(e.target.checked); if (e.target.checked) setAllDay(false); }}
          style={{ accentColor: color }}
        />
        <span style={{ fontSize: '0.8rem', color: t.textMuted }}>Repeats weekly (a class)</span>
      </label>

      {/* Weekday picker + term range — only for a repeating class */}
      {repeats && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
            {/* Mon-first labels; value maps to Date.getDay() (0=Sun … 6=Sat). */}
            {[{ d: 1, l: 'M' }, { d: 2, l: 'T' }, { d: 3, l: 'W' }, { d: 4, l: 'T' }, { d: 5, l: 'F' }, { d: 6, l: 'S' }, { d: 0, l: 'S' }].map(({ d, l }) => {
              const on = weekdays.includes(d);
              return (
                <button
                  key={d}
                  onClick={() => toggleWeekday(d)}
                  aria-pressed={on}
                  style={{
                    width: '28px', height: '28px', borderRadius: '7px', cursor: 'pointer',
                    background: on ? color : 'transparent',
                    border: `1px solid ${on ? color : t.border}`,
                    color: on ? '#fff' : t.textMuted, fontFamily: 'inherit',
                    fontSize: '0.72rem', fontWeight: 600,
                  }}
                >
                  {l}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.6rem', color: t.textDim, marginBottom: '0.25rem', letterSpacing: '0.06em' }}>TERM START</div>
              <input
                type="date"
                value={format(new Date(termStart), 'yyyy-MM-dd')}
                onChange={e => { if (e.target.value) setTermStart(localMidnight(new Date(e.target.value))); }}
                style={{ ...inputStyle(t), padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.6rem', color: t.textDim, marginBottom: '0.25rem', letterSpacing: '0.06em' }}>TERM END</div>
              <input
                type="date"
                value={format(new Date(termEnd), 'yyyy-MM-dd')}
                onChange={e => { if (e.target.value) setTermEnd(localMidnight(new Date(e.target.value))); }}
                style={{ ...inputStyle(t), padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Time pickers */}
      {!allDay && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.65rem', color: t.textDim, marginBottom: '0.25rem', letterSpacing: '0.06em' }}>START</div>
            <input
              type="time"
              value={minToLabel(startMin)}
              onChange={e => {
                const [h, m] = e.target.value.split(':').map(Number);
                const sm = h * 60 + m;
                setStartMin(sm);
                if (endMin <= sm) setEndMin(sm + 60);
              }}
              style={{ ...inputStyle(t), padding: '0.4rem 0.6rem', fontSize: '0.82rem' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.65rem', color: t.textDim, marginBottom: '0.25rem', letterSpacing: '0.06em' }}>END</div>
            <input
              type="time"
              value={minToLabel(endMin)}
              onChange={e => {
                const [h, m] = e.target.value.split(':').map(Number);
                setEndMin(h * 60 + m);
              }}
              style={{ ...inputStyle(t), padding: '0.4rem 0.6rem', fontSize: '0.82rem' }}
            />
          </div>
        </div>
      )}

      {/* Location / room */}
      <input
        value={location}
        onChange={e => setLocation(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && save()}
        placeholder="Room / location (optional)…"
        style={inputStyle(t)}
      />

      {/* Color */}
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

      {/* Notes */}
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Notes (optional)…"
        rows={2}
        style={{
          ...inputStyle(t),
          resize: 'vertical',
          fontFamily: 'inherit',
          fontSize: '0.8rem',
          lineHeight: 1.5,
        }}
      />

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={save}
          disabled={!title.trim()}
          style={{
            background: color, border: 'none', borderRadius: '7px', color: '#fff',
            padding: '0.5rem 1.1rem', fontFamily: 'inherit', fontSize: '0.82rem',
            fontWeight: 500, cursor: title.trim() ? 'pointer' : 'default',
            opacity: title.trim() ? 1 : 0.45,
          }}
        >
          Save
        </button>
        <button onClick={onClose} style={ghostBtn(t)}>Cancel</button>
      </div>
    </div>
  );
}

// ── Time grid ─────────────────────────────────────────────────────────────────

/**
 * Renders a vertical time grid from GRID_START_HOUR to GRID_END_HOUR.
 * `columns` is an array of { day, events } — one column per day.
 * All-day events are rendered above in a separate band.
 */
function TimeGrid({
  t, columns, onClickSlot,
}: {
  t: Theme;
  columns: Array<{ day: Date; events: CalendarEvent[] }>;
  onClickSlot: (day: Date, startMin?: number) => void;
}) {
  const hours = Array.from(
    { length: GRID_END_HOUR - GRID_START_HOUR },
    (_, i) => GRID_START_HOUR + i,
  );
  const totalMinutes = (GRID_END_HOUR - GRID_START_HOUR) * 60;
  const gridHeight = (GRID_END_HOUR - GRID_START_HOUR) * HOUR_PX;

  // Separate all-day vs timed events per column
  const colData = columns.map(({ day, events }) => ({
    day,
    allDay: events.filter(e => e.allDay),
    timed: events.filter(e => !e.allDay),
  }));

  // Current time indicator
  const now = new Date();
  const nowMinFromGridStart = now.getHours() * 60 + now.getMinutes() - GRID_START_HOUR * 60;
  const showNowLine = nowMinFromGridStart >= 0 && nowMinFromGridStart <= totalMinutes;
  const nowPct = (nowMinFromGridStart / totalMinutes) * 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: '10px', border: `1px solid ${t.border}` }}>
      {/* All-day band */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${t.border}` }}>
        <div style={{ width: '48px', flexShrink: 0, padding: '0.4rem 0.5rem', borderRight: `1px solid ${t.border}` }}>
          <span style={{ fontSize: '0.55rem', color: t.textDim, letterSpacing: '0.06em', textTransform: 'uppercase' }}>all day</span>
        </div>
        {colData.map(({ day, allDay }) => (
          <div
            key={day.toISOString()}
            style={{
              flex: 1, minHeight: '28px', padding: '3px 4px',
              borderRight: `1px solid ${t.border}`,
              display: 'flex', flexDirection: 'column', gap: '2px',
              cursor: 'pointer',
            }}
            onClick={() => onClickSlot(day)}
          >
            {allDay.map(e => (
              <EventChip key={e.id} event={e} t={t} />
            ))}
          </div>
        ))}
      </div>

      {/* Timed grid */}
      <div style={{ display: 'flex', overflowY: 'auto', maxHeight: '520px' }}>
        {/* Hour labels */}
        <div style={{ width: '48px', flexShrink: 0, position: 'relative', height: gridHeight }}>
          {hours.map(h => (
            <div
              key={h}
              style={{
                position: 'absolute',
                top: (h - GRID_START_HOUR) * HOUR_PX - 9,
                right: '6px',
                fontSize: '0.6rem', color: t.textDim, lineHeight: 1,
                whiteSpace: 'nowrap',
              }}
            >
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>

        {/* Day columns */}
        <div style={{ flex: 1, display: 'flex', position: 'relative' }}>
          {colData.map(({ day, timed }, colIdx) => (
            <div
              key={day.toISOString()}
              style={{
                flex: 1,
                position: 'relative',
                height: gridHeight,
                borderLeft: `1px solid ${t.border}`,
                background: isToday(day) ? t.bgAlt + '80' : 'transparent',
                cursor: 'pointer',
              }}
              onClick={e => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const relY = e.clientY - rect.top;
                const clickedMin = Math.round(((relY / gridHeight) * totalMinutes + GRID_START_HOUR * 60) / 15) * 15;
                onClickSlot(day, Math.max(0, Math.min(23 * 60, clickedMin)));
              }}
            >
              {/* Hour lines */}
              {hours.map(h => (
                <div key={h} style={{
                  position: 'absolute',
                  top: (h - GRID_START_HOUR) * HOUR_PX,
                  left: 0, right: 0,
                  borderTop: `1px solid ${t.border}`,
                  opacity: 0.5,
                  pointerEvents: 'none',
                }} />
              ))}

              {/* Now line */}
              {showNowLine && isToday(day) && (
                <div style={{
                  position: 'absolute',
                  top: `${nowPct}%`,
                  left: 0, right: 0,
                  borderTop: `2px solid ${t.alert}`,
                  opacity: 0.8,
                  pointerEvents: 'none',
                  zIndex: 2,
                }}>
                  <div style={{
                    position: 'absolute', left: '-4px', top: '-4px',
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: t.alert,
                  }} />
                </div>
              )}

              {/* Timed events */}
              {layoutTimedEvents(timed).map(({ event, col, cols }) => {
                const sm = event.startMin ?? (event.start - localMidnight(day)) / 60_000;
                const em = event.endMin ?? (event.end ? (event.end - localMidnight(day)) / 60_000 : sm + 60);
                const topPx = (sm - GRID_START_HOUR * 60) / 60 * HOUR_PX;
                const height = Math.max(24, (em - sm) / 60 * HOUR_PX - 2);
                const colW = 100 / cols;
                return (
                  <div
                    key={event.id}
                    title={`${minToLabel(sm)}–${minToLabel(em)} · ${event.title}`}
                    onClick={e => e.stopPropagation()}
                    style={{
                      position: 'absolute',
                      top: topPx + 1,
                      height,
                      left: `${col * colW}%`,
                      width: `${colW - 1}%`,
                      background: event.color + '33',
                      borderLeft: `3px solid ${event.color}`,
                      borderRadius: '4px',
                      padding: '2px 4px',
                      overflow: 'hidden',
                      zIndex: 1,
                      pointerEvents: 'auto',
                    }}
                  >
                    <div style={{ fontSize: '0.6rem', color: event.color, fontWeight: 500, whiteSpace: 'nowrap' }}>
                      {minToLabel(sm)}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {event.title}
                    </div>
                  </div>
                );
              })}

              {/* Ghost day label for multi-column */}
              {colIdx === 0 && columns.length === 1 && (
                <div style={{ position: 'absolute', top: 4, right: 6, fontSize: '0.6rem', color: t.textDim, pointerEvents: 'none' }}>
                  click to add
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Naive overlap layout — returns col index and total cols for each event. */
function layoutTimedEvents(events: CalendarEvent[]): Array<{ event: CalendarEvent; col: number; cols: number }> {
  const sorted = [...events].sort((a, b) => a.start - b.start);
  const groups: Array<CalendarEvent[]> = [];
  for (const ev of sorted) {
    let placed = false;
    for (const g of groups) {
      const last = g[g.length - 1];
      const lastEnd = last.endMin ?? ((last.end ? last.end - last.start : 3600000) / 60_000 + (last.startMin ?? 0));
      const evStart = ev.startMin ?? 0;
      if (evStart >= lastEnd) { g.push(ev); placed = true; break; }
    }
    if (!placed) groups.push([ev]);
  }
  const result: Array<{ event: CalendarEvent; col: number; cols: number }> = [];
  groups.forEach((g, col) => g.forEach(ev => result.push({ event: ev, col, cols: groups.length })));
  return result;
}

function EventChip({ event, t }: { event: CalendarEvent; t: Theme }) {
  const isDeadline = event.source === 'deadline';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '3px',
      fontSize: '0.62rem',
      padding: isDeadline ? '1px 4px' : '2px 5px',
      borderRadius: '4px',
      background: isDeadline ? 'transparent' : event.color + '25',
      border: isDeadline ? `1px dashed ${event.color}55` : `1px solid ${event.color}44`,
      color: t.text,
      overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
    }}>
      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: event.color, flexShrink: 0 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', color: isDeadline ? t.textMuted : t.text }}>
        {event.title}
      </span>
    </div>
  );
}

// ── Month grid ────────────────────────────────────────────────────────────────

function MonthGrid({ t, cursor, events, onPick }: {
  t: Theme; cursor: Date; events: CalendarEvent[]; onPick: (d: Date) => void;
}) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(cursor), WEEK_OPTS),
    end: endOfWeek(endOfMonth(cursor), WEEK_OPTS),
  });
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '4px' }}>
        {WEEKDAYS.map(w => (
          <div key={w} style={{ fontSize: '0.62rem', color: t.textDim, letterSpacing: '0.08em', textTransform: 'uppercase', textAlign: 'center' }}>
            {w}
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
        {days.map(d => {
          const dayEvents = eventsOnDay(events, d);
          const timedEvents = dayEvents.filter(e => !e.allDay);
          const allDayEvents = dayEvents.filter(e => e.allDay && e.source !== 'deadline');
          const deadlineEvents = dayEvents.filter(e => e.source === 'deadline');
          const dim = !isSameMonth(d, cursor);
          const today = isToday(d);
          return (
            <button
              key={d.toISOString()}
              onClick={() => onPick(d)}
              style={{
                textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                height: '88px', minWidth: 0, padding: '0.35rem 0.4rem', borderRadius: '8px',
                background: today ? t.bgAlt : 'transparent',
                border: `1px solid ${today ? t.borderStrong : t.border}`,
                opacity: dim ? 0.4 : 1,
                display: 'flex', flexDirection: 'column', gap: '2px',
                overflow: 'hidden',
              }}
            >
              <span style={{
                fontSize: '0.72rem', fontWeight: today ? 500 : 300,
                color: today ? t.text : t.textMuted,
                background: today ? t.doingAccent + '22' : 'transparent',
                borderRadius: '4px', padding: '0 3px', alignSelf: 'flex-start',
              }}>
                {d.getDate()}
              </span>

              {/* Timed events — pill with clock + time */}
              {timedEvents.slice(0, 2).map(e => (
                <div key={e.id} style={{
                  display: 'flex', alignItems: 'center', gap: '2px',
                  fontSize: '0.6rem', overflow: 'hidden',
                  background: e.color + '28', borderRadius: '3px',
                  padding: '1px 3px', border: `1px solid ${e.color}44`,
                }}>
                  <Clock size={7} strokeWidth={2} color={e.color} style={{ flexShrink: 0 }} />
                  <span style={{ color: e.color, flexShrink: 0, fontWeight: 500 }}>
                    {e.startMin != null ? minToLabel(e.startMin) : format(new Date(e.start), 'HH:mm')}
                  </span>
                  <span style={{ color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.title}
                  </span>
                </div>
              ))}

              {/* All-day iCal events — solid pill */}
              {allDayEvents.slice(0, 2).map(e => (
                <div key={e.id} style={{
                  display: 'flex', alignItems: 'center', gap: '2px',
                  fontSize: '0.6rem', overflow: 'hidden',
                  background: e.color + '22', borderRadius: '3px',
                  padding: '1px 3px',
                }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: e.color, flexShrink: 0 }} />
                  <span style={{ color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</span>
                </div>
              ))}

              {/* Deadline dots — compact */}
              {deadlineEvents.length > 0 && (
                <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap', marginTop: '1px' }}>
                  {deadlineEvents.slice(0, 4).map(e => (
                    <span key={e.id} title={e.title} style={{
                      width: '6px', height: '6px', borderRadius: '50%',
                      background: e.color, flexShrink: 0,
                    }} />
                  ))}
                  {deadlineEvents.length > 4 && (
                    <span style={{ fontSize: '0.55rem', color: t.textDim }}>+{deadlineEvents.length - 4}</span>
                  )}
                </div>
              )}

              {dayEvents.length > 4 && (
                <span style={{ fontSize: '0.55rem', color: t.textDim }}>
                  +{dayEvents.length - 4} more
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Day panel (slide-in) ──────────────────────────────────────────────────────

function DayPanel({ t, day, events, onClose, topics, onAddTopicItem, tbOffset = 0, onCreateNote, colorBank, notes = [], onDeleteNote }: {
  t: Theme; day: Date; events: CalendarEvent[]; onClose: () => void;
  topics?: Topic[];
  onAddTopicItem?: (topicId: string, text: string, deadline: number) => void;
  tbOffset?: number;
  onCreateNote: (note: Omit<CalendarNote, 'id'>) => void;
  colorBank: string[];
  /** User-created notes — used to tell a recurring class from a one-off event. */
  notes?: CalendarNote[];
  /** Delete the note behind a note-source event. Recurring = whole series. */
  onDeleteNote?: (noteId: string) => void;
}) {
  const [topicId, setTopicId] = useState<string>(() => topics?.[0]?.id ?? '');
  const [text, setText] = useState('');
  const [showEventForm, setShowEventForm] = useState(false);
  const useTopics = topics && topics.length > 0 && onAddTopicItem;

  const timedEvents = events.filter(e => !e.allDay).sort((a, b) => a.start - b.start);
  const allDayEvents = events.filter(e => e.allDay && e.source !== 'deadline');
  const deadlines = events.filter(e => e.source === 'deadline');

  // Delete a user-created event. For a recurring class, confirm first (it removes
  // the whole series). Feed (.ics) events have no note id, so no delete is offered.
  const deleteEvent = (e: CalendarEvent) => {
    const noteId = noteIdFromEvent(e);
    if (!noteId || !onDeleteNote) return;
    const note = notes.find(n => n.id === noteId);
    const isRecurring = !!note?.repeat && (note.repeat.weekdays ?? []).length > 0;
    if (isRecurring && !window.confirm('Delete this class? This removes the whole repeating series.')) return;
    onDeleteNote(noteId);
  };

  const add = () => {
    if (!text.trim() || !useTopics) return;
    const midnight = localMidnight(day);
    onAddTopicItem!(topicId || topics![0].id, text.trim(), midnight);
    setText('');
  };

  return (
    <div style={{
      position: 'fixed', top: tbOffset, right: 0, bottom: 0, width: '340px', zIndex: 50,
      background: t.panel, borderLeft: `1px solid ${t.border}`,
      padding: '1.5rem', overflowY: 'auto', boxShadow: '-8px 0 24px rgba(0,0,0,0.18)',
      display: 'flex', flexDirection: 'column', gap: '1rem',
      animation: 'bozz-slide-in 0.18s cubic-bezier(0.25,0.46,0.45,0.94)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.95rem', color: t.text, fontWeight: 300 }}>
          {format(day, 'EEEE d MMMM')}
        </span>
        <button onClick={onClose} style={iconBtnStyle(t)}><X size={16} strokeWidth={1.5} /></button>
      </div>

      {/* Timed events */}
      {timedEvents.length > 0 && (
        <div>
          <SectionLabel t={t} label="Timed" icon={<Clock size={11} strokeWidth={1.5} />} />
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            {timedEvents.map(e => {
              const sm = e.startMin ?? Math.floor((e.start % 86400000) / 60000);
              const em = e.endMin ?? (e.end ? Math.floor(((e.end - e.start) + (e.start % 86400000)) / 60000) : sm + 60);
              return (
                <div key={e.id} style={eventRow(t, e.color)}>
                  <span style={{ fontSize: '0.68rem', color: e.color, fontWeight: 500, flexShrink: 0, width: '88px' }}>
                    {minToLabel(sm)}–{minToLabel(em)}
                  </span>
                  <span style={{ flex: 1, fontSize: '0.82rem', color: t.text }}>{e.title}</span>
                  <EventSourceBadge source={e.source} />
                  {noteIdFromEvent(e) && onDeleteNote && (
                    <button onClick={() => deleteEvent(e)} title="Delete event" aria-label="Delete event" style={deleteBtn(t)}>
                      <Trash2 size={13} strokeWidth={1.6} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* All-day events */}
      {allDayEvents.length > 0 && (
        <div>
          <SectionLabel t={t} label="All day" icon={<Calendar size={11} strokeWidth={1.5} />} />
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            {allDayEvents.map(e => (
              <div key={e.id} style={eventRow(t, e.color)}>
                <span style={{ flex: 1, fontSize: '0.82rem', color: t.text }}>{e.title}</span>
                <EventSourceBadge source={e.source} />
                {noteIdFromEvent(e) && onDeleteNote && (
                  <button onClick={() => deleteEvent(e)} title="Delete event" aria-label="Delete event" style={deleteBtn(t)}>
                    <Trash2 size={13} strokeWidth={1.6} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deadlines */}
      {deadlines.length > 0 && (
        <div>
          <SectionLabel t={t} label="Deadlines" />
          <div style={{ display: 'grid', gap: '0.3rem' }}>
            {deadlines.map(e => (
              <div key={e.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.45rem 0.65rem',
                border: `1px dashed ${e.color}66`,
                borderRadius: '6px',
              }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: e.color, flexShrink: 0 }} />
                <span style={{ fontSize: '0.8rem', color: t.textMuted, flex: 1 }}>{e.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {events.length === 0 && (
        <p style={{ color: t.textDim, fontSize: '0.82rem', fontStyle: 'italic', margin: 0 }}>Nothing scheduled</p>
      )}

      {/* Add event */}
      <button
        onClick={() => setShowEventForm(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.35rem',
          background: 'transparent', border: `1px dashed ${t.border}`,
          borderRadius: '8px', padding: '0.5rem 0.75rem',
          color: t.textMuted, fontFamily: 'inherit', fontSize: '0.8rem',
          cursor: 'pointer', transition: 'border-color 0.1s, color 0.1s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = t.borderStrong; e.currentTarget.style.color = t.text; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textMuted; }}
      >
        <Plus size={13} strokeWidth={1.8} /> Add event
      </button>

      {showEventForm && (
        <CreateEventForm
          t={t}
          defaultDate={day}
          onSave={onCreateNote}
          onClose={() => setShowEventForm(false)}
          colorBank={colorBank}
        />
      )}

      {/* Add task with this deadline — topics only */}
      {useTopics && (
        <div>
          <div style={{ fontSize: '0.68rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: t.textMuted, marginBottom: '0.5rem' }}>
            Add task with this deadline
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.5rem' }}>
            {topics!.map(tp => {
              const on = (topicId || topics![0].id) === tp.id;
              return (
                <button
                  key={tp.id}
                  onClick={() => setTopicId(tp.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                    padding: '0.3rem 0.7rem', borderRadius: '999px',
                    background: on ? tp.color + '25' : 'transparent',
                    border: `1.5px solid ${on ? tp.color : t.border}`,
                    color: on ? tp.color : t.textMuted,
                    fontSize: '0.78rem', fontFamily: 'inherit', cursor: 'pointer',
                    transition: 'all 0.1s',
                  }}
                >
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: tp.color, flexShrink: 0 }} />
                  {tp.name || 'New topic'}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
              placeholder="task…"
              style={{ flex: 1, ...inputStyle(t) }}
            />
            <button onClick={add} style={ghostBtn(t)}>add</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function CalendarView({
  t, feedEvents, topics, onAddTopicItem,
  calendarFeeds = [], onAddFeed,
  calendarNotes = [], onCalendarNotesChange,
  calendarConnections = [],
  onCalendarConnectionsChange,
  gcalError,
  appleCalError,
  tbOffset = 0,
  colorBank = [] as string[],
  focusRequest,
}: CalendarViewProps) {
  const [mode, setMode] = useState<CalendarViewMode>('month');
  const [cursor, setCursor] = useState<Date>(new Date());
  const [selected, setSelected] = useState<Date | null>(null);

  // Focus request — when a specific event is clicked elsewhere (Today, Week…),
  // jump to its date in DAY mode and open that day's panel. Keyed off the request
  // object's identity so each click re-focuses even on the same date.
  useEffect(() => {
    if (!focusRequest) return;
    const d = new Date(focusRequest.date);
    setCursor(d);
    setMode(focusRequest.mode ?? 'day');
    setSelected(d);
  }, [focusRequest]);
  const [createFor, setCreateFor] = useState<{ day: Date; startMin?: number } | null>(null);
  const [colorPickingFor, setColorPickingFor] = useState<string | null>(null);
  const [addFeedOpen, setAddFeedOpen] = useState(false);
  const [typeTimetableOpen, setTypeTimetableOpen] = useState(false);

  // The "Add your timetable" front door is only useful when the parent wired the
  // callback. Show the empty-state card prominently until the user has any feed.
  const canAddFeed = !!onAddFeed;
  const noFeeds = calendarFeeds.length === 0;

  const events = useMemo<CalendarEvent[]>(
    () => [
      ...(topics ? topicDeadlineEvents(topics) : []),
      ...feedEvents,
      ...noteEvents(calendarNotes),
    ],
    [topics, feedEvents, calendarNotes],
  );

  const step = (dir: 1 | -1) => {
    setCursor(c =>
      mode === 'month' ? addMonths(c, dir)
        : mode === 'week' ? addWeeks(c, dir)
          : addDays(c, dir));
  };

  const heading =
    mode === 'month' ? format(cursor, 'MMMM yyyy')
      : mode === 'week'
        ? `${format(startOfWeek(cursor, WEEK_OPTS), 'd MMM')} – ${format(endOfWeek(cursor, WEEK_OPTS), 'd MMM yyyy')}`
        : format(cursor, 'EEEE d MMMM yyyy');

  const handleClickSlot = (day: Date, startMin?: number) => {
    setCreateFor({ day, startMin });
    setSelected(null);
  };

  const handlePickDay = (day: Date) => {
    setSelected(day);
    setCreateFor(null);
  };

  const saveNote = (raw: Omit<CalendarNote, 'id'>) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    onCalendarNotesChange?.([...calendarNotes, { id, ...raw }]);
    setCreateFor(null);
  };

  // Remove a user-created note (a one-off event or a whole recurring class). The
  // grid, day panel, and every notes-derived surface (Today/Week/Deadlines)
  // recompute from calendarNotes, so the event disappears everywhere at once.
  const deleteNote = (noteId: string) => {
    onCalendarNotesChange?.((calendarNotes ?? []).filter(n => n.id !== noteId));
  };

  const weekDays = mode === 'week'
    ? eachDayOfInterval({ start: startOfWeek(cursor, WEEK_OPTS), end: endOfWeek(cursor, WEEK_OPTS) })
    : null;

  return (
    <div style={{ position: 'relative' }}>
      <style>{`@keyframes bozz-slide-in{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
      <SectionHeader
        title="Calendar"
        t={t}
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => { setTypeTimetableOpen(true); setAddFeedOpen(false); setSelected(null); setCreateFor(null); }}
              style={{ ...ghostBtn(t), color: t.text, borderColor: t.borderStrong }}
              title="Type your classes in plain English"
            >
              <Keyboard size={13} strokeWidth={1.6} /> Type classes
            </button>
            {canAddFeed && (
              <button
                onClick={() => { setAddFeedOpen(true); setTypeTimetableOpen(false); setSelected(null); setCreateFor(null); }}
                style={{ ...ghostBtn(t), color: t.text, borderColor: t.borderStrong }}
                title="Add a timetable / calendar subscription"
              >
                <CalendarPlus size={13} strokeWidth={1.6} /> Add link
              </button>
            )}
            <Segmented mode={mode} setMode={setMode} t={t} />
            <button onClick={() => setCursor(new Date())} style={ghostBtn(t)}>today</button>
            <button onClick={() => step(-1)} aria-label="Previous" style={ghostBtn(t)}>
              <ChevronLeft size={14} strokeWidth={1.5} />
            </button>
            <button onClick={() => step(1)} aria-label="Next" style={ghostBtn(t)}>
              <ChevronRight size={14} strokeWidth={1.5} />
            </button>
          </div>
        }
      />

      <div style={{ fontSize: '1rem', color: t.text, fontWeight: 300, margin: '0 0 1rem' }}>
        {heading}
      </div>

      {/* Calendar error notices */}
      {gcalError && (
        <div style={{
          background: t.alertBg, border: `1px solid ${t.alertBorder}`,
          borderRadius: '8px', padding: '0.55rem 0.9rem',
          fontSize: '0.75rem', color: t.alert, marginBottom: '0.5rem',
          lineHeight: 1.5,
        }}>
          <strong>Google Calendar:</strong> {gcalError}
        </div>
      )}
      {appleCalError && !appleCalError.includes('desktop app') && (
        <div style={{
          background: t.alertBg, border: `1px solid ${t.alertBorder}`,
          borderRadius: '8px', padding: '0.55rem 0.9rem',
          fontSize: '0.75rem', color: t.alert, marginBottom: '0.85rem',
          lineHeight: 1.5,
        }}>
          <strong>Apple Calendar:</strong> {appleCalError}
        </div>
      )}
      {appleCalError?.includes('desktop app') && (
        <div style={{
          background: t.bgAlt, border: `1px solid ${t.border}`,
          borderRadius: '8px', padding: '0.55rem 0.9rem',
          fontSize: '0.75rem', color: t.textMuted, marginBottom: '0.85rem',
          lineHeight: 1.5,
        }}>
          Apple Calendar is only available in the desktop app.
        </div>
      )}

      {/* Per-account enable/disable toggles */}
      {calendarConnections.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', marginBottom: '1rem' }}>
          {calendarConnections.map(conn => {
            const defaultColor = conn.provider === 'googleCalendar' ? '#4285F4' : '#555555';
            const displayColor = conn.color ?? defaultColor;
            const label = conn.provider === 'googleCalendar' ? 'Google Calendar' : 'Apple Calendar';
            const pickerKey = `${conn.provider}:${conn.email}`;
            const isPickerOpen = colorPickingFor === pickerKey;
            return (
              <div key={`${conn.provider}:${conn.email}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                  <button
                    onClick={() => onCalendarConnectionsChange?.(
                      calendarConnections.map(c =>
                        c.email === conn.email && c.provider === conn.provider
                          ? { ...c, enabled: !c.enabled } : c
                      )
                    )}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                      padding: '0.3rem 0.75rem', borderRadius: '999px',
                      background: conn.enabled ? displayColor + '20' : 'transparent',
                      border: `1.5px solid ${conn.enabled ? displayColor : t.border}`,
                      color: conn.enabled ? displayColor : t.textMuted,
                      fontSize: '0.75rem', fontFamily: 'inherit', cursor: 'pointer',
                      transition: 'all 0.12s',
                    }}
                  >
                    <span style={{
                      width: '7px', height: '7px', borderRadius: '50%',
                      background: conn.enabled ? displayColor : t.borderStrong, flexShrink: 0,
                    }} />
                    {label}
                    <span style={{ fontSize: '0.68rem', opacity: 0.7 }}>{conn.email}</span>
                  </button>
                  {/* Color swatch opens inline bank picker */}
                  <button
                    onClick={() => setColorPickingFor(isPickerOpen ? null : pickerKey)}
                    title="Change colour"
                    style={{
                      width: '12px', height: '12px',
                      minWidth: '12px', minHeight: '12px',
                      borderRadius: '50%', boxSizing: 'content-box',
                      background: displayColor,
                      border: isPickerOpen ? `2px solid ${t.text}` : `1.5px solid ${t.border}`,
                      cursor: 'pointer', padding: 0, flexShrink: 0, alignSelf: 'center',
                    }}
                  />
                </div>
                {/* Inline colour bank picker */}
                {isPickerOpen && (
                  <div style={{ paddingLeft: '0.5rem' }}>
                    <ColorBankPicker
                      bank={colorBank}
                      selected={conn.color}
                      onChange={(c) => {
                        onCalendarConnectionsChange?.(
                          calendarConnections.map(cc =>
                            cc.email === conn.email && cc.provider === conn.provider
                              ? { ...cc, color: c } : cc
                          )
                        );
                        setColorPickingFor(null);
                      }}
                      swatchSize={16}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* "Add your timetable" front door — shown prominently until the user has a
          feed AND no typed classes. Type is the primary action (no .ics needed);
          pasting a link is the secondary. Both fill the grid + Today in seconds. */}
      {noFeeds && calendarNotes.length === 0 && !addFeedOpen && !typeTimetableOpen && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
          background: t.bgAlt, border: `1px dashed ${t.borderStrong}`, borderRadius: '12px',
          padding: '1.1rem 1.25rem', marginBottom: '1.25rem',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '42px', height: '42px', borderRadius: '11px', flexShrink: 0,
            background: t.doingAccent + '22', color: t.doingAccent,
          }}>
            <CalendarPlus size={20} strokeWidth={1.6} />
          </div>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <div style={{ fontSize: '0.92rem', color: t.text, fontWeight: 500, marginBottom: '0.15rem' }}>
              Add your timetable
            </div>
            <div style={{ fontSize: '0.78rem', color: t.textMuted, lineHeight: 1.5 }}>
              Type your classes in plain English (no link needed), or paste your university calendar link. Either way they fill the grid and Today in seconds.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, flexWrap: 'wrap' }}>
            <button
              onClick={() => setTypeTimetableOpen(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                background: t.doingAccent, border: 'none', borderRadius: '8px', color: '#fff',
                padding: '0.55rem 1.1rem', fontFamily: 'inherit', fontSize: '0.82rem',
                fontWeight: 500, cursor: 'pointer',
              }}
            >
              <Keyboard size={14} strokeWidth={2} /> Type classes
            </button>
            {canAddFeed && (
              <button
                onClick={() => setAddFeedOpen(true)}
                style={{ ...ghostBtn(t), color: t.text, borderColor: t.borderStrong, padding: '0.55rem 1rem', fontSize: '0.82rem' }}
              >
                <Plus size={14} strokeWidth={2} /> Paste link
              </button>
            )}
          </div>
        </div>
      )}

      {mode === 'month' && (
        <MonthGrid t={t} cursor={cursor} events={events} onPick={handlePickDay} />
      )}
      {mode === 'week' && weekDays && (
        <div>
          {/* Week day headers */}
          <div style={{ display: 'flex', marginLeft: '48px', marginBottom: '4px', gap: 0 }}>
            {weekDays.map(d => (
              <div
                key={d.toISOString()}
                style={{
                  flex: 1, textAlign: 'center', fontSize: '0.72rem',
                  color: isToday(d) ? t.text : t.textMuted,
                  fontWeight: isToday(d) ? 500 : 300,
                  paddingBottom: '4px',
                  borderBottom: isToday(d) ? `2px solid ${t.doingAccent}` : 'none',
                  cursor: 'pointer',
                }}
                onClick={() => handlePickDay(d)}
              >
                {format(d, 'EEE d')}
              </div>
            ))}
          </div>
          <TimeGrid
            t={t}
            columns={weekDays.map(d => ({ day: d, events: eventsOnDay(events, d) }))}
            onClickSlot={handleClickSlot}
          />
        </div>
      )}
      {mode === 'day' && (
        <div>
          <TimeGrid
            t={t}
            columns={[{ day: cursor, events: eventsOnDay(events, cursor) }]}
            onClickSlot={handleClickSlot}
          />
        </div>
      )}

      {/* Type-your-classes panel — the no-.ics activation path. Builds recurring
          CalendarNotes that noteEvents() expands onto the grid + Today. */}
      {typeTimetableOpen && (
        <div style={{
          position: 'fixed', top: tbOffset, right: 0, bottom: 0, width: '380px', zIndex: 50,
          background: t.panel, borderLeft: `1px solid ${t.border}`,
          padding: '1.5rem', overflowY: 'auto', boxShadow: '-8px 0 24px rgba(0,0,0,0.18)',
          animation: 'bozz-slide-in 0.18s cubic-bezier(0.25,0.46,0.45,0.94)',
        }}>
          <TypeTimetableForm
            t={t}
            colorBank={colorBank}
            onAddNotes={(notes) => {
              const stamp = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
              onCalendarNotesChange?.([
                ...calendarNotes,
                ...notes.map(n => ({ id: stamp(), ...n })),
              ]);
            }}
            onClose={() => setTypeTimetableOpen(false)}
          />
        </div>
      )}

      {/* Add timetable panel */}
      {canAddFeed && addFeedOpen && (
        <div style={{
          position: 'fixed', top: tbOffset, right: 0, bottom: 0, width: '360px', zIndex: 50,
          background: t.panel, borderLeft: `1px solid ${t.border}`,
          padding: '1.5rem', overflowY: 'auto', boxShadow: '-8px 0 24px rgba(0,0,0,0.18)',
          animation: 'bozz-slide-in 0.18s cubic-bezier(0.25,0.46,0.45,0.94)',
        }}>
          <AddFeedForm
            t={t}
            colorBank={colorBank}
            onAdd={(feed) => onAddFeed?.(feed)}
            onClose={() => setAddFeedOpen(false)}
          />
        </div>
      )}

      {/* Create event panel */}
      {createFor && (
        <div style={{
          position: 'fixed', top: tbOffset, right: 0, bottom: 0, width: '340px', zIndex: 50,
          background: t.panel, borderLeft: `1px solid ${t.border}`,
          padding: '1.5rem', overflowY: 'auto', boxShadow: '-8px 0 24px rgba(0,0,0,0.18)',
          animation: 'bozz-slide-in 0.18s cubic-bezier(0.25,0.46,0.45,0.94)',
        }}>
          <CreateEventForm
            t={t}
            defaultDate={createFor.day}
            defaultStartMin={createFor.startMin}
            onSave={saveNote}
            onClose={() => setCreateFor(null)}
            colorBank={colorBank}
          />
        </div>
      )}

      {/* Day detail panel */}
      {selected && (
        <DayPanel
          t={t}
          day={selected}
          events={eventsOnDay(events, selected)}
          onClose={() => setSelected(null)}
          topics={topics}
          onAddTopicItem={onAddTopicItem}
          tbOffset={tbOffset}
          colorBank={colorBank}
          notes={calendarNotes}
          onDeleteNote={onCalendarNotesChange ? deleteNote : undefined}
          onCreateNote={note => {
            saveNote(note);
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function Segmented({ mode, setMode, t }: {
  mode: CalendarViewMode; setMode: (m: CalendarViewMode) => void; t: Theme;
}) {
  const opts: CalendarViewMode[] = ['month', 'week', 'day'];
  return (
    <div style={{ display: 'inline-flex', border: `1px solid ${t.border}`, borderRadius: '8px', overflow: 'hidden' }}>
      {opts.map((o, i) => {
        const on = mode === o;
        return (
          <button key={o} onClick={() => setMode(o)} aria-pressed={on} style={{
            background: on ? t.bgAlt : 'transparent', color: on ? t.text : t.textMuted,
            border: 'none', borderLeft: i === 0 ? 'none' : `1px solid ${t.border}`,
            padding: '0.35rem 0.7rem', fontSize: '0.72rem', fontFamily: 'inherit',
            cursor: 'pointer', fontWeight: 300, textTransform: 'capitalize',
          }}>{o}</button>
        );
      })}
    </div>
  );
}

function SectionLabel({ t, label, icon }: { t: Theme; label: string; icon?: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.3rem',
      fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase',
      color: t.textDim, marginBottom: '0.4rem',
    }}>
      {icon}{label}
    </div>
  );
}

function EventSourceBadge({ source }: { source: string }) {
  if (source === 'ical') return (
    <span style={{ fontSize: '0.55rem', color: '#888', letterSpacing: '0.06em', flexShrink: 0 }}>cal</span>
  );
  return null;
}

const eventRow = (_t: Theme, color: string): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: '0.6rem',
  background: color + '15', border: `1px solid ${color}33`,
  borderLeft: `3px solid ${color}`, borderRadius: '8px', padding: '0.5rem 0.7rem',
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
  padding: '0.35rem 0.6rem', color: t.textMuted, cursor: 'pointer',
  fontSize: '0.72rem', fontFamily: 'inherit', fontWeight: 300,
});

const iconBtnStyle = (t: Theme): React.CSSProperties => ({
  background: 'transparent', border: 'none', cursor: 'pointer',
  color: t.textMuted, padding: '0.2rem', display: 'flex', alignItems: 'center',
  borderRadius: '4px',
});

const deleteBtn = (t: Theme): React.CSSProperties => ({
  background: 'transparent', border: 'none', cursor: 'pointer',
  color: t.textDim, padding: '0.2rem', display: 'flex', alignItems: 'center',
  borderRadius: '4px', flexShrink: 0,
});
