/**
 * BriefingView — the zero-config "your morning in 90 seconds" landing surface.
 *
 * Renders the TodayWidget (which already computes the entire brief: narrated
 * line, next-class banner, overdue/today/week priorities, events, plan) at full
 * width, so an impatient student gets the glance on open WITHOUT entering edit
 * mode. The landing surface (Briefing / Week / Board) is chosen in
 * Settings → "Home shows".
 *
 * This is purely a composition over existing WidgetCtx state — no new data.
 */

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

export default function BriefingView({ ctx }: { ctx: WidgetCtx }) {
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
      {/* Greeting */}
      <div style={{ fontSize: '0.82rem', color: t.text, fontWeight: 500, marginBottom: '0.85rem' }}>
        {greeting()}
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
