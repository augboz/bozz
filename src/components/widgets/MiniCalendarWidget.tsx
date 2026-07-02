import type React from 'react';
import {
  startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isToday, format, addDays,
} from 'date-fns';
import { CalendarDays } from 'lucide-react';
import { Widget, WidgetHeader } from '../shared/Widget';
import { sectionAccents } from '../../lib/themes';
import { deadlineEntries } from './util';
import type { WidgetCtx } from './context';
import type { CalendarEvent } from '../../lib/types';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** The widget's display mode — switchable on the widget itself and persisted in
 *  its per-instance config, so each placed calendar can be its own view. */
type MiniView = 'month' | 'week' | 'day';

function timeLabel(e: CalendarEvent): string | null {
  if (e.allDay) return null;
  if (e.startMin != null) {
    const h = Math.floor(e.startMin / 60), m = e.startMin % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  return format(new Date(e.start), 'HH:mm');
}

/** One compact event line (dot + time + title). */
function EventRow({ e, t, accent, onClick }: {
  e: { title: string; color?: string; time: string | null };
  t: WidgetCtx['t']; accent: string;
  onClick?: (ev: React.MouseEvent) => void;
}) {
  return (
    <button
      className="widget-interactive"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.4rem', width: '100%',
        background: 'transparent', border: 'none', padding: '0.14rem 0',
        cursor: onClick ? 'pointer' : 'default', fontFamily: 'inherit', textAlign: 'left',
      }}
    >
      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: e.color ?? accent, flexShrink: 0 }} />
      {e.time && (
        <span style={{ fontSize: '0.66rem', color: t.textDim, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
          {e.time}
        </span>
      )}
      <span style={{
        fontSize: '0.74rem', color: t.text, minWidth: 0, overflow: 'hidden',
        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {e.title}
      </span>
    </button>
  );
}

export default function MiniCalendarWidget({ ctx }: { ctx: WidgetCtx }) {
  const { t, setActiveSection, openCalendarOnDate, todayEvents, upcomingEvents, widgetConfig, onWidgetConfig } = ctx;
  const accent = sectionAccents.home;
  const now = new Date();

  const view = ((widgetConfig?.view as MiniView) ?? 'month');
  const setView = (v: MiniView) => {
    // _h/_w are injected by the grid each render — never persist them back.
    const { _h, _w, ...cfg } = (widgetConfig ?? {}) as Record<string, unknown>;
    onWidgetConfig?.({ ...cfg, view: v });
  };

  const entries = deadlineEntries(ctx);
  const deadlinesOn = (d: Date) =>
    entries.filter(e => e.item.deadline != null && isSameDay(new Date(e.item.deadline), d));

  // Feed + typed-note events on a day (topic deadlines come from deadlinesOn —
  // upcomingEvents deliberately excludes them to avoid double-counting).
  const eventsOn = (d: Date) =>
    (upcomingEvents ?? [])
      .filter(e => isSameDay(new Date(e.start), d))
      .sort((a, b) => (a.allDay === b.allDay ? a.start - b.start : a.allDay ? -1 : 1));

  const pick = (d: Date) =>
    openCalendarOnDate
      ? (ev: React.MouseEvent) => { ev.stopPropagation(); openCalendarOnDate(d.getTime()); }
      : undefined;

  const headerLabel =
    view === 'month' ? format(now, 'MMMM yyyy')
      : view === 'week' ? 'Next 7 days'
        : `Today · ${format(now, 'EEE d MMM')}`;

  // ── Views ────────────────────────────────────────────────────────────────────

  const monthGrid = (() => {
    const first = startOfMonth(now);
    const days = eachDayOfInterval({ start: first, end: endOfMonth(now) });
    const lead = (getDay(first) + 6) % 7; // Monday-first offset
    const accentsForDay = (d: Date): string[] => {
      const set = new Set<string>();
      for (const e of deadlinesOn(d)) set.add(e.accent);
      for (const e of eventsOn(d)) set.add(e.color ?? accent);
      return [...set].slice(0, 3);
    };
    return (
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
          const onPick = pick(d);
          return (
            <button key={d.toISOString()} className="widget-interactive" onClick={onPick} style={{
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
    );
  })();

  const weekList = (() => {
    const days = Array.from({ length: 7 }, (_, i) => addDays(now, i));
    const groups = days
      .map(d => ({
        d,
        rows: [
          ...deadlinesOn(d).map(e => ({ title: e.item.text, color: e.accent, time: null as string | null })),
          ...eventsOn(d).map(e => ({ title: e.title, color: e.color, time: timeLabel(e) })),
        ],
      }))
      .filter(g => g.rows.length > 0);
    if (groups.length === 0) {
      return <div style={{ marginTop: '0.85rem', fontSize: '0.76rem', color: t.textDim }}>Nothing scheduled this week.</div>;
    }
    return (
      <div style={{ marginTop: '0.7rem', display: 'flex', flexDirection: 'column', gap: '0.45rem', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {groups.map(({ d, rows }) => (
          <div key={d.toISOString()}>
            <div style={{
              fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase',
              color: isToday(d) ? t.text : t.textDim, marginBottom: '0.1rem',
            }}>
              {isToday(d) ? 'Today' : format(d, 'EEE d')}
            </div>
            {rows.map((r, i) => <EventRow key={i} e={r} t={t} accent={accent} onClick={pick(d)} />)}
          </div>
        ))}
      </div>
    );
  })();

  const dayList = (() => {
    // todayEvents already merges feed + notes + topic deadlines for today.
    const rows = [...(todayEvents ?? [])]
      .sort((a, b) => (a.allDay === b.allDay ? a.start - b.start : a.allDay ? -1 : 1))
      .map(e => ({ title: e.title, color: e.color, time: timeLabel(e) }));
    if (rows.length === 0) {
      return <div style={{ marginTop: '0.85rem', fontSize: '0.76rem', color: t.textDim }}>Nothing today.</div>;
    }
    return (
      <div style={{ marginTop: '0.7rem', display: 'flex', flexDirection: 'column', gap: '0.1rem', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {rows.map((r, i) => <EventRow key={i} e={r} t={t} accent={accent} onClick={pick(now)} />)}
      </div>
    );
  })();

  // ── Shell ────────────────────────────────────────────────────────────────────

  const segBtn = (v: MiniView, label: string) => {
    const on = view === v;
    return (
      <button
        key={v}
        className="widget-interactive"
        onClick={(ev) => { ev.stopPropagation(); setView(v); }}
        title={v === 'month' ? 'Month view' : v === 'week' ? 'Next 7 days' : 'Today'}
        aria-pressed={on}
        style={{
          background: on ? t.bgAlt : 'transparent',
          border: 'none', borderRadius: '5px', padding: '0.14rem 0.4rem',
          color: on ? t.text : t.textDim, cursor: 'pointer',
          fontFamily: 'inherit', fontSize: '0.62rem', fontWeight: on ? 600 : 400,
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <Widget t={t} accent={accent} onClick={() => setActiveSection('calendar')}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <WidgetHeader label={headerLabel} accent={accent} t={t} icon={CalendarDays} />
        <div style={{ display: 'inline-flex', gap: '2px', flexShrink: 0 }}>
          {segBtn('month', 'M')}
          {segBtn('week', 'W')}
          {segBtn('day', 'D')}
        </div>
      </div>
      {view === 'month' ? monthGrid : view === 'week' ? weekList : dayList}
    </Widget>
  );
}
