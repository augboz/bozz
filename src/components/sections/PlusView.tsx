import { ArrowLeft, Bell, Palette, ShieldCheck, Check } from 'lucide-react';
import type { Theme } from '../../lib/types';
import { SectionHeader } from '../shared/ui';
import { BETA_UNLOCK } from '../../lib/plus';
import { openCheckout, openDonate } from '../../lib/billing';

interface Props {
  t: Theme;
  onBack: () => void;
  onOpenWorlds: () => void;
}

const FEATURES = [
  { icon: Palette, title: 'Bozz Worlds', body: 'One-tap aesthetic worlds — theme, wallpaper and mood together. New looks land regularly.' },
  { icon: Bell, title: 'Priority alerts', body: 'Unlimited watches with quiet hours and multi-account scope. Never miss the email that matters.' },
  { icon: ShieldCheck, title: 'Sync & safekeeping', body: 'Your stuff, safe and everywhere — with the version history and restore depth coming to Plus.' },
];

// Mirrors the section 5 comparison table.
const COMPARISON: Array<[string, string, string]> = [
  ['Alerts', '1 rule, desktop', 'Unlimited · senders + keywords · quiet hours'],
  ['Worlds', 'a few free worlds', 'full library + every future drop'],
  ['Templates', 'starter packs', 'full gallery + create & share your own'],
  ['Dashboards', '1 home layout', 'multiple named, switchable'],
  ['Accounts', '1 email + 1 calendar', 'several of each'],
  ['Backups', 'local backup', 'cloud backups + 90-day history'],
];

export default function PlusView({ t, onBack, onOpenWorlds }: Props) {
  const card: React.CSSProperties = {
    border: `1px solid ${t.border}`, borderRadius: '14px', padding: '1.1rem 1.2rem',
    display: 'flex', flexDirection: 'column', gap: '0.6rem', background: t.todoBg,
  };
  const cta = (hero = false): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: hero ? t.text : 'transparent', color: hero ? t.bg : t.text,
    border: hero ? 'none' : `1px solid ${t.borderStrong}`, borderRadius: '9px',
    padding: '0.6rem 1rem', fontSize: '0.82rem', fontWeight: 500,
    fontFamily: 'inherit', cursor: 'pointer', marginTop: '0.2rem',
  });

  return (
    <div style={{ maxWidth: '860px' }}>
      <button
        onClick={onBack}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
          background: 'transparent', border: 'none', color: t.textMuted,
          cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', marginBottom: '0.8rem', padding: 0,
        }}
      >
        <ArrowLeft size={15} strokeWidth={1.6} /> Back
      </button>

      <SectionHeader title="Bozz Plus" t={t} />

      <p style={{ fontSize: '0.92rem', color: t.text, lineHeight: 1.6, margin: '0 0 0.4rem', fontWeight: 300 }}>
        Bozz is free and always will be. Plus is for people who want a little more — and want to
        keep a one-person project alive.
      </p>
      {BETA_UNLOCK && (
        <div style={{
          display: 'inline-block', fontSize: '0.74rem', color: t.doneAccent,
          border: `1px solid ${t.doneBorder}`, background: t.doneBg,
          borderRadius: '999px', padding: '0.25rem 0.7rem', marginBottom: '1.2rem',
        }}>
          Plus is free while in beta — everything below is already unlocked.
        </div>
      )}

      {/* What Plus is */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.7rem', margin: '0.6rem 0 1.6rem' }}>
        {FEATURES.map(f => {
          const Icon = f.icon;
          return (
            <div key={f.title} style={card}>
              <Icon size={18} strokeWidth={1.6} color={t.text} />
              <div style={{ fontSize: '0.9rem', color: t.text, fontWeight: 500 }}>{f.title}</div>
              <div style={{ fontSize: '0.76rem', color: t.textMuted, lineHeight: 1.5 }}>{f.body}</div>
              {f.title === 'Bozz Worlds' && (
                <button onClick={onOpenWorlds} style={{ ...cta(), alignSelf: 'flex-start', padding: '0.4rem 0.8rem', fontSize: '0.76rem' }}>
                  Browse Worlds
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Pricing */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.8rem', marginBottom: '1.8rem' }}>
        <div style={{ ...card, border: `1.5px solid ${t.doneAccent}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.9rem', color: t.text, fontWeight: 600 }}>Worlds All-Access</span>
            <span style={{ fontSize: '0.66rem', color: t.doneAccent, border: `1px solid ${t.doneBorder}`, borderRadius: '999px', padding: '0.1rem 0.5rem' }}>Best value</span>
          </div>
          <div style={{ fontSize: '1.3rem', color: t.text, fontWeight: 600 }}>£15–20 <span style={{ fontSize: '0.78rem', color: t.textMuted, fontWeight: 300 }}>once</span></div>
          <div style={{ fontSize: '0.76rem', color: t.textMuted, lineHeight: 1.5 }}>
            Buy once, unlock every World and every future drop — forever.
          </div>
          <button onClick={() => openCheckout('worldsLifetime')} style={cta(true)}>
            {BETA_UNLOCK ? 'Join the waitlist' : 'Get lifetime access'}
          </button>
        </div>

        <div style={card}>
          <span style={{ fontSize: '0.9rem', color: t.text, fontWeight: 600 }}>Bozz Plus</span>
          <div style={{ fontSize: '1.3rem', color: t.text, fontWeight: 600 }}>£3 <span style={{ fontSize: '0.78rem', color: t.textMuted, fontWeight: 300 }}>/month</span></div>
          <div style={{ fontSize: '0.76rem', color: t.textMuted, lineHeight: 1.5 }}>
            Or £20–30/year. Unlocks all Worlds while active, plus priority alerts and sync depth.
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button onClick={() => openCheckout('plusMonthly')} style={cta()}>
              {BETA_UNLOCK ? 'Waitlist · monthly' : 'Subscribe monthly'}
            </button>
            <button onClick={() => openCheckout('plusAnnual')} style={cta()}>
              {BETA_UNLOCK ? 'Waitlist · annual' : 'Subscribe annual'}
            </button>
          </div>
        </div>
      </div>

      {/* Free vs Plus */}
      <div style={{ border: `1px solid ${t.border}`, borderRadius: '12px', overflow: 'hidden', marginBottom: '1.6rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.2fr 1.6fr', background: t.bgAlt, padding: '0.6rem 0.9rem', fontSize: '0.7rem', color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <span /> <span>Free</span> <span>Plus</span>
        </div>
        {COMPARISON.map(([row, free, plus], i) => (
          <div key={row} style={{
            display: 'grid', gridTemplateColumns: '1.1fr 1.2fr 1.6fr',
            padding: '0.6rem 0.9rem', fontSize: '0.78rem', color: t.text,
            borderTop: i === 0 ? 'none' : `1px solid ${t.border}`, alignItems: 'center',
          }}>
            <span style={{ color: t.textMuted }}>{row}</span>
            <span style={{ color: t.textMuted }}>{free}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Check size={13} strokeWidth={2} color={t.doneAccent} style={{ flexShrink: 0 }} /> {plus}
            </span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ fontSize: '0.78rem', color: t.textMuted, lineHeight: 1.6 }}>
        Bozz is free forever, with or without Plus. No countdowns, no dark patterns.{' '}
        <button onClick={() => openDonate('sponsors')} style={{ background: 'none', border: 'none', color: t.text, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.78rem', textDecoration: 'underline', padding: 0 }}>
          Support Bozz
        </button>{' '}
        if you just want to chip in.
      </div>
    </div>
  );
}
