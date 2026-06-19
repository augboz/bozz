import { useRef, useState, useEffect } from 'react';
import { ImageIcon, RotateCcw } from 'lucide-react';
import type { WidgetCtx } from './context';
import { Widget } from '../shared/Widget';
import { getItem, setItem } from '../../lib/storage';
import { supabase } from '../../lib/supabase';
import { schedulePush } from '../../lib/sync';

interface PhotoData {
  url: string;
  /** 1 = image just covers the frame; up to 3 = zoomed in. */
  zoom: number;
  /** Focal point shown within the frame, 0-100 each axis. */
  posX: number;
  posY: number;
}

const DEFAULT_FRAME = { zoom: 1, posX: 50, posY: 50 };

function photoKey(widgetId: string) { return `photo__${widgetId}`; }

/** Reads the single stored photo, migrating the old multi-photo array format. */
async function loadPhoto(widgetId: string): Promise<PhotoData | null> {
  const r = await getItem(photoKey(widgetId));
  if (!r?.value) return null;
  try {
    const parsed = JSON.parse(r.value);
    if (Array.isArray(parsed)) {
      return parsed.length > 0 ? { url: parsed[0], ...DEFAULT_FRAME } : null;
    }
    if (parsed && typeof parsed === 'object' && parsed.url) {
      return {
        url: parsed.url,
        zoom: parsed.zoom ?? 1,
        posX: parsed.posX ?? 50,
        posY: parsed.posY ?? 50,
      };
    }
    return null;
  } catch { return null; }
}

async function savePhoto(widgetId: string, photo: PhotoData | null): Promise<void> {
  await setItem(photoKey(widgetId), JSON.stringify(photo));
  // Photo widgets aren't wired through Dashboard's central save() effect (they
  // persist straight to storage by widget id), so trigger the cloud push here
  // too — otherwise drag/zoom edits stay local-only until something else
  // happens to trigger a sync. getSession() reads the cached session (no
  // network round trip), which matters here since this can fire on every
  // pointer-move while dragging to reposition.
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) schedulePush(session.user.id);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target?.result as string);
    reader.readAsDataURL(file);
  });
}

export default function PhotoWidget({ ctx }: { ctx: WidgetCtx }) {
  const { t, widgetConfig, onWidgetConfig, widgetId } = ctx;
  const fileRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<PhotoData | null>(null);

  // Load the stored photo on mount; migrate legacy widgetConfig data.
  useEffect(() => {
    if (!widgetId) return;
    loadPhoto(widgetId).then(stored => {
      if (stored) { setPhoto(stored); return; }
      const legacyUrl = (widgetConfig?.imageUrls as string[] | undefined)?.[0]
        ?? (widgetConfig?.imageUrl as string | undefined);
      if (legacyUrl) {
        const next: PhotoData = { url: legacyUrl, ...DEFAULT_FRAME };
        setPhoto(next);
        void savePhoto(widgetId, next);
        onWidgetConfig({ ...widgetConfig, imageUrls: undefined, imageUrl: undefined });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgetId]);

  // Listen for live updates from the config panel (drag/zoom).
  useEffect(() => {
    if (!widgetId) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ widgetId: string; photo: PhotoData }>).detail;
      if (detail.widgetId === widgetId) setPhoto(detail.photo);
    };
    window.addEventListener('photo-update', handler);
    return () => window.removeEventListener('photo-update', handler);
  }, [widgetId]);

  const handleFile = (file: File) => {
    readFileAsDataUrl(file).then(url => {
      const next: PhotoData = { url, ...DEFAULT_FRAME };
      setPhoto(next);
      if (widgetId) void savePhoto(widgetId, next);
    });
  };

  if (!photo) {
    return (
      <Widget t={t} accent="" noPadding>
        <div
          onClick={() => fileRef.current?.click()}
          style={{
            width: '100%', height: '100%',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: '0.75rem', cursor: 'pointer',
          }}
        >
          <ImageIcon size={28} strokeWidth={1} color={t.textDim} />
          <span style={{ fontSize: '0.78rem', color: t.textDim }}>Click to add a photo</span>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.[0]) { handleFile(e.target.files[0]); e.target.value = ''; } }} />
        </div>
      </Widget>
    );
  }

  const caption = widgetConfig?.caption as string | undefined;

  return (
    <Widget t={t} accent="" noPadding>
      <div style={{
        width: '100%', height: '100%', position: 'relative', overflow: 'hidden',
        backgroundImage: `url(${photo.url})`,
        backgroundSize: `${photo.zoom * 100}%`,
        backgroundPosition: `${photo.posX}% ${photo.posY}%`,
        backgroundRepeat: 'no-repeat',
      }}>
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '45%',
          background: 'linear-gradient(to top, rgba(0,0,0,0.48) 0%, transparent 100%)',
          pointerEvents: 'none',
        }} />
        {caption && (
          <div style={{
            position: 'absolute', bottom: 10, left: 14,
            fontSize: '0.68rem', fontWeight: 500, letterSpacing: '0.06em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)',
          }}>
            {caption}
          </div>
        )}
      </div>
    </Widget>
  );
}

