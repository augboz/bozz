/**
 * WelcomeColdStart — the guided step shown to brand-new accounts right after the
 * theme pick. One question ("What are you here for?") with tappable chips.
 *
 * MULTI-select (P4): a real student is rarely just one thing — Uni AND Gym AND a
 * Job. Tap as many as apply; each seeds a real colour-coded topic with its
 * keyword set, so predictTopic (inert until a topic scores) can route the very
 * first capture. The next step adds their real timetable to fill it all.
 *
 * Skippable. Neutral full-screen overlay (renders before the live theme matters),
 * matching WelcomeThemePicker so the two steps feel like one flow.
 */

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { COLD_START_OPTIONS, type ColdStartOption } from '../../lib/coldStart';

export default function WelcomeColdStart({ onChoose, onSkip }: {
  /** Seed ALL chosen options at once (≥1). */
  onChoose: (options: ColdStartOption[]) => void;
  onSkip: () => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const confirm = () => {
    const chosen = COLD_START_OPTIONS.filter(o => selected.has(o.id));
    if (chosen.length === 0) { onSkip(); return; }
    onChoose(chosen);
  };

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'radial-gradient(120% 120% at 50% 0%, #15161a 0%, #08080a 60%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: '2rem', padding: '2rem', textAlign: 'center',
    }}>
      <img src="/brand/bozz-mark-dark.png" alt="" width={52} height={52}
        style={{ width: '52px', height: '52px', borderRadius: '13px', objectFit: 'cover' }} />
      <div>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#f2f2f2', letterSpacing: '-0.02em' }}>
          What are you here for?
        </h1>
        <div style={{ fontSize: '0.92rem', color: 'rgba(255,255,255,0.55)', marginTop: '0.4rem', maxWidth: '440px' }}>
          Pick everything that applies and we’ll tailor your board to match — change or add more anytime.
        </div>
      </div>

      <div style={{
        display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '560px',
      }}>
        {COLD_START_OPTIONS.map(opt => {
          const on = selected.has(opt.id);
          const hot = hover === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => toggle(opt.id)}
              onMouseEnter={() => setHover(opt.id)}
              onMouseLeave={() => setHover(null)}
              aria-label={opt.label}
              aria-pressed={on}
              style={{
                position: 'relative',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem',
                background: on ? 'rgba(94,196,216,0.16)' : hot ? 'rgba(94,196,216,0.08)' : 'transparent',
                cursor: 'pointer', fontFamily: 'inherit',
                border: `1.5px solid ${on || hot ? '#5ec4d8' : 'rgba(255,255,255,0.14)'}`,
                borderRadius: '16px', padding: '1.3rem 1.6rem', minWidth: '128px',
                transform: on || hot ? 'translateY(-3px)' : 'none',
                transition: 'border-color 0.18s, transform 0.18s, background 0.18s',
              }}
            >
              {on && (
                <span style={{
                  position: 'absolute', top: '0.5rem', right: '0.5rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '18px', height: '18px', borderRadius: '50%',
                  background: '#5ec4d8', color: '#08080a',
                }}>
                  <Check size={12} strokeWidth={3} />
                </span>
              )}
              <span style={{ fontSize: '1.9rem', lineHeight: 1 }}>{opt.emoji}</span>
              <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#e8e8e8' }}>{opt.label}</span>
            </button>
          );
        })}
      </div>

      <button
        onClick={confirm}
        disabled={selected.size === 0}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
          background: selected.size === 0 ? 'rgba(255,255,255,0.08)' : '#5ec4d8',
          color: selected.size === 0 ? 'rgba(255,255,255,0.4)' : '#08080a',
          border: 'none', borderRadius: '10px', padding: '0.65rem 1.6rem',
          fontFamily: 'inherit', fontSize: '0.9rem', fontWeight: 600,
          cursor: selected.size === 0 ? 'default' : 'pointer',
          transition: 'background 0.18s, color 0.18s',
        }}
      >
        {selected.size > 1 ? `Set up ${selected.size} spaces` : 'Continue'}
      </button>

      <button
        onClick={onSkip}
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem', padding: '0.5rem 1rem',
          marginTop: '-0.5rem',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
      >
        Skip for now
      </button>
    </div>,
    document.body,
  );
}
