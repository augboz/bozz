import React, { useState, useRef, useEffect } from 'react';
import { X, Plus, Check, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import type { Theme, Topic, TopicFolder, TopicStage } from '../lib/types';
import ColorBankPicker from './shared/ColorBankPicker';
import { DEFAULT_COLOR_BANK } from '../lib/appearance';
import { TOPIC_ICONS, iconForTopic } from './sections/settings/TopicsBlock';

const STAGE_COLORS = ['#7a93ad', '#d99a52', '#6fb088', '#dc5050', '#bfa8c9'];
function genId(): string { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

interface Props {
  t: Theme;
  bank: string[];
  /** Provide exactly one of topic / folder. */
  topic?: Topic;
  folder?: TopicFolder;
  onChangeTopic?: (patch: Partial<Topic>) => void;
  onChangeFolder?: (patch: Partial<TopicFolder>) => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function TopicFolderEditModal({
  t, bank, topic, folder, onChangeTopic, onChangeFolder, onDelete, onClose,
}: Props) {
  const usableBank = bank.length > 0 ? bank : DEFAULT_COLOR_BANK;
  const isTopic = !!topic;
  const name = topic?.name ?? folder?.name ?? '';
  const color = topic?.color ?? folder?.color ?? usableBank[0];
  const icon = topic?.icon ?? folder?.icon;
  const CurrentIcon = iconForTopic(icon);

  const [showIcons, setShowIcons] = useState(false);
  const [showColors, setShowColors] = useState(false);
  const [newStage, setNewStage] = useState('');

  const setName = (v: string) => isTopic ? onChangeTopic?.({ name: v }) : onChangeFolder?.({ name: v });
  const setColor = (v: string) => isTopic ? onChangeTopic?.({ color: v }) : onChangeFolder?.({ color: v });
  const setIcon = (v: string) => isTopic ? onChangeTopic?.({ icon: v }) : onChangeFolder?.({ icon: v });

  // ── Stage helpers (topics only) ──
  const setStage = (id: string, patch: Partial<TopicStage>) =>
    onChangeTopic?.({ stages: (topic?.stages ?? []).map(s => s.id === id ? { ...s, ...patch } : s) });
  const removeStage = (id: string) => {
    if ((topic?.stages.length ?? 0) <= 1) return;
    onChangeTopic?.({ stages: (topic?.stages ?? []).filter(s => s.id !== id) });
  };
  const addStage = () => {
    const label = newStage.trim();
    if (!label || !topic) return;
    const c = usableBank[topic.stages.length % usableBank.length] ?? STAGE_COLORS[topic.stages.length % STAGE_COLORS.length];
    onChangeTopic?.({ stages: [...topic.stages, { id: genId(), label, color: c }] });
    setNewStage('');
  };
  const moveStage = (idx: number, dir: -1 | 1) => {
    if (!topic) return;
    const arr = [...topic.stages];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    onChangeTopic?.({ stages: arr });
  };

  const inp: React.CSSProperties = {
    background: t.input, border: `1px solid ${t.border}`, borderRadius: '8px',
    padding: '0.5rem 0.7rem', color: t.text, fontSize: '0.85rem',
    fontFamily: 'inherit', outline: 'none', width: '100%',
  };
  const lbl: React.CSSProperties = { display: 'block', fontSize: '0.7rem', color: t.textMuted, marginBottom: '0.35rem', letterSpacing: '0.02em' };

  const popoverRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showIcons && !showColors) return;
    const h = (e: MouseEvent) => { if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) { setShowIcons(false); setShowColors(false); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showIcons, showColors]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem',
      }}
    >
      <div
        data-onb="topic-modal"
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(440px, 100%)', maxHeight: '90vh', overflowY: 'auto',
          background: t.panel, border: `1px solid ${t.borderStrong}`, borderRadius: '18px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)', padding: '1.2rem 1.3rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: t.text, fontWeight: 600 }}>
            {isTopic ? 'Topic' : 'Folder'}
          </h3>
          <button onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', color: t.textMuted, cursor: 'pointer', padding: '0.2rem' }}>
            <X size={18} strokeWidth={1.6} />
          </button>
        </div>

        {/* Name + icon + colour */}
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-end', marginBottom: '1rem' }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Name</label>
            <input data-onb="topic-name-input" value={name} onChange={e => setName(e.target.value)} placeholder={isTopic ? 'e.g. Job hunt' : 'e.g. Work'} autoFocus style={inp} />
          </div>
          <div ref={popoverRef} data-onb="topic-icon-colour" style={{ position: 'relative', display: 'flex', gap: '0.4rem' }}>
            <div>
              <label style={lbl}>Icon</label>
              <button
                onClick={() => { setShowIcons(v => !v); setShowColors(false); }}
                title="Pick icon"
                style={{ width: '38px', height: '38px', borderRadius: '9px', background: t.input, border: `1px solid ${t.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color }}
              >
                <CurrentIcon size={17} strokeWidth={1.5} />
              </button>
            </div>
            <div>
              <label style={lbl}>Colour</label>
              <button
                onClick={() => { setShowColors(v => !v); setShowIcons(false); }}
                title="Pick colour"
                style={{ width: '38px', height: '38px', borderRadius: '9px', background: color, border: `2px solid ${t.borderStrong}`, cursor: 'pointer' }}
              />
            </div>
            {showIcons && (
              <div style={{
                position: 'absolute', top: '64px', right: 0, zIndex: 60,
                background: t.panel, border: `1px solid ${t.borderStrong}`, borderRadius: '10px', padding: '0.5rem',
                display: 'grid', gridTemplateColumns: 'repeat(6, 30px)', gap: '0.25rem',
                boxShadow: '0 8px 28px rgba(0,0,0,0.4)', maxHeight: '200px', overflowY: 'auto',
              }}>
                {TOPIC_ICONS.map(({ name: n, Icon }) => (
                  <button key={n} onClick={() => { setIcon(n); setShowIcons(false); }} title={n}
                    style={{ width: '30px', height: '30px', borderRadius: '6px', background: icon === n ? color : 'transparent', border: `1px solid ${icon === n ? color : t.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: icon === n ? '#fff' : t.textMuted }}>
                    <Icon size={14} strokeWidth={1.5} />
                  </button>
                ))}
              </div>
            )}
            {showColors && (
              <div style={{ position: 'absolute', top: '64px', right: 0, zIndex: 60, background: t.panel, border: `1px solid ${t.borderStrong}`, borderRadius: '10px', padding: '0.6rem', width: '180px', boxShadow: '0 8px 28px rgba(0,0,0,0.4)' }}>
                <ColorBankPicker bank={usableBank} selected={color} onChange={c => { if (c) setColor(c); setShowColors(false); }} allowNone={false} swatchSize={22} />
              </div>
            )}
          </div>
        </div>

        {/* Topic-only: description + stages */}
        {isTopic && topic && (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <label style={lbl}>Description <span style={{ color: t.textDim }}>— helps Quick Add route to the right topic</span></label>
              <textarea
                value={topic.description ?? ''}
                onChange={e => onChangeTopic?.({ description: e.target.value })}
                placeholder="e.g. tennis, squash, court bookings, gym sessions"
                rows={2}
                style={{ ...inp, resize: 'vertical', lineHeight: 1.45 }}
              />
            </div>

            <div data-onb="topic-stages" style={{ marginBottom: '1rem' }}>
              <label style={lbl}>Stages <span style={{ color: t.textDim }}>— mark the last as "done"</span></label>
              <div style={{ display: 'grid', gap: '0.35rem' }}>
                {topic.stages.map((s, idx) => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: t.input, border: `1px solid ${s.done ? t.doneBorder : t.border}`, borderRadius: '8px', padding: '0.35rem 0.45rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <button onClick={() => moveStage(idx, -1)} disabled={idx === 0} style={arrowBtn(t, idx === 0)}><ChevronUp size={11} strokeWidth={2} /></button>
                      <button onClick={() => moveStage(idx, 1)} disabled={idx === topic.stages.length - 1} style={arrowBtn(t, idx === topic.stages.length - 1)}><ChevronDown size={11} strokeWidth={2} /></button>
                    </div>
                    <StageSwatch color={s.color ?? STAGE_COLORS[idx % STAGE_COLORS.length]} bank={usableBank} t={t} onChange={c => setStage(s.id, { color: c })} />
                    <input value={s.label} onChange={e => setStage(s.id, { label: e.target.value })} placeholder="stage name" style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: t.text, fontSize: '0.8rem', fontFamily: 'inherit' }} />
                    <button onClick={() => setStage(s.id, { done: !s.done })} aria-pressed={!!s.done} title="Mark as completion stage"
                      style={{ padding: '0.15rem 0.5rem', borderRadius: '999px', border: 'none', fontSize: '0.62rem', fontFamily: 'inherit', cursor: 'pointer', background: s.done ? t.doneAccent : t.borderStrong, color: s.done ? '#fff' : t.textDim, flexShrink: 0 }}>
                      ✓ done
                    </button>
                    <button onClick={() => removeStage(s.id)} disabled={topic.stages.length <= 1} aria-label="Remove stage"
                      style={{ background: 'transparent', border: 'none', color: topic.stages.length <= 1 ? t.textDim : t.textMuted, cursor: topic.stages.length <= 1 ? 'not-allowed' : 'pointer', padding: '0.2rem', display: 'flex', flexShrink: 0 }}>
                      <X size={12} strokeWidth={1.6} />
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
                <input value={newStage} onChange={e => setNewStage(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addStage(); }} placeholder="add a stage…" style={inp} />
                <button onClick={addStage} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px', padding: '0.4rem 0.7rem', color: t.textMuted, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.76rem', flexShrink: 0 }}>
                  <Plus size={12} strokeWidth={1.6} /> Add
                </button>
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${t.border}`, paddingTop: '0.9rem' }}>
          <button onClick={onDelete} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'transparent', border: `1px solid ${t.alertBorder}`, color: t.alert, borderRadius: '8px', padding: '0.45rem 0.8rem', fontSize: '0.78rem', fontFamily: 'inherit', cursor: 'pointer' }}>
            <Trash2 size={13} strokeWidth={1.6} /> Delete
          </button>
          <button data-onb="topic-modal-done" onClick={onClose} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: t.doneAccent, color: '#fff', border: 'none', borderRadius: '8px', padding: '0.5rem 1.1rem', fontSize: '0.82rem', fontFamily: 'inherit', cursor: 'pointer', fontWeight: 500 }}>
            <Check size={14} strokeWidth={2.5} /> Done
          </button>
        </div>
      </div>
    </div>
  );
}

function StageSwatch({ color, bank, t, onChange }: { color: string; bank: string[]; t: Theme; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button onClick={() => setOpen(v => !v)} title="Pick colour" style={{ width: '20px', height: '20px', borderRadius: '5px', background: color, border: '2px solid rgba(0,0,0,0.2)', cursor: 'pointer' }} />
      {open && (
        <div style={{ position: 'absolute', top: '24px', left: 0, zIndex: 70, background: t.panel, border: `1px solid ${t.borderStrong}`, borderRadius: '10px', padding: '0.5rem', width: '150px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          <ColorBankPicker bank={bank} selected={color} onChange={c => { if (c) onChange(c); setOpen(false); }} allowNone={false} swatchSize={18} />
        </div>
      )}
    </div>
  );
}

function arrowBtn(t: Theme, disabled: boolean): React.CSSProperties {
  return { background: 'transparent', border: 'none', color: disabled ? t.textDim : t.textMuted, cursor: disabled ? 'not-allowed' : 'pointer', padding: 0, display: 'flex', opacity: disabled ? 0.4 : 1, lineHeight: 0.6 };
}
