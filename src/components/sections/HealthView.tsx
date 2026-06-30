import React, { useRef, useState, useEffect, useCallback } from 'react';
import JSZip from 'jszip';
import { Plus, X, Heart, Moon, Activity, RefreshCw, Loader } from 'lucide-react';
import { format, subDays, startOfDay } from 'date-fns';
import type { HealthDay, Theme } from '../../lib/types';
import { SectionHeader } from '../shared/ui';
import { supabase } from '../../lib/supabase';
import DatePicker from '../shared/DatePicker';

function dayKey(ts: number): string {
  return format(new Date(ts), 'yyyy-MM-dd');
}

function last7(): HealthDay[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = startOfDay(subDays(new Date(), 6 - i));
    return { date: d.getTime(), steps: null, sleepHours: null, activeCalories: null, heartRateAvg: null };
  });
}

// ── Parse Apple Health XML ────────────────────────────────────────────────────

function parseHealthXml(text: string): HealthDay[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'application/xml');
  const stepMap: Record<string, number> = {};
  const sleepMap: Record<string, number> = {};
  const calMap: Record<string, number> = {};
  const hrMap: Record<string, number[]> = {};

  doc.querySelectorAll('Record[type="HKQuantityTypeIdentifierStepCount"]').forEach(r => {
    const date = r.getAttribute('startDate')?.slice(0, 10);
    const val = parseFloat(r.getAttribute('value') ?? '0');
    if (date) stepMap[date] = (stepMap[date] ?? 0) + val;
  });

  doc.querySelectorAll('Record[type="HKCategoryTypeIdentifierSleepAnalysis"]').forEach(r => {
    const date = r.getAttribute('startDate')?.slice(0, 10);
    const startStr = r.getAttribute('startDate');
    const endStr = r.getAttribute('endDate');
    const value = r.getAttribute('value') ?? '';
    if (date && startStr && endStr && value !== 'HKCategoryValueSleepAnalysisInBed') {
      const hours = (new Date(endStr).getTime() - new Date(startStr).getTime()) / 3_600_000;
      if (hours > 0 && hours < 16) sleepMap[date] = (sleepMap[date] ?? 0) + hours;
    }
  });

  doc.querySelectorAll('Record[type="HKQuantityTypeIdentifierActiveEnergyBurned"]').forEach(r => {
    const date = r.getAttribute('startDate')?.slice(0, 10);
    const val = parseFloat(r.getAttribute('value') ?? '0');
    if (date) calMap[date] = (calMap[date] ?? 0) + val;
  });

  doc.querySelectorAll('Record[type="HKQuantityTypeIdentifierHeartRate"]').forEach(r => {
    const date = r.getAttribute('startDate')?.slice(0, 10);
    const val = parseFloat(r.getAttribute('value') ?? '0');
    if (date && val > 0) {
      if (!hrMap[date]) hrMap[date] = [];
      hrMap[date].push(val);
    }
  });

  const allDates = new Set([
    ...Object.keys(stepMap),
    ...Object.keys(sleepMap),
    ...Object.keys(calMap),
    ...Object.keys(hrMap),
  ]);

  return Array.from(allDates).map(dateStr => {
    const hrs = hrMap[dateStr];
    return {
      date: new Date(dateStr + 'T00:00:00').getTime(),
      steps: stepMap[dateStr] ? Math.round(stepMap[dateStr]) : null,
      sleepHours: sleepMap[dateStr] ? Math.round(sleepMap[dateStr] * 10) / 10 : null,
      activeCalories: calMap[dateStr] ? Math.round(calMap[dateStr]) : null,
      heartRateAvg: hrs?.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : null,
    };
  });
}

// ── Terra connect modal ───────────────────────────────────────────────────────
// Terra is a health data aggregation service that connects to Apple Health
// via their hosted widget. The user opens the widget link on their iPhone,
// grants HealthKit access, and Terra pushes data to our webhook → Supabase.

type ConnectStage = 'idle' | 'generating' | 'waiting' | 'syncing' | 'error' | 'not-configured';

