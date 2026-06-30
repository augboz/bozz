/**
 * TodayWidget — auto-generated morning brief ("your morning in 90 seconds").
 *
 * Aggregates the day's REAL signals rather than waiting on the manual planner:
 *   Summary  — one narrated line ("1 overdue · 2 due today · next event 14:00")
 *   Priorities — overdue deadlines first, then due-today, then due-this-week
 *                (from deadlineEntries) — always shown, this is the promise.
 *   Events   — timed calendar events + all-day + deadline dots (toggle showEvents)
 *   Tasks    — the manually-curated daily-plan items (toggle showTasks)
 *
 * Config keys (stored in widgetConfig / HomeWidgetItem.config):
 *   showEvents: boolean  (default true)
 *   showTasks:  boolean  (default true)
 */

import type React from 'react';
import { useState, useEffect } from 'react';
import { Check, AlertTriangle, Flag, MapPin, Flame, PartyPopper, CalendarArrowUp } from 'lucide-react';
import type { WidgetCtx } from './context';
import { Widget, WidgetHeader } from '../shared/Widget';
import { CalendarDays, Clock } from 'lucide-react';
import type { CalendarEvent } from '../../lib/types';
import { deadlineEntries, dueTimestamp, type DeadlineEntry } from './util';
import SnoozeControl from '../shared/SnoozeControl';
import { isSnoozeable, snoozeItem } from '../../lib/snooze';
import { markTodayCleared, isTodayCleared } from '../../lib/clearStreak';

const ACCENT = '#bfa8c9';
const WARNING = '#e0a23b';
const MAX_TIMED  = 3;
const MAX_ALLDAY = 2;
const MAX_TASKS  = 5;
const MAX_PRIORITIES = 5;

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

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

function dayStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

type Bucket = 'overdue' | 'today' | 'week';

interface Priority extends DeadlineEntry {
  bucket: Bucket;
  due: number;
}

/** Overdue → due-today → due-this-week, each ascending by precise due time. */
function priorities(ctx: WidgetCtx, todayMs: number): Priority[] {
  const out: Priority[] = [];
  const weekCutoff = todayMs + WEEK_MS;
  for (const e of deadlineEntries(ctx)) {
    const due = dueTimestamp(e.item);
    if (due == null) continue;
    const dayMs = dayStart(e.item.deadline!);
    let bucket: Bucket;
    if (dayMs < todayMs) bucket = 'overdue';
    else if (dayMs === todayMs) bucket = 'today';
    else if (due <= weekCutoff) bucket = 'week';
    else continue;
    out.push({ ...e, bucket, due });
  }
  const rank: Record<Bucket, number> = { overdue: 0, today: 1, week: 2 };
  return out.sort((a, b) => rank[a.bucket] - rank[b.bucket] || a.due - b.due);
}

// ── Sub-sections ──────────────────────────────────────────────────────────────

