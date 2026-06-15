/**
 * TodayWidget — unified "Today" home widget.
 *
 * Shows two sections, each toggleable via the gear config panel:
 *   Events  — timed calendar events (with exact time range) + all-day + deadline dots
 *   Tasks   — today's daily-plan items (with stage pill + check to advance)
 *
 * Config keys (stored in widgetConfig / HomeWidgetItem.config):
 *   showEvents: boolean  (default true)
 *   showTasks:  boolean  (default true)
 */

import { Check } from 'lucide-react';
import type { WidgetCtx } from './context';
import { Widget, WidgetHeader } from '../shared/Widget';
import { CalendarDays, Clock } from 'lucide-react';
import type { CalendarEvent } from '../../lib/types';

const ACCENT = '#bfa8c9';
const MAX_TIMED  = 3;
const MAX_ALLDAY = 2;
const MAX_TASKS  = 5;

// ── Helpers ───────────────────────────────────────────────────────────────────

function minToLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getStartMin(e: CalendarEvent): number {
  if (e.startMin != null) return e.startMin;
  const d = new Date(e.start);
  return d.getHours() * 60 + d.getMinutes();
}

function getEndMin(e: CalendarEvent, startMin: number): number {
  if (e.endMin != null) return e.endMin;
  if (e.end != null) return startMin + Math.floor((e.end - e.start) / 60_000);
  return startMin + 60;
}

// ── Sub-sections ──────────────────────────────────────────────────────────────

function EventsSection({ events, t, setActiveSection }: {
  events: CalendarEvent[];
  t: WidgetCtx['t'];
  setActiveSection: (id: string) => void;
}) {
  const timed    = events.filter(e => !e.allDay).sort((a, b) => a.start - b.start);
  const allDay   = events.filter(e => e.allDay && e.source !== 'deadline');
  const deadlines = events.filter(e => e.source === 'deadline');

  if (events.length === 0) {
    return (
      <div style={{ fontSize: '0.78rem', color: t.textDim, fontStyle: 'italic' }}>
        No events today.{' '}
        <button onClick={() => setActiveSection('calendar')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: ACCENT, fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 500, padding: 0 }}>
          Open calendar →
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      {/* Timed events */}
      {timed.slice(0, MAX_TIMED).map(e => {
        const sm = getStartMin(e);
        const em = getEndMin(e, sm);
        return (
          <div key={e.id} style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.3rem 0.45rem',
            background: e.color + '18',
            border: `1px solid ${e.color}33`,
            borderLeft: `3px solid ${e.color}`,
            borderRadius: '6px',
          }}>
            <Clock size={9} strokeWidth={2} color={e.color} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '0.66rem', color: e.color, fontWeight: 500, flexShrink: 0 }}>
              {minToLabel(sm)}–{minToLabel(em)}
            </span>
            <span style={{ flex: 1, fontSize: '0.78rem', color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {e.title}
            </span>
          </div>
        );
      })}

      {/* All-day */}
      {allDay.slice(0, MAX_ALLDAY).map(e => (
        <div key={e.id} style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.28rem 0.45rem',
          background: t.bgAlt,
          border: `1px solid ${t.border}`,
          borderLeft: `3px solid ${e.color}`,
          borderRadius: '6px',
        }}>
          <span style={{ fontSize: '0.62rem', color: t.textDim, flexShrink: 0, width: '42px' }}>all day</span>
          <span style={{ flex: 1, fontSize: '0.78rem', color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {e.title}
          </span>
        </div>
      ))}

      {/* Deadline dots */}
      {deadlines.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap', paddingLeft: '0.1rem' }}>
          <span style={{ fontSize: '0.6rem', color: t.textDim }}>due:</span>
          {deadlines.slice(0, 5).map(e => (
            <span key={e.id} title={e.title} style={{
              display: 'flex', alignItems: 'center', gap: '0.2rem',
              fontSize: '0.63rem', color: t.textMuted,
              background: e.color + '18', border: `1px dashed ${e.color}55`,
              borderRadius: '4px', padding: '1px 5px',
            }}>
              <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: e.color }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '72px', whiteSpace: 'nowrap' }}>
                {e.title}
              </span>
            </span>
          ))}
          {deadlines.length > 5 && <span style={{ fontSize: '0.6rem', color: t.textDim }}>+{deadlines.length - 5}</span>}
        </div>
      )}

      {(timed.length > MAX_TIMED || allDay.length > MAX_ALLDAY) && (
        <div style={{ fontSize: '0.68rem', color: t.textDim, paddingLeft: '0.1rem' }}>
          +{Math.max(0, timed.length - MAX_TIMED) + Math.max(0, allDay.length - MAX_ALLDAY)} more events
        </div>
      )}
    </div>
  );
}

