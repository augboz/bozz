import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import GridLayout, { WidthProvider } from 'react-grid-layout/legacy';
import type { Layout, LayoutItem } from 'react-grid-layout/legacy';
import { Plus, X, Link, StickyNote, ChevronDown, ExternalLink, Pencil, Check, Settings2 } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import type { TopicLink } from '../../lib/types';
import { isMobileViewport, isTauri } from '../../lib/platform';
import type { Theme, Topic, HomeWidgetItem } from '../../lib/types';
import type { WidgetCtx } from '../widgets/context';
import { WIDGET_REGISTRY, TOPIC_WIDGET_LIST } from '../widgets/registry';
import { TITLE_BAR_HEIGHT } from '../TitleBar';
import ColorBankPicker from '../shared/ColorBankPicker';
import BackgroundControls, { BgLayer, type PageBg } from '../shared/BackgroundControls';
import { deleteItem } from '../../lib/storage';

const Grid = WidthProvider(GridLayout);
const COLS = 12;
const ROW_H = 32;

const DEFAULT_TOPIC_LAYOUT: HomeWidgetItem[] = [
  { i: 'topicTodos', type: 'topicTodos', x: 0, y: 0, w: 12, h: 16 },
];

interface Props {
  topic: Topic;
  onChange: (next: Topic) => void;
  t: Theme;
  ctx: WidgetCtx;
}

function sameLayout(items: HomeWidgetItem[], layout: Layout): boolean {
  if (items.length !== layout.length) return false;
  return items.every(it => {
    const l = layout.find(x => x.i === it.i);
    return l && l.x === it.x && l.y === it.y && l.w === it.w && l.h === it.h;
  });
}

// ── Topic dashboard panel (used by TopicTodosWidget via re-export) ───────────

