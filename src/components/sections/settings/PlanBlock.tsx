import { useState } from 'react';
import { Sparkles, Heart, Coffee, ExternalLink, ChevronRight } from 'lucide-react';
import type { Theme } from '../../../lib/types';
import { getPlanLabel, BETA_UNLOCK } from '../../../lib/plus';
import { activateLicense, openDonate } from '../../../lib/billing';

interface Props {
  t: Theme;
  onOpenPlus: () => void;
}

export default function PlanBlock({ t, onOpenPlus }: Props) {
  const [key, setKey] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const ghost: React.CSSProperties = {
    background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px',
    padding: '0.45rem 0.85rem', color: t.textMuted, cursor: 'pointer',
    fontFamily: 'inherit', fontSize: '0.78rem',
  };

  const activate = async () => {
    try {
      await activateLicense(key);
      setMsg('Activated ✓');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Current plan */}
      <div style={{
        border: `1px solid ${t.border}`, borderRadius: '12px', padding: '1rem 1.1rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: '0.7rem', color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Current plan
          </div>
          <div style={{ fontSize: '1rem', color: t.text, fontWeight: 500, marginTop: '0.15rem' }}>
            {getPlanLabel()}
          </div>
          <div style={{ fontSize: '0.74rem', color: t.textMuted, marginTop: '0.25rem' }}>
            {BETA_UNLOCK
              ? 'Bozz is free forever. Plus is free while in beta — everything is unlocked.'
              : 'Bozz is free forever. Plus adds Worlds, priority alerts and more.'}
          </div>
        </div>
        <button
          onClick={onOpenPlus}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            background: t.text, color: t.bg, border: 'none', borderRadius: '9px',
            padding: '0.55rem 1rem', fontSize: '0.82rem', fontWeight: 500,
            fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0,
          }}
        >
          <Sparkles size={14} strokeWidth={1.8} /> See Bozz Plus
        </button>
      </div>

      {/* License key */}
      <div>
        <div style={{ fontSize: '0.78rem', color: t.text, marginBottom: '0.4rem' }}>Have a license key?</div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
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
        {msg && <div style={{ fontSize: '0.72rem', color: t.textMuted, marginTop: '0.4rem' }}>{msg}</div>}
      </div>

      {/* Support Bozz — donations, never gated, never mixed with the paid value exchange */}
      <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: '0.9rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.3rem' }}>
          <Heart size={14} strokeWidth={1.6} color={t.textMuted} />
          <span style={{ fontSize: '0.86rem', color: t.text, fontWeight: 500 }}>Support Bozz</span>
        </div>
        <div style={{ fontSize: '0.74rem', color: t.textMuted, lineHeight: 1.5, marginBottom: '0.6rem' }}>
          Bozz is free and open source, built by one person. If it makes your mornings calmer,
          you can chip in.
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button onClick={() => openDonate('sponsors')} style={{ ...ghost, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <ExternalLink size={13} strokeWidth={1.6} /> GitHub Sponsors
          </button>
          <button onClick={() => openDonate('kofi')} style={{ ...ghost, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <Coffee size={13} strokeWidth={1.6} /> Ko-fi
          </button>
          <button onClick={onOpenPlus} style={{ ...ghost, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            More <ChevronRight size={12} strokeWidth={1.6} />
          </button>
        </div>
      </div>
    </div>
  );
}
