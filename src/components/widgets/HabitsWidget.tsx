/**
 * HabitsWidget — home widget.
 *
 * Shows today's habits as a compact checklist.
 * Each habit has a checkmark button to mark done for today.
 * Shows streak per habit. "View all" navigates to Habits section.
 */

import type { WidgetCtx } from './context';
import { Widget } from '../shared/Widget';
import { Flame, ExternalLink, Check } from 'lucide-react';

const ACCENT = '#a8c4a0';
const MAX_VISIBLE = 5;

/** Day-of-week with Mon=0 … Sun=6. */
function dow(d: Date): number {
  return (d.getDay() + 6) % 7;
}

function localMidnightKey(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return String(d.getTime());
}

function currentStreak(habit: import('../../lib/types').Habit, todayKey: string): number {
  let streak = 0;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  for (let i = 0; i < 365; i++) {
    const key = String(d.getTime());
    const active = habit.activeDays.length === 0 || habit.activeDays.includes(dow(d));
    if (active) {
      if (habit.entries[key]) {
        streak++;
      } else {
        if (key === todayKey && streak === 0) {
          d.setDate(d.getDate() - 1);
          continue;
        }
        break;
      }
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export default function HabitsWidget({ ctx }: { ctx: WidgetCtx }) {
  const { t, habits, onHabitsChange, setActiveSection } = ctx;

  if (!habits || !onHabitsChange) return null;

  const todayKey = localMidnightKey();
  const todayDow = dow(new Date());

  // Only show habits active today
  const todayHabits = habits.filter(
    h => h.activeDays.length === 0 || h.activeDays.includes(todayDow)
  );

  const visible = todayHabits.slice(0, MAX_VISIBLE);
  const overflow = todayHabits.length - visible.length;
  const doneCount = todayHabits.filter(h => !!h.entries[todayKey]).length;

  const toggle = (habitId: string) => {
    onHabitsChange(habits.map(h => {
      if (h.id !== habitId) return h;
      const next = { ...h.entries };
      if (next[todayKey]) {
        delete next[todayKey];
      } else {
        next[todayKey] = true;
      }
      return { ...h, entries: next };
    }));
  };

  return (
    <Widget t={t} accent={ACCENT}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {todayHabits.length > 0 && (
          <span style={{
            fontSize: '0.65rem', color: t.textMuted,
            background: t.bgAlt, border: `1px solid ${t.border}`,
            borderRadius: '999px', padding: '0.1rem 0.5rem',
          }}>
            {doneCount}/{todayHabits.length}
          </span>
        )}
      </div>

      {todayHabits.length === 0 ? (
        <div style={{ marginTop: '0.85rem', fontSize: '0.8rem', color: t.textMuted, lineHeight: 1.5 }}>
          No habits today.{' '}
          <button
            onClick={() => setActiveSection('habits')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: ACCENT, fontFamily: 'inherit', fontSize: 'inherit',
              fontWeight: 500, padding: 0,
            }}
          >
            Add habits →
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.75rem' }}>
            {visible.map(habit => {
              const done = !!habit.entries[todayKey];
              const streak = currentStreak(habit, todayKey);
              return (
                <div
                  key={habit.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.35rem 0.5rem',
                    background: done ? habit.color + '15' : t.bgAlt,
                    border: `1px solid ${done ? habit.color + '44' : t.border}`,
                    borderLeft: `3px solid ${habit.color}`,
                    borderRadius: '6px',
                    transition: 'background 0.12s',
                  }}
                >
                  {/* Check button */}
                  <button
                    onClick={() => toggle(habit.id)}
                    title={done ? 'Mark incomplete' : 'Mark done'}
                    style={{
                      width: '16px', height: '16px',
                      minWidth: '16px', minHeight: '16px',
                      borderRadius: '50%', boxSizing: 'content-box',
                      border: `1.5px solid ${done ? habit.color : t.border}`,
                      background: done ? habit.color : 'transparent',
                      cursor: 'pointer', padding: 0, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 0.12s, border-color 0.12s',
                    }}
                  >
                    {done && <Check size={10} strokeWidth={3} color="#fff" />}
                  </button>

                  {/* Name */}
                  <div style={{
                    flex: 1, minWidth: 0,
                    fontSize: '0.82rem',
                    color: done ? t.textMuted : t.text,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    textDecoration: done ? 'line-through' : 'none',
                    transition: 'color 0.12s',
                  }}>
                    {habit.name}
                  </div>

                  {/* Streak */}
                  {streak > 0 && (
                    <span style={{
                      display: 'flex', alignItems: 'center', gap: '0.2rem',
                      fontSize: '0.65rem', color: streak > 2 ? '#e08a4a' : t.textDim,
                      flexShrink: 0,
                    }}>
                      <Flame size={10} strokeWidth={1.5} />
                      {streak}
                    </span>
                  )}
                </div>
              );
            })}

            {overflow > 0 && (
              <div style={{ fontSize: '0.72rem', color: t.textDim, padding: '0.1rem 0.25rem' }}>
                +{overflow} more
              </div>
            )}
          </div>

          <button
            onClick={() => setActiveSection('habits')}
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
            View habits
          </button>
        </>
      )}
    </Widget>
  );
}