function SummaryLine({ overdue, dueToday, nextEvent, t }: {
  overdue: number; dueToday: number; nextEvent: CalendarEvent | null; t: WidgetCtx['t'];
}) {
  const parts: { text: string; color: string }[] = [];
  if (overdue > 0)  parts.push({ text: `${overdue} overdue`, color: t.alert });
  if (dueToday > 0) parts.push({ text: `${dueToday} due today`, color: WARNING });
  if (nextEvent) {
    const sm = getStartMin(nextEvent);
    parts.push({ text: `next event ${minToLabel(sm)}`, color: t.textMuted });
  }
  if (parts.length === 0) parts.push({ text: 'nothing pressing — a clear morning', color: t.textMuted });

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap',
      fontSize: '0.72rem', lineHeight: 1.4, marginBottom: '0.6rem',
    }}>
      {parts.map((p, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
          {i > 0 && <span style={{ color: t.textDim }}>·</span>}
          <span style={{ color: p.color, fontWeight: 500 }}>{p.text}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * BigTaskWarning — P-B "start now" red flag. Shown when a high-effort (L) task is
 * due within ~2 days: a big job with little runway. INFORMATIONAL ONLY — it links
 * to the task's section, it never schedules or time-blocks anything.
 */
function BigTaskWarning({ items, t, setActiveSection }: {
  items: Priority[]; t: WidgetCtx['t']; setActiveSection: (id: string) => void;
}) {
  if (items.length === 0) return null;
  const first = items[0];
  const extra = items.length - 1;
  return (
    <button
      onClick={() => setActiveSection(first.section)}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.4rem', width: '100%',
        padding: '0.4rem 0.55rem', marginBottom: '0.6rem',
        background: t.alertBg, border: `1px solid ${t.alertBorder}`,
        borderLeft: `3px solid ${t.alert}`, borderRadius: '7px',
        cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
      }}
    >
      <AlertTriangle size={12} strokeWidth={2} color={t.alert} style={{ flexShrink: 0 }} />
      <span style={{ fontSize: '0.7rem', color: t.alert, lineHeight: 1.35, minWidth: 0 }}>
        <span style={{ fontWeight: 600 }}>Start now</span> — big task, little time:{' '}
        <span style={{ fontWeight: 500 }}>{first.item.text}</span>
        {extra > 0 && <span style={{ color: t.textMuted }}> +{extra} more</span>}
      </span>
    </button>
  );
}

/** "in 18 min" / "in 2h 5m" / "now" — relative label for the next event start. */
function untilLabel(ms: number): string {
  if (ms <= 0) return 'now';
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `in ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `in ${h}h` : `in ${h}h ${m}m`;
}

/**
 * Persistent "Next: BIO101 · 14:00 · Room 3.21 · in 18 min" banner.
 *
 * Driven off the nextEvent the Today widget already computes. Only shown for a
 * still-upcoming timed event today; re-renders every 30s so the countdown stays
 * live. Migration-safe — `location` is optional, so it's simply omitted when a
 * one-off note has none.
 */
function NextClassBanner({ event, t, onOpen }: { event: CalendarEvent; t: WidgetCtx['t']; onOpen?: (ts: number) => void }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(x => x + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const sm = getStartMin(event);
  const until = untilLabel(event.start - Date.now());

  return (
    <button
      onClick={() => onOpen?.(event.start)}
      title={event.title}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', width: '100%',
        padding: '0.4rem 0.55rem', marginBottom: '0.6rem',
        background: event.color + '1a',
        border: `1px solid ${event.color}40`,
        borderLeft: `3px solid ${event.color}`,
        borderRadius: '7px',
        cursor: onOpen ? 'pointer' : 'default', fontFamily: 'inherit', textAlign: 'left',
      }}>
      <span style={{ fontSize: '0.56rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: event.color, flexShrink: 0 }}>
        Next
      </span>
      <span style={{ fontSize: '0.78rem', fontWeight: 500, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
        {event.title}
      </span>
      <span style={{ fontSize: '0.68rem', color: t.textMuted, flexShrink: 0 }}>· {minToLabel(sm)}</span>
      {event.location && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem', fontSize: '0.68rem', color: t.textMuted, flexShrink: 0 }}>
          · <MapPin size={9} strokeWidth={2} color={t.textDim} />{event.location}
        </span>
      )}
      <span style={{ marginLeft: 'auto', fontSize: '0.68rem', fontWeight: 600, color: event.color, flexShrink: 0 }}>
        {until}
      </span>
    </button>
  );
}

function PrioritiesSection({ items, ctx, t, setActiveSection }: {
  items: Priority[];
  ctx: WidgetCtx;
  t: WidgetCtx['t'];
  setActiveSection: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div style={{ fontSize: '0.78rem', color: t.textMuted, lineHeight: 1.5 }}>
        Nothing due soon.{' '}
        <button onClick={() => setActiveSection('inbox')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: ACCENT, fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 500, padding: 0 }}>
          Capture a task →
        </button>
      </div>
    );
  }

  const visible = items.slice(0, MAX_PRIORITIES);
  const overflow = items.length - visible.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      {visible.map(p => {
        const isOverdue = p.bucket === 'overdue';
        const labelColor = isOverdue ? t.alert : p.bucket === 'today' ? WARNING : t.textMuted;
        const label = isOverdue ? 'overdue' : p.bucket === 'today' ? 'today' : 'this week';
        // Snooze only on real, editable topic items (calendar-derived entries carry
        // a synthetic negative id and have no topic — hide the control for them).
        const canSnooze = isSnoozeable(p.item.id, p.section, ctx.topics) && !!ctx.onTopicChange;
        return (
          // Row is a flex container (not a button) so the snooze control can be a
          // sibling — nesting a button inside a button is invalid HTML.
          <div
            key={`${p.section}-${p.item.id}`}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.3rem 0.45rem',
              background: isOverdue ? t.alertBg : t.bgAlt,
              border: `1px solid ${isOverdue ? t.alertBorder : t.border}`,
              borderLeft: `3px solid ${p.accent}`,
              borderRadius: '6px',
            }}
          >
            {isOverdue
              ? <AlertTriangle size={11} strokeWidth={2} color={t.alert} style={{ flexShrink: 0 }} />
              : <Flag size={10} strokeWidth={2} color={labelColor} style={{ flexShrink: 0 }} />}
            <button
              onClick={() => setActiveSection(p.section)}
              style={{
                flex: 1, minWidth: 0, display: 'flex', alignItems: 'center',
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                fontFamily: 'inherit', textAlign: 'left',
              }}
            >
              <span style={{
                flex: 1, fontSize: '0.78rem', color: isOverdue ? t.alert : t.text,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {p.item.text}
              </span>
            </button>
            <span style={{ fontSize: '0.6rem', fontWeight: 600, color: labelColor, flexShrink: 0, whiteSpace: 'nowrap' }}>
              {label}
            </span>
            {canSnooze && (
              <SnoozeControl
                t={t}
                topics={ctx.topics}
                topicId={p.section}
                itemId={p.item.id}
                onTopicChange={ctx.onTopicChange}
                size={11}
              />
            )}
          </div>
        );
      })}
      {overflow > 0 && (
        <div style={{ fontSize: '0.68rem', color: t.textDim, paddingLeft: '0.1rem' }}>+{overflow} more due soon</div>
      )}
    </div>
  );
}

/**
 * CloseOutCard — the end-of-day reward (P-C). Shown in place of the priorities
 * list when today's actionable priorities (overdue + due-today) hit zero. It
 *   - auto-marks today on the persisted clear-streak (idempotent, once/day),
 *   - celebrates "Today's done", showing how many were cleared + the streak, and
 *   - offers a one-tap "Roll unfinished to tomorrow" that snoozes the remaining
 *     (this-week) topic items to tomorrow — reusing P-A's reschedule.
 *
 * Pure composition over existing state + the small persisted counter.
 */
function CloseOutCard({ ctx, prios, todayMs, t, setActiveSection }: {
  ctx: WidgetCtx;
  prios: Priority[];
  todayMs: number;
  t: WidgetCtx['t'];
  setActiveSection: (id: string) => void;
}) {
  const { clearStreak, onClearStreakChange } = ctx;

  // How many actionable items the user actually closed today: tasks whose
  // deadline was today and that now sit in a done stage. Falls back to a warm
  // generic message when we can't count any (e.g. a genuinely empty day).
  const clearedToday = (ctx.topics ?? []).reduce((n, topic) => {
    const doneStageIds = new Set((topic.stages ?? []).filter(s => s.done).map(s => s.id));
    return n + (topic.items ?? []).filter(it =>
      it.completedAt != null
      && dayStart(it.completedAt) === todayMs
      && doneStageIds.has(it.stageId),
    ).length;
  }, 0);

  // Auto-mark today on the streak the first time it goes clear (idempotent).
  useEffect(() => {
    if (!onClearStreakChange) return;
    if (isTodayCleared(clearStreak)) return;
    onClearStreakChange(markTodayCleared(clearStreak));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Remaining snoozeable items = this-week topic items still pending (not the
  // calendar-derived ones). These are what "Roll unfinished to tomorrow" moves.
  const rollable = prios.filter(p =>
    p.bucket === 'week' && isSnoozeable(p.item.id, p.section, ctx.topics),
  );

  const rollToTomorrow = () => {
    if (!ctx.onTopicChange) return;
    for (const p of rollable) {
      snoozeItem(ctx.topics, p.section, p.item.id, 'tomorrow', ctx.onTopicChange);
    }
  };

  const streakCount = clearStreak?.count ?? 0;
  const headline = clearedToday > 0
    ? `Today's done — ${clearedToday} cleared`
    : "Today's done — nothing pressing";

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '0.55rem',
      padding: '0.85rem 0.9rem',
      background: `${t.doneAccent}14`,
      border: `1px solid ${t.doneAccent}3a`,
      borderRadius: '10px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <PartyPopper size={16} strokeWidth={2} color={t.doneAccent} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: '0.86rem', fontWeight: 600, color: t.text }}>
          {headline}
        </span>
      </div>

      {streakCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: t.textMuted }}>
          <Flame size={12} strokeWidth={1.8} color="#e08a4a" style={{ flexShrink: 0 }} />
          <span>
            <span style={{ fontWeight: 700, color: '#e08a4a' }}>{streakCount}-day</span> clear streak
            {(clearStreak?.best ?? 0) > streakCount && (
              <span style={{ color: t.textDim }}> · best {clearStreak?.best}</span>
            )}
          </span>
        </div>
      )}

      {rollable.length > 0 && (
        <button
          onClick={rollToTomorrow}
          title="Push this week's remaining items to tomorrow"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.35rem', alignSelf: 'flex-start',
            background: t.bgAlt, border: `1px solid ${t.border}`, borderRadius: '7px',
            padding: '0.32rem 0.6rem', cursor: 'pointer', fontFamily: 'inherit',
            color: t.textMuted, fontSize: '0.72rem', fontWeight: 500,
          }}
          onMouseEnter={e => { e.currentTarget.style.color = t.text; }}
          onMouseLeave={e => { e.currentTarget.style.color = t.textMuted; }}
        >
          <CalendarArrowUp size={12} strokeWidth={1.8} />
          Roll {rollable.length} unfinished to tomorrow
        </button>
      )}

      {rollable.length === 0 && (
        <button
          onClick={() => setActiveSection('inbox')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', alignSelf: 'flex-start',
            color: ACCENT, fontFamily: 'inherit', fontSize: '0.72rem', fontWeight: 500, padding: 0,
          }}
        >
          Capture something for tomorrow →
        </button>
      )}
    </div>
  );
}

