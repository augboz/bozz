import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import GridLayout, { WidthProvider } from 'react-grid-layout/legacy';
import type { Layout, LayoutItem } from 'react-grid-layout/legacy';
import { Pencil, Plus, X, Check, Settings2 } from 'lucide-react';
import type { HomeWidgetItem, Theme, ImapAccount, WidgetShape, WidgetBorder } from '../../lib/types';
import type { WidgetCtx } from '../widgets/context';
import { WIDGET_REGISTRY, WIDGET_LIST } from '../widgets/registry';
import { TITLE_BAR_HEIGHT } from '../TitleBar';
import { isMobileViewport, isTauri } from '../../lib/platform';
import { getItem, setItem, deleteItem } from '../../lib/storage';
import ColorBankPicker from '../shared/ColorBankPicker';
import BackgroundControls, { BgLayer, type PageBg } from '../shared/BackgroundControls';
import { PhotoWidgetConfig } from '../widgets/PhotoWidget';

const Grid = WidthProvider(GridLayout);
const COLS = 12;
const ROW_H = 32;

interface HomeViewProps {
  items: HomeWidgetItem[];
  setItems: React.Dispatch<React.SetStateAction<HomeWidgetItem[]>>;
  ctx: WidgetCtx;
  widgetShape: WidgetShape;
  widgetBorder: WidgetBorder;
  onWidgetShape: (v: WidgetShape) => void;
  onWidgetBorder: (v: WidgetBorder) => void;
  /** Whether the Home section is currently shown (Home stays mounted). Used to
   *  re-arm the grid's mount-animation suppression each time it becomes visible. */
  visible?: boolean;
}

function sameLayout(items: HomeWidgetItem[], layout: Layout): boolean {
  if (items.length !== layout.length) return false;
  return items.every(it => {
    const l = layout.find(x => x.i === it.i);
    return l && l.x === it.x && l.y === it.y && l.w === it.w && l.h === it.h;
  });
}


