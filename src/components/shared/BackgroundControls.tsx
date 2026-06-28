import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImageIcon, X, ClipboardPaste, Move, RotateCcw } from 'lucide-react';
import type { Theme } from '../../lib/types';

export interface PageBg {
  url: string;
  /** 0 = photo fully visible · 1 = fully covered by theme colour */
  dim: number;
  /** Focal point within the frame, 0-100 each axis (default 50). */
  posX?: number;
  posY?: number;
  /** Zoom, 1 = cover · up to 3 = zoomed in (default 1). */
  scale?: number;
}

// ── BgLayer ──────────────────────────────────────────────────────────────────
// Portalled into document.body as position:fixed so the photo fills the entire
// content column regardless of any maxWidth/padding containers. The sidebar and
// title bar both have their own opaque backgrounds and sit above zIndex 0, so
// they naturally mask the left/top portions of the fixed layer.

export function BgLayer({ bg, t }: { bg: PageBg; t: Theme }) {
  const posX = bg.posX ?? 50;
  const posY = bg.posY ?? 50;
  const scale = bg.scale ?? 1;
  return createPortal(
    <div
      aria-hidden
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}
    >
      <img
        src={bg.url}
        alt=""
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover',
          objectPosition: `${posX}% ${posY}%`,
          transform: scale !== 1 ? `scale(${scale})` : undefined,
          transformOrigin: `${posX}% ${posY}%`,
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
  // Frosted so the control stays readable over any page background photo.
  background: `var(--glass-bg, ${t.panel})`,
  backdropFilter: 'var(--glass-blur, blur(8px))', WebkitBackdropFilter: 'var(--glass-blur, blur(8px))',
  border: `1px solid ${t.borderStrong}`, borderRadius: '8px',
  padding: '0.4rem 0.7rem', color: t.text, cursor: 'pointer',
  fontSize: '0.75rem', fontFamily: 'inherit', fontWeight: 400,
  boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
});

function fileToUrl(file: File, cb: (url: string) => void) {
  const reader = new FileReader();
  reader.onload = (e) => { const url = e.target?.result as string; if (url) cb(url); };
  reader.readAsDataURL(file);
}
function imageFromList(list: FileList | null | undefined): File | null {
  if (!list) return null;
  return Array.from(list).find(f => f.type.startsWith('image/')) ?? null;
}
async function imageFromClipboard(): Promise<string | null> {
  try {
    if (!navigator.clipboard?.read) return null;
    for (const item of await navigator.clipboard.read()) {
      const type = item.types.find(ty => ty.startsWith('image/'));
      if (type) {
        const blob = await item.getType(type);
        return await new Promise<string>(res => {
          const r = new FileReader(); r.onload = e => res(e.target?.result as string); r.readAsDataURL(blob);
        });
      }
    }
  } catch { /* denied or empty */ }
  return null;
}

export default function BackgroundControls({ t, bg, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [adjusting, setAdjusting] = useState(false);

  const pick = () => fileRef.current?.click();
  const setNew = (url: string) => onChange({ url, dim: bg?.dim ?? 0.55, posX: 50, posY: 50, scale: 1 });
  const handleFile = (file: File) => fileToUrl(file, setNew);
  const paste = async () => { const url = await imageFromClipboard(); if (url) setNew(url); };

  return (
    <div
      onPaste={e => { const f = imageFromList(e.clipboardData?.files); if (f) { e.preventDefault(); handleFile(f); } }}
      onDragOver={e => e.preventDefault()}
      onDrop={e => { const f = imageFromList(e.dataTransfer?.files); if (f) { e.preventDefault(); handleFile(f); } }}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.45rem',
        ...(bg ? {
          background: `var(--glass-bg, ${t.panel})`,
          backdropFilter: 'var(--glass-blur, blur(8px))', WebkitBackdropFilter: 'var(--glass-blur, blur(8px))',
          border: `1px solid ${t.borderStrong}`, borderRadius: '999px',
          padding: '0.2rem 0.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
        } : {}),
      }}
    >
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
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setAdjusting(v => !v)}
              title="Reposition & zoom"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: adjusting ? t.bgAlt : 'transparent', border: `1px solid ${t.border}`, borderRadius: '7px', padding: '0.2rem 0.45rem', color: t.text, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.68rem' }}
            >
              <Move size={12} strokeWidth={1.6} /> Adjust
            </button>
            {adjusting && (
              <AdjustPopover t={t} bg={bg} onChange={onChange} onClose={() => setAdjusting(false)} />
            )}
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
        <>
          <button data-onb="topic-bg-photo" onClick={pick} style={ghostBtn(t)}>
            <ImageIcon size={13} strokeWidth={1.5} />
            Background photo
          </button>
          <button onClick={() => void paste()} title="Paste image from clipboard" style={ghostBtn(t)}>
            <ClipboardPaste size={13} strokeWidth={1.5} />
            Paste
          </button>
        </>
      )}
      <input
        ref={fileRef} type="file" accept="image/*"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
      />
    </div>
  );
}

