import { useState } from 'react';
import { ArrowLeft, Check, RotateCcw, Volume2, VolumeX, X, Sparkles } from 'lucide-react';
import type { AppearancePrefs, BozzWorld, Theme, Topic, TopicFolder, WorldScope } from '../../lib/types';
import { SectionHeader } from '../shared/ui';
import {
  BUNDLED_WORLDS, applyWorld, revertToDefault, canApply,
  worldToTopic, worldTopicPatch, worldToFolder,
} from '../../lib/worlds';
import { FONT_STACK } from '../../lib/appearance';
import { openPlansPage } from '../../lib/billing';
import {
  play as ambientPlay, stop as ambientStop, setVolume as ambientVolume, mute as ambientMute,
} from '../../lib/ambient';

interface Props {
  t: Theme;
  appearance: AppearancePrefs;
  patchAppearance: (patch: Partial<AppearancePrefs>) => void;
  topics: Topic[];
  topicFolders: TopicFolder[];
  onTopicsChange: (next: Topic[]) => void;
  onTopicFoldersChange: (next: TopicFolder[]) => void;
  onNavigate: (sectionId: string) => void;
  onBack: () => void;
}

const SHAPE_RADIUS: Record<string, string> = { sharp: '8px', rounded: '18px', pill: '26px' };

