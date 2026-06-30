/**
 * SnoozeControl — the subtle one-tap "defer this" control on every priority +
 * deadline row (Round 7, P-A). A small clock icon opens a tiny portal menu with
 * Tomorrow / This weekend / Next week / Clear. Picking one rewrites the topic
 * item's deadline through onTopicChange (see lib/snooze.ts).
 *
 * Rendered ONLY for real, editable topic items — callers gate on isSnoozeable()
 * so calendar-derived deadline entries never show it.
 *
 * The menu is portalled to document.body (like ChoicePicker) so it escapes the
 * widget card's overflow:hidden and floats above the grid.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Clock } from 'lucide-react';
import type { Theme, Topic } from '../../lib/types';
import { snoozeItem, SNOOZE_LABELS, type SnoozeOption } from '../../lib/snooze';

const ORDER: SnoozeOption[] = ['tomorrow', 'weekend', 'nextWeek', 'clear'];
const MENU_H = 180;

export default function SnoozeControl({
  t, topics, topicId, itemId, onTopicChange, onSnoozed, size = 12, hasDeadline = true,
}: {
  t: Theme;
  topics: Topic[] | undefined;
  topicId: string;
  itemId: number;
  onTopicChange: ((next: Topic) => void) | undefined;
  /** Fired after a successful reschedule, with the chosen option. */
  onSnoozed?: (option: SnoozeOption) => void;
  /** Icon size in px. */
  size?: number;
  /** When false, the "Clear deadline" row is hidden (nothing to clear). */
  hasDeadline?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const options = hasDeadline ? ORDER : ORDER.filter(o => o !== 'clear');

  const reposition = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const width = 168;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = r.right - width;
    let top = r.bottom + 5;
    if (left < 8) left = 8;
    if (left + width > vw - 8) left = vw - width - 8;
    if (top + MENU_H > vh - 8 && r.top > vh - r.bottom) top = Math.max(8, r.top - MENU_H - 5);
    setCoords({ top, left });
  }, []);

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

  const pick = (option: SnoozeOption) => {
    setOpen(false);
    const ok = snoozeItem(topics, topicId, itemId, option, onTopicChange);
    if (ok) onSnoozed?.(option);
  };

  const menu = open && coords ? (
    <div
      ref={popRef}
      role="menu"
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
      style={{
        position: 'fixed', top: coords.top, left: coords.left, width: '168px',
        background: t.panel, border: `1px solid ${t.borderStrong}`,
        borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        padding: '0.3rem', zIndex: 10000, fontFamily: 'var(--app-font)',
      }}
    >
      <div style={{
        fontSize: '0.56rem', letterSpacing: '0.08em', textTransform: 'uppercase',
        color: t.textDim, padding: '0.25rem 0.45rem 0.3rem',
      }}>
        Snooze until
      </div>
      {options.map(option => (
        <button
          key={option}
          role="menuitem"
          onClick={() => pick(option)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center',
            padding: '0.45rem 0.5rem',
            background: 'transparent', border: 'none', borderRadius: '6px',
            color: option === 'clear' ? t.textMuted : t.text,
            fontFamily: 'inherit', fontSize: '0.8rem', cursor: 'pointer', textAlign: 'left',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = t.bgAlt; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          {SNOOZE_LABELS[option]}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        title="Snooze / defer"
        aria-label="Snooze"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', cursor: 'pointer',
          padding: '0.15rem', flexShrink: 0, borderRadius: '5px',
          color: open ? t.text : t.textDim, lineHeight: 0,
          transition: 'color 0.12s',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = t.textMuted; }}
        onMouseLeave={e => { e.currentTarget.style.color = open ? t.text : t.textDim; }}
      >
        <Clock size={size} strokeWidth={2} />
      </button>
      {menu && createPortal(menu, document.body)}
    </>
  );
}
