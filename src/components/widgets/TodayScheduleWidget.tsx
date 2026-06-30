/**
 * TodayScheduleWidget — home widget.
 *
 * Shows today's schedule: timed events first (with clock times),
 * then all-day events, then deadline dots. Clear visual distinction
 * between "I have this at 2pm" vs "I need to do this today".
 * "View calendar" navigates to the Calendar section.
 */

import type { WidgetCtx } from './context';
import { Widget, WidgetHeader } from '../shared/Widget';
import { CalendarDays, Clock, ExternalLink } from 'lucide-react';
import type { CalendarEvent } from '../../lib/types';

const ACCENT = '#bfa8c9';
const MAX_TIMED = 4;
const MAX_ALLDAY = 3;

function minToLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getStartMin(e: CalendarEvent): number {
  if (e.startMin != null) return e.startMin;
  // Derive from unix ms if no startMin stored
  const d = new Date(e.start);
  return d.getHours() * 60 + d.getMinutes();
}

export default function TodayScheduleWidget({ ctx }: { ctx: WidgetCtx }) {
  const { t, todayEvents, setActiveSection, openCalendarOnDate } = ctx;
  // Clicking a concrete event opens the calendar on that event's day; falls back
  // to plain calendar nav when the host didn't wire openCalendarOnDate.
  const openOn = (ts: number) =>
    openCalendarOnDate ? openCalendarOnDate(ts) : setActiveSection('calendar');

  const events = todayEvents ?? [];
  const timed = events
    .filter(e => !e.allDay)
    .sort((a, b) => a.start - b.start);
  const allDay = events.filter(e => e.allDay && e.source !== 'deadline');
  const deadlines = events.filter(e => e.source === 'deadline');

  const isEmpty = events.length === 0;

  return (
    <Widget t={t} accent={ACCENT}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <WidgetHeader label="Today" accent={ACCENT} t={t} icon={CalendarDays} />
        {!isEmpty && (
          <span style={{
            fontSize: '0.65rem', color: t.textMuted,
            background: t.bgAlt, border: `1px solid ${t.border}`,
            borderRadius: '999px', padding: '0.1rem 0.5rem',
          }}>
            {timed.length + allDay.length + deadlines.length} items
          </span>
        )}
      </div>

      {isEmpty ? (
        <div style={{ marginTop: '0.85rem', fontSize: '0.8rem', color: t.textMuted, lineHeight: 1.5 }}>
          Nothing scheduled today.{' '}
          <button
            onClick={() => setActiveSection('calendar')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: ACCENT, fontFamily: 'inherit', fontSize: 'inherit',
              fontWeight: 500, padding: 0,
            }}
          >
            Open calendar →
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.75rem' }}>

            {/* ── Timed events — "I have this at 2pm" ── */}
            {timed.slice(0, MAX_TIMED).map(e => {
              const sm = getStartMin(e);
              const em = e.endMin ?? (e.end
                ? Math.floor((e.end - e.start) / 60_000) + sm
                : sm + 60);
              return (
                <button key={e.id} onClick={() => openOn(e.start)} title={e.title} style={{
                  display: 'flex', alignItems: 'center', gap: '0.45rem',
                  padding: '0.35rem 0.5rem',
                  background: e.color + '18',
                  border: `1px solid ${e.color}33`,
                  borderLeft: `3px solid ${e.color}`,
                  borderRadius: '6px',
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%',
                }}>
                  <Clock size={10} strokeWidth={1.8} color={e.color} style={{ flexShrink: 0 }} />
                  <span style={{
                    fontSize: '0.68rem', color: e.color, fontWeight: 500,
                    flexShrink: 0, letterSpacing: '0.02em',
                  }}>
                    {minToLabel(sm)}-{minToLabel(em)}
                  </span>
                  <span style={{
                    flex: 1, fontSize: '0.8rem', color: t.text,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {e.title}
                  </span>
                </button>
              );
            })}

            {/* ── All-day events ── */}
            {allDay.slice(0, MAX_ALLDAY).map(e => (
              <button key={e.id} onClick={() => openOn(e.start)} title={e.title} style={{
                display: 'flex', alignItems: 'center', gap: '0.45rem',
                padding: '0.3rem 0.5rem',
                background: t.bgAlt,
                border: `1px solid ${t.border}`,
                borderLeft: `3px solid ${e.color}`,
                borderRadius: '6px',
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%',
              }}>
                <span style={{
                  fontSize: '0.62rem', color: t.textDim,
                  flexShrink: 0, width: '44px',
                }}>
                  all day
                </span>
                <span style={{
                  flex: 1, fontSize: '0.8rem', color: t.text,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {e.title}
                </span>
              </button>
            ))}

            {/* ── Deadline dots — "I need to do this today" ── */}
            {deadlines.length > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.3rem',
                padding: '0.25rem 0.4rem',
                flexWrap: 'wrap',
              }}>
                <span style={{ fontSize: '0.62rem', color: t.textDim, marginRight: '0.2rem' }}>due:</span>
                {deadlines.slice(0, 5).map(e => (
                  <span
                    key={e.id}
                    title={e.title}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.2rem',
                      fontSize: '0.65rem', color: t.textMuted,
                      background: e.color + '18',
                      border: `1px dashed ${e.color}55`,
                      borderRadius: '4px', padding: '1px 5px',
                    }}
                  >
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: e.color, flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80px', whiteSpace: 'nowrap' }}>
                      {e.title}
                    </span>
                  </span>
                ))}
                {deadlines.length > 5 && (
                  <span style={{ fontSize: '0.62rem', color: t.textDim }}>+{deadlines.length - 5}</span>
                )}
              </div>
            )}

            {(timed.length > MAX_TIMED || allDay.length > MAX_ALLDAY) && (
              <div style={{ fontSize: '0.72rem', color: t.textDim, padding: '0.1rem 0.25rem' }}>
                +{Math.max(0, timed.length - MAX_TIMED) + Math.max(0, allDay.length - MAX_ALLDAY)} more
              </div>
            )}
          </div>

          <button
            onClick={() => setActiveSection('calendar')}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.3rem',
              marginTop: '0.65rem',
              background: 'none', border: 'none', cursor: 'pointer',
              color: t.textMuted, fontFamily: 'inherit', fontSize: '0.72rem',
              padding: 0, transition: 'color 0.1s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = ACCENT)}
            onMouseLeave={e => (e.currentTarget.style.color = t.textMuted)}
          >
            <ExternalLink size={11} strokeWidth={1.5} />
            View calendar
          </button>
        </>
      )}
    </Widget>
  );
}
