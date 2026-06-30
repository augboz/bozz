import { useState } from 'react';
import { ArrowLeft, Check, RotateCcw, Volume2, VolumeX, X, Sparkles } from 'lucide-react';
import type { AppearancePrefs, BozzWorld, Theme, Topic, TopicFolder, WidgetType, WorldScope } from '../../lib/types';
import { SectionHeader } from '../shared/ui';
import {
  BUNDLED_WORLDS, applyWorld, revertToDefault, canApply,
  worldToTopic, worldTopicPatch, worldToFolder,
} from '../../lib/worlds';
import { WIDGET_REGISTRY } from '../widgets/registry';
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
        <strong style={{ color: t.text, fontWeight: 500 }}>Themes</strong> restyle Bozz: colour,
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
          const premium = !world.free;       // a paid-tier World (Plus)
          // Cards stay crisp — even premium ones — so the gallery reads clearly.
          // The paid surface (the actual layout) is teased in the preview modal,
          // not hidden behind a blur here. Premium is signalled by the Plus pill.
          const wtypes = uniqueWidgetTypes(world);
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
                <MiniLayout t={t} world={world} blurred={!world.free} compact height={110} />
                {active && (
                  <span style={badge(t.doneAccent)}><Check size={13} strokeWidth={2.5} /></span>
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
                  {premium && (
                    <span style={{ ...pill(t.doingAccent, t.doingBorder), display: 'inline-flex', alignItems: 'center', gap: '0.18rem' }}>
                      <Sparkles size={9} strokeWidth={2} /> Plus
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.72rem', color: t.textMuted, marginTop: '0.2rem', lineHeight: 1.4 }}>
                  {world.description}
                </div>
                {world.kind === 'template' && wtypes.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.22rem', marginTop: '0.5rem' }}>
                    {wtypes.slice(0, 4).map(type => (
                      <span key={type} style={{ fontSize: '0.6rem', color: t.textDim, border: `1px solid ${t.border}`, borderRadius: '999px', padding: '0.08rem 0.42rem' }}>
                        {WIDGET_REGISTRY[type]?.label ?? type}
                      </span>
                    ))}
                    {wtypes.length > 4 && (
                      <span style={{ fontSize: '0.6rem', color: t.textDim, padding: '0.08rem 0.2rem' }}>+{wtypes.length - 4}</span>
                    )}
                  </div>
                )}
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
  const font = FONT_STACK[world.font] ?? FONT_STACK.inter;
  const accent = world.accent;
  const swatches = world.colorBank.slice(0, 6);
  const hasWidgets = !!(world.topicWidgets && world.topicWidgets.length);
  // "Whole of Bozz" applies the look only (no widgets), so preview a home mock;
  // a topic/folder drops the actual template page. Themes have no page either way.
  const showHome = scope === 'global' || !hasWidgets;

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

        {/* Real layout preview — adapts to the chosen scope: a home mock for
            "Whole of Bozz" (look only), the template's page for a topic/folder.
            Crisp for free, teased for premium (names listed below regardless). */}
        <div style={{ margin: '0.9rem 0' }}>
          <MiniLayout t={t} world={world} blurred={!world.free} home={showHome} />
          <div style={{ fontSize: '0.7rem', color: t.textDim, marginTop: '0.45rem', textAlign: 'center' }}>
            {showHome
              ? 'How your home looks with this World applied. The look only.'
              : (world.free ? 'The page this drops in. Tap Apply to add it.' : 'The page this drops in. Plus is free while in beta.')}
          </div>
        </div>

        {/* What's inside — every widget + connected app the page installs
            ("Whole of Bozz" applies the look only, so no page is listed). */}
        {!showHome && <IncludesChips t={t} world={world} accent={accent} />}

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
                  <p style={{ fontSize: '0.74rem', color: t.textMuted, lineHeight: 1.5, margin: 0 }}>No topics yet. Create one first.</p>
                ) : (
                  <select value={targetTopic} onChange={e => setTargetTopic(e.target.value)} style={inp}>
                    {topics.map(tp => <option key={tp.id} value={tp.id}>{tp.name || 'New topic'}</option>)}
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
              This is a Plus World. It comes with a ready-made section and look. Plus is free while
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

// ── Layout preview ────────────────────────────────────────────────────────────

/** Connected-app widgets → the app they surface (shown on the "what's inside" chips). */
const CONNECTED_APP: Partial<Record<WidgetType, string>> = {
  recentEmails: 'Email', miniCalendar: 'Calendar', todaySchedule: 'Calendar',
  nowPlaying: 'Spotify', notion: 'Notion', weather: 'Weather', whatsapp: 'WhatsApp',
};

/** A representative home layout for theme Worlds (which install no widgets). */
const THEME_HOME_MOCK: Array<{ type: WidgetType; x: number; y: number; w: number; h: number }> = [
  { type: 'today', x: 0, y: 0, w: 7, h: 12 },
  { type: 'clock', x: 7, y: 0, w: 5, h: 5 },
  { type: 'upcomingDeadlines', x: 7, y: 5, w: 5, h: 7 },
  { type: 'quickAdd', x: 0, y: 12, w: 12, h: 4 },
];

/** Unique widget types in a World's layout, in placement order. */
function uniqueWidgetTypes(world: BozzWorld): WidgetType[] {
  const seen = new Set<WidgetType>(); const out: WidgetType[] = [];
  for (const w of world.topicWidgets ?? []) if (!seen.has(w.type)) { seen.add(w.type); out.push(w.type); }
  return out;
}

/** A tiny, realistic representation of a widget drawn in the World's accent, so
 *  the preview reads like an actual dashboard rather than labelled boxes. */
function WidgetGlyph({ type, accent, light }: { type: WidgetType; accent: string; light: boolean }) {
  const line = light ? 'rgba(20,22,28,0.34)' : 'rgba(255,255,255,0.36)';
  const faint = light ? 'rgba(20,22,28,0.15)' : 'rgba(255,255,255,0.15)';
  const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '3px', width: '100%' };
  const bar = (w: string, c = line, h = 4, key?: number) => <div key={key} style={{ width: w, height: h, borderRadius: 3, background: c }} />;
  const row = (children: React.ReactNode, key?: number) => <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>{children}</div>;
  const dot = (c = accent, s = 5) => <div style={{ width: s, height: s, borderRadius: '50%', background: c, flexShrink: 0 }} />;
  const ring = (border: React.CSSProperties) => <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%' }}><div style={border} /></div>;

  switch (type) {
    case 'topicTodos': case 'today': case 'upcomingDeadlines': case 'dailyPlanner': case 'todaySchedule':
      return <div style={col}>{[0, 1, 2].map(i => row(<>{dot([accent, line, faint][i])}{bar(['72%', '88%', '56%'][i])}</>, i))}</div>;
    case 'topicNote':
      return <div style={col}>{['92%', '100%', '78%', '60%'].map((w, i) => bar(w, i ? faint : line, 4, i))}</div>;
    case 'topicLinks': case 'notion':
      return <div style={col}>{[0, 1].map(i => row(<><div style={{ width: 7, height: 7, borderRadius: 2, background: accent, opacity: 0.7 }} />{bar(['62%', '78%'][i])}</>, i))}</div>;
    case 'miniCalendar':
      return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', width: '100%' }}>{Array.from({ length: 21 }).map((_, i) => <div key={i} style={{ aspectRatio: '1', borderRadius: 1.5, background: [4, 10, 15].includes(i) ? accent : faint }} />)}</div>;
    case 'budget':
      return <div style={col}>{bar('48%', accent, 6, 0)}{bar('82%', line, 4, 1)}{bar('34%', faint, 4, 2)}</div>;
    case 'habits':
      return <div style={col}>{[0, 1, 2].map(r => row(Array.from({ length: 5 }).map((_, i) => <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: i <= r + 1 ? accent : faint }} />), r))}</div>;
    case 'recentEmails': case 'whatsapp':
      return <div style={col}>{[0, 1].map(i => row(<>{dot(accent, 6)}<div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>{bar('58%')}{bar('92%', faint, 3)}</div></>, i))}</div>;
    case 'weather':
      return row(<><div style={{ width: 16, height: 16, borderRadius: '50%', background: accent, opacity: 0.8 }} /><div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>{bar('22px')}{bar('14px', faint, 3)}</div></>);
    case 'nowPlaying':
      return row(<><div style={{ width: 18, height: 18, borderRadius: 4, background: accent, opacity: 0.75 }} /><div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>{bar('70%')}{bar('45%', faint, 3)}<div style={{ width: '100%', height: 3, borderRadius: 2, background: faint }}><div style={{ width: '40%', height: '100%', borderRadius: 2, background: accent }} /></div></div></>);
    case 'pomodoro':
      return ring({ width: 24, height: 24, borderRadius: '50%', border: `3px solid ${faint}`, borderTopColor: accent, borderRightColor: accent });
    case 'clock':
      return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%' }}><div style={{ position: 'relative', width: 24, height: 24, borderRadius: '50%', border: `2px solid ${line}` }}><div style={{ position: 'absolute', left: '50%', top: '28%', width: 2, height: '24%', background: accent, transform: 'translateX(-50%)' }} /><div style={{ position: 'absolute', left: '50%', top: '50%', width: '28%', height: 2, background: accent }} /></div></div>;
    case 'photo':
      return <div style={{ width: '100%', height: '100%', minHeight: 22, borderRadius: 4, background: `linear-gradient(135deg, ${accent}66, ${faint})`, display: 'flex', alignItems: 'flex-end', padding: 3 }}><div style={{ width: 7, height: 7, borderRadius: '50%', background: accent, opacity: 0.85 }} /></div>;
    case 'quickAdd': case 'quickCapture':
      return row(<><div style={{ flex: 1, height: 9, borderRadius: 5, border: `1px solid ${faint}` }} /><div style={{ width: 16, height: 9, borderRadius: 5, background: accent }} /></>);
    case 'summary':
      return row(<>{bar('30%', accent, 8)}{bar('30%', line, 8)}{bar('30%', faint, 8)}</>);
    default:
      return <div style={col}>{bar('70%', faint, 4, 0)}{bar('45%', faint, 4, 1)}</div>;
  }
}

