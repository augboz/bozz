import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { ImageIcon, X } from 'lucide-react';
import type { Theme } from '../../lib/types';

export interface PageBg {
  url: string;
  /** 0 = photo fully visible · 1 = fully covered by theme colour */
  dim: number;
}

// ── BgLayer ──────────────────────────────────────────────────────────────────
// Portalled into document.body as position:fixed so the photo fills the entire
// content column regardless of any maxWidth/padding containers. The sidebar and
// title bar both have their own opaque backgrounds and sit above zIndex 0, so
// they naturally mask the left/top portions of the fixed layer.

export function BgLayer({ bg, t }: { bg: PageBg; t: Theme }) {
  return createPortal(
    <div
      aria-hidden
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
    >
      <img
        src={bg.url}
        alt=""
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover', objectPosition: 'center',
          userSelect: 'none',
        }}
      />
      {/* Theme-colour dim overlay keeps widgets readable */}
      <div style={{ position: 'absolute', inset: 0, background: t.bg, opacity: bg.dim }} />
    </div>,
    document.body,
  );
}

// ── BackgroundControls ───────────────────────────────────────────────────────

interface Props {
  t: Theme;
  bg: PageBg | null;
  onChange: (bg: PageBg | null) => void;
}

const ghostBtn = (t: Theme): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
  background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px',
  padding: '0.4rem 0.7rem', color: t.textMuted, cursor: 'pointer',
  fontSize: '0.75rem', fontFamily: 'inherit', fontWeight: 300,
});

export default function BackgroundControls({ t, bg, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const pick = () => fileRef.current?.click();

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      if (url) onChange({ url, dim: bg?.dim ?? 0.55 });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
      {bg ? (
        <>
          <img
            src={bg.url}
            alt="Page background"
            onClick={pick}
            title="Change photo"
            style={{
              width: '26px', height: '26px', objectFit: 'cover',
              borderRadius: '5px', cursor: 'pointer', flexShrink: 0,
              border: `1px solid ${t.borderStrong}`,
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ fontSize: '0.62rem', color: t.textDim, whiteSpace: 'nowrap' }}>dim</span>
            <input
              type="range" min={0} max={100} step={5}
              value={Math.round(bg.dim * 100)}
              onChange={e => onChange({ ...bg, dim: Number(e.target.value) / 100 })}
              style={{ width: '64px', cursor: 'pointer', accentColor: t.doingAccent }}
            />
          </div>
          <button
            onClick={() => onChange(null)}
            aria-label="Remove background photo"
            title="Remove background"
            style={{ background: 'transparent', border: 'none', color: t.textDim, cursor: 'pointer', padding: '0.1rem', display: 'flex' }}
          >
            <X size={13} strokeWidth={1.5} />
          </button>
        </>
      ) : (
        <button onClick={pick} style={ghostBtn(t)}>
          <ImageIcon size={13} strokeWidth={1.5} />
          Photo
        </button>
      )}
      <input
        ref={fileRef} type="file" accept="image/*"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
      />
    </div>
  );
}
