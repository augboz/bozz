import { useRef, useState, useEffect } from 'react';
import { ImageIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { WidgetCtx } from './context';
import { Widget } from '../shared/Widget';
import { getItem, setItem } from '../../lib/storage';

function photoKey(widgetId: string) { return `photo__${widgetId}`; }

async function loadPhotos(widgetId: string): Promise<string[]> {
  const r = await getItem(photoKey(widgetId));
  if (r?.value) { try { return JSON.parse(r.value); } catch { /* ignore */ } }
  return [];
}

async function savePhotos(widgetId: string, urls: string[]): Promise<void> {
  await setItem(photoKey(widgetId), JSON.stringify(urls));
}

export default function PhotoWidget({ ctx }: { ctx: WidgetCtx }) {
  const { t, widgetConfig, onWidgetConfig, widgetId } = ctx;
  const fit = (widgetConfig?.fit as string | undefined) ?? 'cover';
  const fileRef = useRef<HTMLInputElement>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);

  // Load photos from local storage on mount; migrate legacy widgetConfig data.
  useEffect(() => {
    if (!widgetId) return;
    loadPhotos(widgetId).then(stored => {
      if (stored.length > 0) {
        setImageUrls(stored);
      } else {
        // Migrate: old data stored base64 in widgetConfig.imageUrls
        const legacy = (widgetConfig?.imageUrls as string[] | undefined)
          ?? (widgetConfig?.imageUrl ? [widgetConfig.imageUrl as string] : []);
        if (legacy.length > 0) {
          setImageUrls(legacy);
          void savePhotos(widgetId, legacy);
          // Strip from widgetConfig so the sync blob stays small
          onWidgetConfig({ ...widgetConfig, imageUrls: undefined, imageUrl: undefined });
        }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgetId]);

  const persistPhotos = (urls: string[]) => {
    setImageUrls(urls);
    if (widgetId) void savePhotos(widgetId, urls);
  };

  const handleFiles = (files: FileList) => {
    const readers = Array.from(files).map(file => new Promise<string>(resolve => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target?.result as string);
      reader.readAsDataURL(file);
    }));
    Promise.all(readers).then(results => {
      const next = [...imageUrls, ...results];
      persistPhotos(next);
      setIdx(next.length - 1);
    });
  };

  const safeIdx = imageUrls.length > 0 ? Math.min(idx, imageUrls.length - 1) : 0;

  if (imageUrls.length === 0) {
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
          <span style={{ fontSize: '0.78rem', color: t.textDim }}>Click to add photos</span>
          <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.length) { handleFiles(e.target.files); e.target.value = ''; } }} />
        </div>
      </Widget>
    );
  }

  const caption = widgetConfig?.caption as string | undefined;

  return (
    <Widget t={t} accent="" noPadding>
      <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
        <img
          src={imageUrls[safeIdx]}
          alt="photo"
          style={{ width: '100%', height: '100%', objectFit: fit as 'cover' | 'contain', display: 'block' }}
        />
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
        {imageUrls.length > 1 && (
          <>
            <button
              onClick={e => { e.stopPropagation(); setIdx(i => (i - 1 + imageUrls.length) % imageUrls.length); }}
              style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.45)', border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
            ><ChevronLeft size={14} /></button>
            <button
              onClick={e => { e.stopPropagation(); setIdx(i => (i + 1) % imageUrls.length); }}
              style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.45)', border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
            ><ChevronRight size={14} /></button>
            <div style={{ position: 'absolute', bottom: 8, right: 12, display: 'flex', gap: 4 }}>
              {imageUrls.map((_, i) => (
                <div key={i} onClick={() => setIdx(i)} style={{ width: i === safeIdx ? 14 : 6, height: 4, borderRadius: 999, background: i === safeIdx ? '#fff' : 'rgba(255,255,255,0.5)', cursor: 'pointer', transition: 'width 0.2s' }} />
              ))}
            </div>
          </>
        )}
        <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
          onChange={e => { if (e.target.files?.length) { handleFiles(e.target.files); e.target.value = ''; } }} />
      </div>
    </Widget>
  );
}

export function PhotoWidgetConfig({ config, onConfig, t, widgetId }: {
  config: Record<string, unknown>;
  onConfig: (cfg: Record<string, unknown>) => void;
  t: import('../../lib/types').Theme;
  widgetId?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  useEffect(() => {
    if (!widgetId) return;
    loadPhotos(widgetId).then(setImageUrls);
  }, [widgetId]);

  const handleFiles = (files: FileList) => {
    const readers = Array.from(files).map(file => new Promise<string>(resolve => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target?.result as string);
      reader.readAsDataURL(file);
    }));
    Promise.all(readers).then(results => {
      const next = [...imageUrls, ...results];
      setImageUrls(next);
      if (widgetId) void savePhotos(widgetId, next);
    });
  };

  const removePhoto = (i: number) => {
    const next = imageUrls.filter((_, j) => j !== i);
    setImageUrls(next);
    if (widgetId) void savePhotos(widgetId, next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
      <button
        onClick={() => fileRef.current?.click()}
        style={{ background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px', padding: '0.45rem 0.8rem', color: t.textMuted, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem', textAlign: 'left' }}
      >
        Add photos…
      </button>
      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
        onChange={e => { if (e.target.files?.length) { handleFiles(e.target.files); e.target.value = ''; } }} />

      {imageUrls.length > 0 && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {imageUrls.map((url, i) => (
              <div key={i} style={{ position: 'relative', width: 48, height: 48 }}>
                <img src={url} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }} />
                <button onClick={() => removePhoto(i)} style={{ position: 'absolute', top: -6, right: -6, background: t.panel, border: `1px solid ${t.borderStrong}`, borderRadius: '50%', width: 16, height: 16, cursor: 'pointer', color: t.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                  <X size={9} strokeWidth={2} />
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <span style={{ fontSize: '0.68rem', color: t.textDim }}>Fit</span>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {(['cover', 'contain'] as const).map(f => {
                const on = (config.fit ?? 'cover') === f;
                return (
                  <button key={f} onClick={() => onConfig({ ...config, fit: f })}
                    style={{ flex: 1, padding: '0.3rem 0', borderRadius: '6px', background: on ? t.text : 'transparent', border: `1px solid ${on ? t.text : t.border}`, color: on ? t.bg : t.textMuted, fontFamily: 'inherit', fontSize: '0.72rem', cursor: 'pointer' }}>
                    {f}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
