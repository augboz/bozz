import { useEffect } from 'react';
import type { RefObject } from 'react';

/**
 * Accessibility helper for modal overlays. While mounted it:
 *  - moves focus into the overlay on open,
 *  - traps Tab / Shift+Tab inside the overlay (focus can't escape to the page
 *    behind it),
 *  - closes on Escape via a document-level listener (works even when focus has
 *    drifted onto the page body, which per-element onKeyDown handlers miss),
 *  - restores focus to whatever was focused before the overlay opened, on close.
 *
 * Pair with {@link dialogProps} so the overlay also announces as a dialog.
 *
 * Usage:
 *   const ref = useRef<HTMLDivElement>(null);
 *   useFocusTrap(ref, onClose);
 *   return <div ref={ref} {...dialogProps('Edit topic')}>…</div>;
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  onClose?: () => void,
  options: { closeOnEscape?: boolean } = {},
): void {
  const { closeOnEscape = true } = options;

  useEffect(() => {
    const node = ref.current;
    const prevFocused = document.activeElement as HTMLElement | null;

    const focusable = (): HTMLElement[] => {
      if (!node) return [];
      return Array.from(
        node.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(el => el.offsetParent !== null || el === document.activeElement);
    };

    // Move focus inside on open (only if it isn't already there).
    const initial = focusable();
    if (node && initial.length && !node.contains(document.activeElement)) {
      initial[0].focus();
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key !== 'Tab' || !node) return;
      const f = focusable();
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !node.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !node.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      if (prevFocused && typeof prevFocused.focus === 'function') {
        prevFocused.focus();
      }
    };
  }, [ref, onClose, closeOnEscape]);
}

/** Spread onto a modal's container so screen readers announce it as a dialog. */
export function dialogProps(label?: string): {
  role: 'dialog';
  'aria-modal': true;
  'aria-label'?: string;
} {
  return { role: 'dialog', 'aria-modal': true, ...(label ? { 'aria-label': label } : {}) };
}
