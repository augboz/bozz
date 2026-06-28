/**
 * MapWidget — an OpenStreetMap map you can drop pins and areas on.
 *
 * Uses Leaflet directly (no react-leaflet, to avoid React-version peer-dep
 * friction). Tiles come from the public OSM tile servers over https, which the
 * app CSP already allows (img-src https:). Marker icons are CSS/SVG divIcons so
 * we don't hit Leaflet's classic "marker image 404 after bundling" problem.
 *
 * State (view + pins + areas) persists in the widget's instance config via
 * onWidgetConfig, so each placed Map widget remembers its own location.
 */

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Hand, Circle as CircleIcon } from 'lucide-react';
import { Widget } from '../shared/Widget';
import type { WidgetCtx } from './context';

interface Pin { id: string; lat: number; lng: number; label: string }
interface Area { id: string; lat: number; lng: number; radius: number; label: string }
type Mode = 'pan' | 'pin' | 'area';

const DEFAULT_CENTER: [number, number] = [51.5074, -0.1278]; // London
const DEFAULT_ZOOM = 13;
const DEFAULT_RADIUS = 500; // metres
const ACCENT = '#e0563a';

function makeId() { return Math.random().toString(36).slice(2, 9); }

function pinIcon(color: string) {
  return L.divIcon({
    className: 'bozz-map-pin',
    html: `<svg width="26" height="26" viewBox="0 0 24 24" fill="${color}" stroke="#fff" stroke-width="1.5" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5))"><path d="M12 21s-7-5.686-7-11a7 7 0 1 1 14 0c0 5.314-7 11-7 11z"/><circle cx="12" cy="10" r="2.5" fill="#fff" stroke="none"/></svg>`,
    iconSize: [26, 26], iconAnchor: [13, 26], popupAnchor: [0, -24],
  });
}

