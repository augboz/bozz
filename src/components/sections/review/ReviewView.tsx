import React, { useMemo, useState } from 'react';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { Check, ChevronDown, ChevronRight, X } from 'lucide-react';
import type {
  Application, BudgetData, ListItem, TaskListKey, Theme, WeeklyReview,
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
  lists: Record<TaskListKey, ListItem[]>;
  applications: Application[];
  budget: BudgetData;
}

const LIST_LABEL: Record<TaskListKey, string> = {
  music: 'Music', life: 'Life', cv: 'CV', other: 'Other',
};

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

export default function ReviewView({ t, reviews, setReviews, lists, applications, budget }: ReviewViewProps) {
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
    lists, applications, budget,
  });

  const setNote = (note: string) => {
    if (!pending) return;
    setReviews(prev => prev.map(r => r.id === pending.id ? { ...r, note } : r));
  };

  const markReviewed = () => {
    if (!pending) return;
    setReviews(prev => prev.map(r => r.id === pending.id ? { ...r, reviewedAt: Date.now() } : r));
  };

  const range = `${format(new Date(window.start), 'd MMM')} – ${format(new Date(window.end), 'd MMM yyyy')}`;

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
          <StatBlock t={t} label="tasks done" rows={(Object.keys(stats.doneBySection) as TaskListKey[])
            .map(k => ({ label: LIST_LABEL[k], value: String(stats.doneBySection[k]) }))} />
          <StatBlock t={t} label="applications" rows={[
            { label: 'open', value: String(stats.applicationsSnapshot.open) },
            { label: 'interviews', value: String(stats.applicationsSnapshot.interviewing) },
            { label: 'offers', value: String(stats.applicationsSnapshot.offers) },
            { label: 'rejected', value: String(stats.applicationsSnapshot.rejected) },
          ]} />
          <StatBlock t={t} label="spend"
            big={formatMoney(stats.spend, budget.currency)}
            rows={stats.spendByCategory.map(c => ({ label: c.category, value: formatMoney(c.amount, budget.currency) }))}
          />
        </div>
      </Panel>

      <Panel t={t} title="Scheduled vs done">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <ItemColumn t={t} icon={<Check size={12} strokeWidth={2} color={t.doneAccent} />} label={`Done (${stats.scheduledDone.length})`} items={stats.scheduledDone} />
          <ItemColumn t={t} icon={<X size={12} strokeWidth={2} color={t.alert} />} label={`Missed (${stats.scheduledMissed.length})`} items={stats.scheduledMissed} />
        </div>
      </Panel>

      <Panel t={t} title={`Rolled over (${stats.rolledOver.length})`}>
        {stats.rolledOver.length === 0
          ? <span style={{ fontSize: '0.82rem', color: t.textDim, fontStyle: 'italic' }}>nothing trailing — clean slate</span>
          : <ItemColumn t={t} label="" items={stats.rolledOver} />}
      </Panel>

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

function ItemColumn({ t, icon, label, items }: {
  t: Theme; icon?: React.ReactNode; label: string;
  items: Array<{ list: TaskListKey; item: ListItem }>;
}) {
  return (
    <div>
      {label && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.35rem',
          fontSize: '0.7rem', color: t.textMuted, letterSpacing: '0.08em', marginBottom: '0.4rem',
        }}>
          {icon}{label}
        </div>
      )}
      {items.length === 0
        ? <span style={{ fontSize: '0.78rem', color: t.textDim, fontStyle: 'italic' }}>—</span>
        : (
          <div style={{ display: 'grid', gap: '0.3rem' }}>
            {items.map(({ list, item }) => (
              <div key={`${list}:${item.id}`} style={{
                fontSize: '0.8rem', color: t.text,
                display: 'flex', alignItems: 'center', gap: '0.4rem',
              }}>
                <span style={{ color: t.textDim, fontSize: '0.7rem', width: '46px' }}>{LIST_LABEL[list]}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.text}</span>
              </div>
            ))}
          </div>
        )}
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
                {format(new Date(r.weekStart), 'd MMM')} – {format(new Date(r.weekEnd), 'd MMM yyyy')}
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
