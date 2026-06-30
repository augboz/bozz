/**
 * TopicTodosWidget — shows the items & stages for the current topic page.
 * Uses ctx.currentTopicId to identify which topic to render.
 */
import React, { useState } from 'react';
import { Plus, X, GripVertical } from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, TouchSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import { Widget, WidgetHeader } from '../shared/Widget';
import { ListTree } from 'lucide-react';
import type { WidgetCtx } from './context';
import type { Topic, TopicItem, SortMode } from '../../lib/types';
import { nextId } from '../../lib/ids';
import DonePile from '../shared/DonePile';
import DeadlineControl from '../shared/DeadlineControl';

// ── Inline sortable row that includes the stage chip ─────────────────────────

interface TodoRowProps {
  item: TopicItem;
  t: WidgetCtx['t'];
  stageLabel: string;
  stageColor: string;
  isLastStage: boolean;
  sortMode: SortMode;
  onAdvance: () => void;
  onDelete: () => void;
  onDeadlineChange: (dl: number | null) => void;
  onDueMinChange: (dueMin: number | null) => void;
  onTextChange: (text: string) => void;
}

function SortableTodoRow({
  item, t, stageLabel, stageColor, isLastStage, sortMode,
  onAdvance, onDelete, onDeadlineChange, onDueMinChange, onTextChange,
}: TodoRowProps) {
  const disabled = sortMode !== 'manual';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.text);

  const commit = () => {
    const next = draft.trim();
    setEditing(false);
    if (next && next !== item.text) onTextChange(next);
    else setDraft(item.text); // reverted/empty — restore original
  };
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled,
  });

  const style: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '0.3rem',
    padding: '0.2rem 0.4rem',
    background: t.bgAlt,
    border: `1px solid ${t.border}`,
    borderRadius: '7px',
    transform: CSS.Transform.toString(transform),
    transition: [transition, 'background-color 150ms ease'].filter(Boolean).join(', '),
    opacity: isDragging ? 0.45 : 1,
    position: 'relative',
    zIndex: isDragging ? 2 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {!disabled && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          style={{
            background: 'transparent', border: 'none', padding: 0, margin: 0,
            cursor: isDragging ? 'grabbing' : 'grab', flexShrink: 0,
            display: 'flex', alignItems: 'center', color: t.textDim,
            touchAction: 'none',
          }}
        >
          <GripVertical size={12} strokeWidth={1.5} />
        </button>
      )}
      {/* Stage chip */}
      <button
        onClick={() => !isLastStage && onAdvance()}
        disabled={isLastStage}
        title={isLastStage ? stageLabel : `Advance to next stage`}
        style={{
          fontSize: '0.58rem', color: stageColor,
          background: stageColor + '20', border: `1px solid ${stageColor + '55'}`,
          padding: '2px 6px', borderRadius: '999px', whiteSpace: 'nowrap', flexShrink: 0,
          alignSelf: 'center',
          cursor: isLastStage ? 'default' : 'pointer', fontFamily: 'inherit', opacity: isLastStage ? 0.7 : 1,
        }}
      >
        {stageLabel}
      </button>
      {/* Text — click to edit inline */}
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            else if (e.key === 'Escape') { setDraft(item.text); setEditing(false); }
          }}
          style={{
            flex: 1, minWidth: 0, fontSize: '0.8rem', color: t.text,
            background: t.input, border: `1px solid ${stageColor}`, borderRadius: '5px',
            padding: '0.1rem 0.35rem', fontFamily: 'inherit', outline: 'none',
          }}
        />
      ) : (
        <span
          onClick={() => { setDraft(item.text); setEditing(true); }}
          title="Click to edit"
          style={{
            flex: 1, fontSize: '0.8rem', color: t.text, cursor: 'text',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {item.text}
        </span>
      )}
      {/* Deadline */}
      <DeadlineControl deadline={item.deadline} onChange={onDeadlineChange} dueMin={item.dueMin} onDueMin={onDueMinChange} t={t} />
      {/* Delete */}
      <button
        onClick={onDelete}
        aria-label="Delete"
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: t.textDim, padding: '2px', display: 'flex', alignItems: 'center',
          borderRadius: '4px', flexShrink: 0,
        }}
      >
        <X size={12} strokeWidth={1.5} />
      </button>
    </div>
  );
}

