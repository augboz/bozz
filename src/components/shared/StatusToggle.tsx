import React from 'react';
import { Check } from 'lucide-react';
import type { Status, Theme } from '../../lib/types';

export function StatusToggle({ status, onClick, t, size = 18 }: {
  status: Status; onClick: (s: Status) => void; t: Theme; size?: number;
}) {
  const cycle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next: Status = status === 'todo' ? 'doing' : status === 'doing' ? 'done' : 'todo';
    onClick(next);
  };

  let bg: string, border: string, content: React.ReactNode = null;
  if (status === 'todo') {
    bg = 'transparent'; border = t.todoBorder;
  } else if (status === 'doing') {
    bg = t.doingAccent; border = t.doingAccent;
    content = <div style={{ width: `${size * 0.35}px`, height: `${size * 0.35}px`, borderRadius: '50%', background: t.bg }} />;
  } else {
    bg = t.doneAccent; border = t.doneAccent;
    content = <Check size={size * 0.6} strokeWidth={3} color={t.bg} />;
  }

  return (
    <button
      onClick={cycle}
      title={status}
      aria-label={`Status: ${status}. Click to cycle.`}
      style={{
        width: `${size}px`, height: `${size}px`, borderRadius: '50%', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 0, flexShrink: 0, background: bg, border: `1.5px solid ${border}`,
        transition: 'all 0.15s ease',
        boxShadow: status === 'doing' ? `0 0 0 3px ${t.doingBg}` : status === 'done' ? `0 0 0 3px ${t.doneBg}` : 'none',
      }}
    >
      {content}
    </button>
  );
}

export function StatusPill({ status, t }: { status: Status; t: Theme }) {
  if (status === 'doing') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
        fontSize: '0.65rem', color: t.doingAccent, letterSpacing: '0.12em',
        textTransform: 'uppercase', border: `1px solid ${t.doingBorder}`,
        background: t.doingBg, padding: '0.15rem 0.55rem', borderRadius: '999px', fontWeight: 400,
      }}>
        <span style={{
          width: '5px', height: '5px', borderRadius: '50%',
          background: t.doingAccent, display: 'inline-block',
          animation: 'pulse 2s ease-in-out infinite',
        }} />
        doing
      </span>
    );
  }
  return (
    <span style={{
      display: 'inline-flex', fontSize: '0.65rem', color: t.textMuted,
      letterSpacing: '0.12em', textTransform: 'uppercase',
      border: `1px solid ${t.border}`, padding: '0.15rem 0.55rem', borderRadius: '999px',
    }}>
      next up
    </span>
  );
}
