import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { Theme, Topic, TopicItem, TopicStage } from '../../lib/types';
import { SectionHeader } from '../shared/ui';
import { rowStyle, textStyle, iconBtn } from '../shared/styles';
import DonePile from '../shared/DonePile';
import DeadlineControl from '../shared/DeadlineControl';
import type { ListItem } from '../../lib/types';

interface Props {
  topic: Topic;
  onChange: (next: Topic) => void;
  t: Theme;
}

/** Map a TopicStage to the nearest ListItem status — used for row styling. */
function stageStatus(stages: TopicStage[], stageId: string): 'todo' | 'doing' | 'done' {
  const stage = stages.find(s => s.id === stageId);
  if (!stage) return 'todo';
  if (stage.done) return 'done';
  const activeStages = stages.filter(s => !s.done);
  return activeStages[0]?.id === stageId ? 'todo' : 'doing';
}

/** Convert a TopicItem to a ListItem shape for DonePile. */
function toListItem(item: TopicItem): ListItem {
  return {
    id: item.id,
    text: item.text,
    status: 'done',
    completedAt: item.completedAt,
    deadline: item.deadline,
  };
}

export default function TopicView({ topic, onChange, t }: Props) {
  const [newText, setNewText] = useState('');
  const [filterStageId, setFilterStageId] = useState<string | null>(null);

  const activeStages = topic.stages.filter(s => !s.done);
  const doneStages = topic.stages.filter(s => s.done);
  const doneStageIds = new Set(doneStages.map(s => s.id));

  const activeItems = topic.items.filter(i => !doneStageIds.has(i.stageId));
  const doneItems = topic.items.filter(i => doneStageIds.has(i.stageId));

  const displayed = filterStageId
    ? activeItems.filter(i => i.stageId === filterStageId)
    : activeItems;

  const defaultStageId = activeStages[0]?.id ?? topic.stages[0]?.id ?? '';

  const addItem = () => {
    const text = newText.trim();
    if (!text) return;
    const item: TopicItem = {
      id: Date.now(),
      text,
      stageId: filterStageId ?? defaultStageId,
      completedAt: null,
      deadline: null,
    };
    onChange({ ...topic, items: [...topic.items, item] });
    setNewText('');
  };

  const cycleStage = (itemId: number) => {
    onChange({
      ...topic,
      items: topic.items.map(i => {
        if (i.id !== itemId) return i;
        const allIds = topic.stages.map(s => s.id);
        const idx = allIds.indexOf(i.stageId);
        const nextId = allIds[(idx + 1) % allIds.length];
        const nextStage = topic.stages.find(s => s.id === nextId);
        return {
          ...i,
          stageId: nextId,
          completedAt: nextStage?.done ? Date.now() : null,
        };
      }),
    });
  };

  const setDeadline = (itemId: number, ts: number | null) => {
    onChange({
      ...topic,
      items: topic.items.map(i => i.id === itemId ? { ...i, deadline: ts } : i),
    });
  };

  const deleteItem = (itemId: number) => {
    onChange({ ...topic, items: topic.items.filter(i => i.id !== itemId) });
  };

  const restoreItem = (itemId: number) => {
    onChange({
      ...topic,
      items: topic.items.map(i =>
        i.id === itemId ? { ...i, stageId: defaultStageId, completedAt: null } : i,
      ),
    });
  };

  // DonePile expects ListItem callbacks
  const handleRestore = (id: number) => restoreItem(id);
  const handleDeleteDone = (id: number) => deleteItem(id);

  return (
    <div>
      <SectionHeader title={topic.name} t={t} />

      {/* Stage filter pills */}
      {activeStages.length > 1 && (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <button
            onClick={() => setFilterStageId(null)}
            style={pillStyle(t, filterStageId === null, t.textMuted)}
          >
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
      <div style={{ display: 'grid', gap: '0.4rem' }}>
        {displayed.map(item => {
          const stage = topic.stages.find(s => s.id === item.stageId);
          const status = stageStatus(topic.stages, item.stageId);
          return (
            <div key={item.id} style={rowStyle(status, t)}>
              {/* Stage pill — click to cycle */}
              <button
                onClick={() => cycleStage(item.id)}
                title="Click to advance stage"
                style={{
                  background: stage?.color ?? t.textMuted,
                  border: 'none', borderRadius: '999px',
                  padding: '0.15rem 0.55rem',
                  fontSize: '0.65rem', color: '#fff', fontWeight: 500,
                  cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                }}
              >
                {stage?.label ?? '—'}
              </button>

              <span style={{ ...textStyle(status, t), flex: 1 }}>{item.text}</span>

              <DeadlineControl
                deadline={item.deadline}
                onChange={(ts) => setDeadline(item.id, ts)}
                t={t}
              />
              <button onClick={() => deleteItem(item.id)} style={iconBtn(t)} aria-label="Delete">
                <X size={14} strokeWidth={1.5} />
              </button>
            </div>
          );
        })}
        {displayed.length === 0 && (
          <div style={{ color: t.textDim, fontSize: '0.82rem', padding: '0.5rem 0', fontStyle: 'italic' }}>
            {filterStageId ? 'nothing in this stage' : 'no tasks yet'}
          </div>
        )}
      </div>

      {/* Done pile */}
      <DonePile
        items={doneItems.map(toListItem)}
        t={t}
        onRestore={handleRestore}
        onDelete={handleDeleteDone}
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
