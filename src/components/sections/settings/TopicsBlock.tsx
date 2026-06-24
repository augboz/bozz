import React, { useState, useRef, useEffect } from 'react';
import {
  Plus, X, ChevronDown, ChevronRight, GripVertical, Check,
  ListTree, Music, Briefcase, BookOpen, Heart, Star, Flame,
  Code, Dumbbell, Plane, Coffee, ShoppingBag, Gamepad2,
  Pencil, Camera, Headphones, Globe, Wrench, FileText,
  Home, GraduationCap, Leaf, DollarSign, Users, Palette,
  Car, Moon, Microscope, Utensils, Bike, PiggyBank,
  Sunset, TreePine, Zap, Watch,
} from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, arrayMove, useSortable,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import type { Theme, Topic, TopicFolder, TopicStage } from '../../../lib/types';
import ColorBankPicker from '../../shared/ColorBankPicker';
import { DEFAULT_COLOR_BANK } from '../../../lib/appearance';

interface Props {
  t: Theme;
  topics: Topic[];
  setTopics: (next: Topic[]) => void;
  topicFolders: TopicFolder[];
  setTopicFolders: (next: TopicFolder[]) => void;
  colorBank?: string[];
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
  { name: 'home',       Icon: Home },
  { name: 'study',      Icon: GraduationCap },
  { name: 'nature',     Icon: Leaf },
  { name: 'finance',    Icon: DollarSign },
  { name: 'social',     Icon: Users },
  { name: 'art',        Icon: Palette },
  { name: 'car',        Icon: Car },
  { name: 'sleep',      Icon: Moon },
  { name: 'science',    Icon: Microscope },
  { name: 'food',       Icon: Utensils },
  { name: 'bike',       Icon: Bike },
  { name: 'savings',    Icon: PiggyBank },
  { name: 'evening',    Icon: Sunset },
  { name: 'outdoors',   Icon: TreePine },
  { name: 'energy',     Icon: Zap },
  { name: 'habits',     Icon: Watch },
];

export function iconForTopic(iconName?: string): React.ElementType {
  return TOPIC_ICONS.find(i => i.name === iconName)?.Icon ?? ListTree;
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function makeBlankTopic(order: number, bank: string[] = DEFAULT_COLOR_BANK): Topic {
  const color = bank[Math.floor(Math.random() * bank.length)] ?? COLOR_PRESETS[0];
  return {
    id: genId(),
    name: '',
    color,
    icon: 'list',
    keywords: [],
    stages: [
      { id: genId(), label: 'To do', color: bank[0] ?? STAGE_COLORS[0] },
      { id: genId(), label: 'Doing', color: bank[1] ?? STAGE_COLORS[1] },
      { id: genId(), label: 'Done',  color: bank[2] ?? STAGE_COLORS[2], done: true },
    ],
    items: [],
    order,
    sortMode: 'manual',
  };
}

// ── Folder row in the settings list ────────────────────────────────────────

function FolderRow({ folder, t, bank, onRename, onColorChange, onIconChange, onDelete }: {
  folder: TopicFolder; t: Theme; bank: string[];
  onRename: (name: string) => void;
  onColorChange: (color: string) => void;
  onIconChange: (icon: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(folder.name);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const iconPickerRef = useRef<HTMLDivElement>(null);
  const FolderIcon = iconForTopic(folder.icon);

  useEffect(() => {
    if (!showIconPicker) return;
    const handler = (e: MouseEvent) => {
      if (iconPickerRef.current && !iconPickerRef.current.contains(e.target as Node)) {
        setShowIconPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showIconPicker]);

  const commit = () => {
    onRename(draft.trim() || folder.name);
    setEditing(false);
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.5rem',
      background: t.todoBg, border: `1px solid ${t.border}`, borderRadius: '8px',
      padding: '0.5rem 0.75rem',
    }}>
      {/* Icon picker button */}
      <div ref={iconPickerRef} style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={() => setShowIconPicker(v => !v)}
          title="Pick icon"
          style={{
            width: '26px', height: '26px', borderRadius: '6px',
            background: t.input, border: `1px solid ${t.border}`,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: folder.color ?? t.textMuted,
          }}
        >
          <FolderIcon size={13} strokeWidth={1.5} />
        </button>
        {showIconPicker && (
          <div style={{
            position: 'absolute', top: '30px', left: 0, zIndex: 50,
            background: t.panel, border: `1px solid ${t.borderStrong}`,
            borderRadius: '10px', padding: '0.5rem',
            display: 'grid', gridTemplateColumns: 'repeat(5, 28px)', gap: '0.25rem',
            boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
          }}>
            {TOPIC_ICONS.map(({ name, Icon }) => (
              <button
                key={name}
                onClick={() => { onIconChange(name); setShowIconPicker(false); }}
                title={name}
                style={{
                  width: '28px', height: '28px', borderRadius: '5px',
                  background: folder.icon === name ? (folder.color ?? t.textMuted) : 'transparent',
                  border: `1px solid ${folder.icon === name ? (folder.color ?? t.textMuted) : t.border}`,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: folder.icon === name ? '#fff' : t.textMuted,
                }}
              >
                <Icon size={13} strokeWidth={1.5} />
              </button>
            ))}
          </div>
        )}
      </div>
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(folder.name); setEditing(false); } }}
          style={{ flex: 1, background: t.input, border: `1px solid ${t.border}`, borderRadius: '5px', padding: '0.2rem 0.4rem', color: t.text, fontSize: '0.82rem', fontFamily: 'inherit', outline: 'none' }}
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          style={{ flex: 1, background: 'transparent', border: 'none', cursor: 'text', textAlign: 'left', color: t.text, fontSize: '0.82rem', fontFamily: 'inherit', padding: 0 }}
        >
          {folder.name || <span style={{ color: t.textDim, fontStyle: 'italic' }}>(unnamed folder)</span>}
        </button>
      )}
      <SwatchButton
        color={folder.color ?? (bank[0] ?? COLOR_PRESETS[0])}
        bank={bank}
        size={14}
        onChange={c => { if (c) onColorChange(c); }}
      />
      <button
        onClick={() => {
          if (!window.confirm(`Delete folder "${folder.name}"? Topics inside will become unfiled.`)) return;
          onDelete();
        }}
        style={miniBtn(t, false)}
        title="Delete folder"
      >
        <X size={12} strokeWidth={1.6} />
      </button>
    </div>
  );
}

