/**
 * WidgetSizeStepper — precise, one-click width/height controls for a grid widget
 * in edit mode. Dragging the resize handle is imprecise; this lets you nail an
 * exact size by tapping +/- (one grid cell per tap) with a live W x H readout.
 * Rendered as a small overlay pill in the home/topic grids' edit overlay.
 */

import { Minus, Plus } from 'lucide-react';
import type { Theme } from '../../lib/types';

export default function WidgetSizeStepper({ t, w, h, maxW, onResize }: {
  t: Theme;
  w: number;
  h: number;
  /** Max width in grid columns (clamps the width +). */
  maxW: number;
  onResize: (w: number, h: number) => void;
}) {
  const group: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: '0.1rem',
    background: t.panel, border: `1px solid ${t.borderStrong}`,
    borderRadius: '7px', padding: '0.05rem 0.15rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
  };
  const btn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 17, height: 17, borderRadius: 4, padding: 0,
    background: 'transparent', border: 'none', color: t.text, cursor: 'pointer',
  };
  const lab: React.CSSProperties = { fontSize: '0.56rem', fontWeight: 700, color: t.textMuted, letterSpacing: '0.03em' };
  const num: React.CSSProperties = { fontSize: '0.62rem', color: t.text, minWidth: 13, textAlign: 'center', fontVariantNumeric: 'tabular-nums' };

  return (
    <div style={{ display: 'inline-flex', gap: '0.2rem' }}>
      <div style={group} title="Width">
        <span style={lab}>W</span>
        <button style={btn} aria-label="Narrower" onClick={() => onResize(w - 1, h)}><Minus size={11} strokeWidth={2.4} /></button>
        <span style={num}>{w}</span>
        <button style={btn} aria-label="Wider" onClick={() => onResize(Math.min(maxW, w + 1), h)}><Plus size={11} strokeWidth={2.4} /></button>
      </div>
      <div style={group} title="Height">
        <span style={lab}>H</span>
        <button style={btn} aria-label="Shorter" onClick={() => onResize(w, h - 1)}><Minus size={11} strokeWidth={2.4} /></button>
        <span style={num}>{h}</span>
        <button style={btn} aria-label="Taller" onClick={() => onResize(w, h + 1)}><Plus size={11} strokeWidth={2.4} /></button>
      </div>
    </div>
  );
}
