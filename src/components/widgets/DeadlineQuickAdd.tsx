/**
 * DeadlineQuickAdd — a compact, topic-free "add a deadline" affordance shown
 * inside the Today + Upcoming-deadlines widgets.
 *
 * Type something like "stats essay due friday 5pm" and hit enter: the existing
 * taskParser extracts the date (and strips the date phrase from the text), then
 * ctx.addDeadline routes it to a predicted topic if one matches, else a lazily
 * created "Deadlines" bucket — so capture works even on a zero-topic account.
 *
 * Collapsed to a single "+ add a deadline" button until tapped, so it never
 * competes with the widget's primary content.
 */

import { useState } from 'react';
import { Plus, CornerDownLeft } from 'lucide-react';
import type { WidgetCtx } from './context';
import { parseVoiceTasks } from '../../lib/taskParser';

export default function DeadlineQuickAdd({ ctx, accent }: { ctx: WidgetCtx; accent: string }) {
  const { t, addDeadline } = ctx;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');

  // No capture path wired (older ctx call site) — render nothing rather than a
  // dead button.
  if (!addDeadline) return null;

  const submit = () => {
    const raw = text.trim();
    if (!raw) { setOpen(false); return; }
    // Parse with no topics so we only lift out the text + date; addDeadline does
    // its own topic prediction against the live list.
    const parsed = parseVoiceTasks(raw, []);
    const first = parsed[0];
    const clean = first?.text?.trim() || raw;
    const deadline = first?.deadline ?? null;
    addDeadline(clean, deadline);
    setText('');
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
          background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          color: t.textDim, fontSize: '0.7rem', padding: '0.2rem 0', marginTop: '0.35rem',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = accent; }}
        onMouseLeave={e => { e.currentTarget.style.color = t.textDim; }}
      >
        <Plus size={11} strokeWidth={2} /> add a deadline
      </button>
    );
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.4rem',
      background: t.bgAlt, border: `1px solid ${t.border}`, borderRadius: '7px',
      padding: '0.25rem 0.35rem',
    }}>
      <input
        autoFocus
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); submit(); }
          if (e.key === 'Escape') { setText(''); setOpen(false); }
        }}
        onBlur={() => { if (!text.trim()) setOpen(false); }}
        placeholder="e.g. stats essay due friday 5pm"
        style={{
          flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none',
          color: t.text, fontSize: '0.76rem', fontFamily: 'inherit', padding: '0.15rem 0.1rem',
        }}
      />
      <button
        onClick={submit}
        title="Add deadline"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: accent, border: 'none', borderRadius: '5px', cursor: 'pointer',
          color: '#fff', padding: '0.25rem 0.35rem', flexShrink: 0,
        }}
      >
        <CornerDownLeft size={12} strokeWidth={2} />
      </button>
    </div>
  );
}
