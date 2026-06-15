import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import {
  addMonths, subMonths, format, isSameDay, isSameMonth,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isToday,
} from 'date-fns';
import type { Theme } from '../../lib/types';

interface Props {
  t: Theme;
  value: number | null;            // unix ms or null
  onChange: (next: number | null) => void;
  placeholder?: string;
  allowClear?: boolean;
  showTime?: boolean;
  size?: 'sm' | 'md';
  align?: 'left' | 'right';
  min?: number;
  disabled?: boolean;
  defaultOpen?: boolean;
  onClose?: () => void;
}

const POPOVER_W = 266;
const POPOVER_H_DATE = 320;
const POPOVER_H_TIME = 390;

export default function DatePicker({
  t, value, onChange, placeholder = 'pick date',
  allowClear, showTime, size = 'md', align = 'left',
  min, disabled, defaultOpen, onClose,
}: Props) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [month, setMonth] = useState<Date>(value ? new Date(value) : new Date());
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  // Time state (extracted from value when it has time, otherwise defaults)
  const initTime = (v: number | null) => {
    if (!v) return { hour: '12', minute: '00', period: 'AM' as const };
    const d = new Date(v);
    let h = d.getHours();
    const period = h >= 12 ? 'PM' : 'AM';
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return { hour: String(h).padStart(2, '0'), minute: String(d.getMinutes()).padStart(2, '0'), period };
  };
  const [timeState, setTimeState] = useState(() => initTime(value));

  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (value) setMonth(new Date(value)); }, [value]);

  const close = useCallback(() => {
    setOpen(false);
    onClose?.();
  }, [onClose]);

  const reposition = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const popH = showTime ? POPOVER_H_TIME : POPOVER_H_DATE;
    let left = align === 'right' ? r.right - POPOVER_W : r.left;
    let top = r.bottom + 6;
    if (left + POPOVER_W > vw - 8) left = vw - POPOVER_W - 8;
    if (left < 8) left = 8;
    if (top + popH > vh - 8) top = Math.max(8, r.top - popH - 6);
    setCoords({ top, left });
  }, [align, showTime]);

  useEffect(() => {
    if (!open) return;
    reposition();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (popRef.current?.contains(e.target as Node)) return;
      if (btnRef.current?.contains(e.target as Node)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end:   endOfWeek(endOfMonth(month),   { weekStartsOn: 1 }),
  });

  const buildTimestamp = (d: Date, ts: typeof timeState): number => {
    const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (showTime) {
      let h = parseInt(ts.hour, 10);
      if (ts.period === 'PM' && h < 12) h += 12;
      if (ts.period === 'AM' && h === 12) h = 0;
      date.setHours(h, parseInt(ts.minute, 10), 0, 0);
    }
    return date.getTime();
  };

  const pick = (d: Date) => {
    const v = buildTimestamp(d, timeState);
    if (min && v < min) return;
    onChange(v);
    if (!showTime) close();
  };

  const applyTime = () => {
    if (!value) return;
    onChange(buildTimestamp(new Date(value), timeState));
    close();
  };

  const triggerPad = size === 'sm' ? '0.34rem 0.55rem' : '0.45rem 0.7rem';
  const triggerFontSize = size === 'sm' ? '0.78rem' : '0.82rem';

  const selStyle = (w: string): React.CSSProperties => ({
    background: t.bgAlt, border: `1px solid ${t.border}`,
    borderRadius: '7px', padding: '0.28rem 0.4rem',
    color: t.text, fontSize: '0.8rem', fontFamily: 'inherit',
    cursor: 'pointer', width: w, outline: 'none',
  });

  const popover = open && coords ? (
    <div
      ref={popRef}
      role="dialog"
      style={{
        position: 'fixed', top: coords.top, left: coords.left,
        background: t.panel, border: `1px solid ${t.borderStrong}`,
        borderRadius: '14px',
        boxShadow: '0 12px 48px rgba(0,0,0,0.45), 0 3px 10px rgba(0,0,0,0.28), 0 0 0 0.5px rgba(255,255,255,0.06)',
        padding: '0.8rem', zIndex: 10000, width: `${POPOVER_W}px`,
        fontFamily: 'var(--app-font)',
      }}
      onMouseDown={e => e.stopPropagation()}
    >
      {/* Month nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
        <button onClick={() => setMonth(m => subMonths(m, 1))} style={navBtnStyle(t)}>
          <ChevronLeft size={14} strokeWidth={1.6} />
        </button>
        <div style={{ fontSize: '0.85rem', color: t.text, fontWeight: 500 }}>
          {format(month, 'MMMM yyyy')}
        </div>
        <button onClick={() => setMonth(m => addMonths(m, 1))} style={navBtnStyle(t)}>
          <ChevronRight size={14} strokeWidth={1.6} />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '0.2rem' }}>
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
          <div key={d} style={{ fontSize: '0.6rem', textAlign: 'center', color: t.textDim, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '0.25rem 0' }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {days.map(d => {
          const inMonth  = isSameMonth(d, month);
          const selected = value != null && isSameDay(d, new Date(value));
          const today    = isToday(d);
          const blocked  = min != null && d.getTime() < min;
          return (
            <button key={d.toISOString()} onClick={() => pick(d)} disabled={blocked} style={{
              height: '32px', borderRadius: '7px',
              background: selected ? t.doingAccent : (today ? t.bgAlt : 'transparent'),
              color: selected ? '#fff' : (inMonth ? t.text : t.textDim),
              border: today && !selected ? `1px solid ${t.borderStrong}` : 'none',
              cursor: blocked ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', fontSize: '0.78rem',
              fontWeight: today && !selected ? 500 : 400,
              opacity: blocked ? 0.3 : (!inMonth ? 0.4 : 1),
              padding: 0,
            }}>
              {d.getDate()}
            </button>
          );
        })}
      </div>

      {/* Time picker row */}
      {showTime && (
        <div style={{ marginTop: '0.75rem', paddingTop: '0.65rem', borderTop: `1px solid ${t.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
            <Clock size={12} strokeWidth={1.6} color={t.textDim} />
            <span style={{ fontSize: '0.68rem', color: t.textDim, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Time</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <select value={timeState.hour} onChange={e => setTimeState(s => ({ ...s, hour: e.target.value }))} style={selStyle('3.8rem')}>
              {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(h => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
            <span style={{ color: t.textMuted, fontSize: '0.9rem', fontWeight: 300 }}>:</span>
            <select value={timeState.minute} onChange={e => setTimeState(s => ({ ...s, minute: e.target.value }))} style={selStyle('3.8rem')}>
              {['00', '15', '30', '45'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={timeState.period} onChange={e => setTimeState(s => ({ ...s, period: e.target.value as 'AM' | 'PM' }))} style={selStyle('4rem')}>
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
            {value && (
              <button onClick={applyTime} style={{ marginLeft: 'auto', background: t.text, color: t.bg, border: 'none', borderRadius: '7px', padding: '0.28rem 0.65rem', fontSize: '0.75rem', fontFamily: 'inherit', cursor: 'pointer', fontWeight: 500 }}>
                Set
              </button>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.6rem', borderTop: `1px solid ${t.border}`, paddingTop: '0.55rem' }}>
        <button onClick={() => pick(new Date())} style={textBtnStyle(t)}>Today</button>
        {allowClear && value != null && (
          <button onClick={() => { onChange(null); close(); }} style={{ ...textBtnStyle(t), color: t.alert }}>
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
          borderRadius: '8px', padding: triggerPad,
          color: value ? t.text : t.textDim,
          fontSize: triggerFontSize, fontFamily: 'inherit',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
          transition: 'border-color 0.12s', minWidth: 0,
        }}
      >
        <Calendar size={13} strokeWidth={1.6} color={t.textMuted} style={{ flexShrink: 0 }} />
        <span style={{ whiteSpace: 'nowrap' }}>
          {value
            ? showTime
              ? format(new Date(value), 'd MMM yyyy, h:mm a')
              : format(new Date(value), 'd MMM yyyy')
            : placeholder}
        </span>
      </button>
      {popover && createPortal(popover, document.body)}
    </>
  );
}

const navBtnStyle = (t: Theme): React.CSSProperties => ({
  background: 'transparent', border: 'none', color: t.textMuted,
  cursor: 'pointer', padding: '0.3rem', borderRadius: '6px',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
});

const textBtnStyle = (t: Theme): React.CSSProperties => ({
  background: 'transparent', border: 'none', color: t.textMuted,
  cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.74rem',
  padding: '0.25rem 0.5rem',
});
