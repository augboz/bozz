/**
 * HabitsView — full-page habits tracker.
 *
 * Features:
 *  - Add / delete habits with name + colour
 *  - 7-day completion grid (Mon–today)
 *  - Current streak + all-time best per habit
 *  - 28-day heatmap calendar at the bottom
 */

import { useState, useMemo } from 'react';
import { Plus, X, Flame, Check } from 'lucide-react';
import type { Theme, Habit } from '../../lib/types';
import { SectionHeader } from '../shared/ui';
import ColorBankPicker from '../shared/ColorBankPicker';

interface Props {
  t: Theme;
  habits: Habit[];
  onChange: (next: Habit[]) => void;
  colorBank?: string[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Day-of-week with Mon=0 … Sun=6. */
function dow(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/** Compute current streak (consecutive days up to and including today). */
function currentStreak(habit: Habit, todayKey: string): number {
  let streak = 0;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  // Walk backwards from today
  for (let i = 0; i < 365; i++) {
    const key = String(d.getTime());
    const active = habit.activeDays.length === 0 || habit.activeDays.includes(dow(d));
    if (active) {
      if (habit.entries[key]) {
        streak++;
      } else {
        // Allow today to be incomplete without breaking streak
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


/** Generate the 7 day keys ending today (Mon-first order). */
function last7Days(todayKey: string): Array<{ key: string; label: string; isToday: boolean }> {
  const result = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  for (let i = 6; i >= 0; i--) {
    const dd = new Date(d);
    dd.setDate(d.getDate() - i);
    const key = String(dd.getTime());
    result.push({
      key,
      label: DAY_LABELS[dow(dd)],
      isToday: key === todayKey,
    });
  }
  return result;
}

/** Generate 28 days ending today for the heatmap. */
function last28DayKeys(): string[] {
  const result: string[] = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  for (let i = 27; i >= 0; i--) {
    const dd = new Date(d);
    dd.setDate(d.getDate() - i);
    result.push(String(dd.getTime()));
  }
  return result;
}

const PALETTE = [
  '#7da7d9', '#c9a8d4', '#d4b896', '#a8c4a0', '#c7a1a1',
  '#a1bdc7', '#d9c47d', '#d49ea8', '#9ab8d4', '#b8d4a0',
];

// ── Sub-components ────────────────────────────────────────────────────────────

function HabitRow({
  habit, days, todayKey, streak, t, onToggle, onDelete,
}: {
  habit: Habit;
  days: Array<{ key: string; label: string; isToday: boolean }>;
  todayKey: string;
  streak: number;
  t: Theme;
  onToggle: (key: string) => void;
  onDelete: () => void;
}) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr auto auto',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '0.75rem 0.9rem',
      background: t.panel,
      border: `1px solid ${t.border}`,
      borderLeft: `3px solid ${habit.color}`,
      borderRadius: '10px',
      marginBottom: '0.5rem',
    }}>
      {/* Name + streaks */}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.88rem', color: t.text, fontWeight: 400, marginBottom: '0.25rem' }}>
          {habit.name}
        </div>
        <div style={{ display: 'flex', gap: '0.85rem' }}>
          <span style={{ fontSize: '0.68rem', color: t.textMuted, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Flame size={11} strokeWidth={1.6} color={streak > 0 ? '#e08a4a' : t.textDim} />
            {streak} day streak
          </span>
        </div>
      </div>

      {/* 7-day dot grid */}
      <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
        {days.map(({ key, label, isToday }) => {
          const checked = !!habit.entries[key];
          const isActive = habit.activeDays.length === 0 || habit.activeDays.includes(
            dow(new Date(Number(key)))
          );
          const isPast = Number(key) < Number(todayKey);
          const isFuture = Number(key) > Number(todayKey);

          const CIRCLE = 18;
          return (
            <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem', width: `${CIRCLE}px`, flexShrink: 0 }}>
              <span style={{
                fontSize: '0.48rem', color: isToday ? habit.color : t.textDim,
                fontWeight: isToday ? 600 : 400, lineHeight: 1,
              }}>
                {label}
              </span>
              <button
                onClick={() => !isFuture && isActive && onToggle(key)}
                title={
                  isFuture ? 'future' :
                  !isActive ? 'not scheduled' :
                  checked ? 'mark incomplete' : 'mark complete'
                }
                style={{
                  width: `${CIRCLE}px`, height: `${CIRCLE}px`,
                  minWidth: `${CIRCLE}px`, minHeight: `${CIRCLE}px`,
                  borderRadius: '50%',
                  flexShrink: 0,
                  boxSizing: 'content-box',
                  border: isToday
                    ? `2px solid ${habit.color}`
                    : `1px solid ${checked ? habit.color : t.border}`,
                  background: checked
                    ? (isPast ? habit.color + 'cc' : habit.color)
                    : (isFuture || !isActive ? 'transparent' : t.bgAlt),
                  cursor: isFuture || !isActive ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: isFuture ? 0.3 : (!isActive ? 0.3 : 1),
                  transition: 'background 0.12s, border-color 0.12s',
                  padding: 0,
                }}
              >
                {checked && <Check size={9} strokeWidth={2.5} color="#fff" />}
              </button>
            </div>
          );
        })}
      </div>

      {/* Delete */}
      <button
        onClick={onDelete}
        title="Delete habit"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: t.textDim, padding: '0.25rem',
          display: 'flex', alignItems: 'center',
          transition: 'color 0.1s',
          borderRadius: '6px',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = t.alert)}
        onMouseLeave={e => (e.currentTarget.style.color = t.textDim)}
      >
        <X size={14} strokeWidth={1.5} />
      </button>
    </div>
  );
}

function HeatmapRow({ habit, keys28, t }: {
  habit: Habit;
  keys28: string[];
  t: Theme;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
      <div style={{
        width: '120px', flexShrink: 0,
        fontSize: '0.72rem', color: t.textMuted,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {habit.name}
      </div>
      <div style={{ display: 'flex', gap: '2px', flexWrap: 'nowrap' }}>
        {keys28.map(key => {
          const checked = !!habit.entries[key];
          const isActive = habit.activeDays.length === 0 || habit.activeDays.includes(
            dow(new Date(Number(key)))
          );
          return (
            <div
              key={key}
              title={new Date(Number(key)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              style={{
                width: '14px', height: '14px',
                borderRadius: '3px',
                background: checked
                  ? habit.color
                  : isActive
                    ? t.bgAlt
                    : 'transparent',
                border: `1px solid ${checked ? habit.color : isActive ? t.border : 'transparent'}`,
                opacity: isActive ? 1 : 0.25,
                flexShrink: 0,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Add habit form ────────────────────────────────────────────────────────────

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const DAY_FULL = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function AddHabitForm({ t, onAdd, bank }: { t: Theme; onAdd: (name: string, color: string, activeDays: number[]) => void; bank: string[] }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(bank[0] ?? PALETTE[0]);
  const [days, setDays] = useState<number[]>([]); // empty = every day
  const [open, setOpen] = useState(false);

  const toggleDay = (d: number) => {
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort());
  };

  const submit = () => {
    const n = name.trim();
    if (!n) return;
    onAdd(n, color, days);
    setName('');
    setColor(bank[0] ?? PALETTE[0]);
    setDays([]);
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
          background: 'none', border: `1px dashed ${t.border}`,
          borderRadius: '8px', padding: '0.55rem 1rem',
          color: t.textMuted, fontFamily: 'inherit', fontSize: '0.82rem',
          cursor: 'pointer', transition: 'border-color 0.12s, color 0.12s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = t.borderStrong; e.currentTarget.style.color = t.text; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textMuted; }}
      >
        <Plus size={14} strokeWidth={1.8} /> Add habit
      </button>
    );
  }

  return (
    <div style={{
      background: t.panel, border: `1px solid ${t.border}`, borderRadius: '10px',
      padding: '1rem 1.1rem', marginBottom: '0.5rem',
    }}>
      {/* Name */}
      <input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder="Habit name…"
        style={{
          width: '100%', boxSizing: 'border-box',
          background: t.input, border: `1px solid ${t.border}`, borderRadius: '7px',
          padding: '0.6rem 0.85rem', color: t.text, fontSize: '0.88rem',
          fontFamily: 'inherit', outline: 'none', marginBottom: '0.75rem',
        }}
      />

      {/* Colour picker */}
      <div style={{ marginBottom: '0.75rem' }}>
        <ColorBankPicker
          bank={bank}
          selected={color}
          onChange={(c) => { if (c) setColor(c); }}
          allowNone={false}
          swatchSize={20}
        />
      </div>

      {/* Day picker */}
      <div style={{ marginBottom: '0.85rem' }}>
        <div style={{ fontSize: '0.65rem', color: t.textDim, marginBottom: '0.4rem' }}>
          Active days
        </div>
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setDays([])}
            style={{
              height: '28px', padding: '0 0.6rem',
              borderRadius: '6px',
              border: `1px solid ${days.length === 0 ? color : t.border}`,
              background: days.length === 0 ? color + '33' : 'transparent',
              color: days.length === 0 ? color : t.textDim,
              fontSize: '0.68rem', fontFamily: 'inherit',
              cursor: 'pointer', fontWeight: days.length === 0 ? 500 : 400,
              transition: 'all 0.1s',
            }}
          >
            Every day
          </button>
          {ALL_DAYS.map(d => {
            const on = days.length > 0 && days.includes(d);
            return (
              <button
                key={d}
                onClick={() => toggleDay(d)}
                style={{
                  width: '32px', height: '28px',
                  borderRadius: '6px',
                  border: `1px solid ${on ? color : t.border}`,
                  background: on ? color + '33' : 'transparent',
                  color: on ? color : t.textDim,
                  fontSize: '0.68rem', fontFamily: 'inherit',
                  cursor: 'pointer', fontWeight: on ? 500 : 400,
                  transition: 'all 0.1s',
                }}
              >
                {DAY_FULL[d].slice(0, 2)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={submit}
          disabled={!name.trim()}
          style={{
            background: color, border: 'none', borderRadius: '7px',
            color: '#fff', padding: '0.5rem 1.1rem',
            fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 500,
            cursor: name.trim() ? 'pointer' : 'default',
            opacity: name.trim() ? 1 : 0.45,
          }}
        >
          Add
        </button>
        <button
          onClick={() => setOpen(false)}
          style={{
            background: 'transparent', border: `1px solid ${t.border}`,
            borderRadius: '7px', color: t.textMuted,
            padding: '0.5rem 0.85rem', fontFamily: 'inherit', fontSize: '0.82rem',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function HabitsView({ t, habits, onChange, colorBank }: Props) {
  const bank = colorBank ?? [];
  const todayKey = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return String(d.getTime());
  }, []);

  const days = useMemo(() => last7Days(todayKey), [todayKey]);
  const keys28 = useMemo(() => last28DayKeys(), []);

  const addHabit = (name: string, color: string, activeDays: number[]) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const next: Habit = { id, name, color, activeDays, entries: {}, order: habits.length };
    onChange([...habits, next]);
  };

  const deleteHabit = (id: string) => onChange(habits.filter(h => h.id !== id));

  const toggleEntry = (habitId: string, key: string) => {
    onChange(habits.map(h => {
      if (h.id !== habitId) return h;
      const next = { ...h.entries };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = true;
      }
      return { ...h, entries: next };
    }));
  };

  // Today's completion summary
  const todayTotal = habits.filter(h =>
    h.activeDays.length === 0 || h.activeDays.includes(dow(new Date()))
  ).length;
  const todayDone = habits.filter(h => h.entries[todayKey]).length;

  return (
    <div>
      <SectionHeader
        title="Habits"
        t={t}
        right={
          todayTotal > 0 ? (
            <span style={{
              fontSize: '0.75rem', color: t.textMuted,
              background: t.bgAlt, border: `1px solid ${t.border}`,
              borderRadius: '999px', padding: '0.2rem 0.65rem',
            }}>
              {todayDone} / {todayTotal} today
            </span>
          ) : null
        }
      />

      {habits.length === 0 ? (
        <div style={{
          color: t.textMuted, fontSize: '0.85rem', marginBottom: '1.25rem',
          lineHeight: 1.6, fontStyle: 'italic',
        }}>
          No habits yet. Add one below to start tracking your daily streaks.
        </div>
      ) : (
        <>
          {/* 7-day habit rows */}
          <div style={{ marginBottom: '1.5rem' }}>
            {habits.map(h => (
              <HabitRow
                key={h.id}
                habit={h}
                days={days}
                todayKey={todayKey}
                streak={currentStreak(h, todayKey)}
                t={t}
                onToggle={(key) => toggleEntry(h.id, key)}
                onDelete={() => deleteHabit(h.id)}
              />
            ))}
          </div>

          {/* 28-day heatmap */}
          {habits.length > 0 && (
            <div style={{
              background: t.panel, border: `1px solid ${t.border}`,
              borderRadius: '10px', padding: '1rem 1.1rem', marginBottom: '1.5rem',
            }}>
              <div style={{
                fontSize: '0.62rem', letterSpacing: '0.12em', textTransform: 'uppercase',
                color: t.textDim, marginBottom: '0.75rem',
              }}>
                28-day history
              </div>
              {habits.map(h => (
                <HeatmapRow key={h.id} habit={h} keys28={keys28} t={t} />
              ))}
              {/* Week labels */}
              <div style={{ display: 'flex', marginLeft: '128px', gap: '2px', marginTop: '0.4rem' }}>
                {keys28.filter((_, i) => i % 7 === 0).map(key => (
                  <div key={key} style={{
                    width: `${7 * 16}px`,
                    fontSize: '0.55rem', color: t.textDim,
                  }}>
                    {new Date(Number(key)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <AddHabitForm t={t} onAdd={addHabit} bank={bank} />
    </div>
  );
}
