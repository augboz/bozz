import React, { useState } from 'react';
import {
  Plus, X, ChevronDown, ChevronRight, GripVertical,
  ListTree, Music, Briefcase, BookOpen, Heart, Star, Flame,
  Code, Dumbbell, Plane, Coffee, ShoppingBag, Gamepad2,
  Pencil, Camera, Headphones, Globe, Wrench, FileText,
} from 'lucide-react';
import type { Theme, Topic, TopicStage } from '../../../lib/types';

interface Props {
  t: Theme;
  topics: Topic[];
  setTopics: (next: Topic[]) => void;
}

const COLOR_PRESETS = [
  '#7da7d9', '#c9a8d4', '#a1bdc7', '#b8c7a1', '#d4b896',
  '#c7a1a1', '#bfa8c9', '#a8c7b4', '#d0b89a', '#e8a55a',
];

const STAGE_COLORS = [
  '#7a93ad', '#d99a52', '#6fb088', '#dc5050', '#bfa8c9',
];

// Icon options the user can choose from
export const TOPIC_ICONS: Array<{ name: string; Icon: React.ElementType }> = [
  { name: 'list',       Icon: ListTree },
  { name: 'music',      Icon: Music },
  { name: 'work',       Icon: Briefcase },
  { name: 'book',       Icon: BookOpen },
  { name: 'health',     Icon: Heart },
  { name: 'star',       Icon: Star },
  { name: 'flame',      Icon: Flame },
  { name: 'code',       Icon: Code },
  { name: 'fitness',    Icon: Dumbbell },
  { name: 'travel',     Icon: Plane },
  { name: 'coffee',     Icon: Coffee },
  { name: 'shopping',   Icon: ShoppingBag },
  { name: 'gaming',     Icon: Gamepad2 },
  { name: 'writing',    Icon: Pencil },
  { name: 'photo',      Icon: Camera },
  { name: 'audio',      Icon: Headphones },
  { name: 'web',        Icon: Globe },
  { name: 'tools',      Icon: Wrench },
  { name: 'cv',         Icon: FileText },
];

