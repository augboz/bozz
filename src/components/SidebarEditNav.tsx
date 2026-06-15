import { useState, useMemo } from 'react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent, type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, arrayMove, useSortable,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Folder, ChevronDown, ChevronRight, FolderMinus } from 'lucide-react';
import type { ElementType } from 'react';
import type { Theme, Topic, TopicFolder } from '../lib/types';
import { iconForTopic } from './sections/settings/TopicsBlock';

interface SectionDef {
  id: string;
  label: string;
  icon: ElementType;
}

interface Props {
  topics: Topic[];
  topicFolders: TopicFolder[];
  hiddenTopicIds: string[];
  sections: SectionDef[];
  navOrder?: string[];
  sidebarCollapsed: boolean;
  t: Theme;
  onTopicsChange: (topics: Topic[]) => void;
  onTopicFoldersChange: (folders: TopicFolder[]) => void;
  onNavOrderChange: (order: string[]) => void;
}

function SortableRow({ id, children }: {
  id: string;
  children: (dragProps: React.HTMLAttributes<HTMLElement>, isDragging: boolean) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
      {children({ ...attributes, ...listeners }, isDragging)}
    </div>
  );
}

export default function SidebarEditNav({
  topics, topicFolders, hiddenTopicIds, sections, navOrder,
  sidebarCollapsed, t,
  onTopicsChange, onTopicFoldersChange, onNavOrderChange,
}: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [draggingTopicId, setDraggingTopicId] = useState<string | null>(null);
  const [hoverFolderId, setHoverFolderId] = useState<string | null>(null);

  const toggleFolder = (id: string) =>
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const visible = useMemo(
    () => [...topics].filter(tp => !hiddenTopicIds.includes(tp.id)),
    [topics, hiddenTopicIds],
  );
  const unfiledTopics = useMemo(() => visible.filter(tp => !tp.folderId), [visible]);
  const topicsInFolder = useMemo(() => {
    const map: Record<string, Topic[]> = {};
    for (const f of topicFolders) {
      map[f.id] = visible.filter(tp => tp.folderId === f.id).sort((a, b) => a.order - b.order);
    }
    return map;
  }, [topicFolders, visible]);

  type TopItem =
    | { key: string; type: 'topic';   order: number; topic: Topic }
    | { key: string; type: 'folder';  order: number; folder: TopicFolder }
    | { key: string; type: 'section'; order: number; section: SectionDef };

  const orderOf = (id: string, fallback: number) =>
    navOrder ? (navOrder.indexOf(id) === -1 ? 9999 + fallback : navOrder.indexOf(id)) : fallback;

  const topItems: TopItem[] = useMemo(() => [
    ...unfiledTopics.map(tp => ({ key: tp.id, type: 'topic'   as const, order: orderOf(tp.id, tp.order),  topic: tp })),
    ...topicFolders.map(f  => ({ key: f.id,  type: 'folder'  as const, order: orderOf(f.id, f.order),    folder: f })),
    ...sections.map((s, i) => ({ key: s.id,  type: 'section' as const, order: orderOf(s.id, 1000 + i),   section: s })),
  ].sort((a, b) => a.order - b.order), [unfiledTopics, topicFolders, sections, navOrder]);

  // Emit a full navOrder array reflecting the new positions
  const emitOrder = (reordered: TopItem[]) => {
    // Rebuild topic/folder numeric orders too
    const topicUpdates: Record<string, number> = {};
    const folderUpdates: Record<string, number> = {};
    const newNavOrder: string[] = [];
    reordered.forEach((item, idx) => {
      newNavOrder.push(item.key);
      if (item.type === 'topic')  topicUpdates[item.topic.id]  = idx;
      if (item.type === 'folder') folderUpdates[item.folder.id] = idx;
    });
    onTopicsChange(topics.map(tp => {
      const o = topicUpdates[tp.id];
      return o !== undefined ? { ...tp, order: o } : tp;
    }));
    onTopicFoldersChange(topicFolders.map(f => {
      const o = folderUpdates[f.id];
      return o !== undefined ? { ...f, order: o } : f;
    }));
    onNavOrderChange(newNavOrder);
  };

  const handleDragStart = ({ active }: DragStartEvent) => {
    const id = String(active.id);
    const item = topItems.find(i => i.key === id);
    setDraggingTopicId(item?.type === 'topic' ? id : null);
    setHoverFolderId(null);
  };

  const handleDragOver = ({ over }: DragOverEvent) => {
    if (!draggingTopicId || !over) { setHoverFolderId(null); return; }
    const overItem = topItems.find(i => i.key === String(over.id));
    setHoverFolderId(overItem?.type === 'folder' ? overItem.folder.id : null);
  };

  const handleTopDragEnd = ({ active, over }: DragEndEvent) => {
    setDraggingTopicId(null);
    setHoverFolderId(null);
    if (!over || active.id === over.id) return;

    const activeItem = topItems.find(i => i.key === String(active.id));
    const overItem   = topItems.find(i => i.key === String(over.id));
    if (!activeItem || !overItem) return;

    // Topic dropped onto folder → assign to folder
    if (activeItem.type === 'topic' && overItem.type === 'folder') {
      const folderId = overItem.folder.id;
      const newOrder = (topicsInFolder[folderId] ?? []).length;
      onTopicsChange(topics.map(tp =>
        tp.id === activeItem.topic.id ? { ...tp, folderId, order: newOrder } : tp,
      ));
      onTopicFoldersChange(topicFolders.map(f =>
        f.id === folderId ? { ...f, collapsed: false } : f,
      ));
      setExpandedFolders(prev => new Set([...prev, folderId]));
      return;
    }

    const oldIdx = topItems.findIndex(i => i.key === String(active.id));
    const newIdx = topItems.findIndex(i => i.key === String(over.id));
    if (oldIdx === -1 || newIdx === -1) return;
    emitOrder(arrayMove(topItems, oldIdx, newIdx));
  };

  const handleFolderDragEnd = (folderId: string) => ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const ft = topicsInFolder[folderId] ?? [];
    const oldIdx = ft.findIndex(tp => tp.id === String(active.id));
    const newIdx = ft.findIndex(tp => tp.id === String(over.id));
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(ft, oldIdx, newIdx);
    onTopicsChange(topics.map(tp => {
      const idx = reordered.findIndex(r => r.id === tp.id);
      return idx !== -1 ? { ...tp, order: idx } : tp;
    }));
  };

  const moveOutOfFolder = (topicId: string) => {
    const maxOrder = Math.max(-1, ...topItems.map(i => i.order)) + 1;
    onTopicsChange(topics.map(tp =>
      tp.id === topicId ? { ...tp, folderId: undefined, order: maxOrder } : tp,
    ));
  };

  const textFade: React.CSSProperties = {
    opacity: sidebarCollapsed ? 0 : 1,
    transition: 'opacity 0.16s ease',
    whiteSpace: 'nowrap', overflow: 'hidden',
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleTopDragEnd}
      modifiers={[restrictToVerticalAxis]}
    >
      <SortableContext items={topItems.map(i => i.key)} strategy={verticalListSortingStrategy}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.12rem' }}>

          {topItems.map(item => (
            <SortableRow key={item.key} id={item.key}>
              {(dragProps, isDragging) => {

                // ── Section row ────────────────────────────────────────────
                if (item.type === 'section') {
                  const Icon = item.section.icon;
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', opacity: isDragging ? 0.45 : 1 }}>
                      <span {...dragProps} style={{ cursor: 'grab', color: t.textDim, display: 'flex', padding: '0 3px', flexShrink: 0, touchAction: 'none' }}>
                        <GripVertical size={12} strokeWidth={1.5} />
                      </span>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.38rem 0.45rem', borderRadius: '6px' }}>
                        <Icon size={15} strokeWidth={1.5} color={t.textMuted} style={{ flexShrink: 0 }} />
                        <span style={{ ...textFade, fontSize: '0.84rem', color: t.textMuted, flex: 1 }}>
                          {item.section.label}
                        </span>
                      </div>
                    </div>
                  );
                }

                // ── Folder row ─────────────────────────────────────────────
                if (item.type === 'folder') {
                  const isExpanded   = expandedFolders.has(item.folder.id);
                  const isDropTarget = draggingTopicId !== null && hoverFolderId === item.folder.id;
                  const folderTopics = topicsInFolder[item.folder.id] ?? [];
                  const accentColor  = item.folder.color ?? t.doneAccent;

                  return (
                    <div style={{ opacity: isDragging ? 0.45 : 1 }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.4rem',
                        padding: '0.35rem 0.45rem 0.35rem 0.3rem',
                        background: isDropTarget ? `${accentColor}22` : isDragging ? t.todoBg : t.panel,
                        border: `1px solid ${isDropTarget ? accentColor : isDragging ? t.borderStrong : t.border}`,
                        borderRadius: isExpanded ? '6px 6px 0 0' : '6px',
                        transition: 'background 0.12s, border-color 0.12s',
                        boxShadow: isDropTarget ? `0 0 0 2px ${accentColor}33` : 'none',
                      }}>
                        <span
                          {...dragProps}
                          style={{ cursor: 'grab', color: t.textDim, display: 'flex', flexShrink: 0, touchAction: 'none', padding: '0 2px' }}
                        >
                          <GripVertical size={12} strokeWidth={1.5} />
                        </span>
                        <button
                          onClick={() => toggleFolder(item.folder.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                            flex: 1, background: 'none', border: 'none',
                            cursor: 'pointer', padding: 0,
                            fontFamily: 'inherit', minWidth: 0,
                          }}
                        >
                          <Folder
                            size={13} strokeWidth={1.5}
                            color={isDropTarget ? accentColor : (item.folder.color ?? t.textDim)}
                            style={{ flexShrink: 0 }}
                          />
                          <span style={{ ...textFade, fontSize: '0.78rem', fontWeight: 500, color: isDropTarget ? accentColor : t.textDim, flex: 1, textAlign: 'left' }}>
                            {isDropTarget ? `add to ${item.folder.name || 'folder'}` : (item.folder.name || '(folder)')}
                          </span>
                          {!sidebarCollapsed && !isDropTarget && (
                            isExpanded
                              ? <ChevronDown size={11} strokeWidth={1.6} color={t.textDim} style={{ flexShrink: 0 }} />
                              : <ChevronRight size={11} strokeWidth={1.6} color={t.textDim} style={{ flexShrink: 0 }} />
                          )}
                        </button>
                      </div>

                      {isExpanded && (
                        <div style={{
                          border: `1px solid ${t.border}`, borderTop: 'none',
                          borderRadius: '0 0 6px 6px', background: t.bgAlt, overflow: 'hidden',
                        }}>
                          {folderTopics.length === 0 ? (
                            <div style={{ padding: '0.42rem 0.85rem', fontSize: '0.71rem', color: t.textDim, fontStyle: 'italic' }}>
                              empty folder
                            </div>
                          ) : (
                            <DndContext
                              sensors={sensors}
                              collisionDetection={closestCenter}
                              onDragEnd={handleFolderDragEnd(item.folder.id)}
                              modifiers={[restrictToVerticalAxis]}
                            >
                              <SortableContext items={folderTopics.map(tp => tp.id)} strategy={verticalListSortingStrategy}>
                                {folderTopics.map((topic, idx) => {
                                  const Icon = iconForTopic(topic.icon);
                                  return (
                                    <SortableRow key={topic.id} id={topic.id}>
                                      {(tProps, tDragging) => (
                                        <div style={{
                                          display: 'flex', alignItems: 'center', paddingLeft: '0.35rem',
                                          opacity: tDragging ? 0.45 : 1,
                                          borderBottom: idx < folderTopics.length - 1 ? `1px solid ${t.border}` : 'none',
                                        }}>
                                          <span {...tProps} style={{ cursor: 'grab', color: t.textDim, display: 'flex', padding: '0 2px', flexShrink: 0, touchAction: 'none' }}>
                                            <GripVertical size={11} strokeWidth={1.5} />
                                          </span>
                                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.34rem 0.3rem' }}>
                                            <Icon size={13} strokeWidth={1.5} color={topic.color} style={{ flexShrink: 0 }} />
                                            <span style={{ ...textFade, fontSize: '0.82rem', color: t.textMuted, flex: 1 }}>
                                              {topic.name || '(unnamed)'}
                                            </span>
                                          </div>
                                          <button
                                            onClick={() => moveOutOfFolder(topic.id)}
                                            title="Move out of folder"
                                            style={{
                                              background: 'none', border: 'none', cursor: 'pointer',
                                              color: t.textDim, padding: '0.28rem 0.45rem',
                                              display: 'flex', alignItems: 'center', flexShrink: 0,
                                              opacity: sidebarCollapsed ? 0 : 0.7,
                                              transition: 'opacity 0.12s, color 0.12s',
                                              pointerEvents: sidebarCollapsed ? 'none' : 'auto',
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = t.textMuted; }}
                                            onMouseLeave={e => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.color = t.textDim; }}
                                          >
                                            <FolderMinus size={12} strokeWidth={1.5} />
                                          </button>
                                        </div>
                                      )}
                                    </SortableRow>
                                  );
                                })}
                              </SortableContext>
                            </DndContext>
                          )}
                        </div>
                      )}
                    </div>
                  );
                }

                // ── Unfiled topic row ──────────────────────────────────────
                const Icon = iconForTopic(item.topic.icon);
                return (
                  <div style={{ display: 'flex', alignItems: 'center', opacity: isDragging ? 0.45 : 1 }}>
                    <span {...dragProps} style={{ cursor: 'grab', color: t.textDim, display: 'flex', padding: '0 3px', flexShrink: 0, touchAction: 'none' }}>
                      <GripVertical size={12} strokeWidth={1.5} />
                    </span>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.38rem 0.45rem', borderRadius: '6px' }}>
                      <Icon size={15} strokeWidth={1.5} color={item.topic.color} style={{ flexShrink: 0 }} />
                      <span style={{ ...textFade, fontSize: '0.84rem', color: t.textMuted, flex: 1 }}>
                        {item.topic.name || '(unnamed)'}
                      </span>
                    </div>
                  </div>
                );
              }}
            </SortableRow>
          ))}

          {topItems.length === 0 && (
            <div style={{ fontSize: '0.74rem', color: t.textDim, padding: '0.5rem 0.65rem' }}>
              No topics yet. Add one in Settings.
            </div>
          )}

        </div>
      </SortableContext>
    </DndContext>
  );
}
