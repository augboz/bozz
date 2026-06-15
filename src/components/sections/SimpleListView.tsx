import React, { useState } from 'react';
import { isMobileViewport } from '../../lib/platform';
import { Plus, X } from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, TouchSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import type { ListItem, Status, SortMode, Theme } from '../../lib/types';
import SortableTaskRow from '../SortableTaskRow';
import { StatusToggle } from '../shared/StatusToggle';
import { SectionHeader, EmptyState } from '../shared/ui';
import DeadlineControl from '../shared/DeadlineControl';
import DonePile from '../shared/DonePile';
import DatePicker from '../shared/DatePicker';
import { rowStyle, textStyle, iconBtn } from '../shared/styles';

interface SimpleListViewProps {
  items: ListItem[]; setItems: React.Dispatch<React.SetStateAction<ListItem[]>>;
  t: Theme; accent: string; placeholder: string; emptyText: string;
  sortMode: SortMode; setSortMode: (m: SortMode) => void;
}

const statusRank: Record<Status, number> = { doing: 0, todo: 1, done: 2 };

function SortControl({ mode, setMode, t, accent }: {
  mode: SortMode; setMode: (m: SortMode) => void; t: Theme; accent: string;
}) {
  const opts: Array<{ id: SortMode; label: string }> = [
    { id: 'manual', label: 'manual' },
    { id: 'deadline', label: 'deadline' },
    { id: 'status', label: 'status' },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
      <span style={{ fontSize: '0.65rem', color: t.textDim, letterSpacing: '0.05em', marginRight: '0.35rem' }}>
        sort
      </span>
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

export default function SimpleListView({
  items, setItems, t, accent, placeholder, emptyText, sortMode, setSortMode,
}: SimpleListViewProps) {
  const [newItem, setNewItem] = useState('');
  const [newDeadline, setNewDeadline] = useState<number | null>(null);
  const circleSize = isMobileViewport() ? 13 : 16;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const active = items.filter(i => i.status !== 'done');
  const archived = items.filter(i => i.status === 'done');
  const isManual = sortMode === 'manual';

  const displayedActive = (() => {
    if (sortMode === 'deadline') {
      return [...active].sort((a, b) =>
        (a.deadline ?? Infinity) - (b.deadline ?? Infinity));
    }
    if (sortMode === 'status') {
      return [...active].sort((a, b) => statusRank[a.status] - statusRank[b.status]);
    }
    return active;
  })();

  const addItem = () => {
    if (newItem.trim()) {
      setItems(prev => [...prev, {
        id: Date.now(), text: newItem.trim(), status: 'todo',
        completedAt: null, deadline: newDeadline,
      }]);
      setNewItem('');
      setNewDeadline(null);
    }
  };

  const setStatus = (id: number, status: Status) =>
    setItems(prev => prev.map(i =>
      i.id === id
        ? { ...i, status, completedAt: status === 'done' ? Date.now() : null }
        : i));

  const restore = (id: number) =>
    setItems(prev => prev.map(i =>
      i.id === id ? { ...i, status: 'todo', completedAt: null } : i));

  const deletePermanently = (id: number) =>
    setItems(prev => prev.filter(i => i.id !== id));

  const setDeadline = (id: number, ts: number | null) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, deadline: ts } : i));

  const handleDragEnd = (e: DragEndEvent) => {
    if (!isManual) return;
    const { active: a, over } = e;
    if (over && a.id !== over.id) {
      setItems(() => {
        const oldIndex = active.findIndex(i => i.id === a.id);
        const newIndex = active.findIndex(i => i.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return items;
        // Archived items' array position is irrelevant (the pile sorts by
        // completedAt), so keep the model simple: active order then archive.
        return [...arrayMove(active, oldIndex, newIndex), ...archived];
      });
    }
  };

  return (
    <div>
      <SectionHeader
        title=""
        t={t}
        right={<SortControl mode={sortMode} setMode={setSortMode} t={t} accent={accent} />}
      />
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      >
        <SortableContext items={displayedActive.map(i => i.id)} strategy={verticalListSortingStrategy}>
          <div style={{ display: 'grid', gap: '0.4rem' }}>
            {displayedActive.map(i => (
              <SortableTaskRow
                key={i.id}
                id={i.id}
                t={t}
                disabled={!isManual}
                containerStyle={rowStyle(i.status, t)}
              >
                <StatusToggle status={i.status} onClick={(s) => setStatus(i.id, s)} t={t} size={circleSize} />
                <span style={textStyle(i.status, t)}>{i.text}</span>
                <DeadlineControl deadline={i.deadline} onChange={(ts) => setDeadline(i.id, ts)} t={t} />
                <button onClick={() => deletePermanently(i.id)} style={iconBtn(t)} aria-label="Delete">
                  <X size={14} strokeWidth={1.5} />
                </button>
              </SortableTaskRow>
            ))}
            {active.length === 0 && <EmptyState text={emptyText} t={t} />}
          </div>
        </SortableContext>
      </DndContext>

      <DonePile items={archived} t={t} onRestore={restore} onDelete={deletePermanently} />

      <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        <input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => e.key === 'Enter' && addItem()}
          style={{
            flex: 1, minWidth: '180px',
            background: t.input, border: `1px solid ${t.border}`, borderRadius: '8px',
            padding: '0.7rem 1rem', color: t.text, fontSize: '0.9rem',
            fontFamily: 'inherit', outline: 'none',
          }}
        />
        <DatePicker
          t={t}
          value={newDeadline}
          onChange={setNewDeadline}
          placeholder="no deadline"
          allowClear
        />
        <button
          onClick={addItem}
          aria-label="Add"
          style={{
            background: accent, border: 'none', borderRadius: '8px',
            color: '#fff', padding: '0.65rem 1rem',
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
            fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 500,
            opacity: newItem.trim() ? 1 : 0.4,
          }}
        >
          <Plus size={15} strokeWidth={1.8} /> Add
        </button>
      </div>
    </div>
  );
}
