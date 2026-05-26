import { useState, useRef, useEffect, useCallback, type ElementType } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import type { Theme } from '../../lib/types';

export interface Choice {
  id: string;
  label: string;
  /** Optional accent dot colour shown next to the label. */
  color?: string;
  /** Optional leading icon. */
  icon?: ElementType;
}

interface Props {
  t: Theme;
  value: string;
  onChange: (id: string) => void;
  options: Choice[];
  placeholder?: string;
  size?: 'sm' | 'md';
  align?: 'left' | 'right';
  minWidth?: number | string;
}

const MAX_POPOVER_H = 280;

/**
 * Drop-in <select> replacement that opens a themed listbox popover. The
 * list is rendered via a React Portal so it escapes any parent's
 * overflow:hidden (widget cards, modal bodies, etc.) and always scrolls
 * cleanly when there are many options.
 */
export default function ChoicePicker({
  t, value, onChange, options, placeholder = 'pick…',
  size = 'md', align = 'left', minWidth,
}: Props) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const current = options.find(o => o.id === value);

  const reposition = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const popWidth = Math.max(r.width, 160);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = align === 'right' ? r.right - popWidth : r.left;
    let top = r.bottom + 6;
    if (left + popWidth > vw - 8) left = vw - popWidth - 8;
    if (left < 8) left = 8;
    // Flip above if there's no room below
    const projected = top + MAX_POPOVER_H;
    if (projected > vh - 8 && r.top > vh - r.bottom) {
      top = Math.max(8, r.top - MAX_POPOVER_H - 6);
    }
    setCoords({ top, left, width: popWidth });
  }, [align]);

  useEffect(() => {
    if (!open) return;
    reposition();
    const onScrollResize = () => reposition();
    window.addEventListener('scroll', onScrollResize, true);
    window.addEventListener('resize', onScrollResize);
    return () => {
      window.removeEventListener('scroll', onScrollResize, true);
      window.removeEventListener('resize', onScrollResize);
    };
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (popRef.current?.contains(e.target as Node)) return;
      if (btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const triggerPadding = size === 'sm' ? '0.34rem 0.55rem' : '0.45rem 0.7rem';
  const triggerFont = size === 'sm' ? '0.78rem' : '0.82rem';
  const Icon = current?.icon;

  const popover = open && coords ? (
    <div
      ref={popRef}
      role="listbox"
      style={{
        position: 'fixed', top: coords.top, left: coords.left,
        width: `${coords.width}px`,
        background: t.panel, border: `1px solid ${t.borderStrong}`,
        borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        padding: '0.3rem', zIndex: 10000,
        fontFamily: 'var(--app-font)',
        maxHeight: `${MAX_POPOVER_H}px`, overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
      onMouseDown={e => e.stopPropagation()}
    >
      {options.map(opt => {
        const selected = opt.id === value;
        const OptIcon = opt.icon;
        return (
          <button
            key={opt.id}
            role="option"
            aria-selected={selected}
            onClick={() => { onChange(opt.id); setOpen(false); }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '0.55rem',
              padding: '0.5rem 0.55rem',
              background: selected ? t.bgAlt : 'transparent',
              border: 'none', borderRadius: '6px',
              color: t.text, fontFamily: 'inherit', fontSize: '0.82rem',
              cursor: 'pointer', textAlign: 'left',
            }}
            onMouseEnter={e => { if (!selected) e.currentTarget.style.background = t.bgAlt; }}
            onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
          >
            {opt.color && (
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: opt.color, flexShrink: 0,
              }} />
            )}
            {OptIcon && <OptIcon size={14} strokeWidth={1.6} color={t.textMuted} style={{ flexShrink: 0 }} />}
            <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {opt.label}
            </span>
            {selected && <Check size={13} strokeWidth={1.8} color={t.doneAccent} />}
          </button>
        );
      })}
    </div>
  ) : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          background: t.input, border: `1px solid ${open ? t.borderStrong : t.border}`,
          borderRadius: '8px', padding: triggerPadding,
          color: current ? t.text : t.textDim,
          fontSize: triggerFont, fontFamily: 'inherit',
          cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '0.55rem',
          transition: 'border-color 0.12s',
          minWidth: minWidth ?? 0,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
          {current?.color && (
            <span style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: current.color, flexShrink: 0,
            }} />
          )}
          {Icon && <Icon size={13} strokeWidth={1.6} color={t.textMuted} style={{ flexShrink: 0 }} />}
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {current ? current.label : placeholder}
          </span>
        </span>
        <ChevronDown size={13} strokeWidth={1.6} color={t.textMuted} style={{
          flexShrink: 0,
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.15s ease',
        }} />
      </button>
      {popover && createPortal(popover, document.body)}
    </>
  );
}