export function iconForTopic(iconName?: string): React.ElementType {
  return TOPIC_ICONS.find(i => i.name === iconName)?.Icon ?? ListTree;
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function makeBlankTopic(order: number): Topic {
  const color = COLOR_PRESETS[Math.floor(Math.random() * COLOR_PRESETS.length)];
  return {
    id: genId(),
    name: '',
    color,
    icon: 'list',
    keywords: [],
    stages: [
      { id: genId(), label: 'To do', color: STAGE_COLORS[0] },
      { id: genId(), label: 'Doing', color: STAGE_COLORS[1] },
      { id: genId(), label: 'Done',  color: STAGE_COLORS[2], done: true },
    ],
    items: [],
    order,
    sortMode: 'manual',
  };
}

export default function TopicsBlock({ t, topics, setTopics }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const update = (id: string, patch: Partial<Topic>) =>
    setTopics(topics.map(top => top.id === id ? { ...top, ...patch } : top));

  const addTopic = () => {
    const fresh = makeBlankTopic(topics.length);
    setTopics([...topics, fresh]);
    setEditingId(fresh.id);
  };

  const removeTopic = (id: string) => {
    const top = topics.find(x => x.id === id);
    const itemCount = top?.items.length ?? 0;
    const msg = itemCount > 0
      ? `Delete "${top?.name || 'this topic'}"? You'll lose ${itemCount} task${itemCount !== 1 ? 's' : ''} inside it.`
      : `Delete "${top?.name || 'this topic'}"?`;
    if (!window.confirm(msg)) return;
    const next = topics.filter(x => x.id !== id).map((x, i) => ({ ...x, order: i }));
    setTopics(next);
    if (editingId === id) setEditingId(null);
  };

  const move = (id: string, direction: -1 | 1) => {
    const idx = topics.findIndex(x => x.id === id);
    if (idx < 0) return;
    const target = idx + direction;
    if (target < 0 || target >= topics.length) return;
    const reordered = [...topics];
    [reordered[idx], reordered[target]] = [reordered[target], reordered[idx]];
    setTopics(reordered.map((x, i) => ({ ...x, order: i })));
  };

  return (
    <div>
      {topics.length === 0 && (
        <div style={{
          padding: '0.85rem 1rem',
          background: t.todoBg, border: `1px dashed ${t.border}`, borderRadius: '10px',
          fontSize: '0.78rem', color: t.textMuted, lineHeight: 1.55,
          marginBottom: '0.6rem',
        }}>
          No topics yet. Add one to create a task list — give it a name, choose an icon,
          and define your stages (e.g. <em>To do → Doing → Done</em>).
        </div>
      )}

      <div style={{ display: 'grid', gap: '0.5rem' }}>
        {topics.map((topic, idx) => (
          <TopicCard
            key={topic.id}
            t={t}
            topic={topic}
            expanded={editingId === topic.id}
            onToggle={() => setEditingId(editingId === topic.id ? null : topic.id)}
            onChange={(patch) => update(topic.id, patch)}
            onDelete={() => removeTopic(topic.id)}
            onMoveUp={idx > 0 ? () => move(topic.id, -1) : undefined}
            onMoveDown={idx < topics.length - 1 ? () => move(topic.id, 1) : undefined}
          />
        ))}
      </div>

      <button
        onClick={addTopic}
        style={{
          marginTop: topics.length > 0 ? '0.65rem' : 0,
          display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
          background: 'transparent', border: `1px dashed ${t.borderStrong}`,
          borderRadius: '8px', padding: '0.5rem 0.85rem',
          color: t.textMuted, cursor: 'pointer',
          fontFamily: 'inherit', fontSize: '0.8rem',
        }}
      >
        <Plus size={14} strokeWidth={1.6} /> Add topic
      </button>
    </div>
  );
}

// ── Topic card ─────────────────────────────────────────────────────────────

function TopicCard({ t, topic, expanded, onToggle, onChange, onDelete, onMoveUp, onMoveDown }: {
  t: Theme; topic: Topic; expanded: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<Topic>) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const [keywordInput, setKeywordInput] = useState('');
  const [newStageInput, setNewStageInput] = useState('');
  const [showIconPicker, setShowIconPicker] = useState(false);

  const CurrentIcon = iconForTopic(topic.icon);

  const cycleColor = () => {
    const next = COLOR_PRESETS[(COLOR_PRESETS.indexOf(topic.color) + 1) % COLOR_PRESETS.length];
    onChange({ color: next });
  };

  const setStage = (idx: number, patch: Partial<TopicStage>) => {
    const next = topic.stages.map((s, i) => i === idx ? { ...s, ...patch } : s);
    onChange({ stages: next });
  };
  const removeStage = (idx: number) => {
    if (topic.stages.length <= 1) return;
    onChange({ stages: topic.stages.filter((_, i) => i !== idx) });
  };
  const addStage = () => {
    const label = newStageInput.trim();
    if (!label) return;
    const nextColor = STAGE_COLORS[topic.stages.length % STAGE_COLORS.length];
    onChange({ stages: [...topic.stages, { id: genId(), label, color: nextColor }] });
    setNewStageInput('');
  };
  const moveStage = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= topic.stages.length) return;
    const next = [...topic.stages];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange({ stages: next });
  };

  const addKeyword = () => {
    const kw = keywordInput.trim().toLowerCase();
    if (!kw) return;
    if (topic.keywords.includes(kw)) { setKeywordInput(''); return; }
    onChange({ keywords: [...topic.keywords, kw] });
    setKeywordInput('');
  };
  const removeKeyword = (kw: string) =>
    onChange({ keywords: topic.keywords.filter(k => k !== kw) });

  const inp: React.CSSProperties = {
    background: t.input, border: `1px solid ${t.border}`, borderRadius: '7px',
    padding: '0.42rem 0.6rem', color: t.text, fontSize: '0.82rem',
    fontFamily: 'inherit', outline: 'none', flex: 1, minWidth: 0,
  };

  return (
    <div style={{ border: `1px solid ${t.border}`, borderRadius: '10px', background: t.todoBg, overflow: 'hidden' }}>
      {/* Header */}
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          gap: '0.55rem', padding: '0.7rem 0.85rem',
          background: 'transparent', border: 'none', cursor: 'pointer',
          fontFamily: 'inherit', textAlign: 'left',
        }}
      >
        <GripVertical size={13} strokeWidth={1.5} color={t.textDim} style={{ flexShrink: 0 }} />
        <CurrentIcon size={14} strokeWidth={1.5} color={topic.color} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0, fontSize: '0.9rem', color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {topic.name || <span style={{ color: t.textDim, fontStyle: 'italic' }}>(unnamed topic)</span>}
        </span>
        <span style={{ fontSize: '0.68rem', color: t.textDim, flexShrink: 0 }}>
          {topic.stages.length} stage{topic.stages.length !== 1 ? 's' : ''} · {topic.items.length} item{topic.items.length !== 1 ? 's' : ''}
        </span>
        {expanded
          ? <ChevronDown size={14} strokeWidth={1.6} color={t.textDim} style={{ flexShrink: 0 }} />
          : <ChevronRight size={14} strokeWidth={1.6} color={t.textDim} style={{ flexShrink: 0 }} />}
      </button>

      {expanded && (
        <div style={{ padding: '0.4rem 0.85rem 0.9rem', borderTop: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

          {/* Name + colour + icon row */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={lbl(t)}>Name</label>
              <input
                value={topic.name}
                onChange={(e) => onChange({ name: e.target.value })}
                placeholder="e.g. Job hunt"
                style={{ ...inp, width: '100%' }}
              />
            </div>
            {/* Colour swatch */}
            <div>
              <label style={lbl(t)}>Colour</label>
              <button
                onClick={cycleColor}
                title="Click to cycle colour"
                style={{
                  width: '36px', height: '36px', borderRadius: '8px',
                  background: topic.color, border: `2px solid ${t.border}`,
                  cursor: 'pointer', flexShrink: 0,
                }}
              />
            </div>
            {/* Icon picker */}
            <div style={{ position: 'relative' }}>
              <label style={lbl(t)}>Icon</label>
              <button
                onClick={() => setShowIconPicker(v => !v)}
                title="Pick icon"
                style={{
                  width: '36px', height: '36px', borderRadius: '8px',
                  background: t.input, border: `1px solid ${t.border}`,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: topic.color,
                }}
              >
                <CurrentIcon size={16} strokeWidth={1.5} />
              </button>
              {showIconPicker && (
                <div style={{
                  position: 'absolute', bottom: '42px', right: 0, zIndex: 50,
                  background: t.panel, border: `1px solid ${t.borderStrong}`,
                  borderRadius: '10px', padding: '0.5rem',
                  display: 'grid', gridTemplateColumns: 'repeat(5, 32px)', gap: '0.3rem',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
                  maxHeight: '200px', overflowY: 'auto',
                }}>
                  {TOPIC_ICONS.map(({ name, Icon }) => (
                    <button
                      key={name}
                      onClick={() => { onChange({ icon: name }); setShowIconPicker(false); }}
                      title={name}
                      style={{
                        width: '32px', height: '32px', borderRadius: '6px',
                        background: topic.icon === name ? topic.color : 'transparent',
                        border: `1px solid ${topic.icon === name ? topic.color : t.border}`,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: topic.icon === name ? '#fff' : t.textMuted,
                      }}
                    >
                      <Icon size={14} strokeWidth={1.5} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Stages */}
          <div>
            <label style={lbl(t)}>
              Stages
              <span style={{ color: t.textDim, fontWeight: 400, marginLeft: '0.4rem' }}>
                — mark the last stage as "done" so completed items move to the done pile
              </span>
            </label>
            <div style={{ display: 'grid', gap: '0.35rem' }}>
              {topic.stages.map((s, i) => (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.45rem',
                  background: t.input, border: `1px solid ${s.done ? t.doneBorder : t.border}`,
                  borderRadius: '7px', padding: '0.35rem 0.45rem',
                }}>
                  {/* Stage colour dot */}
                  <span
                    onClick={() => {
                      const next = STAGE_COLORS[(STAGE_COLORS.indexOf(s.color ?? STAGE_COLORS[0]) + 1) % STAGE_COLORS.length];
                      setStage(i, { color: next });
                    }}
                    title="Click to change colour"
                    style={{ width: '12px', height: '12px', borderRadius: '50%', background: s.color ?? t.textDim, cursor: 'pointer', flexShrink: 0 }}
                  />
                  <input
                    value={s.label}
                    onChange={(e) => setStage(i, { label: e.target.value })}
                    placeholder="stage name"
                    style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: t.text, fontSize: '0.8rem', fontFamily: 'inherit', padding: '0.15rem' }}
                  />
                  {/* Done toggle — clear label */}
                  <button
                    onClick={() => setStage(i, { done: !s.done })}
                    title={s.done ? 'This stage marks completion — click to unmark' : 'Mark as completion stage'}
                    aria-pressed={!!s.done}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
                      padding: '0.15rem 0.5rem', borderRadius: '999px', border: 'none',
                      fontSize: '0.65rem', fontFamily: 'inherit', cursor: 'pointer',
                      background: s.done ? t.doneAccent : t.borderStrong,
                      color: s.done ? '#fff' : t.textDim,
                      transition: 'background 0.15s',
                      flexShrink: 0,
                    }}
                  >
                    ✓ done
                  </button>
                  <button onClick={() => moveStage(i, -1)} disabled={i === 0} aria-label="Move up" style={miniBtn(t, i === 0)}>↑</button>
                  <button onClick={() => moveStage(i, 1)} disabled={i === topic.stages.length - 1} aria-label="Move down" style={miniBtn(t, i === topic.stages.length - 1)}>↓</button>
                  <button onClick={() => removeStage(i)} disabled={topic.stages.length <= 1} aria-label="Remove" style={miniBtn(t, topic.stages.length <= 1)}>
                    <X size={11} strokeWidth={1.6} />
                  </button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
              <input
                value={newStageInput}
                onChange={(e) => setNewStageInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addStage(); }}
                placeholder="add a stage…"
                style={inp}
              />
              <button onClick={addStage} style={smallBtn(t)}><Plus size={12} strokeWidth={1.6} /> Add</button>
            </div>
          </div>

          {/* Keywords */}
          <div>
            <label style={lbl(t)}>
              Voice keywords
              <span style={{ color: t.textDim, fontWeight: 400, marginLeft: '0.35rem' }}>(optional)</span>
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: topic.keywords.length > 0 ? '0.4rem' : 0 }}>
              {topic.keywords.map(kw => (
                <span key={kw} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: t.input, border: `1px solid ${t.border}`, borderRadius: '999px', padding: '0.15rem 0.5rem 0.15rem 0.65rem', fontSize: '0.72rem', color: t.text }}>
                  {kw}
                  <button onClick={() => removeKeyword(kw)} style={{ background: 'transparent', border: 'none', color: t.textDim, cursor: 'pointer', padding: '0.1rem', display: 'flex' }}>
                    <X size={10} strokeWidth={1.6} />
                  </button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <input value={keywordInput} onChange={(e) => setKeywordInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addKeyword(); }} placeholder="add keyword and press Enter…" style={inp} />
              <button onClick={addKeyword} style={smallBtn(t)}><Plus size={12} strokeWidth={1.6} /> Add</button>
            </div>
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.4rem', borderTop: `1px solid ${t.border}`, paddingTop: '0.55rem' }}>
            <div style={{ display: 'flex', gap: '0.3rem' }}>
              {onMoveUp && <button onClick={onMoveUp} style={smallBtn(t)}>↑ Up</button>}
              {onMoveDown && <button onClick={onMoveDown} style={smallBtn(t)}>↓ Down</button>}
            </div>
            <button onClick={onDelete} style={{ ...smallBtn(t), borderColor: t.alertBorder, color: t.alert }}>
              Delete topic
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const lbl = (t: Theme): React.CSSProperties => ({
  display: 'block', fontSize: '0.7rem', color: t.textMuted,
  marginBottom: '0.35rem', letterSpacing: '0.02em',
});
const smallBtn = (t: Theme): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
  background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '7px',
  padding: '0.35rem 0.65rem', color: t.textMuted, cursor: 'pointer',
  fontFamily: 'inherit', fontSize: '0.74rem', flexShrink: 0,
});
const miniBtn = (t: Theme, disabled: boolean): React.CSSProperties => ({
  background: 'transparent', border: 'none',
  color: disabled ? t.textDim : t.textMuted,
  cursor: disabled ? 'not-allowed' : 'pointer',
  padding: '0.2rem 0.3rem', borderRadius: '4px',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: 'inherit', fontSize: '0.78rem',
  opacity: disabled ? 0.4 : 1, flexShrink: 0,
});
