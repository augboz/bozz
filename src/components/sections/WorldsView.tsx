import { ArrowLeft, Check, Lock, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import type { AppearancePrefs, BozzWorld, Theme } from '../../lib/types';
import { SectionHeader } from '../shared/ui';
import { BUNDLED_WORLDS, applyWorld, revertToDefault, canApply } from '../../lib/worlds';
import { play as ambientPlay, stop as ambientStop, setVolume as ambientVolume, mute as ambientMute } from '../../lib/ambient';

interface Props {
  t: Theme;
  appearance: AppearancePrefs;
  patchAppearance: (patch: Partial<AppearancePrefs>) => void;
  onBack: () => void;
}

export default function WorldsView({ t, appearance, patchAppearance, onBack }: Props) {
  const activeId = appearance.activeWorldId;

  const apply = (world: BozzWorld) => {
    if (!canApply(world)) return;
    patchAppearance(applyWorld(world, appearance));
    if (world.ambientSound) ambientPlay(world.ambientSound.url, appearance.ambient?.volume ?? 0.25);
    else ambientStop();
  };

  const revert = () => {
    patchAppearance(revertToDefault(appearance));
    ambientStop();
  };

  const ambient = appearance.ambient;
  const setAmbVolume = (v: number) => {
    ambientVolume(v);
    if (ambient) patchAppearance({ ambient: { ...ambient, volume: v } });
  };
  const toggleMute = () => {
    if (!ambient) return;
    const muted = !ambient.muted;
    ambientMute(muted);
    patchAppearance({ ambient: { ...ambient, muted } });
  };

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
        <ArrowLeft size={15} strokeWidth={1.6} /> Back
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
            <RotateCcw size={12} strokeWidth={1.6} /> Revert to default
          </button>
        ) : undefined}
      />

      <p style={{ fontSize: '0.82rem', color: t.textMuted, lineHeight: 1.55, margin: '0 0 1.2rem', fontWeight: 300 }}>
        A World is a one-tap look — theme, wallpaper and mood together. Tap one to try it; revert anytime.
      </p>

      {/* Ambient controls (shown when the active World has sound) */}
      {ambient && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem',
          border: `1px solid ${t.border}`, borderRadius: '10px', padding: '0.55rem 0.8rem',
        }}>
          <button onClick={toggleMute} style={{ background: 'transparent', border: 'none', color: t.textMuted, cursor: 'pointer', display: 'flex' }}>
            {ambient.muted ? <VolumeX size={16} strokeWidth={1.6} /> : <Volume2 size={16} strokeWidth={1.6} />}
          </button>
          <span style={{ fontSize: '0.74rem', color: t.textMuted }}>Ambient sound</span>
          <input
            type="range" min={0} max={100} value={Math.round((ambient.volume ?? 0.25) * 100)}
            onChange={e => setAmbVolume(Number(e.target.value) / 100)}
            style={{ flex: 1, accentColor: t.doingAccent, cursor: 'pointer' }}
          />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.9rem' }}>
        {BUNDLED_WORLDS.map(world => {
          const active = activeId === world.id || (!activeId && world.id === 'default');
          const locked = !canApply(world);
          return (
            <button
              key={world.id}
              onClick={() => apply(world)}
              disabled={locked}
              style={{
                textAlign: 'left', padding: 0, cursor: locked ? 'not-allowed' : 'pointer',
                background: t.todoBg, border: `1.5px solid ${active ? t.doneAccent : t.border}`,
                borderRadius: '14px', overflow: 'hidden', fontFamily: 'inherit',
                transition: 'border-color 0.15s, transform 0.12s',
              }}
              onMouseEnter={e => { if (!locked) e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <div style={{ position: 'relative', height: '110px' }}>
                <img src={world.previewUrl} alt={world.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                {active && (
                  <span style={{
                    position: 'absolute', top: '0.5rem', right: '0.5rem',
                    background: t.doneAccent, color: '#fff', borderRadius: '999px',
                    width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Check size={13} strokeWidth={2.5} />
                  </span>
                )}
                {locked && (
                  <span style={{
                    position: 'absolute', top: '0.5rem', right: '0.5rem',
                    background: 'rgba(0,0,0,0.55)', color: '#fff', borderRadius: '999px',
                    width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Lock size={11} strokeWidth={2} />
                  </span>
                )}
              </div>
              <div style={{ padding: '0.7rem 0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.86rem', color: t.text, fontWeight: 500 }}>{world.name}</span>
                  {world.free && world.id !== 'default' && (
                    <span style={{ fontSize: '0.6rem', color: t.doneAccent, border: `1px solid ${t.doneBorder}`, borderRadius: '999px', padding: '0.05rem 0.4rem' }}>Free</span>
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
    </div>
  );
}
