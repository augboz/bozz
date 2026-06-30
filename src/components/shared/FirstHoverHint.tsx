/**
 * FirstHoverHints — a single global controller that shows a small description
 * bubble the FIRST time a user hovers a key control, then never again. It keys
 * off the `data-onb` markers already on those controls (no per-button wrapping),
 * so adding a hint is just adding an entry to HINTS below. Seen keys persist.
 *
 * Mount once near the app root. Suppressed while a walkthrough spotlight is
 * active (Dashboard sets document.body.dataset.walkActive).
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getItem, setItem } from '../../lib/storage';

// data-onb value → hint text. Distinguishes e.g. the sidebar Edit from a page Edit.
const HINTS: Record<string, string> = {
  'edit-nav':         'Edit your sidebar: reorder, hide, or add topics & folders.',
  'home-edit':        'Edit your home: add, remove or rearrange widgets.',
  'topic-edit':       'Edit this page: add widgets, set a background, or rearrange.',
  'add-widget':       'Add a widget: tasks, calendar, notes, music and more.',
  'topic-add-widget': 'Add a widget: tasks, calendar, notes, music and more.',
  'nav-add-menu':     'Add a topic: an area of your life like Uni, Work or your CV.',
  'quick-add':        'Capture any thought fast (or press Ctrl+B), sort it later.',
  'topic-bg-photo':   'Set a background photo for this page.',
};

export default function FirstHoverHints() {
  const seen = useRef<Set<string> | null>(null);
  const timer = useRef<number | null>(null);
  const [bubble, setBubble] = useState<{ text: string; rect: DOMRect } | null>(null);

  useEffect(() => {
    let alive = true;
    getItem('hoverHintsSeen')
      .then(r => { if (alive) { try { seen.current = new Set(r?.value ? (JSON.parse(r.value) as string[]) : []); } catch { seen.current = new Set(); } } })
      .catch(() => { seen.current = new Set(); });

    const onOver = (e: MouseEvent) => {
      if (!seen.current) return;
      if (document.body.dataset.walkActive) return; // don't clash with a walkthrough
      const el = (e.target as HTMLElement)?.closest?.('[data-onb]') as HTMLElement | null;
      if (!el) return;
      const key = el.getAttribute('data-onb') || '';
      const text = HINTS[key];
      if (!text || seen.current.has(key)) return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      seen.current.add(key);
      void setItem('hoverHintsSeen', JSON.stringify([...seen.current]));
      setBubble({ text, rect });
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setBubble(null), 5000);
    };

    document.addEventListener('mouseover', onOver);
    return () => {
      alive = false;
      document.removeEventListener('mouseover', onOver);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  if (!bubble) return null;
  const W = 230;
  const left = Math.min(Math.max(8, bubble.rect.left), window.innerWidth - W - 8);
  const below = bubble.rect.bottom + 8;
  const placeAbove = below > window.innerHeight - 70;
  return createPortal(
    <div role="status" style={{
      position: 'fixed', zIndex: 10050, pointerEvents: 'none',
      left,
      top: placeAbove ? bubble.rect.top - 8 : below,
      transform: placeAbove ? 'translateY(-100%)' : 'none',
      maxWidth: `${W}px`,
      background: 'rgba(12,12,18,0.97)', color: 'rgba(255,255,255,0.92)',
      border: '1px solid rgba(94,196,216,0.45)', borderRadius: '10px',
      padding: '0.5rem 0.7rem', fontSize: '0.74rem', lineHeight: 1.45, fontFamily: 'inherit',
      boxShadow: '0 10px 30px rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
    }}>
      {bubble.text}
    </div>,
    document.body,
  );
}
