/**
 * DeadlinesView — the first-class "everything that's due" hub.
 *
 * Deadlines are the #1 job, but they were scattered across every topic + the
 * calendar with no single home. This surface unifies them:
 *   - deadlineEntries(ctx) folds together topic items with deadlines AND
 *     deadline-like imported calendar events (over a long ~120-day window passed
 *     by the parent), deduped — see widgets/util.ts.
 *   - rendered as one chronological list grouped Overdue / This week / This month
 *     / Later, with per-module colour filter chips and an inline "add a deadline"
 *     that routes through the existing topic-free addDeadline path.
 *
 * Pure composition over existing state — no schema, no auth, no new persistence.
 */

import { useMemo, useState } from 'react';
import { Flame, CornerDownLeft, Plus } from 'lucide-react';
import type { SectionId, Theme } from '../../lib/types';
import type { WidgetCtx } from '../widgets/context';
import { deadlineEntries, dueTimestamp, type DeadlineEntry } from '../widgets/util';
import { SectionHeader, EmptyState } from '../shared/ui';
import { sectionAccents } from '../../lib/themes';
import { parseVoiceTasks } from '../../lib/taskParser';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function dayStart(ts: number): number {
  const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime();
}

type Bucket = 'overdue' | 'week' | 'month' | 'later';
const BUCKET_ORDER: Bucket[] = ['overdue', 'week', 'month', 'later'];
const BUCKET_LABEL: Record<Bucket, string> = {
  overdue: 'Overdue', week: 'This week', month: 'This month', later: 'Later',
};

/** Which time bucket a deadline day falls into, relative to today. */
function bucketFor(dayMs: number, todayMs: number): Bucket {
  if (dayMs < todayMs) return 'overdue';
  if (dayMs <= todayMs + 7 * DAY_MS) return 'week';
  if (dayMs <= todayMs + 31 * DAY_MS) return 'month';
  return 'later';
}

/** Live urgency label + colour for a precise due timestamp (mirrors UpcomingDeadlinesWidget). */
function urgency(due: number, now: number, todayMs: number, accent: string, t: Theme): { label: string; color: string } {
  const diff = due - now;
  if (due < todayMs || diff < 0) {
    if (-diff >= DAY_MS) return { label: `overdue ${Math.max(1, Math.round(-diff / DAY_MS))}d`, color: t.alert };
    return { label: `overdue ${Math.max(1, Math.round(-diff / HOUR_MS))}h`, color: t.alert };
  }
  if (dayStart(due) === todayMs) {
    const h = Math.floor(diff / HOUR_MS);
    if (h < 1) return { label: 'due now', color: t.alert };
    if (h < 12) return { label: `in ${h}h`, color: '#e0a23b' };
    return { label: 'due today', color: '#e0a23b' };
  }
  const days = Math.ceil(diff / DAY_MS);
  return { label: `in ${days}d`, color: accent };
}