export default function HomeView({ items, setItems, ctx, widgetShape, widgetBorder, onWidgetShape, onWidgetBorder, visible = true }: HomeViewProps) {
  const { t } = ctx;
  const [editMode, setEditMode] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [configuringId, setConfiguringId] = useState<string | null>(null);
  const [configPanelPos, setConfigPanelPos] = useState<{ top: number; left?: number; right?: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Grid position transitions are gated on edit mode (see .home-grid-editing in
  // index.css) so widgets never slide in on mount or when returning to Home —
  // only while you actively rearrange them.

  // Home stays mounted now, so close its edit/add panels when navigating away
  // (otherwise the portal-rendered AddPanel/config could linger over other pages).
  useEffect(() => {
    if (visible) return;
    setEditMode(false);
    setShowAdd(false);
    setConfiguringId(null);
  }, [visible]);

  // ── Page background ────────────────────────────────────────────────────────
  const [pageBg, setPageBgState] = useState<PageBg | null>(null);
  useEffect(() => {
    getItem('homeBackground').then(r => {
      if (r?.value) {
        try { setPageBgState(JSON.parse(r.value) as PageBg); } catch { /* ignore */ }
      }
    });
  }, []);
  const setPageBg = useCallback(async (bg: PageBg | null) => {
    setPageBgState(bg);
    if (bg) await setItem('homeBackground', JSON.stringify(bg));
    else await deleteItem('homeBackground');
    // homeBackground is written outside Dashboard's save() helper, so it has
    // to schedule its own cloud push or the change never leaves this device.
    try {
      const { supabase } = await import('../../lib/supabase');
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user.id;
      if (uid) {
        const { schedulePush } = await import('../../lib/sync');
        schedulePush(uid);
      }
    } catch { /* offline / not signed in — local save already done */ }
  }, []);

  // Close config panel when clicking outside it
  useEffect(() => {
    if (!configuringId) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setConfiguringId(null);
        setConfigPanelPos(null);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [configuringId]);

  const openConfig = (e: React.MouseEvent, id: string) => {
    if (configuringId === id) {
      setConfiguringId(null);
      setConfigPanelPos(null);
      return;
    }
    let cell = e.currentTarget as HTMLElement;
    while (cell && !cell.dataset.widgetId) cell = cell.parentElement as HTMLElement;
    const cellRect = cell?.getBoundingClientRect() ?? (e.currentTarget as HTMLElement).getBoundingClientRect();
    setConfiguringId(id);

    const PANEL_W = 248;
    const GAP = 10;
    const top = Math.max(8, Math.min(cellRect.top, window.innerHeight - 300));

    // Prefer right of widget; fall back to left
    if (window.innerWidth - cellRect.right >= PANEL_W + GAP) {
      setConfigPanelPos({ top, left: cellRect.right + GAP });
    } else if (cellRect.left >= PANEL_W + GAP) {
      setConfigPanelPos({ top, left: cellRect.left - PANEL_W - GAP });
    } else {
      // Not enough space on either side — float above/right corner
      setConfigPanelPos({ top: cellRect.top + 8, right: 8 });
    }
  };

  const updateWidgetConfig = (id: string, config: Record<string, unknown>) => {
    setItems(prev => prev.map(it => it.i === id ? { ...it, config } : it));
  };

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

  // Navigation is disabled while editing so dragging a card never navigates.
  const renderCtx = useMemo<WidgetCtx>(
    () => ({ ...ctx, editing: editMode, setActiveSection: editMode ? () => {} : ctx.setActiveSection }),
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
    if (items.some(it => it.type === type)) return; // one per type
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
        {/* Gate on `visible`: BgLayer portals a position:fixed layer into
            document.body, which escapes Home's display:none wrapper. Without
            this guard it stays on screen over every other section and hides
            views that don't sit above zIndex 0 (Calendar/Settings/Apps). */}
        {visible && pageBg && <BgLayer bg={pageBg} t={t} />}
        <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{
          display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
          gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap',
        }}>
          {editMode && <BackgroundControls t={t} bg={pageBg} onChange={setPageBg} />}
          {editMode && (
            <button data-onb="add-widget" onClick={() => setShowAdd(s => !s)} style={ghostBtn(t)}>
              <Plus size={14} strokeWidth={1.5} /> Add widget
            </button>
          )}
          <button
            data-onb="home-edit"
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
            const instanceCtx: typeof renderCtx = {
              ...renderCtx,
              widgetId: it.i,
              widgetConfig: { ...it.config ?? {}, _h: it.h },
              onWidgetConfig: (cfg) => updateWidgetConfig(it.i, cfg),
            };
            const mobileWidgetColor = it.config?.widgetColor as string | undefined;
            const cellVars = {
              '--w-accent': mobileWidgetColor,
              '--w-line': mobileWidgetColor ? 'block' : 'none',
              '--w-bg': it.config?.bgColor as string | undefined,
              '--w-text': (it.config?.textColor as string | undefined) ?? t.text,
            } as React.CSSProperties;
            return (
              <div key={it.i} data-widget-id={it.i} style={{ position: 'relative', ...cellVars }}>
                {editMode && (
                  <>
                    <button onClick={() => removeWidget(it.i)} aria-label={`Remove ${meta.label}`}
                      style={{ position: 'absolute', top: '-8px', right: '-8px', zIndex: 5, width: '24px', height: '24px', borderRadius: '50%', background: t.panel, border: `1px solid ${t.borderStrong}`, color: t.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                      <X size={12} strokeWidth={2} />
                    </button>
                    <button onClick={(e) => openConfig(e, it.i)} aria-label="Widget settings"
                      style={{ position: 'absolute', top: '-8px', right: '22px', zIndex: 5, width: '24px', height: '24px', borderRadius: '50%', background: configuringId === it.i ? t.text : t.panel, border: `1px solid ${t.borderStrong}`, color: configuringId === it.i ? t.bg : t.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                      <Settings2 size={12} strokeWidth={2} />
                    </button>
                  </>
                )}
                <div className={editMode ? 'widget-edit-overlay' : ''} style={{ pointerEvents: editMode ? 'none' : 'auto' }}>
                  <W ctx={instanceCtx} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Widget appearance controls — visible in edit mode */}
        {editMode && (
          <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
            <AppearanceControls t={t} widgetShape={widgetShape} widgetBorder={widgetBorder} onShape={onWidgetShape} onBorder={onWidgetBorder} />
          </div>
        )}

        {showAdd && (
          <AddPanel key="add-panel" t={t} onAdd={addWidget} onClose={() => setShowAdd(false)} tbOffset={isTauri() ? TITLE_BAR_HEIGHT : 0} existingTypes={new Set(items.map(it => it.type))} />
        )}
        </div>{/* /zIndex wrapper */}
      </div>
    );
  }

  // ── Desktop grid ───────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative' }}>
      {/* Gate on `visible` — see note above: the portalled fixed BgLayer would
          otherwise cover other sections while Home stays mounted. */}
      {visible && pageBg && <BgLayer bg={pageBg} t={t} />}
      <div style={{ position: 'relative', zIndex: 1 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: '0.5rem', marginBottom: editMode ? '0.5rem' : '0.75rem',
        flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: '0.82rem', color: t.textMuted, fontWeight: 500, letterSpacing: '-0.01em' }}>
          {new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {editMode && (
            <AppearanceControls t={t} widgetShape={widgetShape} widgetBorder={widgetBorder} onShape={onWidgetShape} onBorder={onWidgetBorder} />
          )}
          {editMode && <BackgroundControls t={t} bg={pageBg} onChange={setPageBg} />}
          {editMode && (
            <button data-onb="add-widget" onClick={() => setShowAdd(s => !s)} style={ghostBtn(t)}>
              <Plus size={14} strokeWidth={1.5} /> Add widget
            </button>
          )}
          <button
            onClick={() => { setEditMode(e => !e); setShowAdd(false); setConfiguringId(null); }}
            title={editMode ? 'Done editing' : 'Edit layout'}
            aria-label={editMode ? 'Done editing' : 'Edit layout'}
            style={{ ...ghostBtn(t), padding: '0.4rem', borderRadius: '8px' }}
          >
            {editMode
              ? <Check size={14} strokeWidth={1.5} />
              : <Pencil size={14} strokeWidth={1.5} />}
          </button>
        </div>
      </div>
      {editMode && <div style={{ marginBottom: '0.75rem' }} />}

      <Grid
        className={`home-grid${editMode ? ' home-grid-editing' : ''}`}
        // Measure the container width BEFORE first paint so widgets render at
        // their real positions immediately — no default-width render that then
        // reflows left ("widgets sliding in from the right").
        measureBeforeMount
        layout={layout}
        cols={COLS}
        rowHeight={ROW_H}
        margin={[16, 16]}
        containerPadding={[0, 0]}
        isDraggable={editMode}
        isResizable={editMode}
        resizeHandles={['s', 'w', 'e', 'n', 'sw', 'nw', 'se', 'ne']}
        onLayoutChange={onLayoutChange}
        compactType="vertical"
        draggableCancel=".widget-remove"
      >
        {items.map(it => {
          const meta = WIDGET_REGISTRY[it.type];
          const W = meta.Component;
          const instanceCtx: typeof renderCtx = {
            ...renderCtx,
            widgetId: it.i,
            widgetConfig: { ...it.config ?? {}, _h: it.h },
            onWidgetConfig: (cfg) => updateWidgetConfig(it.i, cfg),
          };
          const widgetColor = it.config?.widgetColor as string | undefined;
          const cellVars = {
            '--w-accent': widgetColor,
            '--w-line': widgetColor ? 'block' : 'none',
            '--w-bg': it.config?.bgColor as string | undefined,
            '--w-text': (it.config?.textColor as string | undefined) ?? t.text,
          } as React.CSSProperties;
          return (
            <div key={it.i} data-widget-id={it.i} style={{
              position: 'relative', height: '100%',
              outline: editMode ? `1px dashed ${t.borderStrong}` : 'none',
              outlineOffset: '2px', borderRadius: '14px',
              ...cellVars,
            }}>
              {editMode && (
                <>
                  <button className="widget-remove" onClick={() => removeWidget(it.i)} aria-label={`Remove ${meta.label}`}
                    style={{ position: 'absolute', top: '-10px', right: '-10px', zIndex: 5, width: '22px', height: '22px', borderRadius: '50%', background: t.panel, border: `1px solid ${t.borderStrong}`, color: t.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                    <X size={12} strokeWidth={2} />
                  </button>
                  <button className="widget-remove" onClick={(e) => openConfig(e, it.i)} aria-label="Widget settings"
                    style={{ position: 'absolute', top: '-10px', right: '18px', zIndex: 5, width: '22px', height: '22px', borderRadius: '50%', background: configuringId === it.i ? t.text : t.panel, border: `1px solid ${t.borderStrong}`, color: configuringId === it.i ? t.bg : t.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                    <Settings2 size={12} strokeWidth={2} />
                  </button>
                </>
              )}
              <div className={editMode ? 'widget-edit-overlay' : ''} style={{ height: '100%', pointerEvents: editMode ? 'none' : 'auto' }}>
                <W ctx={instanceCtx} />
              </div>
            </div>
          );
        })}
      </Grid>

      {showAdd && (
        <AddPanel key="add-panel" t={t} onAdd={addWidget} onClose={() => setShowAdd(false)} tbOffset={isTauri() ? TITLE_BAR_HEIGHT : 0} existingTypes={new Set(items.map(it => it.type))} />
      )}

      {/* Config panel — rendered in a portal so it always floats above everything */}
      {configuringId && configPanelPos && (() => {
        const item = items.find(it => it.i === configuringId);
        if (!item) return null;
        return createPortal(
          <div
            ref={panelRef}
            style={{
              position: 'fixed',
              top: configPanelPos.top,
              left: configPanelPos.left,
              right: configPanelPos.right,
              zIndex: 9999,
              width: '248px',
            }}
          >
            <WidgetConfigPanel t={t} item={item} ctx={renderCtx} onConfig={(cfg) => updateWidgetConfig(configuringId, cfg)} />
          </div>,
          document.body,
        );
      })()}
      </div>{/* /zIndex wrapper */}
    </div>
  );
}

// ── Widget appearance controls (shown in edit mode) ───────────────────────

function AppearanceControls({ t, widgetShape, widgetBorder, onShape, onBorder }: {
  t: Theme; widgetShape: WidgetShape; widgetBorder: WidgetBorder;
  onShape: (v: WidgetShape) => void; onBorder: (v: WidgetBorder) => void;
}) {
  const shapes: Array<{ id: WidgetShape; label: string }> = [
    { id: 'sharp', label: 'Sharp' }, { id: 'rounded', label: 'Rounded' }, { id: 'pill', label: 'Pill' },
  ];
  const borders: Array<{ id: WidgetBorder; label: string }> = [
    { id: 'subtle', label: 'None' }, { id: 'normal', label: 'Thin' }, { id: 'bold', label: 'Bold' },
  ];
  const segStyle = (on: boolean, t: Theme): React.CSSProperties => ({
    background: on ? t.bgAlt : 'transparent', color: on ? t.text : t.textMuted,
    border: 'none', padding: '0.3rem 0.6rem', fontSize: '0.72rem', fontFamily: 'inherit',
    cursor: 'pointer', fontWeight: 300,
  });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        <span style={{ fontSize: '0.65rem', color: t.textDim, letterSpacing: '0.06em' }}>corners</span>
        <div style={{ display: 'inline-flex', border: `1px solid ${t.border}`, borderRadius: '7px', overflow: 'hidden' }}>
          {shapes.map((o, i) => (
            <button key={o.id} onClick={() => onShape(o.id)} aria-pressed={widgetShape === o.id}
              style={{ ...segStyle(widgetShape === o.id, t), borderLeft: i === 0 ? 'none' : `1px solid ${t.border}` }}>
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        <span style={{ fontSize: '0.65rem', color: t.textDim, letterSpacing: '0.06em' }}>border</span>
        <div style={{ display: 'inline-flex', border: `1px solid ${t.border}`, borderRadius: '7px', overflow: 'hidden' }}>
          {borders.map((o, i) => (
            <button key={o.id} onClick={() => onBorder(o.id)} aria-pressed={widgetBorder === o.id}
              style={{ ...segStyle(widgetBorder === o.id, t), borderLeft: i === 0 ? 'none' : `1px solid ${t.border}` }}>
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function AddPanel({ t, onAdd, onClose, tbOffset, existingTypes }: {
  t: Theme; onAdd: (type: HomeWidgetItem['type']) => void; onClose: () => void;
  tbOffset: number; existingTypes: Set<string>;
}) {
  return (
    <div style={{
      position: 'fixed', top: tbOffset, right: 0, bottom: 0,
      width: 'min(320px, 90vw)', zIndex: 50,
      background: 'var(--glass-bg, ' + t.panel + ')',
      backdropFilter: 'var(--glass-blur, none)',
      WebkitBackdropFilter: 'var(--glass-blur, none)',
      borderLeft: `1px solid ${t.border}`,
      display: 'flex', flexDirection: 'column',
      boxShadow: '-8px 0 32px rgba(0,0,0,0.3)',
    }}>
      {/* Header — fixed, doesn't scroll */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '1.25rem 1.5rem 1rem',
        borderBottom: `1px solid ${t.border}`,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: t.textMuted }}>
          Add widget
        </span>
        <button onClick={onClose} aria-label="Close" style={{
          background: 'transparent', border: 'none', color: t.textMuted, cursor: 'pointer', padding: '0.2rem',
        }}>
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>
      {/* Scrollable content — padding inside so bottom padding is respected */}
      <div style={{ flex: 1, overflowY: 'scroll', padding: '1rem 1.5rem 2rem' }}>
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {WIDGET_LIST.map(m => {
            const added = !m.allowMultiple && existingTypes.has(m.type);
            return (
              <button
                key={m.type}
                data-onb={m.type === 'recentEmails' ? 'recent-emails-option' : undefined}
                onClick={() => !added && onAdd(m.type)}
                disabled={added}
                style={{
                  textAlign: 'left',
                  background: added ? t.input : 'transparent',
                  border: `1px solid ${t.border}`, borderRadius: '10px',
                  padding: '0.75rem 0.85rem',
                  cursor: added ? 'default' : 'pointer',
                  fontFamily: 'inherit',
                  opacity: added ? 0.5 : 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', color: t.text, fontWeight: 400 }}>{m.label}</span>
                  {added && !m.allowMultiple && (
                    <span style={{
                      fontSize: '0.6rem', color: t.textDim, border: `1px solid ${t.border}`,
                      borderRadius: '999px', padding: '0.05rem 0.4rem', letterSpacing: '0.05em',
                    }}>
                      added
                    </span>
                  )}
                  {!added && m.status === 'placeholder' && (
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
            );
          })}
        </div>
      </div>
    </div>
  );
}

const ghostBtn = (t: Theme): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
  background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '999px',
  padding: '0.35rem 0.75rem', color: t.textMuted, cursor: 'pointer',
  fontSize: '0.72rem', fontFamily: 'inherit', fontWeight: 400,
  transition: 'border-color 0.2s, color 0.2s',
});

// ── Colour dropdown — a labelled pill that opens an inline bank picker ────────

function ColourDropdown({ label, selected, bank, onChange, t, allowNone = true }: {
  label: string; selected?: string; bank: string[];
  onChange: (c: string | undefined) => void;
  t: Theme; allowNone?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const swatchStyle: React.CSSProperties = selected
    ? { background: selected, border: `1.5px solid rgba(0,0,0,0.2)` }
    : {
        background: 'transparent',
        backgroundImage: 'repeating-linear-gradient(45deg,#888 0,#888 1px,transparent 0,transparent 50%)',
        backgroundSize: '4px 4px',
        border: '1.5px solid #888',
      };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: open ? t.bgAlt : 'transparent',
          border: `1px solid ${open ? t.borderStrong : t.border}`,
          borderRadius: '8px', padding: '0.4rem 0.6rem',
          cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        <span style={{ fontSize: '0.72rem', color: t.textMuted }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <div style={{ width: '14px', height: '14px', borderRadius: '4px', flexShrink: 0, ...swatchStyle }} />
          <span style={{ fontSize: '0.6rem', color: t.textDim }}>▾</span>
        </div>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200,
          background: 'var(--glass-bg, ' + t.panel + ')',
          backdropFilter: 'var(--glass-blur, none)',
          WebkitBackdropFilter: 'var(--glass-blur, none)',
          border: `1px solid ${t.borderStrong}`,
          borderRadius: '10px', padding: '0.6rem',
          boxShadow: 'var(--widget-shadow, 0 6px 24px rgba(0,0,0,0.28))',
        }}>
          <ColorBankPicker
            bank={bank}
            selected={selected}
            allowNone={allowNone}
            onChange={(c) => { onChange(c); setOpen(false); }}
          />
        </div>
      )}
    </div>
  );
}

// ── Per-widget config panel ────────────────────────────────────────────────

type EmailFilter = { accountEmail: string; count: number };

function WidgetConfigPanel({ t, item, ctx, onConfig }: {
  t: Theme;
  item: HomeWidgetItem;
  ctx: WidgetCtx;
  onConfig: (cfg: Record<string, unknown>) => void;
}) {
  const cfg = item.config ?? {};

  // Email-specific hooks — always called (React rules), only rendered for recentEmails
  const [imapAccounts, setImapAccounts] = useState<ImapAccount[]>([]);
  useEffect(() => {
    if (item.type !== 'recentEmails') return;
    getItem('imapAccounts').then(r => {
      if (r?.value) {
        try { setImapAccounts(JSON.parse(r.value) as ImapAccount[]); }
        catch { /* ignore */ }
      }
    });
  }, [item.type]);
  const accounts = useMemo(() => {
    if (item.type !== 'recentEmails') return [];
    const seen = new Map<string, string>();
    for (const m of ctx.emails) {
      if (!seen.has(m.accountEmail)) seen.set(m.accountEmail, m.provider);
    }
    for (const a of imapAccounts) {
      if (!seen.has(a.email)) seen.set(a.email, 'imap');
    }
    return [...seen.entries()].map(([email, provider]) => ({ email, provider }));
  }, [item.type, ctx.emails, imapAccounts]);

  const filters: EmailFilter[] = (cfg.filters as EmailFilter[] | undefined) ?? [];
  const isEnabled = (email: string) => filters.length === 0 || filters.some(f => f.accountEmail === email);
  const getCount  = (email: string) => filters.find(f => f.accountEmail === email)?.count ?? 3;
  const toggleEmail = (email: string) => {
    if (filters.length === 0) {
      onConfig({ ...cfg, filters: accounts.filter(a => a.email !== email).map(a => ({ accountEmail: a.email, count: 3 })) });
    } else {
      const alreadyOn = filters.some(f => f.accountEmail === email);
      onConfig({ ...cfg, filters: alreadyOn ? filters.filter(f => f.accountEmail !== email) : [...filters, { accountEmail: email, count: 3 }] });
    }
  };
  const adjustCount = (email: string, delta: number) => {
    const base = filters.length === 0 ? accounts.map(a => ({ accountEmail: a.email, count: 3 })) : filters;
    onConfig({ ...cfg, filters: base.map(f => f.accountEmail === email ? { ...f, count: Math.min(10, Math.max(1, f.count + delta)) } : f) });
  };

  return (
    <div style={{
      background: 'var(--glass-bg, ' + t.panel + ')',
      backdropFilter: 'var(--glass-blur, none)',
      WebkitBackdropFilter: 'var(--glass-blur, none)',
      border: `1px solid ${t.borderStrong}`, borderRadius: '14px',
      padding: '0.9rem 1.1rem', boxShadow: 'var(--widget-shadow, 0 8px 32px rgba(0,0,0,0.22))',
      display: 'flex', flexDirection: 'column', gap: '0.9rem',
    }}>

      {/* ── Colour dropdowns ──────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
        <ColourDropdown
          label="Accent line colour"
          selected={cfg.widgetColor as string | undefined}
          bank={ctx.colorBank}
          onChange={(c) => onConfig({ ...cfg, widgetColor: c })}
          t={t}
        />
        <ColourDropdown
          label="Background colour"
          selected={cfg.bgColor as string | undefined}
          bank={ctx.colorBank}
          onChange={(c) => onConfig({ ...cfg, bgColor: c })}
          t={t}
        />
        <ColourDropdown
          label="Text colour"
          selected={cfg.textColor as string | undefined}
          bank={ctx.colorBank}
          onChange={(c) => onConfig({ ...cfg, textColor: c })}
          t={t}
        />
        {!!(cfg.textColor || cfg.bgColor || cfg.widgetColor) && (
          <button
            onClick={() => {
              const { textColor: _tc, bgColor: _bc, widgetColor: _wc, ...rest } = cfg;
              onConfig(rest);
            }}
            style={{
              background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '7px',
              padding: '0.3rem 0.6rem', color: t.textDim, cursor: 'pointer',
              fontFamily: 'inherit', fontSize: '0.68rem', textAlign: 'left',
              marginTop: '0.1rem',
            }}
          >
            Reset to theme defaults
          </button>
        )}
      </div>



      {/* ── Photo widget: multi-photo upload ─────────────── */}
      {item.type === 'photo' && (
        <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: '0.7rem' }}>
          <PhotoWidgetConfig config={cfg} onConfig={onConfig} t={t} widgetId={item.i} />
        </div>
      )}

      {/* ── Today widget: section toggles ───────────────── */}
      {item.type === 'today' && (
        <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: '0.7rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
          <div style={{ fontSize: '0.6rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: t.textDim }}>Show sections</div>
          {([
            { key: 'showEvents', label: 'Events (calendar)' },
            { key: 'showTasks',  label: 'Tasks (daily plan)' },
          ] as const).map(({ key, label }) => {
            const on = cfg[key] !== false;
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.75rem', color: t.textMuted }}>{label}</span>
                <button
                  onClick={() => onConfig({ ...cfg, [key]: !on })}
                  aria-pressed={on}
                  style={{
                    width: '36px', height: '20px', borderRadius: '999px', border: 'none',
                    background: on ? t.doneAccent : t.borderStrong,
                    cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.18s',
                  }}
                >
                  <div style={{
                    position: 'absolute', top: '3px', left: on ? '19px' : '3px',
                    width: '14px', height: '14px', borderRadius: '50%', background: 'white', transition: 'left 0.18s',
                  }} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Email widget: account filters ────────────────── */}
      {item.type === 'recentEmails' && (
        <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: '0.7rem' }}>
          <div style={{ fontSize: '0.6rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: t.textDim, marginBottom: '0.55rem' }}>
            Show from
          </div>
          {accounts.length === 0 ? (
            <span style={{ fontSize: '0.72rem', color: t.textMuted }}>No email accounts connected yet</span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {accounts.map(a => {
                const enabled = isEnabled(a.email);
                const count   = getCount(a.email);
                return (
                  <div key={a.email} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <button onClick={() => toggleEmail(a.email)} aria-label={enabled ? 'Disable' : 'Enable'}
                      style={{ width: '15px', height: '15px', borderRadius: '4px', flexShrink: 0,
                        background: enabled ? t.text : 'transparent', border: `1.5px solid ${enabled ? t.text : t.borderStrong}`,
                        cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.14s, border-color 0.14s' }}>
                      {enabled && (
                        <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                          <path d="M1 3L3 5L7 1" stroke={t.bg} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                    <span style={{ flex: 1, fontSize: '0.73rem', color: enabled ? t.text : t.textDim,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', transition: 'color 0.14s' }}>
                      {a.email}
                    </span>
                    {enabled && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
                        <button onClick={() => adjustCount(a.email, -1)} disabled={count <= 1}
                          style={{ width: '18px', height: '18px', borderRadius: '4px', background: 'transparent', border: `1px solid ${t.border}`,
                            color: count <= 1 ? t.textDim : t.textMuted, cursor: count <= 1 ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', padding: 0, lineHeight: 1 }}>−</button>
                        <span style={{ fontSize: '0.72rem', color: t.textMuted, minWidth: '14px', textAlign: 'center' }}>{count}</span>
                        <button onClick={() => adjustCount(a.email, +1)} disabled={count >= 10}
                          style={{ width: '18px', height: '18px', borderRadius: '4px', background: 'transparent', border: `1px solid ${t.border}`,
                            color: count >= 10 ? t.textDim : t.textMuted, cursor: count >= 10 ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', padding: 0, lineHeight: 1 }}>+</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}