/**
 * BriefingView — the zero-config "your morning in 90 seconds" landing surface.
 *
 * Renders the TodayWidget (which already computes the entire brief: narrated
 * line, next-class banner, overdue/today/week priorities, events, plan) at full
 * width, so an impatient student gets the glance on open WITHOUT entering edit
 * mode. A toggle at the top switches to the customisable widget "Board" (the
 * existing HomeView) for power users.
 *
 * This is purely a composition over existing WidgetCtx state — no new data.
 */

import { CalendarDays, LayoutGrid } from 'lucide-react';
import type { Theme } from '../../lib/types';
import type { WidgetCtx } from '../widgets/context';
import TodayWidget from '../widgets/TodayWidget';

/** Time-of-day greeting, reinforcing the "your morning" framing. */
function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'good morning. here is your day.';
  if (h < 18) return 'good afternoon. here is where things stand.';
  return 'good evening. here is what is left.';
}

export default function BriefingView({ ctx, onSwitchToBoard }: {
  ctx: WidgetCtx;
  /** Switch the Home landing to the customisable Board (persists the choice). */
  onSwitchToBoard: () => void;
}) {
  const t: Theme = ctx.t;

  // Briefing always shows every section of the Today brief — it's the whole
  // point. Force the section flags on regardless of any saved widget config.
  const briefingCtx: WidgetCtx = {
    ...ctx,
    widgetConfig: { showEvents: true, showTasks: true },
    onWidgetConfig: () => {},
  };

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      {/* Header row: greeting + Briefing/Board toggle */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '0.75rem', marginBottom: '0.85rem', flexWrap: 'wrap',
      }}>
        <div style={{ fontSize: '0.82rem', color: t.textMuted }}>{greeting()}</div>
        <div style={{
          display: 'inline-flex', borderRadius: '9px', overflow: 'hidden',
          border: `1px solid ${t.borderStrong}`,
          background: `var(--glass-bg, ${t.panel})`,
        }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
            background: t.doingAccent, color: '#fff',
            padding: '0.35rem 0.7rem', fontSize: '0.74rem', fontWeight: 600, fontFamily: 'inherit',
          }}>
            <CalendarDays size={13} strokeWidth={1.8} /> Briefing
          </span>
          <button
            onClick={onSwitchToBoard}
            title="Switch to your customisable Board"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
              background: 'transparent', border: 'none', borderLeft: `1px solid ${t.border}`,
              color: t.text, padding: '0.35rem 0.7rem', fontSize: '0.74rem',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <LayoutGrid size={13} strokeWidth={1.8} /> Board
          </button>
        </div>
      </div>

      {/* The brief, full-width. A min-height keeps the scroll area usable on a
          short brief; max-width keeps line lengths readable on wide screens. */}
      <div style={{ maxWidth: '760px', minHeight: '60vh', display: 'flex' }}>
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <TodayWidget ctx={briefingCtx} />
        </div>
      </div>
    </div>
  );
}
