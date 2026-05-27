import React, { useState } from 'react';
import { Plus, X, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import type { Theme, Topic, TopicItem, TopicStage, ListItem, SortMode } from '../../lib/types';
import { SectionHeader } from '../shared/ui';
import { rowStyle, textStyle, iconBtn } from '../shared/styles';
import DonePile from '../shared/DonePile';
import DeadlineControl from '../shared/DeadlineControl';
import SortableTaskRow from '../SortableTaskRow';

interface Props {
  topic: Topic;
  onChange: (next: Topic) => void;
  t: Theme;
}

function stageStatus(stages: TopicStage[], stageId: string): 'todo' | 'doing' | 'done' {
  const stage = stages.find(s => s.id === stageId);
  if (!stage) return 'todo';
  if (stage.done) return 'done';
  const active = stages.filter(s => !s.done);
  return active[0]?.id === stageId ? 'todo' : 'doing';
}

function toListItem(item: TopicItem): ListItem {
  return { id: item.id, text: item.text, status: 'done', completedAt: item.completedAt, deadline: item.deadline };
}

// ── Stage stepper: [< stage name >] ────────────────────────────────────────
function StageStepper({ topic, item, t, onChange }: {
  topic: Topic; item: TopicItem; t: Theme;
  onChange: (next: TopicItem) => void;
}) {
  const allIds = topic.stages.map(s => s.id);
  const idx = allIds.indexOf(item.stageId);
  const stage = topic.stages[idx];
  const prevId = idx > 0 ? allIds[idx - 1] : null;
  const nextId = idx < allIds.length - 1 ? allIds[idx + 1] : null;

  const setStage = (newId: string) => {
    const newStage = topic.stages.find(s => s.id === newId);
    onChange({
      ...item,
      stageId: newId,
      completedAt: newStage?.done ? Date.now() : null,
    });
  };

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center',
      background: t.input, border: `1px solid ${t.border}`,
      borderRadius: '999px', flexShrink: 0,
      padding: '2px',
    }}>
      <button
        onClick={() => prevId && setStage(prevId)}
        disabled={!prevId}
        aria-label="Previous stage"
        style={stepBtn(t, !prevId)}
      >
        <ChevronLeft size={14} strokeWidth={1.8} />
      </button>
      <span style={{
        display: 'inline-block',
        padding: '0.15rem 0.7rem',
        fontSize: '0.72rem', fontWeight: 500,
        color: stage?.color ?? t.textMuted,
        minWidth: '64px', textAlign: 'center',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
      }}>
        {stage?.label ?? '—'}
      </span>
      <button
        onClick={() => nextId && setStage(nextId)}
        disabled={!nextId}
        aria-label="Next stage"
        style={stepBtn(t, !nextId)}
      >
        <ChevronRight size={14} strokeWidth={1.8} />
      </button>
    </div>
  );
}