function EventsSection({ events, t, setActiveSection, onOpenEvent }: {
  events: CalendarEvent[];
  t: WidgetCtx['t'];
  setActiveSection: (id: string) => void;
  /** Open the calendar on a specific event's date (day view). */
  onOpenEvent?: (ts: number) => void;
}) {
  const openOn = (ts: number) => onOpenEvent ? onOpenEvent(ts) : setActiveSection('calendar');
  const timed    = events.filter(e => !e.allDay).sort((a, b) => a.start - b.start);
  const allDay   = events.filter(e => e.allDay && e.source !== 'deadline');
  const deadlines = events.filter(e => e.source === 'deadline');

  if (events.length === 0) {
    return (
      <div style={{ fontSize: '0.78rem', color: t.textMuted, lineHeight: 1.5 }}>
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
          <button key={e.id} onClick={() => openOn(e.start)} title={e.title} style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.3rem 0.45rem',
            background: e.color + '18',
            border: `1px solid ${e.color}33`,
            borderLeft: `3px solid ${e.color}`,
            borderRadius: '6px',
            cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%',
          }}>
            <Clock size={9} strokeWidth={2} color={e.color} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '0.66rem', color: e.color, fontWeight: 500, flexShrink: 0 }}>
              {minToLabel(sm)}-{minToLabel(em)}
            </span>
            <span style={{ flex: 1, fontSize: '0.78rem', color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {e.title}
            </span>
            {e.location && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.15rem',
                fontSize: '0.62rem', color: t.textMuted, flexShrink: 0, whiteSpace: 'nowrap',
              }}>
                <MapPin size={9} strokeWidth={2} color={t.textDim} />{e.location}
              </span>
            )}
          </button>
        );
      })}

      {/* All-day */}
      {allDay.slice(0, MAX_ALLDAY).map(e => (
        <button key={e.id} onClick={() => openOn(e.start)} title={e.title} style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.28rem 0.45rem',
          background: t.bgAlt,
          border: `1px solid ${t.border}`,
          borderLeft: `3px solid ${e.color}`,
          borderRadius: '6px',
          cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%',
        }}>
          <span style={{ fontSize: '0.62rem', color: t.textDim, flexShrink: 0, width: '42px' }}>all day</span>
          <span style={{ flex: 1, fontSize: '0.78rem', color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {e.title}
          </span>
        </button>
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

function TasksSection({ ctx, todayKey, prios = [] }: { ctx: WidgetCtx; todayKey: string; prios?: Priority[] }) {
  const { t, topics, dailyPlan, onAdvanceStage } = ctx;
  if (!topics || !dailyPlan) return null;

  type Row = {
    item: { id: number; text: string };
    topic: NonNullable<typeof topics>[number];
    stage: NonNullable<typeof topics>[number]['stages'][number] | undefined;
    isDone: boolean;
    /** From a today/overdue deadline rather than the manual plan. */
    fromDeadline?: boolean;
  };

  // 1. The manually-curated daily plan (kept — the planner ritual still works).
  const ids = (dailyPlan[todayKey] ?? []).map(Number);
  const planned: Row[] = ids.flatMap(id => {
    for (const topic of topics) {
      const item = topic.items.find(it => it.id === id);
      if (item) {
        const stage = topic.stages.find(s => s.id === item.stageId);
        return [{ item, topic, stage, isDone: stage?.done ?? false }];
      }
    }
    return [];
  });
  const plannedIds = new Set(ids);

  // 2. Surface tasks whose deadline is today or overdue (from the already-computed
  //    priorities) so a captured + dated + triaged task lands in the morning view
  //    without the manual planner step. Dedupe against the plan so nothing doubles.
  const dueRows: Row[] = [];
  for (const p of prios) {
    if (p.bucket !== 'overdue' && p.bucket !== 'today') continue;
    if (plannedIds.has(p.item.id as number)) continue;
    const topic = topics.find(tp => tp.id === p.section);
    if (!topic) continue;
    const full = topic.items.find(it => it.id === p.item.id);
    if (!full) continue;
    const stage = topic.stages.find(s => s.id === full.stageId);
    dueRows.push({ item: full, topic, stage, isDone: stage?.done ?? false, fromDeadline: true });
  }

  const items = [...planned, ...dueRows];

  // Non-done first
  const sorted = [...items].sort((a, b) => Number(a.isDone) - Number(b.isDone));
  const visible = sorted.slice(0, MAX_TASKS);
  const overflow = sorted.length - visible.length;

  if (items.length === 0) {
    return (
      <div style={{ fontSize: '0.78rem', color: t.textMuted, lineHeight: 1.5 }}>
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
      {visible.map(({ item, topic, stage, isDone, fromDeadline }) => {
        const idx = topic.stages.findIndex(s => s.id === stage?.id);
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

            {/* "due" marker for tasks pulled in by their deadline (not the manual plan) */}
            {fromDeadline && !isDone && (
              <span style={{
                fontSize: '0.55rem', fontWeight: 600, letterSpacing: '0.04em',
                color: WARNING, flexShrink: 0, whiteSpace: 'nowrap',
              }}>
                due
              </span>
            )}

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

// ── Section heading ─────────────────────────────────────────────────────────────

function SectionLabel({ icon: Icon, label, count, t }: {
  icon: React.ElementType; label: string; count?: number; t: WidgetCtx['t'];
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.35rem',
      fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase',
      color: t.textDim, marginBottom: '0.4rem',
    }}>
      <Icon size={9} strokeWidth={1.8} />
      {label}
      {count != null && count > 0 && (
        <span style={{ marginLeft: '0.2rem', color: t.text, fontWeight: 600 }}>{count}</span>
      )}
    </div>
  );
}

// ── Main widget ───────────────────────────────────────────────────────────────

export default function TodayWidget({ ctx }: { ctx: WidgetCtx }) {
  const { t, todayEvents = [], widgetConfig, setActiveSection, openCalendarOnDate } = ctx;

  const showEvents = widgetConfig.showEvents !== false;
  const showTasks  = widgetConfig.showTasks  !== false;

  const todayMs = dayStart(Date.now());
  const todayKey = String(todayMs);

  // Real signals
  const prios = priorities(ctx, todayMs);
  const overdueCount = prios.filter(p => p.bucket === 'overdue').length;
  const dueTodayCount = prios.filter(p => p.bucket === 'today').length;
  // Actionable today = overdue + due-today. When this hits zero the day is
  // "closed" and the celebratory close-out card replaces the priorities list.
  const actionable = prios.filter(p => p.bucket === 'overdue' || p.bucket === 'today');

  // P-B (informational ONLY): a high-effort (L) task due within ~2 days is a
  // "start now" signal — a big task with little time before it's due. We never
  // auto-create planner blocks or schedule anything; this is a red flag, no more.
  const bigTaskWarnings = prios.filter(p =>
    p.effort === 'L' && p.due - Date.now() <= 2 * DAY_MS,
  );

  const timedSorted = todayEvents.filter(e => !e.allDay).sort((a, b) => a.start - b.start);
  const nextEvent = timedSorted.find(e => e.start >= Date.now()) ?? timedSorted[0] ?? null;

  const timedCount = todayEvents.filter(e => !e.allDay).length;
  const allDayCount = todayEvents.filter(e => e.allDay && e.source !== 'deadline').length;
  // "My plan" now also surfaces today/overdue deadlines, deduped against the plan,
  // so the count reflects everything actually shown — not just the manual plan.
  const plannedIds = new Set((ctx.dailyPlan?.[todayKey] ?? []).map(Number));
  const dueExtra = prios.filter(
    p => (p.bucket === 'overdue' || p.bucket === 'today') && !plannedIds.has(p.item.id as number),
  ).length;
  const taskCount = plannedIds.size + dueExtra;

  // Section labels are only shown when more than one block is visible (keeps the
  // single-block layout clean). Priorities always counts as a block.
  const blockCount = 1 + (showEvents ? 1 : 0) + (showTasks ? 1 : 0);
  const labelled = blockCount > 1;

  return (
    <Widget t={t} accent={ACCENT}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
        <WidgetHeader label="Today" accent={ACCENT} t={t} icon={CalendarDays} />
        <span style={{
          fontSize: '0.6rem', color: t.textDim,
          letterSpacing: '0.06em',
        }}>
          {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
        </span>
      </div>

      {/* Narrated morning brief summary */}
      <SummaryLine overdue={overdueCount} dueToday={dueTodayCount} nextEvent={nextEvent} t={t} />

      {/* Persistent "next class" banner — only for a still-upcoming timed event. */}
      {showEvents && nextEvent && nextEvent.start >= Date.now() && (
        <NextClassBanner event={nextEvent} t={t} onOpen={openCalendarOnDate} />
      )}

      {/* P-B informational "start now" red flag for big tasks due very soon. */}
      <BigTaskWarning items={bigTaskWarnings} t={t} setActiveSection={setActiveSection} />

      <div className="thin-scroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: labelled ? '0.75rem' : '0' }}>
          {/* Priorities — always shown; this is the morning-brief promise */}
          <div>
            {labelled && <SectionLabel icon={Flag} label="Priorities" count={prios.length} t={t} />}
            {actionable.length === 0
              ? <CloseOutCard ctx={ctx} prios={prios} todayMs={todayMs} t={t} setActiveSection={setActiveSection} />
              : <PrioritiesSection items={prios} ctx={ctx} t={t} setActiveSection={setActiveSection} />}
          </div>

          {showEvents && (
            <>
              {labelled && <div style={{ height: '1px', background: t.border, margin: '0 -0.25rem' }} />}
              <div>
                {labelled && <SectionLabel icon={Clock} label="Events" count={timedCount + allDayCount} t={t} />}
                <EventsSection events={todayEvents} t={t} setActiveSection={setActiveSection} onOpenEvent={openCalendarOnDate} />
              </div>
            </>
          )}

          {showTasks && (
            <>
              {labelled && <div style={{ height: '1px', background: t.border, margin: '0 -0.25rem' }} />}
              <div>
                {labelled && <SectionLabel icon={Check} label="My plan" count={taskCount} t={t} />}
                <TasksSection ctx={ctx} todayKey={todayKey} prios={prios} />
              </div>
            </>
          )}
        </div>
      </div>
    </Widget>
  );
}
