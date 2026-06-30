/**
 * HomeCoachChip — a small, dismissible "next step" chip on the Home view.
 *
 * Shows ONE ranked suggestion based on signals already in the dashboard, so a
 * day-2 user always has an obvious next move toward "your morning in 90 seconds":
 *   no calendar feeds     → Add your timetable
 *   quicks waiting        → N quicks to sort
 *   nothing planned today → Plan your day
 *   no email connected    → Connect your inbox
 *
 * Routes via setActiveSection. Dismissal persists for the rest of the day (a
 * date-stamped localStorage key) so it never nags within a session but quietly
 * returns tomorrow if there's still a gap.
 */

import { useMemo, useState } from 'react';
import { ArrowRight, X, Sparkles } from 'lucide-react';
import type { SectionId, Theme } from '../../lib/types';

export interface CoachSignals {
  feedCount: number;
  inboxCount: number;
  plannedToday: number;
  emailConnected: boolean;
}

interface Suggestion {
  id: string;
  label: string;
  section: SectionId;
}

/** Highest-priority unmet next step, or null when nothing's worth nudging. */
function pickSuggestion(s: CoachSignals): Suggestion | null {
  if (s.feedCount === 0) return { id: 'timetable', label: 'Add your timetable', section: 'calendar' };
  if (s.inboxCount > 0) return { id: 'quicks', label: `${s.inboxCount} quick${s.inboxCount === 1 ? '' : 's'} to sort`, section: 'inbox' };
  if (s.plannedToday === 0) return { id: 'plan', label: 'Plan your day', section: 'dailyPlanner' };
  if (!s.emailConnected) return { id: 'email', label: 'Connect your inbox', section: 'apps' };
  return null;
}

function dayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export default function HomeCoachChip({ t, signals, setActiveSection }: {
  t: Theme;
  signals: CoachSignals;
  setActiveSection: (id: string) => void;
}) {
  const suggestion = useMemo(() => pickSuggestion(signals), [signals]);

  const storageKey = 'bozzCoachDismissed';
  const [dismissedDay, setDismissedDay] = useState<string | null>(() => {
    try { return localStorage.getItem(storageKey); } catch { return null; }
  });

  if (!suggestion) return null;
  if (dismissedDay === dayKey()) return null;

  const dismiss = () => {
    const k = dayKey();
    setDismissedDay(k);
    try { localStorage.setItem(storageKey, k); } catch { /* ignore */ }
  };

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
      marginBottom: '0.85rem',
      background: `var(--glass-bg, ${t.panel})`,
      backdropFilter: 'var(--glass-blur, blur(8px))', WebkitBackdropFilter: 'var(--glass-blur, blur(8px))',
      border: `1px solid ${t.doingBorder}`, borderRadius: '999px',
      padding: '0.35rem 0.4rem 0.35rem 0.75rem',
      boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
    }}>
      <Sparkles size={13} strokeWidth={1.7} color={t.doingAccent} style={{ flexShrink: 0 }} />
      <span style={{ fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.textDim }}>
        next step
      </span>
      <button
        onClick={() => setActiveSection(suggestion.section)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
          background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          color: t.doingAccent, fontSize: '0.78rem', fontWeight: 600, padding: '0.1rem 0.2rem',
        }}
      >
        {suggestion.label} <ArrowRight size={13} strokeWidth={2} />
      </button>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        title="Dismiss for today"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none', cursor: 'pointer', color: t.textDim,
          padding: '0.2rem', flexShrink: 0,
        }}
      >
        <X size={13} strokeWidth={1.7} />
      </button>
    </div>
  );
}