/** "Wed 2 Jul" date label. */
function dateLabel(dayMs: number): string {
  return new Date(dayMs).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function DeadlinesView({ ctx }: { ctx: WidgetCtx }) {
  const { t, topics, setActiveSection, addDeadline } = ctx;
  const now = Date.now();
  const todayMs = dayStart(now);

  // Filter chips are keyed by section id (topic id, or 'calendar' for imports).
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [addText, setAddText] = useState('');

  const entries = useMemo(() => deadlineEntries(ctx), [ctx]);

  // Map section id → { name, color } for the filter chips. Topic ids resolve to
  // the topic; 'calendar' (and any unknown id) falls back to an "Imported" chip.
  const sectionMeta = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();
    for (const e of entries) {
      if (map.has(e.section)) continue;
      const topic = (topics ?? []).find(tp => tp.id === e.section);
      if (topic) map.set(e.section, { name: topic.name || 'Topic', color: topic.color });
      else map.set(e.section, { name: 'Imported', color: e.accent || sectionAccents.calendar });
    }
    return map;
  }, [entries, topics]);

  const filtered = useMemo(() => {
    const list = activeFilters.size === 0 ? entries : entries.filter(e => activeFilters.has(e.section));
    return [...list].sort((a, b) => (dueTimestamp(a.item) ?? 0) - (dueTimestamp(b.item) ?? 0));
  }, [entries, activeFilters]);

  // Group into the four chronological buckets, preserving the sorted order.
  const grouped = useMemo(() => {
    const out: Record<Bucket, DeadlineEntry[]> = { overdue: [], week: [], month: [], later: [] };
    for (const e of filtered) {
      if (e.item.deadline == null) continue;
      out[bucketFor(dayStart(e.item.deadline), todayMs)].push(e);
    }
    return out;
  }, [filtered, todayMs]);

  const toggleFilter = (id: string) =>
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const submitAdd = () => {
    const raw = addText.trim();
    if (!raw || !addDeadline) { return; }
    const parsed = parseVoiceTasks(raw, []);
    const first = parsed[0];
    const clean = first?.text?.trim() || raw;
    addDeadline(clean, first?.deadline ?? null);
    setAddText('');
  };

  const total = entries.length;

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      <SectionHeader
        title="Deadlines"
        t={t}
        hint={total > 0 ? `${total} open` : ''}
      />

      {/* Always-on inline add — topic-free, parses "stats essay friday 5pm". */}
      {addDeadline && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1.1rem',
          background: t.bgAlt, border: `1px solid ${t.border}`, borderRadius: '9px',
          padding: '0.35rem 0.45rem', maxWidth: '620px',
        }}>
          <Plus size={14} strokeWidth={2} color={t.textDim} style={{ flexShrink: 0, marginLeft: '0.15rem' }} />
          <input
            value={addText}
            onChange={e => setAddText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitAdd(); } }}
            placeholder="Add a deadline — e.g. stats essay friday 5pm"
            style={{
              flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none',
              color: t.text, fontSize: '0.85rem', fontFamily: 'inherit', padding: '0.3rem 0.2rem',
            }}
          />
          <button
            onClick={submitAdd}
            disabled={!addText.trim()}
            title="Add deadline"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: t.doingAccent, border: 'none', borderRadius: '6px', cursor: addText.trim() ? 'pointer' : 'default',
              color: '#fff', padding: '0.3rem 0.45rem', flexShrink: 0, opacity: addText.trim() ? 1 : 0.5,
            }}
          >
            <CornerDownLeft size={13} strokeWidth={2} />
          </button>
        </div>
      )}

      {/* Module / topic colour filter chips */}
      {sectionMeta.size > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1.1rem' }}>
          {[...sectionMeta.entries()].map(([id, meta]) => {
            const on = activeFilters.has(id);
            return (
              <button
                key={id}
                onClick={() => toggleFilter(id)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.3rem 0.7rem', borderRadius: '999px',
                  background: on ? meta.color + '25' : 'transparent',
                  border: `1.5px solid ${on ? meta.color : t.border}`,
                  color: on ? meta.color : t.textMuted,
                  fontSize: '0.76rem', fontFamily: 'inherit', cursor: 'pointer',
                  transition: 'all 0.12s',
                }}
              >
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
                {meta.name}
              </button>
            );
          })}
          {activeFilters.size > 0 && (
            <button
              onClick={() => setActiveFilters(new Set())}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                color: t.textDim, fontSize: '0.74rem', padding: '0.3rem 0.4rem',
              }}
            >
              clear
            </button>
          )}
        </div>
      )}

      {/* Grouped chronological list */}
      {filtered.length === 0 ? (
        <EmptyState
          text={total === 0 ? 'Nothing due. Add a deadline above, or import your timetable.' : 'No deadlines match this filter.'}
          t={t}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.3rem', maxWidth: '760px' }}>
          {BUCKET_ORDER.map(bucket => {
            const items = grouped[bucket] ?? [];
            if (items.length === 0) return null;
            const headColor = bucket === 'overdue' ? t.alert : t.textMuted;
            return (
              <div key={bucket}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.55rem' }}>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
                    color: headColor,
                  }}>
                    {bucket === 'overdue' && <Flame size={11} strokeWidth={2} style={{ display: 'inline', marginRight: '0.25rem', verticalAlign: '-1px' }} />}
                    {BUCKET_LABEL[bucket]}
                  </span>
                  <span style={{ flex: 1, height: 1, background: t.border }} />
                  <span style={{ fontSize: '0.66rem', color: t.textDim }}>{items.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {items.map(e => {
                    const due = dueTimestamp(e.item);
                    const u = due != null ? urgency(due, now, todayMs, e.accent, t) : null;
                    const dayMs = e.item.deadline != null ? dayStart(e.item.deadline) : todayMs;
                    return (
                      <button
                        key={`${e.section}-${e.item.id}`}
                        onClick={() => setActiveSection(e.section as SectionId)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.6rem',
                          background: t.bgAlt, border: `1px solid ${t.border}`,
                          borderLeft: `3px solid ${e.accent}`, borderRadius: '8px',
                          padding: '0.55rem 0.75rem', cursor: 'pointer', fontFamily: 'inherit',
                          textAlign: 'left', width: '100%',
                          transition: 'background 0.12s, border-color 0.12s',
                        }}
                        onMouseEnter={ev => { ev.currentTarget.style.background = t.panel; }}
                        onMouseLeave={ev => { ev.currentTarget.style.background = t.bgAlt; }}
                      >
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: e.accent, flexShrink: 0 }} />
                        <span style={{
                          flex: 1, fontSize: '0.86rem', color: t.text,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {e.item.text}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: t.textDim, flexShrink: 0 }}>{dateLabel(dayMs)}</span>
                        {u && (
                          <span style={{
                            flexShrink: 0, fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.02em',
                            color: u.color, whiteSpace: 'nowrap', minWidth: '54px', textAlign: 'right',
                          }}>
                            {u.label}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
