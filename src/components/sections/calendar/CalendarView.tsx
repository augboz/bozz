import React, { useMemo, useState } from 'react';
import {
  format, addMonths, addWeeks, addDays, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday,
} from 'date-fns';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { CalendarEvent, CalendarViewMode, ListItem, TaskListKey, Theme } from '../../../lib/types';
import { deadlineEvents, eventsOnDay } from '../../../lib/calendar';
import { SectionHeader } from '../../shared/ui';

interface CalendarViewProps {
  t: Theme;
  feedEvents: CalendarEvent[];
  lists: Record<TaskListKey, ListItem[]>;
  onAddTask: (list: TaskListKey, text: string, deadlineMs: number) => void;
}

const WEEK_OPTS = { weekStartsOn: 1 } as const; // Monday
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function timeLabel(e: CalendarEvent): string {
  if (e.allDay) return 'all day';
  return format(new Date(e.start), 'HH:mm');
}

export default function CalendarView({ t, feedEvents, lists, onAddTask }: CalendarViewProps) {
  const [mode, setMode] = useState<CalendarViewMode>('month');
  const [cursor, setCursor] = useState<Date>(new Date());
  const [selected, setSelected] = useState<Date | null>(null);

  const events = useMemo<CalendarEvent[]>(
    () => [...deadlineEvents(lists), ...feedEvents],
    [lists, feedEvents],
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

  return (
    <div style={{ position: 'relative' }}>
      <SectionHeader
        title="Calendar"
        t={t}
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Segmented mode={mode} setMode={setMode} t={t} />
            <button onClick={() => { setCursor(new Date()); }} style={ghost(t)}>today</button>
            <button onClick={() => step(-1)} aria-label="Previous" style={ghost(t)}>
              <ChevronLeft size={14} strokeWidth={1.5} />
            </button>
            <button onClick={() => step(1)} aria-label="Next" style={ghost(t)}>
              <ChevronRight size={14} strokeWidth={1.5} />
            </button>
          </div>
        }
      />

      <div style={{ fontSize: '1rem', color: t.text, fontWeight: 300, margin: '0 0 1rem' }}>
        {heading}
      </div>

      {mode === 'month' && (
        <MonthGrid t={t} cursor={cursor} events={events} onPick={setSelected} />
      )}
      {mode === 'week' && (
        <WeekView t={t} cursor={cursor} events={events} onPick={setSelected} />
      )}
      {mode === 'day' && (
        <DayAgenda t={t} day={cursor} events={eventsOnDay(events, cursor)} />
      )}

      {selected && (
        <DayPanel
          t={t}
          day={selected}
          events={eventsOnDay(events, selected)}
          onClose={() => setSelected(null)}
          onAddTask={onAddTask}
        />
      )}
    </div>
  );
}

