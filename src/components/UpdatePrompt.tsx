/**
 * UpdatePrompt — themed in-app update dialog (replaces the native window.confirm).
 *
 * Shows download progress and, crucially, surfaces any download/install/relaunch
 * error instead of swallowing it — the old flow failed silently when the restart
 * didn't happen. Styled with the app's default theme so it stays on-brand.
 */

import { useState } from 'react';
import type { Update } from '@tauri-apps/plugin-updater';
import { Download, RefreshCw, AlertCircle } from 'lucide-react';
import { themes } from '../lib/themes';
import { DEFAULT_APPEARANCE } from '../lib/appearance';

type Phase = 'prompt' | 'downloading' | 'installing' | 'error';

export default function UpdatePrompt({ update, onClose }: { update: Update; onClose: () => void }) {
  const t = themes[DEFAULT_APPEARANCE.mood];
  const accent = t.doneAccent;
  const [phase, setPhase] = useState<Phase>('prompt');
  const [pct, setPct] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const install = async () => {
    setErr(null);
    setPhase('downloading');
    setPct(null);
    try {
      let total = 0;
      let received = 0;
      await update.downloadAndInstall((e) => {
        if (e.event === 'Started') {
          total = e.data.contentLength ?? 0;
        } else if (e.event === 'Progress') {
          received += e.data.chunkLength;
          if (total > 0) setPct(Math.min(100, Math.round((received / total) * 100)));
        } else if (e.event === 'Finished') {
          setPct(100);
          setPhase('installing');
        }
      });
      // Installed — restart into the new version. relaunch() can throw on some
      // platforms; if it does we show it rather than hanging on a dead screen.
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setPhase('error');
    }
  };

  const btn = (primary: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '0.7rem 1rem',
    borderRadius: '999px',
    fontFamily: 'inherit',
    fontSize: '0.83rem',
    fontWeight: 600,
    cursor: 'pointer',
    border: primary ? 'none' : `1px solid ${t.border}`,
    background: primary ? accent : 'transparent',
    color: primary ? '#fff' : t.textMuted,
    transition: 'opacity 0.15s',
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Software update"
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1.5rem',
        fontFamily: 'var(--app-font, system-ui)',
      }}
    >
      <div style={{
        width: '100%', maxWidth: '380px',
        background: t.panel ?? t.bg,
        border: `1px solid ${t.border}`,
        borderRadius: '18px',
        padding: '1.6rem 1.5rem 1.4rem',
        boxShadow: '0 24px 70px rgba(0,0,0,0.45)',
      }}>
        {/* Icon */}
        <div style={{
          width: 46, height: 46, borderRadius: '13px',
          background: accent + '22', border: `1px solid ${accent}55`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '1rem',
        }}>
          {phase === 'error'
            ? <AlertCircle size={22} strokeWidth={1.7} color={t.alert} />
            : phase === 'prompt'
              ? <Download size={22} strokeWidth={1.7} color={accent} />
              : <RefreshCw size={22} strokeWidth={1.7} color={accent} style={{ animation: 'bozzspin 1s linear infinite' }} />}
        </div>

        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: t.text, marginBottom: '0.35rem' }}>
          {phase === 'error' ? 'Update failed' : 'Update available'}
        </div>
        <div style={{ fontSize: '0.82rem', color: t.textMuted, lineHeight: 1.55, marginBottom: '1.25rem' }}>
          {phase === 'prompt' && <>Bozz <strong style={{ color: t.text }}>v{update.version}</strong> is ready to install. The app will restart to finish.</>}
          {phase === 'downloading' && <>Downloading v{update.version}{pct != null ? ` — ${pct}%` : '…'}</>}
          {phase === 'installing' && <>Installing and restarting…</>}
          {phase === 'error' && <>Something went wrong installing the update:<br /><span style={{ color: t.alert, fontSize: '0.76rem' }}>{err}</span></>}
        </div>

        {/* Progress bar */}
        {(phase === 'downloading' || phase === 'installing') && (
          <div style={{ height: 6, borderRadius: 999, background: t.border, overflow: 'hidden', marginBottom: '1.25rem' }}>
            <div style={{
              height: '100%', borderRadius: 999, background: accent,
              width: phase === 'installing' || pct == null ? '100%' : `${pct}%`,
              transition: 'width 0.25s ease',
              opacity: pct == null && phase === 'downloading' ? 0.5 : 1,
            }} />
          </div>
        )}

        {/* Actions */}
        {phase === 'prompt' && (
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button style={btn(false)} onClick={onClose}>Later</button>
            <button style={btn(true)} onClick={() => { void install(); }}>Install &amp; restart</button>
          </div>
        )}
        {phase === 'error' && (
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button style={btn(false)} onClick={onClose}>Close</button>
            <button style={btn(true)} onClick={() => { void install(); }}>Try again</button>
          </div>
        )}
      </div>

      <style>{`@keyframes bozzspin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
