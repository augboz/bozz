import React, { useEffect, useMemo, useState } from 'react';
import GridLayout, { WidthProvider } from 'react-grid-layout/legacy';
import type { Layout, LayoutItem } from 'react-grid-layout/legacy';
import { Pencil, Plus, X, Check } from 'lucide-react';
import type { HomeWidgetItem, Theme } from '../../lib/types';
import type { WidgetCtx } from '../widgets/context';
import { WIDGET_REGISTRY, WIDGET_LIST } from '../widgets/registry';
import { isMobileViewport } from '../../lib/platform';

const Grid = WidthProvider(GridLayout);
const COLS = 12;
const ROW_H = 64;

interface HomeViewProps {
  items: HomeWidgetItem[];
  setItems: React.Dispatch<React.SetStateAction<HomeWidgetItem[]>>;
  ctx: WidgetCtx;
}

function sameLayout(items: HomeWidgetItem[], layout: Layout): boolean {
  if (items.length !== layout.length) return false;
  return items.every(it => {
    const l = layout.find(x => x.i === it.i);
    return l && l.x === it.x && l.y === it.y && l.w === it.w && l.h === it.h;
  });
}

export default function HomeView({ items, setItems, ctx }: HomeViewProps) {
  const { t } = ctx;
  const [editMode, setEditMode] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  // Listen for viewport changes so resizing the desktop window or rotating
  // a phone correctly swaps between mobile-stack and desktop-grid.
  const [isMobile, setIsMobile] = useState<boolean>(() => isMobileViewport());
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 768px)');
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Auto-migrate existing layouts: if Quick Add (or any future essential
  // widget) is registered but missing from the saved layout, append it
  // once. Runs only when items actually change (e.g. after initial load).
  useEffect(() => {
    if (items.length === 0) return;
    if (items.some(i => i.type === 'quickAdd')) return;
    setItems(prev => {
      if (prev.some(i => i.type === 'quickAdd')) return prev;
      const meta = WIDGET_REGISTRY.quickAdd;
      // Place at the bottom, full width
      const maxY = prev.reduce((m, it) => Math.max(m, it.y + it.h), 0);
      return [
        ...prev,
        { i: `quickAdd-${Date.now()}`, type: 'quickAdd', x: 0, y: maxY, w: meta.defaultSize.w, h: meta.defaultSize.h },
      ];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  // Navigation is disabled while editing so dragging a card never navigates.
  const renderCtx = useMemo<WidgetCtx>(
    () => ({ ...ctx, setActiveSection: editMode ? () => {} : ctx.setActiveSection }),
    [ctx, editMode],
  );

  const layout: LayoutItem[] = items.map(({ i, x, y, w, h }) => {
    const meta = WIDGET_REGISTRY[items.find(it => it.i === i)!.type];
    return { i, x, y, w, h, minW: meta.minSize.w, minH: meta.minSize.h };
  });

  const onLayoutChange = (next: Layout) => {
    if (sameLayout(items, next)) return;
    setItems(prev => prev.map(it => {
      const l = next.find(x => x.i === it.i);
      return l ? { ...it, x: l.x, y: l.y, w: l.w, h: l.h } : it;
    }));
  };

  const addWidget = (type: HomeWidgetItem['type']) => {
    const meta = WIDGET_REGISTRY[type];
    const maxY = items.reduce((m, it) => Math.max(m, it.y + it.h), 0);
    setItems(prev => [...prev, {
      i: `${type}-${Date.now()}`, type,
      x: 0, y: maxY, w: meta.defaultSize.w, h: meta.defaultSize.h,
    }]);
  };

  const removeWidget = (i: string) => setItems(prev => prev.filter(it => it.i !== i));

  // ── Mobile stack ───────────────────────────────────────────────────────
  // On phone widths the 12-col grid produces unreadably small widgets, so
  // we fall back to a single-column vertical stack. Edit mode (drag/resize)
  // is hidden — users still get the Add-widget panel and Remove buttons.
  if (isMobile) {
    const sortedItems = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
    return (
      <div style={{ position: 'relative' }}>
        <div style={{
          display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
          gap: '0.5rem', marginBottom: '0.75rem',
        }}>
          {editMode && (
            <button onClick={() => setShowAdd(s => !s)} style={ghostBtn(t)}>
              <Plus size={14} strokeWidth={1.5} /> Add widget
            </button>
          )}
          <button
            onClick={() => { setEditMode(e => !e); setShowAdd(false); }}
            style={ghostBtn(t)}
          >
            {editMode
              ? <><Check size={14} strokeWidth={1.5} /> Done</>
              : <><Pencil size={14} strokeWidth={1.5} /> Edit</>}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {sortedItems.map(it => {
            const meta = WIDGET_REGISTRY[it.type];
            const W = meta.Component;
            return (
              <div key={it.i} style={{ position: 'relative' }}>
                {editMode && (
                  <button
                    onClick={() => removeWidget(it.i)}
                    aria-label={`Remove ${meta.label}`}
                    style={{
                      position: 'absolute', top: '-8px', right: '-8px', zIndex: 5,
                      width: '24px', height: '24px', borderRadius: '50%',
                      background: t.panel, border: `1px solid ${t.borderStrong}`,
                      color: t.textMuted, cursor: 'pointer', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', padding: 0,
                    }}
                  >
                    <X size={12} strokeWidth={2} />
                  </button>
                )}
                <div style={{ pointerEvents: editMode ? 'none' : 'auto' }}>
                  <W ctx={renderCtx} />
                </div>
              </div>
            );
          })}
        </div>

        {showAdd && (
          <AddPanel t={t} onAdd={addWidget} onClose={() => setShowAdd(false)} />
        )}
      </div>
    );
  }

  // ── Desktop grid ───────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
        gap: '0.5rem', marginBottom: '0.75rem',
      }}>
        {editMode && (
          <button
            onClick={() => setShowAdd(s => !s)}
            style={ghostBtn(t)}
          >
            <Plus size={14} strokeWidth={1.5} /> Add widget
          </button>
        )}
        <button
          onClick={() => { setEditMode(e => !e); setShowAdd(false); }}
          title={editMode ? 'Done editing' : 'Edit layout'}
          aria-label={editMode ? 'Done editing' : 'Edit layout'}
          style={ghostBtn(t)}
        >
          {editMode
            ? <><Check size={14} strokeWidth={1.5} /> Done</>
            : <><Pencil size={14} strokeWidth={1.5} /> Edit</>}
        </button>
      </div>

      <Grid
        className="home-grid"
        layout={layout}
        cols={COLS}
        rowHeight={ROW_H}
        margin={[16, 16]}
        containerPadding={[0, 0]}
        isDraggable={editMode}
        isResizable={editMode}
        onLayoutChange={onLayoutChange}
        compactType="vertical"
        draggableCancel=".widget-remove"
      >
        {items.map(it => {
          const meta = WIDGET_REGISTRY[it.type];
          const W = meta.Component;
          return (
            <div key={it.i} style={{
              position: 'relative', height: '100%',
              outline: editMode ? `1px dashed ${t.borderStrong}` : 'none',
              outlineOffset: '2px', borderRadius: '14px',
            }}>
              {editMode && (
                <button
                  className="widget-remove"
                  onClick={() => removeWidget(it.i)}
                  aria-label={`Remove ${meta.label}`}
                  style={{
                    position: 'absolute', top: '-10px', right: '-10px', zIndex: 5,
                    width: '22px', height: '22px', borderRadius: '50%',
                    background: t.panel, border: `1px solid ${t.borderStrong}`,
                    color: t.textMuted, cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', padding: 0,
                  }}
                >
                  <X size={12} strokeWidth={2} />
                </button>
              )}
              <div style={{ height: '100%', pointerEvents: editMode ? 'none' : 'auto' }}>
                <W ctx={renderCtx} />
              </div>
            </div>
          );
        })}
      </Grid>

      {showAdd && (
        <AddPanel t={t} onAdd={addWidget} onClose={() => setShowAdd(false)} />
      )}
    </div>
  );
}

function AddPanel({ t, onAdd, onClose }: {
  t: Theme; onAdd: (type: HomeWidgetItem['type']) => void; onClose: () => void;
}) {
  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0,
      width: 'min(320px, 90vw)', zIndex: 50,
      background: t.panel, borderLeft: `1px solid ${t.border}`,
      padding: '1.5rem', overflowY: 'auto',
      boxShadow: '-8px 0 24px rgba(0,0,0,0.18)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <span style={{ fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: t.textMuted }}>
          Add widget
        </span>
        <button onClick={onClose} aria-label="Close" style={{
          background: 'transparent', border: 'none', color: t.textMuted, cursor: 'pointer', padding: '0.2rem',
        }}>
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>
      <div style={{ display: 'grid', gap: '0.5rem' }}>
        {WIDGET_LIST.map(m => (
          <button
            key={m.type}
            onClick={() => onAdd(m.type)}
            style={{
              textAlign: 'left', background: 'transparent',
              border: `1px solid ${t.border}`, borderRadius: '10px',
              padding: '0.75rem 0.85rem', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: t.text, fontWeight: 400 }}>{m.label}</span>
              {m.status === 'placeholder' && (
                <span style={{
                  fontSize: '0.6rem', color: t.textDim, border: `1px solid ${t.border}`,
                  borderRadius: '999px', padding: '0.05rem 0.4rem', letterSpacing: '0.05em',
                }}>
                  soon
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.72rem', color: t.textMuted, marginTop: '0.2rem', lineHeight: 1.35 }}>
              {m.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

const ghostBtn = (t: Theme): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
  background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px',
  padding: '0.4rem 0.7rem', color: t.textMuted, cursor: 'pointer',
  fontSize: '0.75rem', fontFamily: 'inherit', fontWeight: 300,
});