export default function TopicsBlock({ t, topics, setTopics, topicFolders, setTopicFolders, colorBank }: Props) {
  const bank = colorBank ?? [];
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTopicId, setNewTopicId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const update = (id: string, patch: Partial<Topic>) =>
    setTopics(topics.map(top => top.id === id ? { ...top, ...patch } : top));

  const addTopic = () => {
    const fresh = makeBlankTopic(topics.length, bank);
    setTopics([...topics, fresh]);
    setEditingId(fresh.id);
    setNewTopicId(fresh.id);
  };

  const addFolder = () => {
    const folder: TopicFolder = {
      id: genId(),
      name: '',
      order: topicFolders.length,
      collapsed: true,
    };
    setTopicFolders([...topicFolders, folder]);
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
    if (newTopicId === id) setNewTopicId(null);
  };

  const removeFolder = (folderId: string) => {
    setTopicFolders(topicFolders.filter(f => f.id !== folderId));
    // Unfile topics that were in this folder
    setTopics(topics.map(t => t.folderId === folderId ? { ...t, folderId: undefined } : t));
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = topics.findIndex(x => x.id === active.id);
    const newIdx = topics.findIndex(x => x.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    setTopics(arrayMove(topics, oldIdx, newIdx).map((x, i) => ({ ...x, order: i })));
  };

  return (
    <div>
      {/* Folders section */}
      <div style={{ marginBottom: '1.2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.72rem', color: t.textMuted, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Folders</span>
          <button data-onb="add-folder" onClick={addFolder} style={smallBtn(t)}>
            <Plus size={12} strokeWidth={1.6} /> New folder
          </button>
        </div>
        {topicFolders.length === 0 ? (
          <div style={{ fontSize: '0.75rem', color: t.textDim, padding: '0.4rem 0' }}>
            No folders yet. Create a folder to group related topics.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            {[...topicFolders].sort((a, b) => a.order - b.order).map(folder => (
              <FolderRow
                key={folder.id}
                folder={folder}
                t={t}
                bank={bank.length > 0 ? bank : DEFAULT_COLOR_BANK}
                onRename={name => setTopicFolders(topicFolders.map(f => f.id === folder.id ? { ...f, name } : f))}
                onColorChange={color => setTopicFolders(topicFolders.map(f => f.id === folder.id ? { ...f, color } : f))}
                onIconChange={icon => setTopicFolders(topicFolders.map(f => f.id === folder.id ? { ...f, icon } : f))}
                onDelete={() => removeFolder(folder.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Topics section */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.72rem', color: t.textMuted, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Topics</span>
      </div>

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

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}>
        <SortableContext items={topics.map(t => t.id)} strategy={verticalListSortingStrategy}>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {topics.map(topic => (
              <TopicCard
                key={topic.id}
                t={t}
                topic={topic}
                expanded={editingId === topic.id}
                isNew={newTopicId === topic.id}
                onToggle={() => setEditingId(editingId === topic.id ? null : topic.id)}
                onChange={(patch) => update(topic.id, patch)}
                onDelete={() => removeTopic(topic.id)}
                onDone={() => { setEditingId(null); setNewTopicId(null); }}
                bank={bank}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button
        data-onb="add-topic"
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

// ── Sortable stage row ─────────────────────────────────────────────────────

function SortableStage({ s, t, total, onSetStage, onRemove, bank }: {
  s: TopicStage; t: Theme; total: number;
  onSetStage: (patch: Partial<TopicStage>) => void;
  onRemove: () => void;
  bank: string[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: s.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.45rem',
        background: t.input, border: `1px solid ${s.done ? t.doneBorder : t.border}`,
        borderRadius: '7px', padding: '0.35rem 0.45rem',
        transform: CSS.Transform.toString(transform),
        transition, opacity: isDragging ? 0.5 : 1,
      }}
    >
      <span {...attributes} {...listeners} style={{ cursor: 'grab', color: t.textDim, display: 'flex', flexShrink: 0 }}>
        <GripVertical size={12} strokeWidth={1.5} />
      </span>
      <SwatchButton color={s.color ?? bank[0] ?? STAGE_COLORS[0]} size={12} bank={bank}
        onChange={c => { if (c) onSetStage({ color: c }); }} />
      <input
        value={s.label}
        onChange={(e) => onSetStage({ label: e.target.value })}
        placeholder="stage name"
        style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: t.text, fontSize: '0.8rem', fontFamily: 'inherit', padding: '0.15rem' }}
      />
      <button
        onClick={() => onSetStage({ done: !s.done })}
        title={s.done ? 'Remove done flag' : 'Mark as completion stage'}
        aria-pressed={!!s.done}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
          padding: '0.15rem 0.5rem', borderRadius: '999px', border: 'none',
          fontSize: '0.65rem', fontFamily: 'inherit', cursor: 'pointer',
          background: s.done ? t.doneAccent : t.borderStrong,
          color: s.done ? '#fff' : t.textDim,
          transition: 'background 0.15s', flexShrink: 0,
        }}
      >
        ✓ done
      </button>
      <button onClick={onRemove} disabled={total <= 1} aria-label="Remove stage" style={miniBtn(t, total <= 1)}>
        <X size={11} strokeWidth={1.6} />
      </button>
    </div>
  );
}

// ── Swatch button ─────────────────────────────────────────────────────────

function SwatchButton({ color, bank, onChange, size = 22 }: {
  color: string; bank: string[]; onChange: (c: string | undefined) => void; size?: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(v => !v)}
        title="Pick colour"
        style={{
          width: `${size + 10}px`, height: `${size + 10}px`, borderRadius: '6px',
          background: color, border: open ? '2px solid rgba(255,255,255,0.7)' : '2px solid rgba(0,0,0,0.15)',
          cursor: 'pointer', flexShrink: 0,
        }}
      />
      {open && (
        <div style={{
          position: 'absolute', top: `${size + 14}px`, left: 0, zIndex: 60,
          background: 'var(--app-bg, #1a1a1a)', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '10px', padding: '0.5rem',
          width: '160px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}>
          <ColorBankPicker
            bank={bank}
            selected={color}
            onChange={(c) => { onChange(c); setOpen(false); }}
            allowNone={false}
            swatchSize={20}
          />
        </div>
      )}
    </div>
  );
}

// ── Topic card ─────────────────────────────────────────────────────────────

function TopicCard({ t, topic, expanded, isNew, onToggle, onChange, onDelete, onDone, bank }: {
  t: Theme; topic: Topic; expanded: boolean; isNew: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<Topic>) => void;
  onDelete: () => void;
  onDone: () => void;
  bank: string[];
}) {
  const [newStageInput, setNewStageInput] = useState('');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const iconPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showIconPicker) return;
    const handler = (e: MouseEvent) => {
      if (iconPickerRef.current && !iconPickerRef.current.contains(e.target as Node)) {
        setShowIconPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showIconPicker]);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: topic.id });

  const stageSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const CurrentIcon = iconForTopic(topic.icon);

  const setStage = (id: string, patch: Partial<TopicStage>) => {
    onChange({ stages: topic.stages.map(s => s.id === id ? { ...s, ...patch } : s) });
  };
  const removeStage = (id: string) => {
    if (topic.stages.length <= 1) return;
    onChange({ stages: topic.stages.filter(s => s.id !== id) });
  };
  const addStage = () => {
    const label = newStageInput.trim();
    if (!label) return;
    const nextColor = bank[topic.stages.length % bank.length] ?? STAGE_COLORS[topic.stages.length % STAGE_COLORS.length];
    onChange({ stages: [...topic.stages, { id: genId(), label, color: nextColor }] });
    setNewStageInput('');
  };
  const handleStageDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = topic.stages.findIndex(s => s.id === active.id);
    const newIdx = topic.stages.findIndex(s => s.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    onChange({ stages: arrayMove(topic.stages, oldIdx, newIdx) });
  };

  const inp: React.CSSProperties = {
    background: t.input, border: `1px solid ${t.border}`, borderRadius: '7px',
    padding: '0.42rem 0.6rem', color: t.text, fontSize: '0.82rem',
    fontFamily: 'inherit', outline: 'none', flex: 1, minWidth: 0,
  };


  return (
    <div
      ref={setNodeRef}
      style={{
        border: `1px solid ${t.border}`, borderRadius: '10px', background: t.todoBg,
        transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', padding: '0.7rem 0.85rem' }}>
        <span {...attributes} {...listeners} style={{ cursor: 'grab', color: t.textDim, display: 'flex', flexShrink: 0 }}>
          <GripVertical size={13} strokeWidth={1.5} />
        </span>
        <button
          onClick={onToggle}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem',
            background: 'transparent', border: 'none', cursor: 'pointer',
            fontFamily: 'inherit', textAlign: 'left', minWidth: 0,
          }}
        >
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
      </div>

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
                autoFocus={isNew}
                style={{ ...inp, width: '100%' }}
              />
            </div>
            <div>
              <label style={lbl(t)}>Colour</label>
              <SwatchButton color={topic.color} bank={bank} onChange={c => { if (c) onChange({ color: c }); }} size={22} />
            </div>
            <div ref={iconPickerRef} style={{ position: 'relative' }}>
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

          {/* Description */}
          <div>
            <label style={lbl(t)}>
              Description
              <span style={{ color: t.textDim, fontWeight: 400, marginLeft: '0.4rem' }}>
                — helps Bozz predict the right topic in Quick Add
              </span>
            </label>
            <textarea
              value={topic.description ?? ''}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="e.g. tennis, squash, court bookings, sports matches, gym sessions"
              rows={2}
              style={{ ...inp, width: '100%', resize: 'vertical', lineHeight: 1.45, boxSizing: 'border-box' }}
            />
          </div>

          {/* Stages — draggable */}
          <div>
            <label style={lbl(t)}>
              Stages
              <span style={{ color: t.textDim, fontWeight: 400, marginLeft: '0.4rem' }}>
                — drag to reorder · mark last stage as "done"
              </span>
            </label>
            <DndContext sensors={stageSensors} collisionDetection={closestCenter} onDragEnd={handleStageDragEnd}
              modifiers={[restrictToVerticalAxis]}>
              <SortableContext items={topic.stages.map(s => s.id)} strategy={verticalListSortingStrategy}>
                <div style={{ display: 'grid', gap: '0.35rem' }}>
                  {topic.stages.map((s) => (
                    <SortableStage
                      key={s.id} s={s} t={t} total={topic.stages.length}
                      onSetStage={patch => setStage(s.id, patch)}
                      onRemove={() => removeStage(s.id)}
                      bank={bank}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
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

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${t.border}`, paddingTop: '0.55rem' }}>
            <button onClick={onDelete} style={{ ...smallBtn(t), borderColor: t.alertBorder, color: t.alert }}>
              Delete topic
            </button>
            <button
              onClick={onDone}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                background: t.doneAccent, color: '#fff', border: 'none', borderRadius: '8px',
                padding: '0.45rem 1rem', fontSize: '0.82rem', fontFamily: 'inherit',
                cursor: 'pointer', fontWeight: 500,
              }}
            >
              <Check size={13} strokeWidth={2.5} /> Done
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
