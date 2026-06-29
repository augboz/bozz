import React, { useState } from 'react';
import type { ListItem, Theme } from '../../lib/types';
import { StatusPill } from './StatusToggle';

interface WidgetProps {
  children: React.ReactNode; t: Theme; accent: string;
  onClick?: () => void; gridSpan?: number; compact?: boolean; noPadding?: boolean;
}

export function Widget({ children, t, accent, onClick, gridSpan = 1, compact = false, noPadding = false }: WidgetProps) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: `var(--w-bg, linear-gradient(160deg, var(--glass-bg-top, var(--glass-bg, ${t.panel})) 0%, var(--glass-bg, ${t.panel}) 100%))`,
        backdropFilter: 'var(--glass-blur, none)',
        WebkitBackdropFilter: 'var(--glass-blur, none)',
        color: `var(--w-text, ${t.text})`,
        border: `var(--widget-border, 0.5px) solid ${hover ? 'var(--glass-border-strong, ' + t.borderStrong + ')' : 'var(--glass-border, ' + t.border + ')'}`,
        borderRadius: 'var(--widget-radius, 20px)',
        boxShadow: hover
          ? 'var(--widget-shadow-hover, 0 2px 0 rgba(255,255,255,0.10) inset, 0 20px 60px rgba(0,0,0,0.65), 0 4px 16px rgba(0,0,0,0.35))'
          : 'var(--widget-shadow, none)',
        padding: noPadding ? 0 : compact ? '1.1rem 1.5rem' : '1.5rem 1.75rem',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.25s var(--ease, cubic-bezier(0.16,1,0.3,1)), border-color 0.2s, box-shadow 0.25s var(--ease, cubic-bezier(0.16,1,0.3,1))',
        gridColumn: `span ${gridSpan}`,
        position: 'relative',
        overflow: 'hidden',
        height: '100%',
        boxSizing: 'border-box',
        transform: hover ? 'translateY(-3px)' : 'translateY(0)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Accent line — hidden for no-padding (photo) widgets */}
      {!noPadding && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '2px', height: '100%',
          background: `var(--w-accent, ${accent})`,
          opacity: hover ? 1 : 0.55,
          transition: `opacity 0.3s var(--ease, cubic-bezier(0.16,1,0.3,1))`,
          display: 'var(--w-line, block)' as React.CSSProperties['display'],
        }} />
      )}
      {children}
    </div>
  );
}

export function WidgetHeader({ label, accent: _accent, t, icon: Icon }: { label: string; accent: string; t: Theme; icon: React.ElementType }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
      {Icon && <Icon size={11} strokeWidth={1.6} color={t.textDim} style={{ flexShrink: 0 }} />}
      <span style={{
        fontSize: '0.65rem', color: 'var(--w-text, ' + t.textMuted + ')',
        letterSpacing: '0.07em', fontWeight: 500,
        textTransform: 'uppercase' as const,
      }}>
        {label}
      </span>
    </div>
  );
}

export function Stat({ label, value, color, t }: { label: string; value: number; color: string; t: Theme }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
      <span style={{ fontSize: '1.1rem', fontWeight: 300, color }}>{value}</span>
      <span style={{ fontSize: '0.7rem', color: t.textMuted, letterSpacing: '0.05em' }}>{label}</span>
    </div>
  );
}

export function MiniStat({ label, value, color, t }: { label: string; value: number; color: string; t: Theme }) {
  return (
    <div style={{ textAlign: 'center', flex: 1 }}>
      <div style={{ fontSize: '1.35rem', fontWeight: 200, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '0.65rem', color: t.textMuted, letterSpacing: '0em', marginTop: '0.3rem' }}>{label}</div>
    </div>
  );
}

export function Divider({ t }: { t: Theme }) {
  return <div style={{ width: '1px', height: '28px', background: t.border }} />;
}

export function ProgressBar({ doing, todo: _todo, done, total, t }: { doing: number; todo: number; done: number; total: number; t: Theme }) {
  if (total === 0) return null;
  const doingPct = (doing / total) * 100;
  const donePct = (done / total) * 100;
  return (
    <div style={{ marginTop: '1rem' }}>
      <div style={{ height: '4px', background: t.bgAlt, borderRadius: '999px', overflow: 'hidden', display: 'flex' }}>
        <div style={{ width: `${donePct}%`, background: t.doneAccent, transition: 'width 0.4s' }} />
        <div style={{ width: `${doingPct}%`, background: t.doingAccent, transition: 'width 0.4s' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.7rem', color: t.textMuted }}>
        <span>{done}/{total} done</span>
        {doing > 0 && <span style={{ color: t.doingAccent }}>{doing} in progress</span>}
      </div>
    </div>
  );
}

export function EmptyWidget({ text, t, actionLabel, onAction }: {
  text: string; t: Theme;
  /** Optional inline action so an empty widget points at the next step instead
   *  of being a dead end (matches the "Open calendar ->" pattern in Today). */
  actionLabel?: string; onAction?: () => void;
}) {
  return (
    <div style={{ marginTop: '1.25rem', padding: '0.75rem 0', fontSize: '0.8rem', color: t.textDim }}>
      {text}
      {actionLabel && onAction && (
        <>
          {' '}
          <button
            onClick={onAction}
            style={{
              background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
              color: t.doingAccent, fontFamily: 'inherit', fontSize: '0.8rem',
            }}
          >
            {actionLabel}
          </button>
        </>
      )}
    </div>
  );
}

export function NextItemDisplay({ item, t, remaining }: { item: ListItem; t: Theme; remaining: number }) {
  return (
    <div style={{ marginTop: '0.85rem' }}>
      <StatusPill status={item.status} t={t} />
      <div style={{ fontSize: '1rem', color: t.text, marginTop: '0.5rem', lineHeight: 1.35 }}>{item.text}</div>
      {remaining > 0 && (
        <div style={{ fontSize: '0.7rem', color: t.textDim, marginTop: '0.85rem', letterSpacing: '0.05em' }}>
          +{remaining} more pending
        </div>
      )}
    </div>
  );
}
