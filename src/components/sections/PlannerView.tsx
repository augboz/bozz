import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, X, Check, Trash2 } from 'lucide-react';
import type { Theme, PlannerItem, Topic, CalendarEvent } from '../../lib/types';
import { sectionAccents } from '../../lib/themes';

// ── Time grid constants ─────────────────────────────────────────────────────
const HOUR_PX = 64;          // px per hour
const START_HOUR = 6;        // 06:00
const END_HOUR = 24;         // 24:00 (midnight)
const HOURS = END_HOUR - START_HOUR;
const GRID_HEIGHT = HOURS * HOUR_PX;
const TIME_COL_W = 52;       // left column width

const ACCENT = sectionAccents.planner;

// ── Helpers ──────────────────────────────────────────────────────────────────
function localMidnight(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function minToY(min: number): number {
  return ((min - START_HOUR * 60) / 60) * HOUR_PX;
}

/** Snap to nearest 15-min slot. */
function yToMin(y: number): number {
  const raw = (y / HOUR_PX) * 60 + START_HOUR * 60;
  return Math.round(raw / 15) * 15;
}

function pad(n: number) { return n.toString().padStart(2, '0'); }
function fmtMin(min: number) {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${pad(h)}:${pad(m)}`;
}

function addDays(ms: number, n: number) {
  const d = new Date(ms);
  d.setDate(d.getDate() + n);
  return localMidnight(d);
}

function formatDateLabel(ms: number) {
  return new Date(ms).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

// ── Colour presets ────────────────────────────────────────────────────────────
const BASE_COLORS = [
  ACCENT, '#7da7d9', '#c9a8d4', '#9aae7c', '#d9a35a',
  '#d75c45', '#6fb096', '#5aa5d7', '#e8c15a', '#bf4a88',
];

interface Props {
  t: Theme;
  items: PlannerItem[];
  setItems: (items: PlannerItem[]) => void;
  topics: Topic[];
  feedEvents?: CalendarEvent[];
}

export default function PlannerView({ t, items, setItems, topics, feedEvents = [] }: Props) {
  const [date, setDate] = useState(() => localMidnight());
  const [adding, setAdding] = useState<{ min: number } | null>(null);
  const [addText, setAddText] = useState('');
  const [addColor, setAddColor] = useState(ACCENT);
  const [addDuration, setAddDuration] = useState(60);
  const [addTopicId, setAddTopicId] = useState('');
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  const isToday = date === localMidnight();

  // Current time in minutes from midnight
  const [nowMin, setNowMin] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });
  useEffect(() => {
    const id = setInterval(() => {
      const n = new Date();
      setNowMin(n.getHours() * 60 + n.getMinutes());
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  // Scroll to current time (or 8am) on mount
  useEffect(() => {
    if (!scrollRef.current) return;
    const targetMin = isToday ? Math.max(nowMin - 60, START_HOUR * 60) : 8 * 60;
    const y = minToY(targetMin);
    scrollRef.current.scrollTop = Math.max(0, y - 32);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dayItems = useMemo(
    () => items.filter(it => it.date === date),
    [items, date],
  );

  const dayFeedEvents = useMemo(() => {
    const start = date;
    const end = date + 86_400_000;
    return feedEvents.filter(ev => ev.start >= start && ev.start < end);
  }, [feedEvents, date]);

  const allDayEvents = useMemo(
    () => dayFeedEvents.filter(ev => ev.allDay),
    [dayFeedEvents],
  );
  const timedFeedEvents = useMemo(
    () => dayFeedEvents.filter(ev => !ev.allDay),
    [dayFeedEvents],
  );

  // Unique colour palette: base + topic colours
  const colorPresets = useMemo(() => {
    const topicColors = topics.map(tp => tp.color);
    return [...BASE_COLORS, ...topicColors]
      .filter((c, i, a) => a.indexOf(c) === i)
      .slice(0, 14);
  }, [topics]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleGridClick(e: React.MouseEvent<HTMLDivElement>) {
    // Ignore clicks on existing items / buttons
    if ((e.target as HTMLElement).closest('[data-planner-item]')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const scroll = scrollRef.current?.scrollTop ?? 0;
    const y = e.clientY - rect.top + scroll;
    const min = yToMin(y);
    if (min < START_HOUR * 60 || min >= END_HOUR * 60) return;
    setAdding({ min });
    setAddText('');
    setAddColor(ACCENT);
    setAddDuration(60);
    setAddTopicId('');
  }

  function commitAdd() {
    if (!adding || !addText.trim()) { setAdding(null); return; }
    const next: PlannerItem = {
      id: Date.now(),
      date,
      startMin: adding.min,
      duration: addDuration,
      text: addText.trim(),
      color: addColor,
      done: false,
      topicId: addTopicId || undefined,
    };
    setItems([...items, next]);
    setAdding(null);
    setAddText('');
  }

  function toggleDone(id: number) {
    setItems(items.map(it => it.id === id ? { ...it, done: !it.done } : it));
  }

  function deleteItem(id: number) {
    setItems(items.filter(it => it.id !== id));
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ width: '3px', height: '1.1rem', borderRadius: '2px', background: ACCENT, flexShrink: 0 }} />
        <h1 style={{ fontSize: '1.4rem', fontWeight: 300, letterSpacing: '-0.02em', color: t.text, margin: 0, flex: 1 }}>
          Planner
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button
            onClick={() => setDate(d => addDays(d, -1))}
            style={navBtnStyle(t)}
            aria-label="Previous day"
          >
            <ChevronLeft size={15} />
          </button>
          <span style={{ fontSize: '0.88rem', color: t.text, minWidth: '196px', textAlign: 'center', letterSpacing: '-0.01em' }}>
            {formatDateLabel(date)}
          </span>
          <button
            onClick={() => setDate(d => addDays(d, 1))}
            style={navBtnStyle(t)}
            aria-label="Next day"
          >
            <ChevronRight size={15} />
          </button>
          {!isToday && (
            <button
              onClick={() => setDate(localMidnight())}
              style={{ ...navBtnStyle(t), padding: '0.3rem 0.65rem', fontSize: '0.75rem', letterSpacing: '0.01em' }}
            >
              Today
            </button>
          )}
        </div>
      </div>

      {/* ── All-day event banner ── */}
      {allDayEvents.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', padding: '0.35rem 0' }}>
          {allDayEvents.map(ev => (
            <span key={ev.id} style={{
              fontSize: '0.72rem', background: ev.color + '22', color: t.text,
              borderLeft: `3px solid ${ev.color}`,
              padding: '0.2rem 0.55rem', borderRadius: '4px',
              letterSpacing: '0.01em',
            }}>
              {ev.title}
            </span>
          ))}
        </div>
      )}

      {/* ── Hint ── */}
      <p style={{ margin: 0, fontSize: '0.72rem', color: t.textDim, letterSpacing: '0.02em' }}>
        Click any time slot to add a block
      </p>

      {/* ── Scroll container ── */}
      <div
        ref={scrollRef}
        style={{
          height: `min(calc(100vh - 260px), ${GRID_HEIGHT}px)`,
          minHeight: '400px',
          overflowY: 'auto',
          overflowX: 'hidden',
          borderRadius: '10px',
          border: `1px solid ${t.border}`,
          background: t.panel,
          position: 'relative',
        }}
      >
        {/* ── Grid ── */}
        <div
          style={{
            position: 'relative',
            height: `${GRID_HEIGHT}px`,
            paddingLeft: `${TIME_COL_W}px`,
            cursor: 'crosshair',
          }}
          onClick={handleGridClick}
        >
          {/* Hour rows */}
          {Array.from({ length: HOURS + 1 }, (_, i) => {
            const h = START_HOUR + i;
            const y = i * HOUR_PX;
            return (
              <div key={h} style={{ position: 'absolute', top: y, left: 0, right: 0 }}>
                {/* Time label */}
                <div style={{
                  position: 'absolute',
                  left: 4, top: -9,
                  width: TIME_COL_W - 10,
                  textAlign: 'right',
                  fontSize: '0.67rem',
                  color: t.textDim,
                  letterSpacing: '0.02em',
                  fontVariantNumeric: 'tabular-nums',
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}>
                  {h === 24 ? '00:00' : `${pad(h)}:00`}
                </div>
                {/* Hour line */}
                {i < HOURS && (
                  <div style={{
                    position: 'absolute',
                    top: 0, left: TIME_COL_W - 4, right: 0,
                    height: '1px',
                    background: t.border,
                    pointerEvents: 'none',
                  }} />
                )}
                {/* Half-hour line (skip last) */}
                {i < HOURS && (
                  <div style={{
                    position: 'absolute',
                    top: HOUR_PX / 2, left: TIME_COL_W - 4, right: 0,
                    height: '1px',
                    background: t.border,
                    opacity: 0.35,
                    pointerEvents: 'none',
                  }} />
                )}
              </div>
            );
          })}

          {/* ── Current-time line ── */}
          {isToday && nowMin >= START_HOUR * 60 && nowMin < END_HOUR * 60 && (
            <div
              style={{
                position: 'absolute',
                top: minToY(nowMin),
                left: TIME_COL_W - 4,
                right: 0,
                height: '2px',
                background: t.alert,
                zIndex: 6,
                pointerEvents: 'none',
              }}
            >
              <div style={{
                position: 'absolute',
                left: -5, top: -4,
                width: 10, height: 10,
                borderRadius: '50%',
                background: t.alert,
              }} />
            </div>
          )}

          {/* ── Feed events (timed) ── */}
          {timedFeedEvents.map(ev => {
            const startDate = new Date(ev.start);
            const startM = startDate.getHours() * 60 + startDate.getMinutes();
            const endMs = ev.end ?? (ev.start + 3_600_000);
            const endDate = new Date(endMs);
            const endM = endDate.getHours() * 60 + endDate.getMinutes();
            const durMin = Math.max(15, endM - startM);
            if (startM < START_HOUR * 60 || startM >= END_HOUR * 60) return null;
            const top = minToY(startM) + 1;
            const height = Math.max(20, (durMin / 60) * HOUR_PX) - 2;
            return (
              <div key={ev.id} style={{
                position: 'absolute',
                top, height,
                left: TIME_COL_W,
                right: 2,
                borderRadius: '5px',
                background: ev.color + '1a',
                borderLeft: `3px solid ${ev.color}`,
                padding: '0.2rem 0.45rem',
                overflow: 'hidden',
                pointerEvents: 'none',
                zIndex: 2,
              }}>
                <div style={{ fontSize: '0.72rem', color: t.textMuted, fontWeight: 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.title}</div>
                {height > 32 && (
                  <div style={{ fontSize: '0.63rem', color: t.textDim }}>{fmtMin(startM)}</div>
                )}
              </div>
            );
          })}

          {/* ── Planner items ── */}
          {dayItems.map(it => {
            if (it.startMin < START_HOUR * 60 || it.startMin >= END_HOUR * 60) return null;
            const top = minToY(it.startMin) + 1;
            const height = Math.max(24, (it.duration / 60) * HOUR_PX) - 2;
            const isHovered = hoveredId === it.id;
            return (
              <div
                key={it.id}
                data-planner-item="1"
                onMouseEnter={() => setHoveredId(it.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  position: 'absolute',
                  top, height,
                  left: TIME_COL_W + 2,
                  right: 4,
                  borderRadius: '6px',
                  background: it.done ? t.bgAlt : it.color + '26',
                  borderLeft: `3px solid ${it.done ? t.textDim : it.color}`,
                  padding: '0.2rem 0.45rem',
                  overflow: 'hidden',
                  cursor: 'default',
                  zIndex: 4,
                  opacity: it.done ? 0.55 : 1,
                  transition: 'opacity 0.15s, box-shadow 0.15s',
                  boxShadow: isHovered && !it.done ? `0 1px 8px rgba(0,0,0,0.18)` : 'none',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.3rem',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '0.78rem',
                    color: t.text,
                    fontWeight: 400,
                    textDecoration: it.done ? 'line-through' : 'none',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {it.text}
                  </div>
                  {height > 36 && (
                    <div style={{ fontSize: '0.64rem', color: t.textDim, marginTop: '1px' }}>
                      {fmtMin(it.startMin)} – {fmtMin(it.startMin + it.duration)}
                    </div>
                  )}
                </div>

                {/* Action buttons — shown on hover */}
                {isHovered && (
                  <div
                    data-planner-item="1"
                    style={{ display: 'flex', gap: '2px', flexShrink: 0, alignItems: 'center' }}
                  >
                    <button
                      data-planner-item="1"
                      onClick={(e) => { e.stopPropagation(); toggleDone(it.id); }}
                      title={it.done ? 'Mark undone' : 'Mark done'}
                      style={actionBtnStyle(it.done ? t.doneAccent : t.textMuted)}
                    >
                      <Check size={12} />
                    </button>
                    <button
                      data-planner-item="1"
                      onClick={(e) => { e.stopPropagation(); deleteItem(it.id); }}
                      title="Delete"
                      style={actionBtnStyle(t.alert)}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* ── Add-item inline form ── */}
          {adding && (
            <div
              data-planner-item="1"
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                top: minToY(adding.min) + 1,
                left: TIME_COL_W + 2,
                right: 4,
                minHeight: '96px',
                borderRadius: '8px',
                background: t.panel,
                border: `1px solid ${t.borderStrong}`,
                padding: '0.55rem 0.6rem',
                zIndex: 10,
                boxShadow: '0 4px 20px rgba(0,0,0,0.22)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
              }}
            >
              {/* Row 1: text input + close */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <input
                  autoFocus
                  value={addText}
                  onChange={e => setAddText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); commitAdd(); }
                    if (e.key === 'Escape') setAdding(null);
                  }}
                  placeholder={`Event at ${fmtMin(adding.min)}…`}
                  style={{
                    flex: 1,
                    background: t.input,
                    border: `1px solid ${t.border}`,
                    color: t.text,
                    borderRadius: '6px',
                    padding: '0.3rem 0.55rem',
                    fontSize: '0.82rem',
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
                <button
                  onClick={() => setAdding(null)}
                  style={actionBtnStyle(t.textDim)}
                  aria-label="Cancel"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Row 2: duration + topic + colours + add */}
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  value={addDuration}
                  onChange={e => setAddDuration(Number(e.target.value))}
                  style={selectStyle(t)}
                  title="Duration"
                >
                  {[15, 30, 45, 60, 90, 120, 180].map(d => (
                    <option key={d} value={d}>{d < 60 ? `${d}m` : `${d / 60}h`}</option>
                  ))}
                </select>

                {topics.length > 0 && (
                  <select
                    value={addTopicId}
                    onChange={e => {
                      setAddTopicId(e.target.value);
                      if (e.target.value) {
                        const tp = topics.find(top => top.id === e.target.value);
                        if (tp) setAddColor(tp.color);
                      }
                    }}
                    style={selectStyle(t)}
                    title="Topic"
                  >
                    <option value="">No topic</option>
                    {topics.map(tp => <option key={tp.id} value={tp.id}>{tp.name}</option>)}
                  </select>
                )}

                {/* Colour swatches */}
                <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', flex: 1 }}>
                  {colorPresets.map(c => (
                    <div
                      key={c}
                      onClick={() => setAddColor(c)}
                      title={c}
                      style={{
                        width: 14, height: 14,
                        borderRadius: '3px',
                        background: c,
                        cursor: 'pointer',
                        flexShrink: 0,
                        outline: addColor === c ? `2px solid ${t.text}` : '2px solid transparent',
                        outlineOffset: '1px',
                        transition: 'outline-color 0.1s',
                      }}
                    />
                  ))}
                </div>

                <button
                  onClick={commitAdd}
                  disabled={!addText.trim()}
                  style={{
                    background: addText.trim() ? ACCENT : t.border,
                    border: 'none',
                    color: addText.trim() ? '#fff' : t.textDim,
                    borderRadius: '6px',
                    padding: '0.28rem 0.7rem',
                    fontSize: '0.78rem',
                    cursor: addText.trim() ? 'pointer' : 'default',
                    fontFamily: 'inherit',
                    fontWeight: 500,
                    transition: 'background 0.15s',
                    flexShrink: 0,
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Style helpers ─────────────────────────────────────────────────────────────
function navBtnStyle(t: Theme): React.CSSProperties {
  return {
    background: 'transparent',
    border: `1px solid ${t.border}`,
    color: t.textMuted,
    borderRadius: '6px',
    padding: '0.3rem 0.5rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    fontFamily: 'inherit',
    transition: 'background 0.12s, color 0.12s',
  };
}

function actionBtnStyle(color: string): React.CSSProperties {
  return {
    background: 'transparent',
    border: 'none',
    color,
    cursor: 'pointer',
    padding: '2px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '3px',
    transition: 'opacity 0.12s',
  };
}

function selectStyle(t: Theme): React.CSSProperties {
  return {
    background: t.input,
    border: `1px solid ${t.border}`,
    color: t.text,
    borderRadius: '5px',
    padding: '0.25rem 0.4rem',
    fontSize: '0.75rem',
    fontFamily: 'inherit',
    cursor: 'pointer',
    outline: 'none',
  };
}