// ── Main widget ───────────────────────────────────────────────────────────────

export default function TopicTodosWidget({ ctx }: { ctx: WidgetCtx }) {
  const { t, topics = [], currentTopicId, onTopicChange } = ctx;
  const topic = topics.find(tp => tp.id === currentTopicId);
  const [newText, setNewText] = useState('');
  const [filterStageId, setFilterStageId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (!topic) {
    return (
      <Widget t={t} accent="#9ab8d4">
        <WidgetHeader label="Tasks" accent="#9ab8d4" t={t} icon={ListTree} />
        <div style={{ marginTop: '1rem', fontSize: '0.82rem', color: t.textMuted, lineHeight: 1.5 }}>
          No topic selected.
        </div>
      </Widget>
    );
  }

  const accent = topic.color;

  const sortMode: SortMode = topic.sortMode ?? 'manual';
  const activeStages = topic.stages.filter(s => !s.done);
  const doneStages = topic.stages.filter(s => s.done);
  const doneStageIds = new Set(doneStages.map(s => s.id));
  const activeItems = topic.items.filter(i => !doneStageIds.has(i.stageId));
  const doneItems = topic.items.filter(i => doneStageIds.has(i.stageId));
  const defaultStageId = activeStages[0]?.id ?? topic.stages[0]?.id ?? '';

  const filtered = filterStageId ? activeItems.filter(i => i.stageId === filterStageId) : activeItems;

  const displayed = (() => {
    if (sortMode === 'deadline') return [...filtered].sort((a, b) => (a.deadline ?? Infinity) - (b.deadline ?? Infinity));
    if (sortMode === 'status') {
      const stageOrder = new Map(topic.stages.map((s, i) => [s.id, i]));
      return [...filtered].sort((a, b) => (stageOrder.get(a.stageId) ?? 0) - (stageOrder.get(b.stageId) ?? 0));
    }
    return filtered;
  })();

  const updateTopic = (next: Topic) => onTopicChange?.(next);
  const updateItem = (next: TopicItem) => updateTopic({ ...topic, items: topic.items.map(i => i.id === next.id ? next : i) });
  const deleteItem = (id: number) => updateTopic({ ...topic, items: topic.items.filter(i => i.id !== id) });
  const restoreItem = (id: number) => updateTopic({
    ...topic,
    items: topic.items.map(i => i.id === id ? { ...i, stageId: defaultStageId, completedAt: null } : i),
  });

  const addItem = () => {
    const text = newText.trim();
    if (!text) return;
    const item: TopicItem = { id: nextId(), text, stageId: filterStageId ?? defaultStageId, completedAt: null, deadline: null };
    updateTopic({ ...topic, items: [...topic.items, item] });
    setNewText('');
  };

  const handleDragEnd = (e: DragEndEvent) => {
    if (sortMode !== 'manual') return;
    const { active: a, over } = e;
    if (!over || a.id === over.id) return;
    const oldIndex = activeItems.findIndex(i => i.id === a.id);
    const newIndex = activeItems.findIndex(i => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(activeItems, oldIndex, newIndex);
    updateTopic({ ...topic, items: [...reordered, ...doneItems] });
  };

  const pillStyle = (active: boolean, color: string): React.CSSProperties => ({
    background: active ? color + '20' : 'transparent',
    border: `1px solid ${active ? color : t.border}`,
    borderRadius: '999px', padding: '0.2rem 0.6rem',
    fontSize: '0.68rem', color: active ? color : t.textMuted,
    cursor: 'pointer', fontFamily: 'inherit',
  });

  const advanceStage = (item: TopicItem) => {
    const idx = topic.stages.findIndex(s => s.id === item.stageId);
    // Advance to the immediate next stage — including a `done` stage. The old
    // code skipped `done` stages (`!s.done`), which made tasks get stuck on the
    // last stage before "Done" because the only remaining stage was filtered out.
    const next = topic.stages[idx + 1];
    if (!next) return;
    updateItem({ ...item, stageId: next.id, completedAt: next.done ? Date.now() : null });
  };

  return (
    <Widget t={t} accent={accent}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
        <WidgetHeader label={topic.name} accent={accent} t={t} icon={ListTree} />
        {/* Sort mode buttons */}
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          {(['manual', 'deadline', 'status'] as SortMode[]).map(m => (
            <button key={m} onClick={() => updateTopic({ ...topic, sortMode: m })}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: '0.62rem', color: (topic.sortMode ?? 'manual') === m ? t.text : t.textDim,
                padding: '0.1rem 0.3rem',
                borderBottom: `1px solid ${(topic.sortMode ?? 'manual') === m ? accent : 'transparent'}`,
              }}>
              {m === 'status' ? 'stage' : m}
            </button>
          ))}
        </div>
      </div>

      {/* Stage filter pills */}
      {activeStages.length > 1 && (
        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          <button onClick={() => setFilterStageId(null)} style={pillStyle(filterStageId === null, t.textMuted)}>All</button>
          {activeStages.map(s => (
            <button key={s.id} onClick={() => setFilterStageId(filterStageId === s.id ? null : s.id)}
              style={pillStyle(filterStageId === s.id, s.color ?? t.textMuted)}>
              {s.label}
              <span style={{ marginLeft: '0.25rem', opacity: 0.6, fontSize: '0.7em' }}>
                {activeItems.filter(i => i.stageId === s.id).length}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Items — scrollable area */}
      <div className="thin-scroll" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <DndContext sensors={sensors} collisionDetection={closestCenter}
          onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis, restrictToParentElement]}>
          <SortableContext items={displayed.map(i => i.id)} strategy={verticalListSortingStrategy}>
            <div style={{ display: 'grid', gap: '0.3rem' }}>
              {displayed.map(item => {
                const stage = topic.stages.find(s => s.id === item.stageId);
                const stageColor = stage?.color ?? accent;
                const isLastStage = topic.stages.findIndex(s => s.id === item.stageId) === topic.stages.length - 1;
                return (
                  <SortableTodoRow
                    key={item.id}
                    item={item}
                    t={t}
                    stageLabel={stage?.label ?? ''}
                    stageColor={stageColor}
                    isLastStage={isLastStage}
                    sortMode={sortMode}
                    onAdvance={() => advanceStage(item)}
                    onDelete={() => deleteItem(item.id)}
                    onDeadlineChange={(dl) => updateItem({ ...item, deadline: dl, dueMin: dl == null ? null : item.dueMin })}
                    onDueMinChange={(dueMin) => updateItem({ ...item, dueMin })}
                    onTextChange={(text) => updateItem({ ...item, text })}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>

        {displayed.length === 0 && (
          <div style={{ fontSize: '0.82rem', color: t.textMuted, lineHeight: 1.5, padding: '0.25rem 0' }}>
            No tasks yet. Add your first one below.
          </div>
        )}

        {/* Done pile */}
        {doneItems.length > 0 && (
          <DonePile
            t={t}
            items={doneItems.map(i => ({ id: i.id, text: i.text, status: 'done' as const, completedAt: i.completedAt, deadline: i.deadline }))}
            onRestore={restoreItem}
            onDelete={deleteItem}
          />
        )}
      </div>

      {/* Add item */}
      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: `1px solid ${t.border}` }}>
        <input
          value={newText}
          onChange={e => setNewText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addItem()}
          placeholder="Add item…"
          style={{
            flex: 1, background: t.input, border: `1px solid ${t.border}`, borderRadius: '8px',
            padding: '0.45rem 0.65rem', color: t.text, fontSize: '0.82rem', fontFamily: 'inherit', outline: 'none',
          }}
        />
        <button onClick={addItem}
          style={{ background: accent, border: 'none', borderRadius: '8px', padding: '0.45rem 0.7rem', color: '#fff', cursor: 'pointer' }}>
          <Plus size={14} strokeWidth={2} />
        </button>
      </div>
    </Widget>
  );
}