export function PhotoWidgetConfig({ config: _config, onConfig: _onConfig, t, widgetId }: {
  config: Record<string, unknown>;
  onConfig: (cfg: Record<string, unknown>) => void;
  t: import('../../lib/types').Theme;
  widgetId?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [photo, setPhoto] = useState<PhotoData | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!widgetId) return;
    loadPhoto(widgetId).then(setPhoto);
  }, [widgetId]);

  // Drag/zoom fire on every pointer-move — update the on-screen preview
  // instantly but debounce the actual persist so we're not writing to disk
  // (and pinging Supabase) dozens of times a second while dragging.
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const update = (patch: Partial<PhotoData>) => {
    setPhoto(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      if (widgetId) {
        // Notify the live widget immediately so it re-renders without waiting for storage.
        window.dispatchEvent(new CustomEvent('photo-update', { detail: { widgetId, photo: next } }));
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => { void savePhoto(widgetId, next); }, 200);
      }
      return next;
    });
  };

  const handleFile = (file: File) => {
    readFileAsDataUrl(file).then(url => {
      const next: PhotoData = { url, ...DEFAULT_FRAME };
      setPhoto(next);
      if (widgetId) void savePhoto(widgetId, next);
    });
  };

  const removePhoto = () => {
    setPhoto(null);
    if (widgetId) void savePhoto(widgetId, null);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!photo || photo.zoom <= 1) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !photo || !boxRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    dragRef.current = { x: e.clientX, y: e.clientY };
    const rect = boxRef.current.getBoundingClientRect();
    const rangeX = rect.width * (photo.zoom - 1);
    const rangeY = rect.height * (photo.zoom - 1);
    const dPosX = rangeX > 0 ? (dx / rangeX) * 100 : 0;
    const dPosY = rangeY > 0 ? (dy / rangeY) * 100 : 0;
    update({
      posX: Math.min(100, Math.max(0, photo.posX - dPosX)),
      posY: Math.min(100, Math.max(0, photo.posY - dPosY)),
    });
  };
  const onPointerUp = () => { dragRef.current = null; };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
      {!photo ? (
        <button
          onClick={() => fileRef.current?.click()}
          style={{ background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px', padding: '0.45rem 0.8rem', color: t.textMuted, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem', textAlign: 'left' }}
        >
          Add a photo…
        </button>
      ) : (
        <>
          <div
            ref={boxRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            style={{
              width: '100%', aspectRatio: '1 / 1', borderRadius: '10px',
              overflow: 'hidden', position: 'relative',
              border: `1px solid ${t.border}`,
              backgroundImage: `url(${photo.url})`,
              backgroundSize: `${photo.zoom * 100}%`,
              backgroundPosition: `${photo.posX}% ${photo.posY}%`,
              backgroundRepeat: 'no-repeat',
              cursor: photo.zoom > 1 ? 'grab' : 'default',
              touchAction: 'none',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.68rem', color: t.textDim, flexShrink: 0 }}>Zoom</span>
            <input
              type="range" min={1} max={3} step={0.05}
              value={photo.zoom}
              onChange={e => update({ zoom: Number(e.target.value) })}
              style={{ flex: 1 }}
            />
            <button
              onClick={() => update({ zoom: 1, posX: 50, posY: 50 })}
              title="Reset position &amp; zoom"
              style={{ background: 'transparent', border: 'none', color: t.textMuted, cursor: 'pointer', padding: '0.2rem', display: 'flex', flexShrink: 0 }}
            >
              <RotateCcw size={13} strokeWidth={1.6} />
            </button>
          </div>
          <div style={{ fontSize: '0.62rem', color: t.textDim }}>
            Drag the preview to reposition, use the slider to zoom.
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              onClick={() => fileRef.current?.click()}
              style={{ flex: 1, background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px', padding: '0.4rem 0.6rem', color: t.textMuted, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.72rem' }}
            >
              Replace
            </button>
            <button
              onClick={removePhoto}
              style={{ flex: 1, background: 'transparent', border: `1px solid ${t.alertBorder}`, borderRadius: '8px', padding: '0.4rem 0.6rem', color: t.alert, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.72rem' }}
            >
              Remove
            </button>
          </div>
        </>
      )}
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { if (e.target.files?.[0]) { handleFile(e.target.files[0]); e.target.value = ''; } }} />
    </div>
  );
}
