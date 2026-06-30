import type React from 'react';
import {
  startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isToday, format,
} from 'date-fns';
import { CalendarDays } from 'lucide-react';
import { Widget, WidgetHeader } from '../shared/Widget';
import { sectionAccents } from '../../lib/themes';
import { deadlineEntries } from './util';
import type { WidgetCtx } from './context';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function MiniCalendarWidget({ ctx }: { ctx: WidgetCtx }) {
  const { t, setActiveSection, openCalendarOnDate } = ctx;
  const now = new Date();
  const first = startOfMonth(now);
  const days = eachDayOfInterval({ start: first, end: endOfMonth(now) });
  // Monday-first offset (getDay: 0=Sun .. 6=Sat).
  const lead = (getDay(first) + 6) % 7;

  const entries = deadlineEntries(ctx);
  const accentsForDay = (d: Date): string[] => {
    const set = new Set<string>();
    for (const e of entries) {
      if (e.item.deadline != null && isSameDay(new Date(e.item.deadline), d)) set.add(e.accent);
    }
    return [...set].slice(0, 3);
  };

  return (
    <Widget t={t} accent={sectionAccents.home} onClick={() => setActiveSection('calendar')}>
      <WidgetHeader label={format(now, 'MMMM yyyy')} accent={sectionAccents.home} t={t} icon={CalendarDays} />
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '2px', marginTop: '0.85rem',
      }}>
        {WEEKDAYS.map((w, i) => (
          <div key={`h${i}`} style={{
            textAlign: 'center', fontSize: '0.6rem', color: t.textDim,
            letterSpacing: '0.05em', padding: '0.2rem 0',
          }}>{w}</div>
        ))}
        {Array.from({ length: lead }).map((_, i) => <div key={`b${i}`} />)}
        {days.map(d => {
          const dots = accentsForDay(d);
          const today = isToday(d);
          // Clicking a day cell opens the calendar focused on that day. Stop
          // propagation so it doesn't also fire the Widget's open-calendar click.
          const onPick = openCalendarOnDate
            ? (ev: React.MouseEvent) => { ev.stopPropagation(); openCalendarOnDate(d.getTime()); }
            : undefined;
          return (
            <button key={d.toISOString()} onClick={onPick} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: '2px', padding: '0.25rem 0', borderRadius: '6px',
              background: today ? t.bgAlt : 'transparent',
              border: 'none', cursor: onPick ? 'pointer' : 'default', fontFamily: 'inherit',
            }}>
              <span style={{
                fontSize: '0.7rem',
                color: today ? t.text : t.textMuted,
                fontWeight: today ? 400 : 300,
              }}>
                {d.getDate()}
              </span>
              <span style={{ display: 'flex', gap: '2px', height: '4px' }}>
                {dots.map((c, i) => (
                  <span key={i} style={{ width: '4px', height: '4px', borderRadius: '50%', background: c }} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </Widget>
  );
}
