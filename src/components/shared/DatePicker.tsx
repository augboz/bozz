import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  addMonths, subMonths, format, isSameDay, isSameMonth,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isToday,
} from 'date-fns';
import type { Theme } from '../../lib/types';

interface Props {
  t: Theme;
  value: number | null;            // unix ms (local midnight) or null
  onChange: (next: number | null) => void;
  placeholder?: string;
  allowClear?: boolean;
  size?: 'sm' | 'md';
  align?: 'left' | 'right';
  /** Optional minimum date (e.g. today only-future). */
  min?: number;
  disabled?: boolean;
}

const POPOVER_W = 266;
const POPOVER_H = 320;

/**
 * Calendar-popover date picker. The calendar is rendered via a React
 * Portal so it can escape parent overflow:hidden / clipped widgets and
 * always sit above everything else.
 */
export default function DatePicker({
  t, value, onChange, placeholder = 'pick date',
  allowClear, size = 'md', align = 'left', min, disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<Date>(value ? new Date(value) : new Date());
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (value) setMonth(new Date(value)); }, [value]);

  // Compute the portal popover's position from the trigger's rect.
  const reposition = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Default: directly below, aligned with the trigger's chosen edge.
    let left = align === 'right' ? r.right - POPOVER_W : r.left;
    let top = r.bottom + 6;
    // Keep inside viewport.
    if (left + POPOVER_W > vw - 8) left = vw - POPOVER_W - 8;
    if (left < 8) left = 8;
    if (top + POPOVER_H > vh - 8) top = Math.max(8, r.top - POPOVER_H - 6);
    setCoords({ top, left });
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

  // Outside click + Escape
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

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end:   endOfWeek(endOfMonth(month),   { weekStartsOn: 1 }),
  });

  const pick = (d: Date) => {
    const v = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    if (min && v < min) return;
    onChange(v);
    setOpen(false);
  };

  const triggerPadding = size === 'sm' ? '0.34rem 0.55rem' : '0.45rem 0.7rem';
  const triggerFont = size === 'sm' ? '0.78rem' : '0.82rem';

  const popover = open && coords ? (
    <div
      ref={popRef}
      role="dialog"
      style={{
        position: 'fixed', top: coords.top, left: coords.left,
        background: t.panel, border: `1px solid ${t.borderStrong}`,
        borderRadius: '12px', boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
        padding: '0.8rem', zIndex: 10000, width: `${POPOVER_W}px`,
        fontFamily: 'var(--app-font)',
      }}
      onMouseDown={e => e.stopPropagation()}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
        <button onClick={() => setMonth(m => subMonths(m, 1))} style={navBtn(t)} aria-label="Previous month">
          <ChevronLeft size={14} strokeWidth={1.6} />
        </button>
        <div style={{ fontSize: '0.85rem', color: t.text, fontWeight: 500 }}>
          {format(month, 'MMMM yyyy')}
        </div>
        <button onClick={() => setMonth(m => addMonths(m, 1))} style={navBtn(t)} aria-label="Next month">
          <ChevronRight size={14} strokeWidth={1.6} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '0.2rem' }}>
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
          <div key={d} style={{
            fontSize: '0.6rem', textAlign: 'center', color: t.textDim,
            letterSpacing: '0.08em', textTransform: 'uppercase', padding: '0.25rem 0',
          }}>{d}</div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {days.map(d => {
          const inMonth  = isSameMonth(d, month);
          const selected = value != null && isSameDay(d, new Date(value));
          const today    = isToday(d);
          const blocked  = min != null && d.getTime() < min;
          return (
            <button
              key={d.toISOString()}
              onClick={() => pick(d)}
              disabled={blocked}
              style={{
                height: '32px', borderRadius: '6px',
                background: selected ? t.doingAccent : (today ? t.bgAlt : 'transparent'),
                color: selected ? '#fff' : (inMonth ? t.text : t.textDim),
                border: today && !selected ? `1px solid ${t.borderStrong}` : 'none',
                cursor: blocked ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', fontSize: '0.78rem',
                fontWeight: today && !selected ? 500 : 400,
                opacity: blocked ? 0.3 : 1,
                padding: 0,
              }}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>

      <div style={{
        display: 'flex', justifyContent: 'space-between',
        marginTop: '0.6rem', borderTop: `1px solid ${t.border}`, paddingTop: '0.55rem',
      }}>
        <button onClick={() => pick(new Date())} style={textBtn(t)}>Today</button>
        {allowClear && value != null && (
          <button onClick={() => { onChange(null); setOpen(false); }} style={{ ...textBtn(t), color: t.alert }}>
            Clear
          </button>
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{
          background: t.input, border: `1px solid ${open ? t.borderStrong : t.border}`,
          borderRadius: '8px', padding: triggerPadding,
          color: value ? t.text : t.textDim,
          fontSize: triggerFont, fontFamily: 'inherit',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
          transition: 'border-color 0.12s',
          minWidth: 0,
        }}
      >
        <Calendar size={13} strokeWidth={1.6} color={t.textMuted} style={{ flexShrink: 0 }} />
        <span style={{ whiteSpace: 'nowrap' }}>
          {value ? format(new Date(value), 'd MMM yyyy') : placeholder}
        </span>
        {value != null && allowClear && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onChange(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onChange(null); } }}
            style={{ display: 'inline-flex', marginLeft: '0.15rem', color: t.textDim, cursor: 'pointer' }}
          >
            <X size={11} strokeWidth={1.6} />
          </span>
        )}
      </button>
      {popover && createPortal(popover, document.body)}
    </>
  );
}

const navBtn = (t: Theme): React.CSSProperties => ({
  background: 'transparent', border: 'none', color: t.textMuted,
  cursor: 'pointer', padding: '0.3rem', borderRadius: '5px',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
});
const textBtn = (t: Theme): React.CSSProperties => ({
  background: 'transparent', border: 'none', color: t.textMuted,
  cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.74rem',
  padding: '0.25rem 0.5rem',
});