export function TopicDashboard({ topic, onChange, t }: { topic: Topic; onChange: (next: Topic) => void; t: Theme }) {
  const [open, setOpen] = useState(true);
  const [editDesc, setEditDesc] = useState(false);
  const [descDraft, setDescDraft] = useState(topic.description ?? '');
  const [editNote, setEditNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(topic.pinnedNote ?? '');
  const [addingLink, setAddingLink] = useState(false);
  const [linkLabel, setLinkLabel] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  const links = topic.links ?? [];

  const saveDesc = () => {
    onChange({ ...topic, description: descDraft.trim() || undefined });
    setEditDesc(false);
  };

  const saveNote = () => {
    onChange({ ...topic, pinnedNote: noteDraft.trim() || undefined });
    setEditNote(false);
  };

  const addLink = () => {
    const label = linkLabel.trim();
    let url = linkUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    const newLink: TopicLink = { id: Date.now().toString(36), label: label || url, url };
    onChange({ ...topic, links: [...links, newLink] });
    setLinkLabel(''); setLinkUrl(''); setAddingLink(false);
  };

  const removeLink = (id: string) =>
    onChange({ ...topic, links: links.filter(l => l.id !== id) });

  const hasContent = topic.description || links.length > 0 || topic.pinnedNote;

  return (
    <div style={{
      background: topic.color + '0d',
      border: `1px solid ${topic.color}33`,
      borderRadius: '12px',
      marginBottom: '1.25rem',
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.6rem 0.9rem', background: 'transparent', border: 'none',
          cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        }}
      >
        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: topic.color, flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: '0.68rem', color: topic.color, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500 }}>
          Dashboard
        </span>
        <ChevronDown size={13} strokeWidth={1.5} color={topic.color}
          style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }} />
      </button>

      {open && (
        <div style={{ padding: '0 0.9rem 0.9rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>

          {/* Description */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
              <span style={{ fontSize: '0.62rem', color: t.textDim, letterSpacing: '0.08em', textTransform: 'uppercase' }}>About</span>
              <button
                onClick={() => { setDescDraft(topic.description ?? ''); setEditDesc(v => !v); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '1px', color: t.textDim }}
              >
                <Pencil size={10} strokeWidth={1.5} />
              </button>
            </div>
            {editDesc ? (
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-end' }}>
                <textarea
                  autoFocus
                  value={descDraft}
                  onChange={e => setDescDraft(e.target.value)}
                  rows={2}
                  placeholder="Short description of this topic…"
                  style={{
                    flex: 1, background: t.input, border: `1px solid ${t.border}`, borderRadius: '7px',
                    padding: '0.4rem 0.6rem', color: t.text, fontSize: '0.82rem',
                    fontFamily: 'inherit', outline: 'none', resize: 'none',
                  }}
                />
                <button onClick={saveDesc} style={{ background: 'none', border: `1px solid ${t.border}`, borderRadius: '7px', padding: '0.35rem 0.7rem', cursor: 'pointer', color: t.doneAccent, fontFamily: 'inherit', fontSize: '0.78rem' }}>
                  <Check size={12} strokeWidth={2} />
                </button>
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '0.82rem', color: topic.description ? t.text : t.textDim, fontStyle: topic.description ? 'normal' : 'italic', lineHeight: 1.5 }}>
                {topic.description ?? 'No description — click ✎ to add one'}
              </p>
            )}
          </div>

          {/* Pinned links */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
              <Link size={10} strokeWidth={1.5} color={t.textDim} />
              <span style={{ fontSize: '0.62rem', color: t.textDim, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Links</span>
              <button
                onClick={() => setAddingLink(v => !v)}
                style={{ marginLeft: 'auto', background: 'none', border: `1px solid ${t.border}`, borderRadius: '5px', padding: '1px 6px', cursor: 'pointer', color: t.textMuted, fontSize: '0.68rem', fontFamily: 'inherit' }}
              >
                + add
              </button>
            </div>

            {addingLink && (
              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                <input
                  autoFocus
                  value={linkLabel}
                  onChange={e => setLinkLabel(e.target.value)}
                  placeholder="Label (e.g. Notion page)"
                  style={{ flex: '2 1 120px', ...linkInput(t) }}
                />
                <input
                  value={linkUrl}
                  onChange={e => setLinkUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addLink()}
                  placeholder="https://…"
                  style={{ flex: '3 1 180px', ...linkInput(t) }}
                />
                <button onClick={addLink} style={{ background: topic.color, border: 'none', borderRadius: '7px', padding: '0.35rem 0.8rem', color: '#fff', fontFamily: 'inherit', fontSize: '0.78rem', cursor: 'pointer' }}>
                  add
                </button>
                <button onClick={() => setAddingLink(false)} style={{ background: 'none', border: `1px solid ${t.border}`, borderRadius: '7px', padding: '0.35rem 0.7rem', cursor: 'pointer', color: t.textMuted, fontFamily: 'inherit', fontSize: '0.78rem' }}>
                  cancel
                </button>
              </div>
            )}

            {links.length === 0 && !addingLink && (
              <span style={{ fontSize: '0.78rem', color: t.textDim, fontStyle: 'italic' }}>No links yet</span>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {links.map(l => (
                <div key={l.id} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                  background: topic.color + '15', border: `1px solid ${topic.color}40`,
                  borderRadius: '999px', padding: '0.25rem 0.6rem 0.25rem 0.5rem',
                }}>
                  <button
                    onClick={() => openUrl(l.url)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: topic.color, fontFamily: 'inherit', fontSize: '0.78rem', padding: 0,
                    }}
                  >
                    <ExternalLink size={10} strokeWidth={1.5} />
                    {l.label}
                  </button>
                  <button
                    onClick={() => removeLink(l.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textDim, padding: '0 0 0 2px', display: 'flex', alignItems: 'center' }}
                  >
                    <X size={9} strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Pinned note */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
              <StickyNote size={10} strokeWidth={1.5} color={t.textDim} />
              <span style={{ fontSize: '0.62rem', color: t.textDim, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Pinned note</span>
              <button
                onClick={() => { setNoteDraft(topic.pinnedNote ?? ''); setEditNote(v => !v); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '1px', color: t.textDim }}
              >
                <Pencil size={10} strokeWidth={1.5} />
              </button>
            </div>
            {editNote ? (
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-end' }}>
                <textarea
                  autoFocus
                  value={noteDraft}
                  onChange={e => setNoteDraft(e.target.value)}
                  rows={4}
                  placeholder="Any notes, context, or reminders for this topic…"
                  style={{
                    flex: 1, background: t.input, border: `1px solid ${t.border}`, borderRadius: '7px',
                    padding: '0.5rem 0.7rem', color: t.text, fontSize: '0.82rem',
                    fontFamily: 'inherit', outline: 'none', resize: 'vertical', lineHeight: 1.5,
                  }}
                />
                <button onClick={saveNote} style={{ background: 'none', border: `1px solid ${t.border}`, borderRadius: '7px', padding: '0.35rem 0.7rem', cursor: 'pointer', color: t.doneAccent, fontFamily: 'inherit', fontSize: '0.78rem' }}>
                  <Check size={12} strokeWidth={2} />
                </button>
              </div>
            ) : topic.pinnedNote ? (
              <p style={{ margin: 0, fontSize: '0.82rem', color: t.text, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {topic.pinnedNote}
              </p>
            ) : (
              <span style={{ fontSize: '0.78rem', color: t.textDim, fontStyle: 'italic' }}>No pinned note — click ✎ to add one</span>
            )}
          </div>

          {!hasContent && !addingLink && !editDesc && !editNote && (
            <p style={{ margin: 0, fontSize: '0.75rem', color: t.textDim, fontStyle: 'italic' }}>
              Add a description, links, or a pinned note to build out this topic's dashboard.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const linkInput = (t: Theme): React.CSSProperties => ({
  background: t.input, border: `1px solid ${t.border}`, borderRadius: '7px',
  padding: '0.4rem 0.6rem', color: t.text, fontSize: '0.78rem',
  fontFamily: 'inherit', outline: 'none',
});

// ── Main TopicView ─────────────────────────────────────────────────────────────

export default function TopicView({ topic, onChange, t, ctx }: Props) {
  const [editMode, setEditMode] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  // Grid position transitions are gated on edit mode (see .topic-grid-editing in
  // index.css) so widgets never slide in when you switch topics — only while you
  // actively rearrange them.
  const [configuringId, setConfiguringId] = useState<string | null>(null);
  const [configPanelPos, setConfigPanelPos] = useState<{ top: number; left?: number; right?: number } | null>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const isMobile = isMobileViewport();

  const widgetLayout: HomeWidgetItem[] = topic.widgetLayout ?? DEFAULT_TOPIC_LAYOUT;

  const updateLayout = useCallback((next: HomeWidgetItem[]) => onChange({ ...topic, widgetLayout: next }), [onChange, topic]);

  // Close config panel when clicking outside
  React.useEffect(() => {
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
    const top = Math.max(8, Math.min(cellRect.top, window.innerHeight - 260));
    if (window.innerWidth - cellRect.right >= PANEL_W + GAP) {
      setConfigPanelPos({ top, left: cellRect.right + GAP });
    } else if (cellRect.left >= PANEL_W + GAP) {
      setConfigPanelPos({ top, left: cellRect.left - PANEL_W - GAP });
    } else {
      setConfigPanelPos({ top: cellRect.top + 8, right: 8 });
    }
  };

  const updateWidgetConfig = (id: string, config: Record<string, unknown>) => {
    updateLayout(widgetLayout.map(it => it.i === id ? { ...it, config } : it));
  };

  const layout: LayoutItem[] = widgetLayout.map(({ i, x, y, w, h, type }) => {
    const meta = WIDGET_REGISTRY[type];
    return { i, x, y, w, h, minW: meta.minSize.w, minH: meta.minSize.h };
  });

  const onLayoutChange = (next: Layout) => {
    if (sameLayout(widgetLayout, next)) return;
    updateLayout(widgetLayout.map(it => {
      const l = next.find(x => x.i === it.i);
      return l ? { ...it, x: l.x, y: l.y, w: l.w, h: l.h } : it;
    }));
  };

  const addWidget = (type: HomeWidgetItem['type']) => {
    const meta = WIDGET_REGISTRY[type];
    if (!meta.allowMultiple && widgetLayout.some(it => it.type === type)) return;
    const maxY = widgetLayout.reduce((m, it) => Math.max(m, it.y + it.h), 0);
    updateLayout([...widgetLayout, {
      i: `${type}-${Date.now()}`, type,
      x: 0, y: maxY, w: meta.defaultSize.w, h: meta.defaultSize.h,
    }]);
  };

  const removeWidget = (i: string) => {
    updateLayout(widgetLayout.filter(it => it.i !== i));
  };

  // ── Page background — stored in topic.pageBg so it syncs to all collaborators
  //    on shared topics, and to the user's own devices via user_data for private
  //    topics. The base64 data URL is self-contained and device-agnostic.
  const pageBg = (topic.pageBg ?? null) as PageBg | null;
  const setPageBg = useCallback((bg: PageBg | null) => {
    onChange({ ...topic, pageBg: bg ?? undefined });
  }, [onChange, topic]);

  // Clean up any stale per-topic localStorage background keys left from previous
  // implementations. We no longer use localStorage for pageBg.
  useEffect(() => {
    deleteItem(`topicBackground_${topic.id}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic.id]);

  // Build the widget ctx with topic-specific overrides — memoised to prevent
  // every widget re-rendering when unrelated state changes in TopicView.
  const topicCtx: WidgetCtx = useMemo(() => ({
    ...ctx,
    currentTopicId: topic.id,
    onTopicChange: onChange,
    editing: editMode,
    setActiveSection: editMode ? () => {} : (ctx?.setActiveSection ?? (() => {})),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [ctx, topic.id, onChange, editMode]);

  const ghostBtn = (t: Theme): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
    background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px',
    padding: '0.4rem 0.7rem', color: t.textMuted, cursor: 'pointer',
    fontSize: '0.75rem', fontFamily: 'inherit', fontWeight: 300,
  });

  if (isMobile) {
    const sortedItems = [...widgetLayout].sort((a, b) => a.y - b.y || a.x - b.x);
    return (
      <div style={{ position: 'relative' }}>
        {pageBg && <BgLayer bg={pageBg} t={t} />}
        <div style={{ position: 'relative', zIndex: 1 }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 600, letterSpacing: '-0.03em', color: t.text, margin: '0 0 1.25rem' }}>{topic.name}</h1>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          {editMode && <BackgroundControls t={t} bg={pageBg} onChange={setPageBg} />}
          {editMode && (
            <button onClick={() => setShowAdd(s => !s)} style={ghostBtn(t)}>
              <Plus size={14} strokeWidth={1.5} /> Add widget
            </button>
          )}
          <button
            onClick={() => { setEditMode(e => !e); setShowAdd(false); }}
            style={ghostBtn(t)}
          >
            {editMode ? <><Check size={14} strokeWidth={1.5} /> Done</> : <><Pencil size={14} strokeWidth={1.5} /> Edit</>}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {sortedItems.map(it => {
            const meta = WIDGET_REGISTRY[it.type];
            const W = meta.Component;
            const instanceCtx: WidgetCtx = {
              ...topicCtx,
              widgetConfig: { ...it.config ?? {}, _h: it.h },
              onWidgetConfig: (cfg) => updateWidgetConfig(it.i, cfg),
            };
            const isTopicTodos = it.type === 'topicTodos';
            return (
              <div key={it.i} data-widget-id={it.i} style={{ position: 'relative' }}>
                {editMode && !isTopicTodos && (
                  <button onClick={() => removeWidget(it.i)} aria-label={`Remove ${meta.label}`}
                    style={{ position: 'absolute', top: '-8px', right: '-8px', zIndex: 5, width: '24px', height: '24px', borderRadius: '50%', background: t.panel, border: `1px solid ${t.borderStrong}`, color: t.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                    <X size={12} strokeWidth={2} />
                  </button>
                )}
                {editMode && (
                  <button onClick={(e) => openConfig(e, it.i)} aria-label="Widget settings"
                    style={{ position: 'absolute', top: '-8px', right: isTopicTodos ? '-8px' : '22px', zIndex: 5, width: '24px', height: '24px', borderRadius: '50%', background: configuringId === it.i ? t.text : t.panel, border: `1px solid ${t.borderStrong}`, color: configuringId === it.i ? t.bg : t.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                    <Settings2 size={12} strokeWidth={2} />
                  </button>
                )}
                <div className={editMode ? 'widget-edit-overlay' : ''} style={{ pointerEvents: editMode ? 'none' : 'auto' }}>
                  <W ctx={instanceCtx} />
                </div>
              </div>
            );
          })}
        </div>

        {showAdd && (
          <AddPanel t={t} onAdd={addWidget} onClose={() => setShowAdd(false)} tbOffset={isTauri() ? TITLE_BAR_HEIGHT : 0} existingTypes={new Set(widgetLayout.map(it => it.type))} />
        )}
        </div>{/* /zIndex wrapper */}
      </div>
    );
  }

  // Desktop grid
  return (
    <div style={{ position: 'relative' }}>
      {pageBg && <BgLayer bg={pageBg} t={t} />}
      <div style={{ position: 'relative', zIndex: 1 }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 600, letterSpacing: '-0.03em', color: t.text, margin: '0 0 1.25rem' }}>{topic.name}</h1>

      <div style={{
        display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
        gap: '0.5rem', marginBottom: editMode ? '0.5rem' : '0.75rem', flexWrap: 'wrap',
      }}>
        {editMode && <BackgroundControls t={t} bg={pageBg} onChange={setPageBg} />}
        {editMode && (
          <button onClick={() => setShowAdd(s => !s)} style={ghostBtn(t)}>
            <Plus size={14} strokeWidth={1.5} /> Add widget
          </button>
        )}
        <button
          onClick={() => { setEditMode(e => !e); setShowAdd(false); setConfiguringId(null); }}
          style={ghostBtn(t)}
        >
          {editMode ? <><Check size={14} strokeWidth={1.5} /> Done</> : <><Pencil size={14} strokeWidth={1.5} /> Edit</>}
        </button>
      </div>

      <Grid
        className={`topic-grid${editMode ? ' topic-grid-editing' : ''}`}
        // Render only after the width is measured so widgets appear directly in
        // place instead of sliding in from the right on each topic open.
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
        {widgetLayout.map(it => {
          const meta = WIDGET_REGISTRY[it.type];
          const W = meta.Component;
          const instanceCtx: WidgetCtx = {
            ...topicCtx,
            widgetId: it.i,
            widgetConfig: { ...it.config ?? {}, _h: it.h },
            onWidgetConfig: (cfg) => updateWidgetConfig(it.i, cfg),
          };
          const isTopicTodos = it.type === 'topicTodos';
          return (
            <div key={it.i} data-widget-id={it.i} style={{
              ...({
                '--w-accent': it.config?.widgetColor,
                '--w-line': it.config?.widgetColor ? 'block' : 'none',
                '--w-bg': it.config?.bgColor,
                '--w-text': it.config?.textColor,
              } as React.CSSProperties),
              position: 'relative', height: '100%',
              outline: editMode ? `1px dashed ${t.borderStrong}` : 'none',
              outlineOffset: '2px', borderRadius: '14px',
            }}>
              {editMode && !isTopicTodos && (
                <button className="widget-remove" onClick={() => removeWidget(it.i)} aria-label={`Remove ${meta.label}`}
                  style={{ position: 'absolute', top: '-10px', right: '-10px', zIndex: 5, width: '22px', height: '22px', borderRadius: '50%', background: t.panel, border: `1px solid ${t.borderStrong}`, color: t.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                  <X size={12} strokeWidth={2} />
                </button>
              )}
              {editMode && (
                <button className="widget-remove" onClick={(e) => openConfig(e, it.i)} aria-label="Widget settings"
                  style={{ position: 'absolute', top: '-10px', right: isTopicTodos ? '-10px' : '18px', zIndex: 5, width: '22px', height: '22px', borderRadius: '50%', background: configuringId === it.i ? t.text : t.panel, border: `1px solid ${t.borderStrong}`, color: configuringId === it.i ? t.bg : t.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                  <Settings2 size={12} strokeWidth={2} />
                </button>
              )}
              <div className={editMode ? 'widget-edit-overlay' : ''} style={{ height: '100%', pointerEvents: editMode ? 'none' : 'auto' }}>
                <W ctx={instanceCtx} />
              </div>
            </div>
          );
        })}
      </Grid>

      {showAdd && (
        <AddPanel t={t} onAdd={addWidget} onClose={() => setShowAdd(false)} tbOffset={isTauri() ? TITLE_BAR_HEIGHT : 0} existingTypes={new Set(widgetLayout.map(it => it.type))} />
      )}

      {configuringId && configPanelPos && (() => {
        const item = widgetLayout.find(it => it.i === configuringId);
        if (!item) return null;
        const cfg = item.config ?? {};
        return createPortal(
          <div ref={panelRef} style={{ position: 'fixed', top: configPanelPos.top, left: configPanelPos.left, right: configPanelPos.right, zIndex: 9999, width: '248px' }}>
            <SimpleConfigPanel t={t} cfg={cfg} onConfig={(c) => updateWidgetConfig(configuringId, c)} colorBank={topicCtx.colorBank} />
          </div>,
          document.body,
        );
      })()}
      </div>{/* /zIndex wrapper */}
    </div>
  );
}

// ── Simple config panel (accent + bg colour for topic widgets) ────────────────

function TopicColourDropdown({ label, selected, bank, onChange, t }: {
  label: string; selected?: string; bank: string[];
  onChange: (c: string | undefined) => void; t: Theme;
}) {
  const [open, setOpen] = React.useState(false);
  const swatchStyle: React.CSSProperties = selected
    ? { background: selected, border: '1.5px solid rgba(0,0,0,0.2)' }
    : { background: 'transparent', backgroundImage: 'repeating-linear-gradient(45deg,#888 0,#888 1px,transparent 0,transparent 50%)', backgroundSize: '4px 4px', border: '1.5px solid #888' };
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(v => !v)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: open ? t.bgAlt : 'transparent', border: `1px solid ${open ? t.borderStrong : t.border}`,
        borderRadius: '8px', padding: '0.4rem 0.6rem', cursor: 'pointer', fontFamily: 'inherit',
      }}>
        <span style={{ fontSize: '0.72rem', color: t.textMuted }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <div style={{ width: '14px', height: '14px', borderRadius: '4px', flexShrink: 0, ...swatchStyle }} />
          <span style={{ fontSize: '0.6rem', color: t.textDim }}>▾</span>
        </div>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200,
          background: t.panel, border: `1px solid ${t.borderStrong}`, borderRadius: '10px',
          padding: '0.6rem', boxShadow: '0 6px 24px rgba(0,0,0,0.28)',
        }}>
          <ColorBankPicker bank={bank} selected={selected} allowNone onChange={(c) => { onChange(c); setOpen(false); }} />
        </div>
      )}
    </div>
  );
}

function SimpleConfigPanel({ t, cfg, onConfig, colorBank }: {
  t: Theme;
  cfg: Record<string, unknown>;
  onConfig: (cfg: Record<string, unknown>) => void;
  colorBank: string[];
}) {
  return (
    <div style={{
      background: t.panel, border: `1px solid ${t.borderStrong}`, borderRadius: '12px',
      padding: '0.9rem 1.1rem', boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
      display: 'flex', flexDirection: 'column', gap: '0.45rem',
    }}>
      <TopicColourDropdown label="Accent line colour" selected={cfg.widgetColor as string | undefined} bank={colorBank} onChange={(c) => onConfig({ ...cfg, widgetColor: c })} t={t} />
      <TopicColourDropdown label="Background colour"  selected={cfg.bgColor   as string | undefined} bank={colorBank} onChange={(c) => onConfig({ ...cfg, bgColor:    c })} t={t} />
      <TopicColourDropdown label="Text colour"        selected={cfg.textColor as string | undefined} bank={colorBank} onChange={(c) => onConfig({ ...cfg, textColor:  c })} t={t} />
    </div>
  );
}

// ── Add widget panel ───────────────────────────────────────────────────────────

function AddPanel({ t, onAdd, onClose, tbOffset, existingTypes }: {
  t: Theme; onAdd: (type: HomeWidgetItem['type']) => void; onClose: () => void;
  tbOffset: number; existingTypes: Set<string>;
}) {
  return (
    <div style={{
      position: 'fixed', top: tbOffset, right: 0, bottom: 0,
      width: 'min(320px, 90vw)', zIndex: 50,
      background: t.panel, borderLeft: `1px solid ${t.border}`,
      display: 'flex', flexDirection: 'column',
      boxShadow: '-8px 0 24px rgba(0,0,0,0.18)',
    }}>
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
      <div style={{ flex: 1, overflowY: 'scroll', padding: '1rem 1.5rem 2rem' }}>
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {TOPIC_WIDGET_LIST.map(m => {
            const added = !m.allowMultiple && existingTypes.has(m.type);
            return (
              <button
                key={m.type}
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
                  {added && (
                    <span style={{ fontSize: '0.6rem', color: t.textDim, border: `1px solid ${t.border}`, borderRadius: '999px', padding: '0.05rem 0.4rem', letterSpacing: '0.05em' }}>
                      added
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