/**
 * A scaled, labelled mock of the World's page — the real widget arrangement, in
 * the World's own colours / shape / font, over its wallpaper. `blurred` is the
 * Plus teaser: legible enough to entice, not a crisp giveaway (names still come
 * through clearly on the "what's inside" chips below).
 */
function MiniLayout({ t, world, blurred, home, compact, height = 210 }: { t: Theme; world: BozzWorld; blurred?: boolean; home?: boolean; compact?: boolean; height?: number }) {
  const radius = SHAPE_RADIUS[world.widgetShape ?? 'rounded'];
  const font = FONT_STACK[world.font] ?? FONT_STACK.inter;
  const accent = world.accent;
  const light = world.mood === 'light';
  const tiles = (!home && world.topicWidgets && world.topicWidgets.length)
    ? world.topicWidgets.map(w => ({ type: w.type, x: w.x, y: w.y, w: w.w, h: w.h }))
    : THEME_HOME_MOCK;
  const rows = Math.max(...tiles.map(tl => tl.y + tl.h), 1);
  return (
    <div style={{ position: 'relative', height: `${height}px`, borderRadius: compact ? '0' : '14px', overflow: 'hidden', border: compact ? 'none' : `1px solid ${t.border}` }}>
      <img src={world.background.url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      <div style={{ position: 'absolute', inset: 0, background: light ? '#f4f4f6' : '#0e0e10', opacity: world.background.dim }} />
      <div style={{ position: 'absolute', inset: 0, padding: '6px', filter: blurred ? 'blur(3.5px)' : undefined }}>
        {tiles.map((tl, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: `${(tl.x / 12) * 100}%`, top: `${(tl.y / rows) * 100}%`,
            width: `${(tl.w / 12) * 100}%`, height: `${(tl.h / rows) * 100}%`, padding: '3px',
          }}>
            <div style={{
              width: '100%', height: '100%', boxSizing: 'border-box',
              background: light ? 'rgba(255,255,255,0.62)' : 'rgba(255,255,255,0.1)',
              backdropFilter: 'blur(6px)', border: `1px solid ${accent}66`, borderRadius: radius,
              display: 'flex', flexDirection: 'column', gap: compact ? '0' : '3px', padding: compact ? '3px 4px' : '4px 5px', overflow: 'hidden',
            }}>
              {!compact && (
                <span style={{
                  fontFamily: font, fontSize: '0.5rem', fontWeight: 600, lineHeight: 1.1, letterSpacing: '0.01em',
                  color: light ? '#33373c' : 'rgba(255,255,255,0.88)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0,
                }}>
                  {WIDGET_REGISTRY[tl.type]?.label ?? tl.type}
                </span>
              )}
              <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', alignItems: 'flex-start' }}>
                <WidgetGlyph type={tl.type} accent={accent} light={light} />
              </div>
            </div>
          </div>
        ))}
      </div>
      {blurred && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
            background: 'rgba(0,0,0,0.5)', color: '#fff', borderRadius: '999px',
            padding: '0.28rem 0.75rem', fontSize: '0.7rem', fontWeight: 600,
          }}>
            <Sparkles size={12} strokeWidth={2} /> Plus preview
          </span>
        </div>
      )}
    </div>
  );
}

/** "What's inside" — names every widget in a template; connected-app widgets are
 *  tinted and tagged with the app they use, so users know what to expect. */
function IncludesChips({ t, world, accent }: { t: Theme; world: BozzWorld; accent: string }) {
  const types = uniqueWidgetTypes(world);
  if (!types.length) return null;
  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ fontSize: '0.7rem', color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.45rem' }}>
        What's inside
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
        {types.map(type => {
          const label = WIDGET_REGISTRY[type]?.label ?? type;
          const app = CONNECTED_APP[type];
          return (
            <span key={type} style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.28rem',
              fontSize: '0.7rem', color: app ? accent : t.textMuted,
              border: `1px solid ${app ? accent + '88' : t.border}`, borderRadius: '999px', padding: '0.2rem 0.6rem',
            }}>
              {label}{app && <span style={{ fontSize: '0.62rem', opacity: 0.85 }}>· {app}</span>}
            </span>
          );
        })}
      </div>
    </div>
  );
}