export default function WorldsView({
  t, appearance, patchAppearance, topics, topicFolders,
  onTopicsChange, onTopicFoldersChange, onNavigate, onBack,
}: Props) {
  const activeId = appearance.activeWorldId;
  const [filter, setFilter] = useState<'all' | 'theme' | 'template'>('all');
  const [preview, setPreview] = useState<BozzWorld | null>(null);
  const [scope, setScope] = useState<WorldScope>('global');
  const [name, setName] = useState('');
  const [targetTopic, setTargetTopic] = useState<string>('');

  const shown = BUNDLED_WORLDS.filter(w => filter === 'all' || w.kind === filter);

  const openPreview = (world: BozzWorld) => {
    setPreview(world);
    // Templates default to "New topic" (they're a page); themes to "Whole of Bozz".
    setScope(world.kind === 'template' ? 'newTopic' : 'global');
    setName(world.name);
    setTargetTopic(topics[0]?.id ?? '');
  };
  const close = () => setPreview(null);

  const accept = () => {
    const world = preview;
    if (!world || !canApply(world)) return;
    if (scope === 'global') {
      patchAppearance(applyWorld(world, appearance));
      if (world.ambientSound) ambientPlay(world.ambientSound.url, appearance.ambient?.volume ?? 0.25);
      else ambientStop();
      close();
      onNavigate('home');
    } else if (scope === 'newTopic') {
      const tp = worldToTopic(world, name, topics.length);
      onTopicsChange([...topics, tp]);
      close();
      onNavigate(tp.id);
    } else if (scope === 'existingTopic') {
      if (!targetTopic) return;
      onTopicsChange(topics.map(tp => tp.id === targetTopic ? { ...tp, ...worldTopicPatch(world) } : tp));
      close();
      onNavigate(targetTopic);
    } else if (scope === 'newFolder') {
      const folder = worldToFolder(world, name, topicFolders.length);
      const tp = worldToTopic(world, name, topics.length, folder.id);
      onTopicFoldersChange([...topicFolders, folder]);
      onTopicsChange([...topics, tp]);
      close();
      onNavigate(tp.id);
    }
  };

  const revert = () => {
    patchAppearance(revertToDefault(appearance));
    ambientStop();
  };

  const ambient = appearance.ambient;

  return (
    <div style={{ maxWidth: '980px' }}>
      <button
        onClick={onBack}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
          background: 'transparent', border: 'none', color: t.textMuted,
          cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', marginBottom: '0.8rem', padding: 0,
        }}
      >
        <ArrowLeft size={15} strokeWidth={1.6} /> Back to settings
      </button>

      <SectionHeader
        title="Worlds"
        t={t}
        right={activeId && activeId !== 'default' ? (
          <button
            onClick={revert}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
              background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px',
              padding: '0.35rem 0.7rem', color: t.textMuted, cursor: 'pointer',
              fontFamily: 'inherit', fontSize: '0.74rem',
            }}
          >
            <RotateCcw size={12} strokeWidth={1.6} /> Revert look
          </button>
        ) : undefined}
      />

      <p style={{ fontSize: '0.82rem', color: t.textMuted, lineHeight: 1.55, margin: '0 0 0.9rem', fontWeight: 300 }}>
        <strong style={{ color: t.text, fontWeight: 500 }}>Themes</strong> restyle Bozz — colour,
        wallpaper and font. <strong style={{ color: t.text, fontWeight: 500 }}>Templates</strong> are
        ready-made pages with widgets for a specific job. Tap any to preview, then choose where it lands.
      </p>

      {/* Themes / Templates filter */}
      <div style={{ display: 'inline-flex', border: `1px solid ${t.border}`, borderRadius: '9px', overflow: 'hidden', marginBottom: '1.2rem' }}>
        {([['all', 'All'], ['theme', 'Themes'], ['template', 'Templates']] as const).map(([id, label], i) => {
          const on = filter === id;
          return (
            <button
              key={id}
              onClick={() => setFilter(id)}
              style={{
                background: on ? t.bgAlt : 'transparent', color: on ? t.text : t.textMuted,
                border: 'none', borderLeft: i === 0 ? 'none' : `1px solid ${t.border}`,
                padding: '0.42rem 0.95rem', fontSize: '0.78rem', fontFamily: 'inherit', cursor: 'pointer',
                fontWeight: on ? 500 : 400,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Ambient controls (shown when the active World has sound) */}
      {ambient && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem',
          border: `1px solid ${t.border}`, borderRadius: '10px', padding: '0.55rem 0.8rem',
        }}>
          <button
            onClick={() => { const m = !ambient.muted; ambientMute(m); patchAppearance({ ambient: { ...ambient, muted: m } }); }}
            style={{ background: 'transparent', border: 'none', color: t.textMuted, cursor: 'pointer', display: 'flex' }}
          >
            {ambient.muted ? <VolumeX size={16} strokeWidth={1.6} /> : <Volume2 size={16} strokeWidth={1.6} />}
          </button>
          <span style={{ fontSize: '0.74rem', color: t.textMuted }}>Ambient sound</span>
          <input
            type="range" min={0} max={100} value={Math.round((ambient.volume ?? 0.25) * 100)}
            onChange={e => { const v = Number(e.target.value) / 100; ambientVolume(v); patchAppearance({ ambient: { ...ambient, volume: v } }); }}
            style={{ flex: 1, accentColor: t.doingAccent, cursor: 'pointer' }}
          />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.9rem' }}>
        {shown.map(world => {
          const active = activeId === world.id || (!activeId && world.id === 'default');
          // Plus worlds are always teased blurred so users see the premium tier;
          // whether they can actually apply is decided in the modal (canApply).
          const isPlus = !world.free;
          return (
            <button
              key={world.id}
              onClick={() => openPreview(world)}
              style={{
                textAlign: 'left', padding: 0, cursor: 'pointer',
                background: t.todoBg, border: `1.5px solid ${active ? t.doneAccent : t.border}`,
                borderRadius: '14px', overflow: 'hidden', fontFamily: 'inherit',
                transition: 'border-color 0.15s, transform 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <div style={{ position: 'relative', height: '110px' }}>
                <img
                  src={world.previewUrl} alt={world.name}
                  style={{
                    width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                    filter: isPlus ? 'blur(6px)' : undefined, transform: isPlus ? 'scale(1.1)' : undefined,
                  }}
                />
                {active && (
                  <span style={badge(t.doneAccent)}><Check size={13} strokeWidth={2.5} /></span>
                )}
                {isPlus && (
                  <span style={{
                    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.04em',
                    textShadow: '0 1px 6px rgba(0,0,0,0.6)',
                  }}>
                    <Sparkles size={14} strokeWidth={2} style={{ marginRight: '0.35rem' }} /> Plus
                  </span>
                )}
              </div>
              <div style={{ padding: '0.7rem 0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.86rem', color: t.text, fontWeight: 500 }}>{world.name}</span>
                  {world.kind === 'template' && (
                    <span style={pill(t.textMuted, t.border)}>Template</span>
                  )}
                  {world.free && world.id !== 'default' && (
                    <span style={pill(t.doneAccent, t.doneBorder)}>Free</span>
                  )}
                </div>
                <div style={{ fontSize: '0.72rem', color: t.textMuted, marginTop: '0.2rem', lineHeight: 1.4 }}>
                  {world.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {preview && (
        <PreviewModal
          t={t} world={preview} locked={!canApply(preview)}
          scope={scope} setScope={setScope}
          name={name} setName={setName}
          topics={topics} targetTopic={targetTopic} setTargetTopic={setTargetTopic}
          onAccept={accept} onClose={close}
        />
      )}
    </div>
  );
}

// ── Preview modal ────────────────────────────────────────────────────────────

function PreviewModal({
  t, world, locked, scope, setScope, name, setName, topics, targetTopic, setTargetTopic, onAccept, onClose,
}: {
  t: Theme; world: BozzWorld; locked: boolean;
  scope: WorldScope; setScope: (s: WorldScope) => void;
  name: string; setName: (s: string) => void;
  topics: Topic[]; targetTopic: string; setTargetTopic: (s: string) => void;
  onAccept: () => void; onClose: () => void;
}) {
  const radius = SHAPE_RADIUS[world.widgetShape ?? 'rounded'];
  const font = FONT_STACK[world.font] ?? FONT_STACK.inter;
  const accent = world.accent;
  const swatches = world.colorBank.slice(0, 6);
  const hasWidgets = !!(world.topicWidgets && world.topicWidgets.length);

  const scopeOpts: Array<{ id: WorldScope; label: string }> = [
    { id: 'global', label: 'Whole of Bozz' },
    { id: 'newTopic', label: 'New topic' },
    { id: 'existingTopic', label: 'A topic' },
    { id: 'newFolder', label: 'New folder' },
  ];

  const inp: React.CSSProperties = {
    background: t.input, border: `1px solid ${t.border}`, borderRadius: '8px',
    padding: '0.5rem 0.7rem', color: t.text, fontSize: '0.82rem', fontFamily: 'inherit', outline: 'none', width: '100%',
  };

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
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(560px, 100%)', maxHeight: '90vh', overflowY: 'auto',
          background: t.panel, border: `1px solid ${t.borderStrong}`, borderRadius: '18px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)', padding: '1.2rem 1.3rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: t.text, fontWeight: 600 }}>{world.name}</h3>
              {!world.free && <span style={pill(accent, t.border)}>Plus</span>}
            </div>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: t.textMuted, lineHeight: 1.5 }}>{world.description}</p>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', color: t.textMuted, cursor: 'pointer', padding: '0.2rem', flexShrink: 0 }}>
            <X size={18} strokeWidth={1.6} />
          </button>
        </div>

        {/* Home preview mock */}
        <div style={{ position: 'relative', height: '190px', borderRadius: '14px', overflow: 'hidden', margin: '0.9rem 0', border: `1px solid ${t.border}` }}>
          <img src={world.background.url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: world.mood === 'light' ? '#f4f4f6' : '#0e0e10', opacity: world.background.dim }} />
          {/* mock widget cards in the World's style */}
          <div style={{ position: 'relative', display: 'flex', gap: '0.6rem', padding: '0.9rem', height: '100%', fontFamily: font }}>
            <div style={{ flex: 2, background: 'var(--glass-bg, rgba(255,255,255,0.1))', backdropFilter: 'blur(8px)', borderRadius: radius, border: `1px solid ${accent}55`, padding: '0.7rem' }}>
              <div style={{ width: '40%', height: '8px', borderRadius: '4px', background: accent, marginBottom: '0.5rem' }} />
              <div style={{ width: '75%', height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.4)', marginBottom: '0.35rem' }} />
              <div style={{ width: '60%', height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.3)' }} />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div style={{ flex: 1, background: 'var(--glass-bg, rgba(255,255,255,0.1))', backdropFilter: 'blur(8px)', borderRadius: radius, border: `1px solid ${accent}55` }} />
              <div style={{ flex: 1, background: accent, opacity: 0.85, borderRadius: radius }} />
            </div>
          </div>
        </div>

        {/* palette + font line */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {swatches.map(c => <span key={c} style={{ width: '16px', height: '16px', borderRadius: '4px', background: c, border: `1px solid ${t.border}` }} />)}
          </div>
          <span style={{ fontSize: '0.72rem', color: t.textDim, fontFamily: font }}>Aa · {world.font}</span>
        </div>

        {!locked ? (
          <>
            {/* Scope */}
            <div style={{ fontSize: '0.72rem', color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
              Where should it go?
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.7rem' }}>
              {scopeOpts.map(o => {
                const on = scope === o.id;
                return (
                  <button
                    key={o.id}
                    onClick={() => setScope(o.id)}
                    style={{
                      background: on ? accent : 'transparent', color: on ? '#fff' : t.textMuted,
                      border: `1px solid ${on ? accent : t.border}`, borderRadius: '999px',
                      padding: '0.35rem 0.8rem', fontSize: '0.76rem', fontFamily: 'inherit', cursor: 'pointer',
                    }}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>

            {scope === 'global' && (
              <p style={{ fontSize: '0.74rem', color: t.textMuted, margin: '0 0 0.9rem', lineHeight: 1.5 }}>
                Applies the theme, wallpaper and font across all of Bozz. Your data is untouched, and
                you can revert in one tap.
              </p>
            )}
            {(scope === 'newTopic' || scope === 'newFolder') && (
              <div style={{ marginBottom: '0.9rem' }}>
                <label style={{ fontSize: '0.74rem', color: t.textMuted, display: 'block', marginBottom: '0.3rem' }}>
                  {scope === 'newFolder' ? 'Folder name' : 'Topic name'}
                </label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder={world.name} style={inp} />
                {hasWidgets && (
                  <p style={{ fontSize: '0.72rem', color: t.textMuted, margin: '0.4rem 0 0' }}>
                    Comes with a ready-made layout you can tweak.
                  </p>
                )}
              </div>
            )}
            {scope === 'existingTopic' && (
              <div style={{ marginBottom: '0.9rem' }}>
                <label style={{ fontSize: '0.74rem', color: t.textMuted, display: 'block', marginBottom: '0.3rem' }}>Apply its look to</label>
                {topics.length === 0 ? (
                  <p style={{ fontSize: '0.74rem', color: t.textDim, fontStyle: 'italic', margin: 0 }}>No topics yet — create one first.</p>
                ) : (
                  <select value={targetTopic} onChange={e => setTargetTopic(e.target.value)} style={inp}>
                    {topics.map(tp => <option key={tp.id} value={tp.id}>{tp.name || '(unnamed)'}</option>)}
                  </select>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button onClick={onClose} style={{ background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '9px', padding: '0.55rem 1rem', color: t.textMuted, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.82rem' }}>
                Cancel
              </button>
              <button
                onClick={onAccept}
                disabled={scope === 'existingTopic' && topics.length === 0}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                  background: t.text, color: t.bg, border: 'none', borderRadius: '9px',
                  padding: '0.55rem 1.2rem', fontSize: '0.82rem', fontWeight: 500, fontFamily: 'inherit',
                  cursor: 'pointer', opacity: scope === 'existingTopic' && topics.length === 0 ? 0.5 : 1,
                }}
              >
                <Check size={14} strokeWidth={2} /> Apply
              </button>
            </div>
          </>
        ) : (
          <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: '0.9rem' }}>
            <p style={{ fontSize: '0.78rem', color: t.textMuted, margin: '0 0 0.7rem', lineHeight: 1.5 }}>
              This is a Plus World — it comes with a ready-made section and look. Plus is free while
              in beta.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button onClick={onClose} style={{ background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '9px', padding: '0.55rem 1rem', color: t.textMuted, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.82rem' }}>
                Close
              </button>
              <button
                onClick={() => { openPlansPage(); onClose(); }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                  background: accent, color: '#fff', border: 'none', borderRadius: '9px',
                  padding: '0.55rem 1.2rem', fontSize: '0.82rem', fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
                }}
              >
                <Sparkles size={14} strokeWidth={2} /> Explore plans
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── small style helpers ──────────────────────────────────────────────────────

function badge(bg: string): React.CSSProperties {
  return {
    position: 'absolute', top: '0.5rem', right: '0.5rem',
    background: bg, color: '#fff', borderRadius: '999px',
    width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
}
function pill(color: string, border: string): React.CSSProperties {
  return { fontSize: '0.6rem', color, border: `1px solid ${border}`, borderRadius: '999px', padding: '0.05rem 0.4rem' };
}