// ── Sort control ───────────────────────────────────────────────────────────
function SortControl({ mode, setMode, t, accent }: {
  mode: SortMode; setMode: (m: SortMode) => void; t: Theme; accent: string;
}) {
  const opts: Array<{ id: SortMode; label: string }> = [
    { id: 'manual', label: 'manual' },
    { id: 'deadline', label: 'deadline' },
    { id: 'status', label: 'stage' },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
      <span style={{ fontSize: '0.65rem', color: t.textDim, letterSpacing: '0.05em', marginRight: '0.35rem' }}>sort</span>
      {opts.map(o => {
        const on = mode === o.id;
        return (
          <button
            key={o.id}
            onClick={() => setMode(o.id)}
            aria-pressed={on}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: '0.68rem', letterSpacing: '0.04em',
              padding: '0.15rem 0.4rem', borderRadius: '6px',
              color: on ? t.text : t.textDim,
              borderBottom: `1px solid ${on ? accent : 'transparent'}`,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function TopicView({ topic, onChange, t }: Props) {
  const [newText, setNewText] = useState('');
  const [filterStageId, setFilterStageId] = useState<string | null>(null);

  const sortMode: SortMode = topic.sortMode ?? 'manual';

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const activeStages = topic.stages.filter(s => !s.done);
  const doneStages = topic.stages.filter(s => s.done);
  const doneStageIds = new Set(doneStages.map(s => s.id));

  const activeItems = topic.items.filter(i => !doneStageIds.has(i.stageId));
  const doneItems = topic.items.filter(i => doneStageIds.has(i.stageId));

  const filtered = filterStageId
    ? activeItems.filter(i => i.stageId === filterStageId)
    : activeItems;

  // Apply sort
  const displayed = (() => {
    if (sortMode === 'deadline') {
      return [...filtered].sort((a, b) => (a.deadline ?? Infinity) - (b.deadline ?? Infinity));
    }
    if (sortMode === 'status') {
      const stageOrder = new Map(topic.stages.map((s, i) => [s.id, i]));
      return [...filtered].sort((a, b) => (stageOrder.get(a.stageId) ?? 0) - (stageOrder.get(b.stageId) ?? 0));
    }
    return filtered; // manual — preserve insertion order
  })();

  const isManual = sortMode === 'manual';
  const defaultStageId = activeStages[0]?.id ?? topic.stages[0]?.id ?? '';

  const updateItem = (next: TopicItem) =>
    onChange({ ...topic, items: topic.items.map(i => i.id === next.id ? next : i) });

  const addItem = () => {
    const text = newText.trim();
    if (!text) return;
    const item: TopicItem = {
      id: Date.now(), text,
      stageId: filterStageId ?? defaultStageId,
      completedAt: null, deadline: null,
    };
    onChange({ ...topic, items: [...topic.items, item] });
    setNewText('');
  };

  const deleteItem = (id: number) =>
    onChange({ ...topic, items: topic.items.filter(i => i.id !== id) });

  const restoreItem = (id: number) =>
    onChange({
      ...topic,
      items: topic.items.map(i =>
        i.id === id ? { ...i, stageId: defaultStageId, completedAt: null } : i,
      ),
    });

  const handleDragEnd = (e: DragEndEvent) => {
    if (!isManual) return;
    const { active: a, over } = e;
    if (!over || a.id === over.id) return;
    const oldIndex = activeItems.findIndex(i => i.id === a.id);
    const newIndex = activeItems.findIndex(i => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(activeItems, oldIndex, newIndex);
    onChange({ ...topic, items: [...reordered, ...doneItems] });
  };

  return (
    <div>
      <SectionHeader
        title={topic.name}
        t={t}
        right={<SortControl mode={sortMode} setMode={(m) => onChange({ ...topic, sortMode: m })} t={t} accent={topic.color} />}
      />

      {/* Stage filter pills */}
      {activeStages.length > 1 && (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <button onClick={() => setFilterStageId(null)} style={pillStyle(t, filterStageId === null, t.textMuted)}>
            All
          </button>
          {activeStages.map(s => (
            <button
              key={s.id}
              onClick={() => setFilterStageId(filterStageId === s.id ? null : s.id)}
              style={pillStyle(t, filterStageId === s.id, s.color ?? t.textMuted)}
            >
              {s.label}
              <span style={{ marginLeft: '0.3rem', opacity: 0.6, fontSize: '0.7em' }}>
                {activeItems.filter(i => i.stageId === s.id).length}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Items */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      >
        <SortableContext items={displayed.map(i => i.id)} strategy={verticalListSortingStrategy}>
          <div style={{ display: 'grid', gap: '0.4rem' }}>
            {displayed.map(item => {
              const status = stageStatus(topic.stages, item.stageId);
              return (
                <SortableTaskRow
                  key={item.id}
                  id={item.id}
                  t={t}
                  disabled={!isManual}
                  containerStyle={rowStyle(status, t)}
                >
                  <StageStepper topic={topic} item={item} t={t} onChange={updateItem} />
                  <span style={{ ...textStyle(status, t), flex: 1 }}>{item.text}</span>
                  <DeadlineControl
                    deadline={item.deadline}
                    onChange={(ts) => updateItem({ ...item, deadline: ts })}
                    t={t}
                  />
                  <button onClick={() => deleteItem(item.id)} style={iconBtn(t)} aria-label="Delete">
                    <X size={14} strokeWidth={1.5} />
                  </button>
                </SortableTaskRow>
              );
            })}
            {displayed.length === 0 && (
              <div style={{ color: t.textDim, fontSize: '0.82rem', padding: '0.5rem 0', fontStyle: 'italic' }}>
                {filterStageId ? 'nothing in this stage' : 'no tasks yet'}
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>

      {/* Done pile */}
      <DonePile
        items={doneItems.map(toListItem)}
        t={t}
        onRestore={restoreItem}
        onDelete={deleteItem}
      />

      {/* Add row */}
      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          value={newText}
          onChange={e => setNewText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addItem()}
          placeholder={`add to ${topic.name}…`}
          style={{
            flex: 1, minWidth: '180px',
            background: t.input, border: `1px solid ${t.border}`, borderRadius: '8px',
            padding: '0.7rem 1rem', color: t.text, fontSize: '0.9rem',
            fontFamily: 'inherit', outline: 'none',
          }}
        />
        <button
          onClick={addItem}
          aria-label="Add"
          style={{
            background: topic.color, border: 'none', borderRadius: '8px',
            color: '#fff', padding: '0.65rem 1rem',
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
            fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 500,
            opacity: newText.trim() ? 1 : 0.4,
          }}
        >
          <Plus size={15} strokeWidth={1.8} /> Add
        </button>
      </div>
    </div>
  );
}

const pillStyle = (t: Theme, active: boolean, color: string): React.CSSProperties => ({
  background: active ? color : 'transparent',
  border: `1px solid ${active ? color : t.border}`,
  borderRadius: '999px',
  padding: '0.25rem 0.75rem',
  fontSize: '0.75rem',
  color: active ? '#fff' : t.textMuted,
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'background 0.12s, color 0.12s',
});

const stepBtn = (t: Theme, disabled: boolean): React.CSSProperties => ({
  background: 'transparent', border: 'none',
  color: disabled ? t.textDim : t.textMuted,
  cursor: disabled ? 'not-allowed' : 'pointer',
  padding: '0.2rem', borderRadius: '999px',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  opacity: disabled ? 0.35 : 1,
});
