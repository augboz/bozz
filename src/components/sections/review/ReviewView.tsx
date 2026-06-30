import React, { useMemo, useState } from 'react';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { Check, ChevronDown, ChevronRight } from 'lucide-react';
import type {
  BudgetData, Theme, Topic, WeeklyReview,
} from '../../../lib/types';
import { SectionHeader } from '../../shared/ui';
import { formatMoney } from '../../../lib/budget';
import { weeklyStats } from '../../../lib/review';

const WEEK_OPTS = { weekStartsOn: 1 as const };
type WindowMode = 'pending' | 'thisWeek';

interface ReviewViewProps {
  t: Theme;
  reviews: WeeklyReview[];
  setReviews: React.Dispatch<React.SetStateAction<WeeklyReview[]>>;
  budget: BudgetData;
  topics?: Topic[];
}

function Panel({ t, title, children }: { t: Theme; title: string; children: React.ReactNode }) {
  return (
    <section style={{
      background: t.panel, border: `1px solid ${t.border}`, borderRadius: '12px',
      padding: '1.1rem 1.4rem', marginBottom: '1rem',
    }}>
      <h3 style={{
        fontSize: '0.68rem', letterSpacing: '0.15em', textTransform: 'uppercase',
        color: t.textMuted, fontWeight: 400, margin: '0 0 0.85rem',
      }}>{title}</h3>
      {children}
    </section>
  );
}

// ── Topics panel ──────────────────────────────────────────────────────────────

