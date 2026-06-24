import { useState } from 'react';
import { Palette, Heart, Coffee, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import type { Theme } from '../../../lib/types';
import { getPlanLabel, BETA_UNLOCK } from '../../../lib/plus';
import { activateLicense, openDonate, openPlansPage } from '../../../lib/billing';

interface Props {
  t: Theme;
  /** Navigate to the in-app Worlds gallery. */
  onOpenWorlds: () => void;
}

export default function PlanBlock({ t, onOpenWorlds }: Props) {
  const [keyOpen, setKeyOpen] = useState(false);
  const [key, setKey] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const ghost: React.CSSProperties = {
    background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px',
    padding: '0.45rem 0.85rem', color: t.textMuted, cursor: 'pointer',
    fontFamily: 'inherit', fontSize: '0.78rem',
  };

  const activate = async () => {
    try { await activateLicense(key); setMsg('Activated ✓'); }
    catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
      {/* Current plan + explore (explore opens the website, not an in-app page) */}
      <div style={{
        border: `1px solid ${t.border}`, borderRadius: '12px', padding: '1rem 1.1rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: '0.7rem', color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Your plan
          </div>
          <div style={{ fontSize: '1rem', color: t.text, fontWeight: 500, marginTop: '0.15rem' }}>
            {getPlanLabel()}
          </div>
          <div style={{ fontSize: '0.74rem', color: t.textMuted, marginTop: '0.25rem' }}>
            {BETA_UNLOCK
              ? 'Bozz is free forever. Plus is free while in beta.'
              : 'Bozz is free forever. Plus adds Worlds, priority alerts and more.'}
          </div>
        </div>
        <button
          onClick={openPlansPage}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            background: 'transparent', color: t.text, border: `1px solid ${t.borderStrong}`,
            borderRadius: '9px', padding: '0.55rem 1rem', fontSize: '0.82rem', fontWeight: 500,
            fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0,
          }}
        >
          Explore plans <ExternalLink size={13} strokeWidth={1.8} />
        </button>
      </div>

      {/* Worlds — an in-app feature, reachable from the plan area */}
      <button
        onClick={onOpenWorlds}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.6rem', width: '100%',
          background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '10px',
          padding: '0.7rem 0.9rem', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        }}
      >
        <Palette size={15} strokeWidth={1.6} color={t.textMuted} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.86rem', color: t.text }}>Browse Worlds</div>
          <div style={{ fontSize: '0.72rem', color: t.textMuted }}>One-tap looks — theme, wallpaper and mood.</div>
        </div>
        <ChevronRight size={15} strokeWidth={1.5} color={t.textDim} />
      </button>

      {/* License key — compact, collapsed by default (most users never need it) */}
      <div>
        <button
          onClick={() => setKeyOpen(o => !o)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
            background: 'transparent', border: 'none', color: t.textMuted, cursor: 'pointer',
            fontFamily: 'inherit', fontSize: '0.76rem', padding: 0,
          }}
        >
          {keyOpen ? <ChevronDown size={13} strokeWidth={1.6} /> : <ChevronRight size={13} strokeWidth={1.6} />}
          Have a license key?
        </button>
        {keyOpen && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
            <input
              value={key}
              onChange={e => { setKey(e.target.value); setMsg(null); }}
              placeholder="Paste your key"
              style={{
                flex: 1, minWidth: '180px',
                background: t.input, border: `1px solid ${t.border}`, borderRadius: '8px',
                padding: '0.45rem 0.7rem', color: t.text, fontSize: '0.8rem',
                fontFamily: 'inherit', outline: 'none',
              }}
            />
            <button onClick={activate} disabled={!key.trim()} style={{ ...ghost, opacity: key.trim() ? 1 : 0.5 }}>
              Activate
            </button>
          </div>
        )}
        {msg && <div style={{ fontSize: '0.72rem', color: t.textMuted, marginTop: '0.4rem' }}>{msg}</div>}
      </div>

      {/* Support Bozz — external links, never gated, never nagged */}
      <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: '0.9rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.3rem' }}>
          <Heart size={14} strokeWidth={1.6} color={t.textMuted} />
          <span style={{ fontSize: '0.86rem', color: t.text, fontWeight: 500 }}>Support Bozz</span>
        </div>
        <div style={{ fontSize: '0.74rem', color: t.textMuted, lineHeight: 1.5, marginBottom: '0.6rem' }}>
          Built by one person. If it makes your mornings calmer, you can chip in.
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button onClick={() => openDonate('sponsors')} style={{ ...ghost, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <ExternalLink size={13} strokeWidth={1.6} /> GitHub Sponsors
          </button>
          <button onClick={() => openDonate('kofi')} style={{ ...ghost, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <Coffee size={13} strokeWidth={1.6} /> Ko-fi
          </button>
        </div>
      </div>
    </div>
  );
}