function TasksSection({ ctx, todayKey }: { ctx: WidgetCtx; todayKey: string }) {
  const { t, topics, dailyPlan, onAdvanceStage } = ctx;
  if (!topics || !dailyPlan) return null;

  const ids = (dailyPlan[todayKey] ?? []).map(Number);
  const items = ids.flatMap(id => {
    for (const topic of topics) {
      const item = topic.items.find(it => it.id === id);
      if (item) {
        const stage = topic.stages.find(s => s.id === item.stageId);
        return [{ item, topic, stage, isDone: stage?.done ?? false }];
      }
    }
    return [];
  });

  // Non-done first
  const sorted = [...items].sort((a, b) => Number(a.isDone) - Number(b.isDone));
  const visible = sorted.slice(0, MAX_TASKS);
  const overflow = sorted.length - visible.length;

  if (items.length === 0) {
    return (
      <div style={{ fontSize: '0.78rem', color: t.textDim, fontStyle: 'italic' }}>
        Nothing planned today.{' '}
        <button onClick={() => ctx.setActiveSection('dailyPlanner')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: ACCENT, fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 500, padding: 0 }}>
          Plan your day →
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      {visible.map(({ item, topic, stage, isDone }) => {
        const idx = topic.stages.findIndex(s => s.id === item.stageId);
        const isLastStage = idx === topic.stages.length - 1;
        const stageColor = stage?.color ?? topic.color;
        return (
          <div key={`${topic.id}-${item.id}`} style={{
            display: 'flex', alignItems: 'center', gap: '0.35rem',
            padding: '0.3rem 0.45rem',
            background: isDone ? t.bgAlt + '88' : t.bgAlt,
            border: `1px solid ${isDone ? t.border + '88' : t.border}`,
            borderLeft: `3px solid ${isDone ? t.textDim : topic.color}`,
            borderRadius: '6px',
            opacity: isDone ? 0.6 : 1,
          }}>
            {/* Stage pill / check */}
            {isDone ? (
              <Check size={11} strokeWidth={2.5} color={t.doneAccent} style={{ flexShrink: 0 }} />
            ) : (
              <button
                onClick={() => !isLastStage && onAdvanceStage?.(topic.id, item.id)}
                disabled={isLastStage}
                title={isLastStage ? stage?.label : `Move to ${topic.stages[idx + 1]?.label}`}
                style={{
                  fontSize: '0.58rem', color: stageColor,
                  background: stageColor + '22', border: `1px solid ${stageColor + '55'}`,
                  padding: '1px 6px', borderRadius: '999px', whiteSpace: 'nowrap', flexShrink: 0,
                  cursor: isLastStage ? 'default' : 'pointer',
                  fontFamily: 'inherit', fontWeight: 400, opacity: isLastStage ? 0.7 : 1,
                }}
              >
                {stage?.label ?? ''}
              </button>
            )}

            {/* Text */}
            <span style={{
              flex: 1, fontSize: '0.78rem', color: t.text,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              textDecoration: isDone ? 'line-through' : 'none',
            }}>
              {item.text}
            </span>

            {/* Topic colour dot */}
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: topic.color, flexShrink: 0 }} />
          </div>
        );
      })}
      {overflow > 0 && (
        <div style={{ fontSize: '0.68rem', color: t.textDim, paddingLeft: '0.1rem' }}>+{overflow} more tasks</div>
      )}
    </div>
  );
}

// ── Main widget ───────────────────────────────────────────────────────────────

export default function TodayWidget({ ctx }: { ctx: WidgetCtx }) {
  const { t, todayEvents = [], widgetConfig, setActiveSection } = ctx;

  const showEvents = widgetConfig.showEvents !== false;
  const showTasks  = widgetConfig.showTasks  !== false;

  const todayKey = (() => { const d = new Date(); d.setHours(0,0,0,0); return String(d.getTime()); })();

  const timedCount = todayEvents.filter(e => !e.allDay).length;
  const allDayCount = todayEvents.filter(e => e.allDay && e.source !== 'deadline').length;
  const taskCount = (ctx.dailyPlan?.[todayKey] ?? []).length;

  const hasBoth = showEvents && showTasks;

  return (
    <Widget t={t} accent={ACCENT}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <WidgetHeader label="Today" accent={ACCENT} t={t} icon={CalendarDays} />
        <span style={{
          fontSize: '0.6rem', color: t.textDim,
          letterSpacing: '0.06em',
        }}>
          {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: hasBoth ? '0.75rem' : '0' }}>
          {showEvents && (
            <div>
              {hasBoth && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase',
                  color: t.textDim, marginBottom: '0.4rem',
                }}>
                  <Clock size={9} strokeWidth={1.8} />
                  Events
                  {(timedCount + allDayCount) > 0 && (
                    <span style={{ marginLeft: '0.2rem', color: t.textMuted }}>
                      {timedCount + allDayCount}
                    </span>
                  )}
                </div>
              )}
              <EventsSection events={todayEvents} t={t} setActiveSection={setActiveSection} />
            </div>
          )}

          {hasBoth && (
            <div style={{ height: '1px', background: t.border, margin: '0 -0.25rem' }} />
          )}

          {showTasks && (
            <div>
              {hasBoth && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase',
                  color: t.textDim, marginBottom: '0.4rem',
                }}>
                  <Check size={9} strokeWidth={2} />
                  Tasks
                  {taskCount > 0 && (
                    <span style={{ marginLeft: '0.2rem', color: t.textMuted }}>{taskCount}</span>
                  )}
                </div>
              )}
              <TasksSection ctx={ctx} todayKey={todayKey} />
            </div>
          )}
        </div>
      </div>
    </Widget>
  );
}