export default function MapWidget({ ctx }: { ctx: WidgetCtx }) {
  const { t, widgetConfig, onWidgetConfig } = ctx;
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const [mode, setMode] = useState<Mode>('pan');

  const pins: Pin[] = (widgetConfig?.pins as Pin[]) ?? [];
  const areas: Area[] = (widgetConfig?.areas as Area[]) ?? [];

  // Keep the latest values reachable from Leaflet event handlers (which are
  // registered once and would otherwise close over stale props).
  const modeRef = useRef(mode);
  const patchRef = useRef<(p: Record<string, unknown>) => void>(() => {});
  const dataRef = useRef<{ pins: Pin[]; areas: Area[] }>({ pins, areas });
  modeRef.current = mode;
  dataRef.current = { pins, areas };
  patchRef.current = (p) => onWidgetConfig?.({ ...widgetConfig, ...p });

  // ── Init the map once ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!boxRef.current || mapRef.current) return;
    const center = (widgetConfig?.center as [number, number]) ?? DEFAULT_CENTER;
    const zoom = (widgetConfig?.zoom as number) ?? DEFAULT_ZOOM;

    const map = L.map(boxRef.current, { center, zoom, zoomControl: true, attributionControl: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    const layer = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerRef.current = layer;

    // Drop a pin / area where the user clicks (when in that mode).
    map.on('click', (e: L.LeafletMouseEvent) => {
      const m = modeRef.current;
      if (m === 'pin') {
        const next = [...dataRef.current.pins, { id: makeId(), lat: e.latlng.lat, lng: e.latlng.lng, label: '' }];
        patchRef.current({ pins: next });
      } else if (m === 'area') {
        const next = [...dataRef.current.areas, { id: makeId(), lat: e.latlng.lat, lng: e.latlng.lng, radius: DEFAULT_RADIUS, label: '' }];
        patchRef.current({ areas: next });
      }
    });

    // Remember the view as the user pans/zooms.
    map.on('moveend', () => {
      const c = map.getCenter();
      patchRef.current({ center: [c.lat, c.lng], zoom: map.getZoom() });
    });

    // Leaflet needs a re-measure when the widget is resized in the grid.
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(boxRef.current);

    // First paint sometimes happens before the container has its size.
    setTimeout(() => map.invalidateSize(), 0);

    return () => { ro.disconnect(); map.remove(); mapRef.current = null; layerRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Render pins + areas whenever they change ───────────────────────────────
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();

    const removePin = (id: string) => patchRef.current({ pins: dataRef.current.pins.filter(p => p.id !== id) });
    const setPinLabel = (id: string, label: string) =>
      patchRef.current({ pins: dataRef.current.pins.map(p => p.id === id ? { ...p, label } : p) });
    const removeArea = (id: string) => patchRef.current({ areas: dataRef.current.areas.filter(a => a.id !== id) });
    const setArea = (id: string, patch: Partial<Area>) =>
      patchRef.current({ areas: dataRef.current.areas.map(a => a.id === id ? { ...a, ...patch } : a) });

    for (const p of pins) {
      const marker = L.marker([p.lat, p.lng], { icon: pinIcon(ACCENT) }).addTo(layer);
      marker.bindPopup(buildPinPopup(p, setPinLabel, removePin));
      if (p.label) marker.bindTooltip(p.label, { direction: 'top', offset: [0, -22] });
    }
    for (const a of areas) {
      const circle = L.circle([a.lat, a.lng], { radius: a.radius, color: ACCENT, fillColor: ACCENT, fillOpacity: 0.15, weight: 2 }).addTo(layer);
      circle.bindPopup(buildAreaPopup(a, setArea, removeArea));
      if (a.label) circle.bindTooltip(a.label, { direction: 'center' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, areas]);

  const modeBtn = (m: Mode, Icon: typeof Hand, label: string) => (
    <button
      onClick={() => setMode(m)}
      title={label}
      aria-label={label}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 30, height: 30, cursor: 'pointer',
        background: mode === m ? ACCENT : t.input,
        color: mode === m ? '#fff' : t.textMuted,
        border: `1px solid ${mode === m ? ACCENT : t.border}`,
        borderRadius: 8,
      }}
    >
      <Icon size={15} strokeWidth={1.8} />
    </button>
  );

  return (
    <Widget t={t} accent="" noPadding>
      <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', borderRadius: 'var(--widget-radius, 16px)' }}>
        <div ref={boxRef} style={{ position: 'absolute', inset: 0 }} />
        {/* Mode toolbar */}
        <div
          className="widget-interactive"
          style={{
            position: 'absolute', top: 10, right: 10, zIndex: 500,
            display: 'flex', gap: 6, padding: 5,
            background: t.panel ?? t.bgAlt, border: `1px solid ${t.border}`,
            borderRadius: 11, boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
          }}
        >
          {modeBtn('pan', Hand, 'Pan the map')}
          {modeBtn('pin', MapPin, 'Click the map to add a pin')}
          {modeBtn('area', CircleIcon, 'Click the map to add an area')}
        </div>
      </div>
    </Widget>
  );
}

// ── Popup builders (plain DOM — Leaflet popups aren't React) ──────────────────

function buildPinPopup(p: Pin, setLabel: (id: string, v: string) => void, remove: (id: string) => void): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;min-width:150px;font-family:inherit';
  const input = document.createElement('input');
  input.value = p.label; input.placeholder = 'Label this pin…';
  input.style.cssText = 'padding:5px 7px;border:1px solid #ccc;border-radius:6px;font:inherit;outline:none';
  input.onchange = () => setLabel(p.id, input.value.trim());
  const btn = document.createElement('button');
  btn.textContent = 'Remove pin';
  btn.style.cssText = 'padding:5px 7px;border:1px solid #e0563a;color:#e0563a;background:transparent;border-radius:6px;cursor:pointer;font:inherit';
  btn.onclick = () => remove(p.id);
  wrap.append(input, btn);
  return wrap;
}

function buildAreaPopup(a: Area, set: (id: string, patch: Partial<Area>) => void, remove: (id: string) => void): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;min-width:160px;font-family:inherit';
  const input = document.createElement('input');
  input.value = a.label; input.placeholder = 'Label this area…';
  input.style.cssText = 'padding:5px 7px;border:1px solid #ccc;border-radius:6px;font:inherit;outline:none';
  input.onchange = () => set(a.id, { label: input.value.trim() });
  const rowLabel = document.createElement('label');
  rowLabel.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:12px;color:#555';
  const radius = document.createElement('input');
  radius.type = 'number'; radius.min = '50'; radius.step = '50'; radius.value = String(a.radius);
  radius.style.cssText = 'width:80px;padding:4px 6px;border:1px solid #ccc;border-radius:6px;font:inherit;outline:none';
  radius.onchange = () => { const v = Math.max(50, Number(radius.value) || a.radius); set(a.id, { radius: v }); };
  rowLabel.append(document.createTextNode('Radius (m)'), radius);
  const btn = document.createElement('button');
  btn.textContent = 'Remove area';
  btn.style.cssText = 'padding:5px 7px;border:1px solid #e0563a;color:#e0563a;background:transparent;border-radius:6px;cursor:pointer;font:inherit';
  btn.onclick = () => remove(a.id);
  wrap.append(input, rowLabel, btn);
  return wrap;
}