function Segmented({ mode, setMode, t }: {
  mode: CalendarViewMode; setMode: (m: CalendarViewMode) => void; t: Theme;
}) {
  const opts: CalendarViewMode[] = ['month', 'week', 'day'];
  return (
    <div style={{ display: 'inline-flex', border: `1px solid ${t.border}`, borderRadius: '8px', overflow: 'hidden' }}>
      {opts.map((o, i) => {
        const on = mode === o;
        return (
          <button
            key={o}
            onClick={() => setMode(o)}
            aria-pressed={on}
            style={{
              background: on ? t.bgAlt : 'transparent', color: on ? t.text : t.textMuted,
              border: 'none', borderLeft: i === 0 ? 'none' : `1px solid ${t.border}`,
              padding: '0.35rem 0.7rem', fontSize: '0.72rem', fontFamily: 'inherit',
              cursor: 'pointer', fontWeight: 300, textTransform: 'capitalize',
            }}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

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
          const dim = !isSameMonth(d, cursor);
          const today = isToday(d);
          return (
            <button
              key={d.toISOString()}
              onClick={() => onPick(d)}
              style={{
                textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                minHeight: '88px', padding: '0.4rem', borderRadius: '8px',
                background: today ? t.bgAlt : 'transparent',
                border: `1px solid ${today ? t.borderStrong : t.border}`,
                opacity: dim ? 0.4 : 1, display: 'flex', flexDirection: 'column', gap: '3px',
              }}
            >
              <span style={{ fontSize: '0.72rem', color: t.textMuted, fontWeight: today ? 400 : 300 }}>
                {d.getDate()}
              </span>
              {dayEvents.slice(0, 3).map(e => (
                <span key={e.id} style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  fontSize: '0.62rem', color: t.text, overflow: 'hidden',
                  whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: e.color, flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.title}</span>
                </span>
              ))}
              {dayEvents.length > 3 && (
                <span style={{ fontSize: '0.6rem', color: t.textDim }}>+{dayEvents.length - 3} more</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ t, cursor, events, onPick }: {
  t: Theme; cursor: Date; events: CalendarEvent[]; onPick: (d: Date) => void;
}) {
  const days = eachDayOfInterval({
    start: startOfWeek(cursor, WEEK_OPTS),
    end: endOfWeek(cursor, WEEK_OPTS),
  });
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
      {days.map(d => {
        const dayEvents = eventsOnDay(events, d);
        return (
          <button
            key={d.toISOString()}
            onClick={() => onPick(d)}
            style={{
              textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
              minHeight: '180px', padding: '0.5rem', borderRadius: '8px',
              background: isToday(d) ? t.bgAlt : 'transparent',
              border: `1px solid ${isToday(d) ? t.borderStrong : t.border}`,
              display: 'flex', flexDirection: 'column', gap: '4px',
            }}
          >
            <span style={{ fontSize: '0.68rem', color: t.textMuted }}>{format(d, 'EEE d')}</span>
            {dayEvents.map(e => (
              <span key={e.id} style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                fontSize: '0.64rem', color: t.text, overflow: 'hidden',
                whiteSpace: 'nowrap', textOverflow: 'ellipsis',
              }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: e.color, flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.title}</span>
              </span>
            ))}
          </button>
        );
      })}
    </div>
  );
}

function DayAgenda({ t, day, events }: { t: Theme; day: Date; events: CalendarEvent[] }) {
  if (events.length === 0) {
    return (
      <p style={{ color: t.textDim, fontSize: '0.85rem', fontStyle: 'italic', textAlign: 'center', padding: '2rem 0' }}>
        nothing on {format(day, 'EEEE d MMMM')}
      </p>
    );
  }
  return (
    <div style={{ display: 'grid', gap: '0.4rem' }}>
      {events.map(e => (
        <div key={e.id} style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          background: t.todoBg, border: `1px solid ${t.border}`,
          borderLeft: `3px solid ${e.color}`, borderRadius: '8px', padding: '0.7rem 1rem',
        }}>
          <span style={{ fontSize: '0.72rem', color: t.textMuted, width: '52px', flexShrink: 0 }}>
            {timeLabel(e)}
          </span>
          <span style={{ flex: 1, fontSize: '0.88rem', color: t.text }}>{e.title}</span>
          {e.source === 'deadline' && (
            <span style={{ fontSize: '0.62rem', color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              deadline
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function DayPanel({ t, day, events, onClose, onAddTask }: {
  t: Theme; day: Date; events: CalendarEvent[]; onClose: () => void;
  onAddTask: (list: TaskListKey, text: string, deadlineMs: number) => void;
}) {
  const [list, setList] = useState<TaskListKey>('life');
  const [text, setText] = useState('');

  const add = () => {
    if (!text.trim()) return;
    const midnight = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
    onAddTask(list, text.trim(), midnight);
    setText('');
  };

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: '340px', zIndex: 50,
      background: t.panel, borderLeft: `1px solid ${t.border}`,
      padding: '1.5rem', overflowY: 'auto', boxShadow: '-8px 0 24px rgba(0,0,0,0.18)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <span style={{ fontSize: '0.95rem', color: t.text, fontWeight: 300 }}>
          {format(day, 'EEEE d MMMM')}
        </span>
        <button onClick={onClose} aria-label="Close" style={{
          background: 'transparent', border: 'none', color: t.textMuted, cursor: 'pointer', padding: '0.2rem',
        }}>
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>

      {events.length === 0
        ? <p style={{ color: t.textDim, fontSize: '0.82rem', fontStyle: 'italic', margin: '0 0 1.5rem' }}>nothing scheduled</p>
        : (
          <div style={{ display: 'grid', gap: '0.4rem', marginBottom: '1.5rem' }}>
            {events.map(e => (
              <div key={e.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                background: t.todoBg, border: `1px solid ${t.border}`,
                borderLeft: `3px solid ${e.color}`, borderRadius: '8px', padding: '0.6rem 0.8rem',
              }}>
                <span style={{ fontSize: '0.68rem', color: t.textMuted, width: '46px', flexShrink: 0 }}>
                  {timeLabel(e)}
                </span>
                <span style={{ flex: 1, fontSize: '0.82rem', color: t.text }}>{e.title}</span>
              </div>
            ))}
          </div>
        )}

      <div style={{ fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: t.textMuted, marginBottom: '0.6rem' }}>
        Add task with this deadline
      </div>
      <select
        value={list}
        onChange={e => setList(e.target.value as TaskListKey)}
        style={{
          width: '100%', background: t.input, border: `1px solid ${t.border}`, borderRadius: '8px',
          padding: '0.45rem 0.6rem', color: t.text, fontSize: '0.8rem', fontFamily: 'inherit',
          outline: 'none', marginBottom: '0.5rem',
        }}
      >
        <option value="music">Music</option>
        <option value="life">Life</option>
        <option value="cv">CV</option>
        <option value="other">Other</option>
      </select>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="task…"
          style={{
            flex: 1, background: t.input, border: `1px solid ${t.border}`, borderRadius: '8px',
            padding: '0.5rem 0.7rem', color: t.text, fontSize: '0.82rem', fontFamily: 'inherit', outline: 'none',
          }}
        />
        <button onClick={add} style={{
          background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px',
          padding: '0 0.85rem', color: t.textMuted, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem',
        }}>
          add
        </button>
      </div>
    </div>
  );
}

const ghost = (t: Theme): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
  background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px',
  padding: '0.35rem 0.6rem', color: t.textMuted, cursor: 'pointer',
  fontSize: '0.72rem', fontFamily: 'inherit', fontWeight: 300,
});