// ── Reposition / zoom popover ────────────────────────────────────────────────

function AdjustPopover({ t, bg, onChange, onClose }: {
  t: Theme; bg: PageBg; onChange: (bg: PageBg) => void; onClose: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const posX = bg.posX ?? 50;
  const posY = bg.posY ?? 50;
  const scale = bg.scale ?? 1;

  const onDown = (e: React.PointerEvent) => {
    if (scale <= 1) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY };
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !boxRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    dragRef.current = { x: e.clientX, y: e.clientY };
    const rect = boxRef.current.getBoundingClientRect();
    const rangeX = rect.width * (scale - 1);
    const rangeY = rect.height * (scale - 1);
    onChange({
      ...bg,
      posX: Math.min(100, Math.max(0, posX - (rangeX > 0 ? (dx / rangeX) * 100 : 0))),
      posY: Math.min(100, Math.max(0, posY - (rangeY > 0 ? (dy / rangeY) * 100 : 0))),
    });
  };
  const onUp = () => { dragRef.current = null; };

  return (
    <div style={{
      position: 'absolute', bottom: 'calc(100% + 8px)', right: 0, zIndex: 300,
      width: 220, background: t.panel, border: `1px solid ${t.borderStrong}`, borderRadius: 12,
      padding: '0.7rem', boxShadow: '0 10px 32px rgba(0,0,0,0.4)',
      display: 'flex', flexDirection: 'column', gap: '0.5rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.72rem', color: t.text, fontWeight: 500 }}>Adjust background</span>
        <button onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', color: t.textMuted, cursor: 'pointer', padding: 0, display: 'flex' }}>
          <X size={14} strokeWidth={1.6} />
        </button>
      </div>
      <div
        ref={boxRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        style={{
          width: '100%', aspectRatio: '16 / 10', borderRadius: 8, overflow: 'hidden',
          border: `1px solid ${t.border}`,
          backgroundImage: `url(${bg.url})`,
          backgroundSize: `${scale * 100}%`,
          backgroundPosition: `${posX}% ${posY}%`,
          backgroundRepeat: 'no-repeat',
          cursor: scale > 1 ? 'grab' : 'default',
          touchAction: 'none',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.66rem', color: t.textDim, flexShrink: 0 }}>zoom</span>
        <input
          type="range" min={1} max={3} step={0.05} value={scale}
          onChange={e => onChange({ ...bg, scale: Number(e.target.value) })}
          style={{ flex: 1, accentColor: t.doingAccent }}
        />
        <button onClick={() => onChange({ ...bg, posX: 50, posY: 50, scale: 1 })} title="Reset" style={{ background: 'transparent', border: 'none', color: t.textMuted, cursor: 'pointer', padding: '0.15rem', display: 'flex', flexShrink: 0 }}>
          <RotateCcw size={13} strokeWidth={1.6} />
        </button>
      </div>
      <div style={{ fontSize: '0.62rem', color: t.textDim, lineHeight: 1.4 }}>
        Zoom in, then drag the preview to reposition.
      </div>
    </div>
  );
}
