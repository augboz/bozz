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

import { useMemo, useState } from 'react';
import { CalendarDays, LayoutGrid, Plus, CornerDownLeft, X } from 'lucide-react';
import type { Theme } from '../../lib/types';
import type { WidgetCtx } from '../widgets/context';
import TodayWidget from '../widgets/TodayWidget';
import { parseVoiceTasks } from '../../lib/taskParser';
import { deadlineLabel } from '../../lib/dates';

/**
 * BriefingDeadlineBar — the always-on "Add a deadline…" input at the very top of
 * the brief (P3). Parses "stats essay friday 5pm" inline (taskParser), shows the
 * detected date as a confirmable chip, and on Enter routes through the existing
 * topic-free addDeadline — no topic choice required. Promotes the already-built
 * capture path to where the action happens.
 */
function BriefingDeadlineBar({ ctx }: { ctx: WidgetCtx }) {
  const t: Theme = ctx.t;
  const { addDeadline } = ctx;
  const [text, setText] = useState('');

  // Live parse so the user can SEE the detected date before committing. Parse
  // with no topics so we only lift text + date; addDeadline does its own routing.
  const parsed = useMemo(() => {
    const raw = text.trim();
    if (raw.length < 2) return null;
    return parseVoiceTasks(raw, [])[0] ?? null;
  }, [text]);

  // No capture path wired (older ctx) — render nothing rather than a dead bar.
  if (!addDeadline) return null;

  const submit = () => {
    const raw = text.trim();
    if (!raw) return;
    const first = parseVoiceTasks(raw, [])[0];
    const clean = first?.text?.trim() || raw;
    addDeadline(clean, first?.deadline ?? null);
    setText('');
  };

  return (
    <div style={{ marginBottom: '0.85rem' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.45rem',
        background: t.bgAlt, border: `1px solid ${t.border}`, borderRadius: '10px',
        padding: '0.4rem 0.5rem',
      }}>
        <Plus size={15} strokeWidth={2} color={t.textDim} style={{ flexShrink: 0, marginLeft: '0.15rem' }} />
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); submit(); }
            if (e.key === 'Escape') setText('');
          }}
          placeholder="Add a deadline… e.g. stats essay friday 5pm"
          style={{
            flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none',
            color: t.text, fontSize: '0.9rem', fontFamily: 'inherit', padding: '0.35rem 0.2rem',
          }}
        />
        {parsed?.deadline != null && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
            background: t.doingAccent + '22', color: t.doingAccent,
            borderRadius: '999px', padding: '0.2rem 0.6rem',
            fontSize: '0.72rem', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap',
          }}>
            {deadlineLabel(parsed.deadline)}
          </span>
        )}
        {text.trim() && (
          <button
            onClick={() => setText('')}
            title="Clear"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer', color: t.textDim,
              display: 'flex', alignItems: 'center', padding: '0.2rem', flexShrink: 0,
            }}
          >
            <X size={13} strokeWidth={2} />
          </button>
        )}
        <button
          onClick={submit}
          disabled={!text.trim()}
          title="Add deadline"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: t.doingAccent, border: 'none', borderRadius: '7px', cursor: text.trim() ? 'pointer' : 'default',
            color: '#fff', padding: '0.35rem 0.5rem', flexShrink: 0, opacity: text.trim() ? 1 : 0.5,
          }}
        >
          <CornerDownLeft size={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

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

      {/* Always-on add-a-deadline bar (P3) — promotes the topic-free capture path
          to the top of the brief, where the action happens. */}
      <div style={{ maxWidth: '760px' }}>
        <BriefingDeadlineBar ctx={briefingCtx} />
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
