/**
 * WelcomeThemePicker — the very first thing a brand-new user sees after signing
 * in. A neutral full-screen overlay that asks them to pick Dark or Light; the
 * choice sets `appearance.mood` and is then never shown again. Theme-agnostic
 * on purpose (it renders before a mood is chosen), so it uses fixed neutral
 * colours rather than the live theme.
 */

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { themes } from '../../lib/themes';

type Pick = 'dark' | 'light';

function ThemeCard({ mood, label, hint, onChoose }: {
  mood: Pick; label: string; hint: string; onChoose: (m: Pick) => void;
}) {
  const th = themes[mood];
  const [hover, setHover] = useState(false);
  const sidebar = mood === 'dark' ? '#0a0a0a' : '#ffffff';
  return (
    <button
      onClick={() => onChoose(mood)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={`Use ${label} mode`}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '0.85rem',
        background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
        border: `1.5px solid ${hover ? '#5ec4d8' : 'rgba(255,255,255,0.14)'}`,
        borderRadius: '18px', padding: '0.9rem', width: '230px',
        transform: hover ? 'translateY(-3px)' : 'none',
        transition: 'border-color 0.18s, transform 0.18s',
      }}
    >
      {/* Mini app preview */}
      <div style={{
        height: '140px', borderRadius: '11px', overflow: 'hidden', display: 'flex',
        background: th.bg, border: `1px solid ${th.border}`,
      }}>
        <div style={{ width: '40px', background: sidebar, borderRight: `1px solid ${th.border}`, flexShrink: 0,
          display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px 8px' }}>
          <div style={{ height: '7px', borderRadius: '3px', background: th.doneAccent }} />
          <div style={{ height: '5px', borderRadius: '3px', background: th.textDim }} />
          <div style={{ height: '5px', borderRadius: '3px', background: th.textDim }} />
        </div>
        <div style={{ flex: 1, padding: '11px', display: 'grid', gap: '8px', gridTemplateColumns: '1fr 1fr', gridAutoRows: '34px' }}>
          <div style={{ background: th.panel, borderRadius: '7px', border: `1px solid ${th.border}` }} />
          <div style={{ background: th.panel, borderRadius: '7px', border: `1px solid ${th.border}` }} />
          <div style={{ background: th.panel, borderRadius: '7px', border: `1px solid ${th.border}` }} />
          <div style={{ background: th.panel, borderRadius: '7px', border: `1px solid ${th.border}` }} />
        </div>
      </div>
      <div style={{ textAlign: 'left' }}>
        <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#e8e8e8' }}>{label}</div>
        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', marginTop: '0.1rem' }}>{hint}</div>
      </div>
    </button>
  );
}

export default function WelcomeThemePicker({ onChoose }: { onChoose: (mood: Pick) => void }) {
  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'radial-gradient(120% 120% at 50% 0%, #15161a 0%, #08080a 60%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: '2.2rem', padding: '2rem', textAlign: 'center',
    }}>
      <img src="/brand/bozz-mark-dark.png" alt="" width={60} height={60}
        style={{ width: '60px', height: '60px', borderRadius: '15px', objectFit: 'cover' }} />
      <div>
        <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700, color: '#f2f2f2', letterSpacing: '-0.02em' }}>
          Welcome to Bozz
        </h1>
        <div style={{ fontSize: '0.92rem', color: 'rgba(255,255,255,0.55)', marginTop: '0.4rem' }}>
          Pick a look to start with, you can change it anytime in Settings.
        </div>
      </div>
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <ThemeCard mood="dark"  label="Dark"  hint="Matte black, easy on the eyes" onChoose={onChoose} />
        <ThemeCard mood="light" label="Light" hint="Bright, clean and crisp"        onChoose={onChoose} />
      </div>
    </div>,
    document.body,
  );
}