function AppleHealthModal({ t, userRef, onSync, onClose }: {
  t: Theme;
  userRef: string;
  onSync: () => void;
  onClose: () => void;
}) {
  const [stage, setStage] = useState<ConnectStage>('idle');
  const [widgetUrl, setWidgetUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [setupInfo, setSetupInfo] = useState('');

  // Also keep the XML fallback available
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseProgress, setParseProgress] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  const generateWidget = async () => {
    setStage('generating');
    setErrorMsg('');
    try {
      const r = await fetch('/api/terra-widget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference_id: userRef }),
      });
      const data = await r.json();
      if (r.status === 503) {
        setSetupInfo(data.setup ?? '');
        setStage('not-configured');
        return;
      }
      if (!r.ok) throw new Error(data.error ?? 'Failed to generate connect link');
      setWidgetUrl(data.url);
      setStage('waiting');
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setStage('error');
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(widgetUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const checkSync = () => {
    setStage('syncing');
    // Give Supabase a moment to receive the webhook
    setTimeout(() => {
      onSync();
      onClose();
    }, 2000);
  };

  // XML fallback handlers
  const processXml = (text: string) => {
    setParseProgress('Parsing health records…');
    // Use the parseHealthXml helper defined elsewhere in this file
    void Promise.resolve().then(() => {
      const days = parseHealthXml(text);
      onSync();
      onClose();
      return days;
    });
  };

  const handleFile = async (file: File) => {
    setParsing(true); setParseError(null); setParseProgress(null);
    try {
      const name = file.name.toLowerCase();
      if (name.endsWith('.zip')) {
        setParseProgress('Opening zip…');
        const zip = await JSZip.loadAsync(file);
        const xmlEntry = zip.file(/export\.xml$/i)[0];
        if (!xmlEntry) throw new Error('export.xml not found in the zip.');
        setParseProgress('Extracting export.xml…');
        const text = await xmlEntry.async('text');
        processXml(text);
      } else if (name.endsWith('.xml')) {
        processXml(await file.text());
      } else {
        setParseError('Drop your export.zip or export.xml file.');
      }
    } catch (e: unknown) {
      setParseError(e instanceof Error ? e.message : String(e));
    }
    setParsing(false); setParseProgress(null);
  };

  return (
    <div
      role="dialog" aria-modal="true" onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '1rem',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(520px, 100%)', background: t.panel,
          border: `1px solid ${t.borderStrong}`, borderRadius: '18px',
          padding: '2rem', fontFamily: 'var(--app-font)', color: t.text,
          position: 'relative',
        }}
      >
        <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: t.textMuted, cursor: 'pointer', padding: '0.3rem', display: 'flex' }}>
          <X size={16} strokeWidth={1.5} />
        </button>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1.5rem' }}>
          <div style={{
            width: 48, height: 48, borderRadius: '12px',
            background: 'linear-gradient(135deg, #ff2d55 0%, #ff6b81 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Heart size={24} color="#fff" fill="#fff" strokeWidth={0} />
          </div>
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>Connect Apple Health</div>
            <div style={{ fontSize: '0.78rem', color: t.textMuted, marginTop: '0.15rem' }}>
              Sync sleep, steps, heart rate and calories
            </div>
          </div>
        </div>

        {/* Idle */}
        {stage === 'idle' && (
          <>
            <div style={{ fontSize: '0.84rem', color: t.textMuted, lineHeight: 1.65, marginBottom: '1.25rem' }}>
              Connect Apple Health using <strong style={{ color: t.text }}>Terra</strong>, a health data bridge that
              links your iPhone's Health app to this dashboard. Your data syncs automatically and is stored securely in your account.
            </div>
            <button
              onClick={generateWidget}
              style={{
                width: '100%', padding: '0.8rem',
                background: 'linear-gradient(135deg, #ff2d55 0%, #ff6b81 100%)',
                border: 'none', borderRadius: '12px', color: '#fff',
                fontFamily: 'inherit', fontSize: '0.92rem', fontWeight: 600,
                cursor: 'pointer', marginBottom: '0.85rem',
              }}
            >
              Connect Apple Health →
            </button>
            <button
              onClick={() => setShowFallback(v => !v)}
              style={{ background: 'transparent', border: 'none', color: t.textDim, fontFamily: 'inherit', fontSize: '0.74rem', cursor: 'pointer', textDecoration: 'underline' }}
            >
              {showFallback ? 'Hide' : 'Or import a Health export file instead'}
            </button>
            {showFallback && <XmlFallback t={t} fileRef={fileRef} onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }} dragOver={dragOver} setDragOver={setDragOver} handleFile={handleFile} parsing={parsing} parseProgress={parseProgress} parseError={parseError} />}
          </>
        )}

        {/* Generating */}
        {stage === 'generating' && (
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <Loader size={28} strokeWidth={1.5} color="#ff2d55" style={{ animation: 'spin 1s linear infinite' }} />
            <div style={{ marginTop: '0.75rem', color: t.textMuted, fontSize: '0.85rem' }}>Generating your connect link…</div>
          </div>
        )}

        {/* Waiting — show link to open on iPhone */}
        {stage === 'waiting' && widgetUrl && (
          <>
            <div style={{ fontSize: '0.84rem', color: t.textMuted, lineHeight: 1.6, marginBottom: '1.1rem' }}>
              <strong style={{ color: t.text }}>On your iPhone:</strong> open the link below, then tap "Apple Health" and grant access. Come back here once done.
            </div>

            {/* Link box */}
            <div style={{
              background: t.bgAlt, border: `1px solid ${t.border}`, borderRadius: '10px',
              padding: '0.75rem 1rem', marginBottom: '1rem',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}>
              <span style={{ flex: 1, fontSize: '0.72rem', color: t.textMuted, wordBreak: 'break-all', lineHeight: 1.4 }}>
                {widgetUrl}
              </span>
              <button
                onClick={copyLink}
                style={{
                  flexShrink: 0, background: copied ? t.doneAccent : t.panel,
                  border: `1px solid ${t.border}`, borderRadius: '7px',
                  padding: '0.35rem 0.7rem', fontSize: '0.72rem', fontFamily: 'inherit',
                  color: copied ? '#fff' : t.text, cursor: 'pointer',
                }}
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>

            <div style={{ fontSize: '0.75rem', color: t.textDim, marginBottom: '1.1rem', lineHeight: 1.5 }}>
              💡 Text or AirDrop this link to your iPhone, then tap it to open the Terra Health connection flow.
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setStage('idle')} style={{ background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '9px', padding: '0.55rem 1.1rem', color: t.textMuted, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.84rem' }}>Back</button>
              <button
                onClick={checkSync}
                style={{
                  flex: 1, background: '#ff2d55', border: 'none', borderRadius: '9px',
                  padding: '0.6rem', color: '#fff', fontFamily: 'inherit',
                  fontSize: '0.86rem', fontWeight: 500, cursor: 'pointer',
                }}
              >
                I've connected, sync data
              </button>
            </div>
          </>
        )}

        {/* Syncing */}
        {stage === 'syncing' && (
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <Loader size={28} strokeWidth={1.5} color="#ff2d55" style={{ animation: 'spin 1s linear infinite' }} />
            <div style={{ marginTop: '0.75rem', color: t.textMuted, fontSize: '0.85rem' }}>Fetching your health data…</div>
          </div>
        )}

        {/* Error */}
        {stage === 'error' && (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⚠️</div>
            <div style={{ fontSize: '0.85rem', color: t.alert, marginBottom: '0.5rem', fontWeight: 500 }}>Connection failed</div>
            <div style={{ fontSize: '0.78rem', color: t.textMuted, marginBottom: '1.25rem' }}>{errorMsg}</div>
            <button onClick={() => setStage('idle')} style={{ background: '#ff2d55', border: 'none', borderRadius: '9px', padding: '0.55rem 1.25rem', color: '#fff', fontFamily: 'inherit', fontSize: '0.84rem', fontWeight: 500, cursor: 'pointer' }}>Try again</button>
          </div>
        )}

        {/* Not configured */}
        {stage === 'not-configured' && (
          <div>
            <div style={{
              background: '#f59e0b18', border: '1px solid #f59e0b40', borderRadius: '10px',
              padding: '1rem 1.1rem', marginBottom: '1.25rem',
            }}>
              <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#f59e0b', marginBottom: '0.35rem' }}>Terra API not configured</div>
              <div style={{ fontSize: '0.78rem', color: t.textMuted, lineHeight: 1.6 }}>{setupInfo}</div>
            </div>
            <div style={{ fontSize: '0.82rem', color: t.text, lineHeight: 1.65 }}>
              <strong>Setup (free):</strong>
              <ol style={{ margin: '0.5rem 0', paddingLeft: '1.2rem' }}>
                <li>Sign up at <strong>tryterra.co</strong> (free developer account)</li>
                <li>Go to <strong>Developer → API Keys</strong> and copy your Dev ID and API Key</li>
                <li>Add <code>TERRA_DEV_ID</code> and <code>TERRA_API_KEY</code> to your Vercel environment variables</li>
                <li>In Terra dashboard, set webhook URL to: <code>https://&lt;your-vercel-url&gt;/api/terra-webhook</code></li>
                <li>Redeploy</li>
              </ol>
            </div>
            <div style={{ marginTop: '1rem' }}>
              <button onClick={() => setShowFallback(v => !v)} style={{ background: 'transparent', border: 'none', color: t.doingAccent, fontFamily: 'inherit', fontSize: '0.78rem', cursor: 'pointer', textDecoration: 'underline' }}>
                Use file import instead (no API key needed)
              </button>
              {showFallback && <XmlFallback t={t} fileRef={fileRef} onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }} dragOver={dragOver} setDragOver={setDragOver} handleFile={handleFile} parsing={parsing} parseProgress={parseProgress} parseError={parseError} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// XML fallback component (shared between idle and not-configured states)
function XmlFallback({ t, fileRef, onDrop, dragOver, setDragOver, handleFile, parsing, parseProgress, parseError }: {
  t: Theme;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onDrop: (e: React.DragEvent) => void;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  handleFile: (f: File) => void;
  parsing: boolean;
  parseProgress: string | null;
  parseError: string | null;
}) {
  return (
    <div style={{ marginTop: '1rem' }}>
      <div
        onClick={() => !parsing && fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        style={{
          border: `2px dashed ${dragOver ? '#ff2d55' : t.border}`, borderRadius: '12px',
          padding: '1.5rem 1rem', textAlign: 'center', cursor: parsing ? 'wait' : 'pointer',
          background: dragOver ? '#ff2d5508' : 'transparent', transition: 'all 0.15s',
        }}
      >
        {parsing
          ? <div style={{ color: t.textMuted, fontSize: '0.82rem' }}>{parseProgress ?? 'Processing…'}</div>
          : <>
              <div style={{ fontSize: '1.4rem', marginBottom: '0.35rem' }}>📂</div>
              <div style={{ fontSize: '0.82rem', color: t.text }}>Drop <strong>export.zip</strong> or <strong>export.xml</strong> here</div>
              <div style={{ fontSize: '0.7rem', color: t.textDim, marginTop: '0.2rem' }}>Export from iPhone: Health app → profile → Export All Health Data</div>
            </>
        }
        <input ref={fileRef} type="file" accept=".zip,.xml" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      </div>
      {parseError && <div style={{ marginTop: '0.5rem', fontSize: '0.74rem', color: t.alert }}>{parseError}</div>}
    </div>
  );
}

// ── Bar chart ─────────────────────────────────────────────────────────────────

function BarChart({ days, getValue, label, unit, color, t, goal }: {
  days: HealthDay[];
  getValue: (d: HealthDay) => number | null;
  label: string;
  unit: string;
  color: string;
  t: Theme;
  goal?: number;
}) {
  const values = days.map(getValue);
  const max = Math.max(...values.filter(v => v !== null) as number[], goal ?? 0, 1);
  const today = dayKey(Date.now());

  return (
    <div style={{
      background: t.panel, border: `1px solid ${t.border}`, borderRadius: '12px',
      padding: '1.1rem 1.25rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <span style={{ fontSize: '0.68rem', color: t.textDim, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          {label}
        </span>
        {goal && (
          <span style={{ fontSize: '0.68rem', color: t.textDim }}>goal: {goal.toLocaleString()} {unit}</span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '80px' }}>
        {days.map((d, i) => {
          const v = getValue(d);
          const pct = v !== null ? Math.min((v / max) * 100, 100) : 0;
          const isToday = dayKey(d.date) === today;
          const hitGoal = goal && v !== null && v >= goal;
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%' }}>
              <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                <div style={{ width: '100%', position: 'relative' }}>
                  <div style={{ height: '80px', background: t.border, borderRadius: '3px 3px 0 0', opacity: 0.35 }} />
                  {v !== null && (
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      height: `${pct}%`,
                      background: hitGoal ? t.doneAccent : (isToday ? color : color + '99'),
                      borderRadius: '3px 3px 0 0',
                      transition: 'height 0.3s', minHeight: '3px',
                    }} />
                  )}
                  {v === null && (
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      height: '3px', background: t.border, borderRadius: '2px',
                    }} />
                  )}
                </div>
              </div>
              <span style={{ fontSize: '0.55rem', color: isToday ? t.text : t.textDim, fontWeight: isToday ? 500 : 400 }}>
                {format(new Date(d.date), 'EEE')}
              </span>
            </div>
          );
        })}
      </div>

      {(() => {
        const todayDay = days.find(d => dayKey(d.date) === today);
        const v = todayDay ? getValue(todayDay) : null;
        return (
          <div style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
            <span style={{ fontSize: '1.6rem', fontWeight: 200, color: t.text, lineHeight: 1 }}>
              {v !== null ? v.toLocaleString() : '-'}
            </span>
            <span style={{ fontSize: '0.72rem', color: t.textMuted }}>{unit} today</span>
          </div>
        );
      })()}
    </div>
  );
}

// ── Stats strip ───────────────────────────────────────────────────────────────

function StatPill({ icon, label, value, unit, color, t }: {
  icon: React.ReactNode; label: string; value: number | null; unit: string; color: string; t: Theme;
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '0.2rem',
      background: color + '0d', border: `1px solid ${color}33`,
      borderRadius: '10px', padding: '0.7rem 0.9rem', flex: 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color }}>
        {icon}
        <span style={{ fontSize: '0.62rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
      </div>
      <span style={{ fontSize: '1.4rem', fontWeight: 200, color: t.text, lineHeight: 1 }}>
        {value !== null ? value.toLocaleString() : '-'}
      </span>
      <span style={{ fontSize: '0.68rem', color: t.textDim }}>{unit}</span>
    </div>
  );
}

// ── Manual entry ──────────────────────────────────────────────────────────────

function ManualEntryForm({ t, onSave }: { t: Theme; onSave: (day: HealthDay) => void }) {
  const [open, setOpen] = useState(false);
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [date, setDate] = useState(todayStr);
  const [steps, setSteps] = useState('');
  const [sleep, setSleep] = useState('');
  const [calories, setCalories] = useState('');
  const [hr, setHr] = useState('');

  const save = () => {
    const d = new Date(date + 'T00:00:00');
    if (isNaN(d.getTime())) return;
    onSave({
      date: d.getTime(),
      steps: steps ? parseInt(steps) : null,
      sleepHours: sleep ? parseFloat(sleep) : null,
      activeCalories: calories ? parseInt(calories) : null,
      heartRateAvg: hr ? parseInt(hr) : null,
    });
    setSteps(''); setSleep(''); setCalories(''); setHr('');
    setDate(todayStr);
    setOpen(false);
  };

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: t.input, border: `1px solid ${t.border}`, borderRadius: '7px',
    padding: '0.45rem 0.6rem', color: t.text, fontSize: '0.82rem',
    fontFamily: 'inherit', outline: 'none',
  };

  const field = (label: string, value: string, set: (v: string) => void, placeholder: string) => (
    <div>
      <div style={{ fontSize: '0.65rem', color: t.textDim, marginBottom: '0.2rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</div>
      <input type="number" min="0" value={value} onChange={e => set(e.target.value)} placeholder={placeholder} style={inp} />
    </div>
  );

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
          background: 'transparent', border: `1px dashed ${t.border}`, borderRadius: '8px',
          padding: '0.45rem 0.85rem', color: t.textMuted, fontFamily: 'inherit',
          fontSize: '0.8rem', cursor: 'pointer',
        }}
      >
        <Plus size={13} strokeWidth={1.8} /> Log today manually
      </button>

      {open && (
        <div style={{
          marginTop: '0.75rem', background: t.panel, border: `1px solid ${t.border}`,
          borderRadius: '12px', padding: '1.1rem', display: 'grid', gap: '0.65rem',
        }}>
          <div>
            <div style={{ fontSize: '0.65rem', color: t.textDim, marginBottom: '0.2rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Date</div>
            <DatePicker
              t={t}
              value={date ? new Date(date + 'T00:00:00').getTime() : null}
              onChange={ts => setDate(ts ? format(new Date(ts), 'yyyy-MM-dd') : '')}
              size="md"
              allowClear={false}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
            {field('Steps', steps, setSteps, '8000')}
            {field('Sleep (hrs)', sleep, setSleep, '7.5')}
            {field('Active cal', calories, setCalories, '400')}
            {field('Heart rate', hr, setHr, '72')}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button onClick={() => setOpen(false)} style={{ background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px', padding: '0.4rem 0.8rem', fontSize: '0.78rem', fontFamily: 'inherit', cursor: 'pointer', color: t.textMuted }}>Cancel</button>
            <button onClick={save} style={{ background: t.text, color: t.bg, border: 'none', borderRadius: '8px', padding: '0.4rem 0.9rem', fontSize: '0.82rem', fontFamily: 'inherit', cursor: 'pointer', fontWeight: 500 }}>Save</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

interface Props {
  t: Theme;
  healthDays: HealthDay[];
  onChange: (days: HealthDay[]) => void;
  /** Supabase user ID or email, used as Terra reference_id */
  userRef?: string;
}

export default function HealthView({ t, healthDays, onChange, userRef = 'aug-user' }: Props) {
  const [showModal, setShowModal] = useState(false);

  const mergeDays = useCallback((incoming: HealthDay[]) => {
    const map = new Map<string, HealthDay>();
    for (const d of healthDays) map.set(dayKey(d.date), d);
    for (const d of incoming) {
      const k = dayKey(d.date);
      const existing = map.get(k);
      if (existing) {
        map.set(k, {
          date: d.date,
          steps: d.steps ?? existing.steps,
          sleepHours: d.sleepHours ?? existing.sleepHours,
          activeCalories: d.activeCalories ?? existing.activeCalories,
          heartRateAvg: d.heartRateAvg ?? existing.heartRateAvg,
        });
      } else {
        map.set(k, d);
      }
    }
    onChange(Array.from(map.values()).sort((a, b) => a.date - b.date));
  }, [healthDays, onChange]);

  // Pull health data from Supabase (set by Terra webhook)
  const fetchFromSupabase = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('health_days')
        .select('*')
        .eq('user_ref', userRef)
        .order('date', { ascending: true });
      if (error || !data?.length) return;
      const days: HealthDay[] = data.map((row: Record<string, unknown>) => ({
        date: new Date(row.date as string + 'T00:00:00').getTime(),
        steps: (row.steps as number | null) ?? null,
        sleepHours: (row.sleep_hours as number | null) ?? null,
        activeCalories: (row.active_calories as number | null) ?? null,
        heartRateAvg: (row.heart_rate_avg as number | null) ?? null,
      }));
      mergeDays(days);
    } catch (_) {}
  }, [userRef, mergeDays]);

  // Fetch from Supabase on mount (picks up Terra-delivered data)
  useEffect(() => { fetchFromSupabase(); }, [fetchFromSupabase]);

  const chart7 = last7().map(skeleton => {
    const real = healthDays.find(d => dayKey(d.date) === dayKey(skeleton.date));
    return real ?? skeleton;
  });

  const today = healthDays.find(d => dayKey(d.date) === dayKey(Date.now()));
  const isConnected = healthDays.length > 0;

  return (
    <div>
      <SectionHeader title="Health" t={t} />

      {/* Apple Health connect card */}
      <div style={{
        background: isConnected ? '#ff2d5508' : 'linear-gradient(135deg, #ff2d5510 0%, #ff6b8110 100%)',
        border: `1px solid ${isConnected ? '#ff2d5530' : '#ff2d5550'}`,
        borderRadius: '14px', padding: '1.1rem 1.25rem',
        marginBottom: '1.5rem',
        display: 'flex', alignItems: 'center', gap: '1rem',
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: '10px', flexShrink: 0,
          background: 'linear-gradient(135deg, #ff2d55 0%, #ff6b81 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Heart size={20} color="#fff" fill="#fff" strokeWidth={0} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 500, color: t.text }}>Apple Health</div>
          <div style={{ fontSize: '0.72rem', color: t.textMuted, marginTop: '0.1rem' }}>
            {isConnected
              ? `${healthDays.length} days synced · steps, sleep, heart rate, calories`
              : 'Connect to see your steps, sleep and activity'}
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            background: isConnected ? 'transparent' : '#ff2d55',
            border: isConnected ? `1px solid #ff2d5560` : 'none',
            borderRadius: '8px', padding: '0.5rem 1rem',
            color: isConnected ? '#ff2d55' : '#fff',
            fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 500,
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          {isConnected ? <><RefreshCw size={13} strokeWidth={1.8} />Update</> : 'Connect'}
        </button>
      </div>

      {/* Today strip */}
      <div style={{ display: 'flex', gap: '0.65rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <StatPill icon={<Activity size={12} strokeWidth={1.8} />} label="Steps" value={today?.steps ?? null} unit="steps today" color="#fc3c44" t={t} />
        <StatPill icon={<Moon size={12} strokeWidth={1.8} />} label="Sleep" value={today?.sleepHours ?? null} unit="hrs last night" color="#7da7d9" t={t} />
        <StatPill icon={<Heart size={12} strokeWidth={1.8} />} label="Heart rate" value={today?.heartRateAvg ?? null} unit="bpm avg" color="#e8556e" t={t} />
        <StatPill icon={<Activity size={12} strokeWidth={1.8} />} label="Active cal" value={today?.activeCalories ?? null} unit="kcal burned" color="#d9a35a" t={t} />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <BarChart days={chart7} getValue={d => d.steps} label="Steps" unit="steps" color="#fc3c44" t={t} goal={8000} />
        <BarChart days={chart7} getValue={d => d.sleepHours} label="Sleep" unit="hrs" color="#7da7d9" t={t} goal={8} />
      </div>

      {/* Manual entry */}
      <div style={{ marginBottom: '0.5rem' }}>
        <ManualEntryForm t={t} onSave={day => mergeDays([day])} />
      </div>

      {/* History table */}
      {healthDays.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{
            fontSize: '0.68rem', color: t.textDim, letterSpacing: '0.1em', textTransform: 'uppercase',
            marginBottom: '0.5rem',
          }}>
            History ({healthDays.length} days)
          </div>
          <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '120px 1fr 1fr 1fr 1fr auto',
              padding: '0.4rem 0.9rem', borderBottom: `1px solid ${t.border}`,
              fontSize: '0.62rem', color: t.textDim, letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              <span>Date</span><span>Steps</span><span>Sleep</span><span>Cal</span><span>HR</span><span />
            </div>
            <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
              {[...healthDays].sort((a, b) => b.date - a.date).map(d => (
                <div key={d.date} style={{
                  display: 'grid', gridTemplateColumns: '120px 1fr 1fr 1fr 1fr auto',
                  padding: '0.45rem 0.9rem', borderBottom: `1px solid ${t.border}`,
                  fontSize: '0.8rem', color: t.text, alignItems: 'center',
                }}>
                  <span style={{ color: t.textMuted }}>{format(new Date(d.date), 'd MMM yyyy')}</span>
                  <span>{d.steps?.toLocaleString() ?? '-'}</span>
                  <span>{d.sleepHours != null ? `${d.sleepHours}h` : '-'}</span>
                  <span>{d.activeCalories?.toLocaleString() ?? '-'}</span>
                  <span>{d.heartRateAvg ?? '-'}</span>
                  <button
                    onClick={() => onChange(healthDays.filter(hd => hd.date !== d.date))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textDim, padding: '0.1rem', display: 'flex', alignItems: 'center' }}
                  >
                    <X size={12} strokeWidth={1.5} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <AppleHealthModal
          t={t}
          userRef={userRef}
          onSync={fetchFromSupabase}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
