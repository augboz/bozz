/**
 * DailyPlannerView — "What do you want to get done?"
 *
 * Top: 4 day columns (window-navigable with < / > buttons).
 * Bottom: collapsible topic dropdowns showing all incomplete items with
 *         deadline badges and quick day-assignment pills.
 * Items in a day column have a quick stage-advance dot and an × to unassign.
 * Done items are auto-pruned from the plan whenever topics change.
 */

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ChevronLeft, X, AlertCircle } from 'lucide-react';
import type { Theme, Topic, TopicItem, DailyPlan } from '../../lib/types';
import { sectionAccents } from '../../lib/themes';

const ACCENT = sectionAccents.planner;
const DAY_COUNT = 4;

// ── Date helpers ─────────────────────────────────────────────────────────────

function localMidnight(offsetDays = 0): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d.getTime();
}

function dayLabel(absoluteOffset: number): string {
  if (absoluteOffset === 0) return 'Today';
  if (absoluteOffset === 1) return 'Tomorrow';
  if (absoluteOffset === -1) return 'Yesterday';
  return new Date(localMidnight(absoluteOffset)).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

function dayDateStr(absoluteOffset: number): string {
  return new Date(localMidnight(absoluteOffset)).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short',
  });
}

function deadlineStr(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StageDot({ color, size = 9 }: { color: string; size?: number }) {
  return (
    <span style={{
      display: 'inline-block',
      width: size, height: size,
      borderRadius: '50%',
      background: color,
      flexShrink: 0,
    }} />
  );
}

// ── Day column ────────────────────────────────────────────────────────────────

interface AssignedItem {
  item: TopicItem;
  topic: Topic;
}

interface DayColProps {
  absoluteOffset: number;
  items: AssignedItem[];
  t: Theme;
  onRemove: (itemId: number) => void;
  onAdvanceStage: (topic: Topic, item: TopicItem) => void;
}

function DayColumn({ absoluteOffset, items, t, onRemove, onAdvanceStage }: DayColProps) {
  const isToday = absoluteOffset === 0;
  const isPast = absoluteOffset < 0;

  const doneCount = items.filter(({ item, topic }) => {
    const stage = topic.stages.find(s => s.id === item.stageId);
    return stage?.done;
  }).length;
  const totalCount = items.length;

  return (
    <div style={{
      flex: 1, minWidth: 0,
      background: t.bgAlt,
      border: `1px solid ${isToday ? ACCENT + '66' : t.border}`,
      borderRadius: '10px',
      overflow: 'hidden',
      opacity: isPast ? 0.7 : 1,
    }}>
      {/* Header */}
      <div style={{
        padding: '0.55rem 0.75rem 0.4rem',
        borderBottom: `1px solid ${t.border}`,
        display: 'flex', alignItems: 'baseline', gap: '0.4rem',
        background: isToday ? ACCENT + '0d' : 'transparent',
      }}>
        <span style={{
          fontSize: '0.78rem', fontWeight: 500,
          color: isToday ? ACCENT : isPast ? t.textDim : t.text,
        }}>
          {dayLabel(absoluteOffset)}
        </span>
        <span style={{ fontSize: '0.65rem', color: t.textDim }}>
          {dayDateStr(absoluteOffset)}
        </span>
        {totalCount > 0 && (
          <span style={{
            marginLeft: 'auto',
            fontSize: '0.62rem',
            color: doneCount === totalCount ? t.doneAccent : t.textDim,
            background: t.panel, padding: '1px 6px',
            borderRadius: '999px', whiteSpace: 'nowrap',
          }}>
            {doneCount > 0 ? `${doneCount}/${totalCount}` : totalCount}
          </span>
        )}
      </div>

      {/* Items */}
      <div style={{
        padding: '0.4rem 0.5rem',
        display: 'flex', flexDirection: 'column', gap: '0.3rem',
        minHeight: '3.5rem',
      }}>
        {items.length === 0 && (
          <div style={{
            fontSize: '0.72rem', color: t.textDim,
            padding: '0.5rem 0.25rem', fontStyle: 'italic',
          }}>
            nothing yet
          </div>
        )}
        {items.map(({ item, topic }) => {
          const stage = topic.stages.find(s => s.id === item.stageId);
          const isDone = stage?.done ?? false;
          const idx = topic.stages.findIndex(s => s.id === item.stageId);
          const isLastStage = idx === topic.stages.length - 1;
          const stageColor = stage?.color ?? topic.color;

          return (
            <div
              key={`${topic.id}-${item.id}`}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                background: isDone ? t.panel + 'aa' : t.panel,
                border: `1px solid ${t.border}`,
                borderLeft: `3px solid ${isDone ? t.textDim : topic.color}`,
                borderRadius: '6px',
                padding: '0.4rem 0.5rem',
                opacity: isDone ? 0.55 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {/* Text + topic name */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '0.8rem', color: t.text,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  textDecoration: isDone ? 'line-through' : 'none',
                }}>
                  {item.text}
                </div>
                <span style={{ fontSize: '0.62rem', color: topic.color }}>{topic.name}</span>
              </div>

              {/* Stage pill — clickable to advance (disabled on last stage) */}
              <button
                onClick={() => !isLastStage && onAdvanceStage(topic, item)}
                title={isLastStage ? stage?.label : `Move to ${topic.stages[idx + 1]?.label}`}
                disabled={isLastStage}
                style={{
                  fontSize: '0.62rem',
                  color: stageColor,
                  background: stageColor + '22',
                  border: `1px solid ${stageColor + '55'}`,
                  padding: '2px 8px', borderRadius: '999px',
                  whiteSpace: 'nowrap', flexShrink: 0,
                  cursor: isLastStage ? 'default' : 'pointer',
                  fontFamily: 'inherit', fontWeight: 400,
                  opacity: isLastStage ? 0.7 : 1,
                  transition: 'background 0.12s, opacity 0.12s',
                }}
              >
                {stage?.label ?? ''}
              </button>

              {/* Remove from day */}
              <button
                onClick={() => onRemove(item.id)}
                title="Remove from this day"
                style={iconBtn(t.textDim)}
              >
                <X size={11} strokeWidth={1.8} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Topic dropdown ────────────────────────────────────────────────────────────

interface TopicDropdownProps {
  topic: Topic;
  plan: DailyPlan;
  windowStart: number; // absolute day offset for column 0
  t: Theme;
  onAssign: (item: TopicItem, dateKey: string) => void;
  onUnassign: (item: TopicItem) => void;
}

function TopicDropdown({ topic, plan, windowStart, t, onAssign, onUnassign }: TopicDropdownProps) {
  const [open, setOpen] = useState(false);
  const todayMs = localMidnight(0);
  const nowMs = Date.now();

  const incompleteItems = useMemo(() => {
    const items = topic.items.filter(it => {
      const stage = topic.stages.find(s => s.id === it.stageId);
      return !stage?.done;
    });
    // Sort: overdue first, then by deadline, then by id (insertion order)
    return [...items].sort((a, b) => {
      const aOverdue = a.deadline != null && a.deadline < todayMs;
      const bOverdue = b.deadline != null && b.deadline < todayMs;
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;
      if (a.deadline != null && b.deadline != null) return a.deadline - b.deadline;
      if (a.deadline != null) return -1;
      if (b.deadline != null) return 1;
      return a.id - b.id;
    });
  }, [topic.items, topic.stages, todayMs]);

  if (incompleteItems.length === 0) return null;

  const assignedTo = (itemId: number): string | null => {
    for (const [dateKey, ids] of Object.entries(plan)) {
      if (ids.includes(String(itemId))) return dateKey;
    }
    return null;
  };

  const days = Array.from({ length: DAY_COUNT }, (_, i) => ({
    absoluteOffset: windowStart + i,
    key: String(localMidnight(windowStart + i)),
    label: dayLabel(windowStart + i),
  }));

  return (
    <div style={{ border: `1px solid ${t.border}`, borderRadius: '10px', overflow: 'hidden' }}>
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          width: '100%', padding: '0.65rem 0.85rem',
          background: 'transparent', border: 'none', cursor: 'pointer',
          fontFamily: 'inherit', textAlign: 'left',
        }}
      >
        <StageDot color={topic.color} size={8} />
        <span style={{ fontSize: '0.85rem', fontWeight: 500, color: t.text, flex: 1 }}>
          {topic.name}
        </span>
        <span style={{ fontSize: '0.7rem', color: t.textDim }}>
          {incompleteItems.length} task{incompleteItems.length !== 1 ? 's' : ''}
        </span>
        {open
          ? <ChevronDown size={14} strokeWidth={1.5} color={t.textDim} />
          : <ChevronRight size={14} strokeWidth={1.5} color={t.textDim} />}
      </button>

      {open && (
        <div style={{ borderTop: `1px solid ${t.border}` }}>
          {incompleteItems.map(item => {
            const assigned = assignedTo(item.id);
            const stage = topic.stages.find(s => s.id === item.stageId);
            const isOverdue = item.deadline != null && item.deadline < todayMs;
            const isDueSoon = item.deadline != null && !isOverdue
              && item.deadline <= nowMs + 7 * 86_400_000;

            return (
              <div
                key={item.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.5rem 0.85rem',
                  borderBottom: `1px solid ${t.border}`,
                  background: assigned ? topic.color + '0a' : 'transparent',
                }}
              >
                {/* Stage dot */}
                <StageDot color={stage?.color ?? topic.color} size={8} />

                {/* Text + deadline */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    fontSize: '0.84rem', color: t.text,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    display: 'block',
                  }}>
                    {item.text}
                  </span>
                  {item.deadline != null && (
                    <span style={{
                      display: 'flex', alignItems: 'center', gap: '3px',
                      fontSize: '0.64rem',
                      color: isOverdue ? t.alert : isDueSoon ? t.doingAccent : t.textDim,
                      marginTop: '1px',
                    }}>
                      {isOverdue && <AlertCircle size={10} strokeWidth={2} />}
                      {isOverdue ? 'Overdue · ' : ''}{deadlineStr(item.deadline)}
                    </span>
                  )}
                </div>

                {/* Stage label */}
                {stage && (
                  <span style={{
                    fontSize: '0.63rem',
                    color: stage.color ?? topic.color,
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                  }}>
                    {stage.label}
                  </span>
                )}

                {/* Day assignment pills */}
                <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                  {assigned ? (
                    <button
                      onClick={() => onUnassign(item)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.2rem',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '999px',
                        border: `1px solid ${topic.color}`,
                        background: topic.color + '18',
                        color: topic.color,
                        fontSize: '0.65rem', fontFamily: 'inherit',
                        cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap',
                      }}
                    >
                      {days.find(d => d.key === assigned)?.label ?? 'Assigned'}
                      <X size={9} strokeWidth={2} />
                    </button>
                  ) : (
                    days.map(day => (
                      <button
                        key={day.key}
                        onClick={() => onAssign(item, day.key)}
                        style={{
                          padding: '0.2rem 0.5rem',
                          borderRadius: '999px',
                          border: `1px solid ${t.border}`,
                          background: 'transparent',
                          color: t.textMuted,
                          fontSize: '0.63rem', fontFamily: 'inherit',
                          cursor: 'pointer', whiteSpace: 'nowrap',
                          transition: 'border-color 0.1s, color 0.1s',
                        }}
                        onMouseEnter={e => {
                          (e.currentTarget).style.borderColor = topic.color;
                          (e.currentTarget).style.color = topic.color;
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget).style.borderColor = t.border;
                          (e.currentTarget).style.color = t.textMuted;
                        }}
                      >
                        {day.label}
                      </button>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

interface Props {
  t: Theme;
  topics: Topic[];
  plan: DailyPlan;
  onPlanChange: (plan: DailyPlan) => void;
  onAdvanceStage: (topicId: string, itemId: number) => void;
}

export default function DailyPlannerView({ t, topics, plan, onPlanChange, onAdvanceStage }: Props) {
  // windowStart = absolute day offset for the first visible column (0 = today)
  const [windowStart, setWindowStart] = useState(0);

  const isOnToday = windowStart === 0;

  const days = useMemo(
    () => Array.from({ length: DAY_COUNT }, (_, i) => ({
      absoluteOffset: windowStart + i,
      key: String(localMidnight(windowStart + i)),
    })),
    [windowStart],
  );

  // Prune plan entries whose item IDs no longer exist in any topic at all
  // (e.g. deleted items). Done items stay visible in columns with strikethrough.
  useEffect(() => {
    const allItemIds = new Set<string>();
    for (const topic of topics) {
      for (const item of topic.items) allItemIds.add(String(item.id));
    }
    let changed = false;
    const next = Object.fromEntries(
      Object.entries(plan).map(([k, ids]) => {
        const filtered = ids.filter(id => allItemIds.has(id));
        if (filtered.length !== ids.length) changed = true;
        return [k, filtered];
      })
    );
    if (changed) onPlanChange(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topics]);

  // Build assigned items per day — done items sorted to the bottom
  const itemsForDay = (dateKey: string): AssignedItem[] => {
    const ids = plan[dateKey] ?? [];
    const result: AssignedItem[] = [];
    for (const idStr of ids) {
      const id = Number(idStr);
      for (const topic of topics) {
        const item = topic.items.find(it => it.id === id);
        if (item) { result.push({ item, topic }); break; }
      }
    }
    // Done items sink to the bottom
    return result.sort((a, b) => {
      const aDone = a.topic.stages.find(s => s.id === a.item.stageId)?.done ?? false;
      const bDone = b.topic.stages.find(s => s.id === b.item.stageId)?.done ?? false;
      if (aDone === bDone) return 0;
      return aDone ? 1 : -1;
    });
  };

  const assign = (item: TopicItem, dateKey: string) => {
    const cleaned = Object.fromEntries(
      Object.entries(plan).map(([k, ids]) => [k, ids.filter(id => id !== String(item.id))])
    );
    onPlanChange({ ...cleaned, [dateKey]: [...(cleaned[dateKey] ?? []), String(item.id)] });
  };

  const unassign = (item: TopicItem) => {
    onPlanChange(
      Object.fromEntries(
        Object.entries(plan).map(([k, ids]) => [k, ids.filter(id => id !== String(item.id))])
      )
    );
  };

  const removeFromDay = (dateKey: string, itemId: number) => {
    onPlanChange({ ...plan, [dateKey]: (plan[dateKey] ?? []).filter(id => id !== String(itemId)) });
  };

  const activeTopics = topics.filter(tp =>
    tp.items.some(it => !tp.stages.find(s => s.id === it.stageId)?.done)
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ width: '3px', height: '1.1rem', borderRadius: '2px', background: ACCENT, flexShrink: 0 }} />
        <h1 style={{ fontSize: '1.4rem', fontWeight: 300, letterSpacing: '-0.02em', color: t.text, margin: 0, flex: 1 }}>
          Daily Planner
        </h1>

        {/* Window navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <button
            onClick={() => setWindowStart(w => w - DAY_COUNT)}
            style={navBtn(t)}
            title="Previous window"
          >
            <ChevronLeft size={15} />
          </button>
          {!isOnToday && (
            <button
              onClick={() => setWindowStart(0)}
              style={{ ...navBtn(t), padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
            >
              Today
            </button>
          )}
          <button
            onClick={() => setWindowStart(w => w + DAY_COUNT)}
            style={navBtn(t)}
            title="Next window"
          >
            <ChevronRight size={15} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {/* ── Day columns ── */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
        {days.map(day => (
          <DayColumn
            key={day.key}
            absoluteOffset={day.absoluteOffset}
            items={itemsForDay(day.key)}
            t={t}
            onRemove={(itemId) => removeFromDay(day.key, itemId)}
            onAdvanceStage={(topic, item) => onAdvanceStage(topic.id, item.id)}
          />
        ))}
      </div>

      {/* ── Topic task list ── */}
      {activeTopics.length === 0 ? (
        <div style={{
          padding: '2rem', textAlign: 'center',
          fontSize: '0.84rem', color: t.textMuted, lineHeight: 1.5,
        }}>
          All tasks are complete. Nothing to plan.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div style={{
            fontSize: '0.68rem', letterSpacing: '0.1em',
            textTransform: 'uppercase', color: t.textDim,
          }}>
            Your tasks
          </div>
          {activeTopics.map(tp => (
            <TopicDropdown
              key={tp.id}
              topic={tp}
              plan={plan}
              windowStart={windowStart}
              t={t}
              onAssign={assign}
              onUnassign={unassign}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Style helpers ─────────────────────────────────────────────────────────────

function iconBtn(color: string): React.CSSProperties {
  return {
    background: 'transparent', border: 'none', color,
    cursor: 'pointer', padding: '2px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: '3px', flexShrink: 0,
    transition: 'opacity 0.1s',
  };
}

function navBtn(t: Theme): React.CSSProperties {
  return {
    background: 'transparent',
    border: `1px solid ${t.border}`,
    color: t.textMuted,
    borderRadius: '6px',
    padding: '0.3rem 0.5rem',
    cursor: 'pointer',
    display: 'flex', alignItems: 'center',
    fontFamily: 'inherit',
    transition: 'background 0.12s, color 0.12s',
  };
}