function TopicsPanel({ t, topics, weekStart, weekEnd }: {
  t: Theme; topics: Topic[]; weekStart: number; weekEnd: number;
}) {
  const inWeek = (ts: number) => ts >= weekStart && ts <= weekEnd;

  const rows = topics.map(topic => {
    const doneStageIds = new Set(topic.stages.filter(s => s.done).map(s => s.id));
    const activeStageIds = new Set(topic.stages.filter(s => !s.done).map(s => s.id));
    const doingStageIds = new Set(
      topic.stages.filter(s => !s.done).slice(1).map(s => s.id),
    );

    const allActive = topic.items.filter(i => activeStageIds.has(i.stageId));
    const completedThisWeek = topic.items.filter(
      i => doneStageIds.has(i.stageId) && i.completedAt != null && inWeek(i.completedAt),
    );
    const inProgress = topic.items.filter(i => doingStageIds.has(i.stageId));
    const upcoming = topic.items.filter(
      i => activeStageIds.has(i.stageId) && i.deadline != null && inWeek(i.deadline),
    );

    return { topic, active: allActive.length, done: completedThisWeek.length, inProgress: inProgress.length, upcoming: upcoming.length };
  });

  // Only show topics that have items
  const nonEmpty = rows.filter(r => r.active + r.done > 0 || r.upcoming > 0);
  if (nonEmpty.length === 0) return null;

  return (
    <Panel t={t} title="By topic">
      <div style={{ display: 'grid', gap: '0.6rem' }}>
        {nonEmpty.map(({ topic, active, done, inProgress, upcoming }) => (
          <div key={topic.id} style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '0.55rem 0.75rem',
            background: topic.color + '0d', border: `1px solid ${topic.color}33`,
            borderLeft: `3px solid ${topic.color}`,
            borderRadius: '8px',
          }}>
            <span style={{ flex: 1, fontSize: '0.85rem', color: t.text, fontWeight: 400 }}>{topic.name}</span>
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
              {done > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.72rem', color: t.doneAccent }}>
                  <Check size={11} strokeWidth={2} />{done} done
                </span>
              )}
              {inProgress > 0 && (
                <span style={{ fontSize: '0.72rem', color: t.doingAccent }}>{inProgress} in progress</span>
              )}
              {upcoming > 0 && (
                <span style={{ fontSize: '0.72rem', color: t.alert }}>{upcoming} due</span>
              )}
              {done === 0 && inProgress === 0 && upcoming === 0 && active > 0 && (
                <span style={{ fontSize: '0.72rem', color: t.textDim }}>{active} open</span>
              )}
              {/* Progress bar */}
              {active + done > 0 && (
                <div style={{
                  width: '60px', height: '4px', background: t.border, borderRadius: '2px', overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${Math.round((done / (active + done)) * 100)}%`,
                    height: '100%', background: topic.color, borderRadius: '2px',
                    transition: 'width 0.3s',
                  }} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export default function ReviewView({ t, reviews, setReviews, budget, topics }: ReviewViewProps) {
  const pending = useMemo(() => reviews.find(r => r.reviewedAt == null), [reviews]);

  // The pending entry may target a week other than the one currently in
  // progress (e.g. last week, awaiting its end-of-week trigger). The toggle
  // lets you scrub between the two: "this week so far" shows live activity,
  // "pending" shows the formal end-of-week review.
  const [mode, setMode] = useState<WindowMode>(pending ? 'pending' : 'thisWeek');
  const effectiveMode: WindowMode = pending ? mode : 'thisWeek';

  const now = new Date();
  const thisWeekStart = startOfWeek(now, WEEK_OPTS).getTime();
  const thisWeekEnd = endOfWeek(now, WEEK_OPTS).getTime();
  const window =
    effectiveMode === 'pending' && pending
      ? { start: pending.weekStart, end: pending.weekEnd }
      : { start: thisWeekStart, end: thisWeekEnd };

  const past = useMemo(
    () => reviews.filter(r => r.reviewedAt != null).sort((a, b) => b.weekEnd - a.weekEnd),
    [reviews],
  );

  const stats = weeklyStats({
    weekStart: window.start, weekEnd: window.end,
    budget,
  });

  const setNote = (note: string) => {
    if (!pending) return;
    setReviews(prev => prev.map(r => r.id === pending.id ? { ...r, note } : r));
  };

  const markReviewed = () => {
    if (!pending) return;
    setReviews(prev => prev.map(r => r.id === pending.id ? { ...r, reviewedAt: Date.now() } : r));
  };

  const range = `${format(new Date(window.start), 'd MMM')} - ${format(new Date(window.end), 'd MMM yyyy')}`;

  return (
    <div>
      <SectionHeader
        title="Review"
        t={t}
        right={
          pending ? (
            <div style={{ display: 'inline-flex', border: `1px solid ${t.border}`, borderRadius: '8px', overflow: 'hidden' }}>
              {([
                { id: 'thisWeek' as WindowMode, label: 'this week' },
                { id: 'pending' as WindowMode, label: 'pending' },
              ]).map((o, i) => {
                const on = effectiveMode === o.id;
                return (
                  <button
                    key={o.id}
                    onClick={() => setMode(o.id)}
                    aria-pressed={on}
                    style={{
                      background: on ? t.bgAlt : 'transparent', color: on ? t.text : t.textMuted,
                      border: 'none', borderLeft: i === 0 ? 'none' : `1px solid ${t.border}`,
                      padding: '0.35rem 0.7rem', fontSize: '0.72rem', fontFamily: 'inherit', cursor: 'pointer',
                    }}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          ) : null
        }
      />

      <div style={{ fontSize: '1rem', color: t.text, fontWeight: 300, margin: '0 0 1rem' }}>
        {effectiveMode === 'pending' ? `Week of ${range}` : `This week so far · ${range}`}
      </div>

      <Panel t={t} title="This week">
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem',
        }}>
          <StatBlock t={t} label="spend"
            big={formatMoney(stats.spend, budget.currency)}
            rows={stats.spendByCategory.map(c => ({ label: c.category, value: formatMoney(c.amount, budget.currency) }))}
          />
        </div>
      </Panel>

      {topics && topics.length > 0 && (
        <TopicsPanel t={t} topics={topics} weekStart={window.start} weekEnd={window.end} />
      )}

      {effectiveMode === 'pending' && pending && (
        <Panel t={t} title="How did this week feel?">
          <textarea
            value={pending.note}
            onChange={e => setNote(e.target.value)}
            rows={4}
            placeholder="a sentence or two…"
            style={{
              width: '100%', boxSizing: 'border-box',
              background: t.input, border: `1px solid ${t.border}`, borderRadius: '8px',
              padding: '0.7rem 0.9rem', color: t.text, fontSize: '0.88rem',
              fontFamily: 'inherit', fontWeight: 300, outline: 'none', resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
            <button onClick={markReviewed} style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
              background: 'transparent', border: `1px solid ${t.doneBorder}`, color: t.doneAccent,
              borderRadius: '8px', padding: '0.45rem 0.9rem',
              fontSize: '0.8rem', fontFamily: 'inherit', cursor: 'pointer', fontWeight: 300,
            }}>
              <Check size={14} strokeWidth={1.5} /> Mark week as reviewed
            </button>
          </div>
        </Panel>
      )}

      {past.length > 0 && <PastReviews t={t} reviews={past} />}
    </div>
  );
}

function StatBlock({ t, label, rows, big }: {
  t: Theme; label: string; rows: Array<{ label: string; value: string }>; big?: string;
}) {
  return (
    <div>
      <div style={{ fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.textDim }}>
        {label}
      </div>
      {big != null && (
        <div style={{ fontSize: '1.6rem', fontWeight: 200, color: t.text, marginTop: '0.2rem', lineHeight: 1 }}>
          {big}
        </div>
      )}
      <div style={{ marginTop: big != null ? '0.5rem' : '0.4rem', display: 'grid', gap: '0.15rem' }}>
        {rows.map(r => (
          <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
            <span style={{ color: t.textMuted }}>{r.label}</span>
            <span style={{ color: t.text }}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PastReviews({ t, reviews }: { t: Theme; reviews: WeeklyReview[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: '1.25rem' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'transparent',
        border: 'none', cursor: 'pointer', color: t.textMuted, fontFamily: 'inherit',
        fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '0.5rem 0',
      }}>
        {open ? <ChevronDown size={13} strokeWidth={1.5}/> : <ChevronRight size={13} strokeWidth={1.5}/>}
        {reviews.length} past review{reviews.length === 1 ? '' : 's'}
      </button>
      {open && (
        <div style={{ display: 'grid', gap: '0.4rem', marginTop: '0.4rem' }}>
          {reviews.map(r => (
            <div key={r.id} style={{
              background: t.todoBg, border: `1px solid ${t.border}`, borderRadius: '8px',
              padding: '0.6rem 0.9rem',
            }}>
              <div style={{ fontSize: '0.8rem', color: t.text }}>
                {format(new Date(r.weekStart), 'd MMM')} - {format(new Date(r.weekEnd), 'd MMM yyyy')}
              </div>
              {r.note && (
                <div style={{ fontSize: '0.78rem', color: t.textMuted, marginTop: '0.25rem', lineHeight: 1.4 }}>
                  {r.note}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
