import React, { useState } from 'react';
import type { ListItem, Theme } from '../../lib/types';
import { StatusPill } from './StatusToggle';

interface WidgetProps {
  children: React.ReactNode; t: Theme; accent: string;
  onClick?: () => void; gridSpan?: number; compact?: boolean;
}

export function Widget({ children, t, accent, onClick, gridSpan = 1, compact = false }: WidgetProps) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: t.panel,
        // Border width + radius are driven by user appearance prefs via
        // CSS variables set in applyAppearanceVars. Falls back to sensible
        // defaults if no var is set yet (e.g. during initial paint).
        border: `var(--widget-border, 1px) solid ${hover && onClick ? t.borderStrong : t.border}`,
        borderRadius: 'var(--widget-radius, 14px)',
        padding: compact ? '1.1rem 1.5rem' : '1.5rem 1.75rem',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        gridColumn: `span ${gridSpan}`,
        position: 'relative',
        overflow: 'hidden',
        // Fill the grid cell so resizing scales the card itself instead of
        // leaving empty space inside an over-sized cell.
        height: '100%',
        boxSizing: 'border-box',
        transform: hover && onClick ? 'translateY(-1px)' : 'translateY(0)',
      }}
    >
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '2px', height: '100%',
        background: accent, opacity: hover ? 1 : 0.6, transition: 'opacity 0.2s',
      }} />
      {children}
    </div>
  );
}

export function WidgetHeader({ label, accent, t, icon: Icon }: { label: string; accent: string; t: Theme; icon: React.ElementType }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      {Icon && <Icon size={15} strokeWidth={1.5} color={accent} />}
      <span style={{ fontSize: '0.82rem', color: t.textMuted, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 400 }}>
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
      <div style={{ fontSize: '0.65rem', color: t.textMuted, letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '0.3rem' }}>{label}</div>
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

export function EmptyWidget({ text, t }: { text: string; t: Theme }) {
  return (
    <div style={{ marginTop: '1.25rem', padding: '0.75rem 0', fontSize: '0.85rem', color: t.textDim, fontStyle: 'italic' }}>
      {text}
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
