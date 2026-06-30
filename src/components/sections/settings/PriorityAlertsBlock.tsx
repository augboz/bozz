import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { AlertRule, OAuthAccount, PriorityAlertSettings, Theme } from '../../../lib/types';
import { isPlus, FREE_LIMITS } from '../../../lib/plus';
import { isTauri } from '../../../lib/platform';

interface Props {
  t: Theme;
  settings: PriorityAlertSettings;
  onChange: (next: PriorityAlertSettings) => void;
  accounts: OAuthAccount[];
}

function uid(): string {
  return `rule-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function Toggle({ on, onClick, t }: { on: boolean; onClick: () => void; t: Theme }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      style={{
        width: '42px', height: '24px', borderRadius: '999px', border: 'none',
        cursor: 'pointer', flexShrink: 0,
        background: on ? t.doneAccent : t.borderStrong,
        transition: 'background 0.2s', position: 'relative',
      }}
    >
      <div style={{
        position: 'absolute', top: '3px', left: on ? '21px' : '3px',
        width: '18px', height: '18px', borderRadius: '50%',
        background: 'white', transition: 'left 0.2s',
      }} />
    </button>
  );
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);

export default function PriorityAlertsBlock({ t, settings, onChange, accounts }: Props) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [type, setType] = useState<AlertRule['type']>('sender');
  const [value, setValue] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(true);
  const [scope, setScope] = useState<string>(''); // '' = all accounts

  const plus = isPlus();
  const ruleLimitReached = !plus && settings.rules.length >= FREE_LIMITS.alertRules;

  const inp: React.CSSProperties = {
    background: t.input, border: `1px solid ${t.border}`, borderRadius: '8px',
    padding: '0.45rem 0.65rem', color: t.text, fontSize: '0.8rem',
    fontFamily: 'inherit', outline: 'none',
  };
  const ghost: React.CSSProperties = {
    background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px',
    padding: '0.4rem 0.8rem', color: t.textMuted, cursor: 'pointer',
    fontFamily: 'inherit', fontSize: '0.78rem',
  };

  const patch = (p: Partial<PriorityAlertSettings>) => onChange({ ...settings, ...p });

  const addRule = () => {
    const v = value.trim();
    if (!v) return;
    const rule: AlertRule = {
      id: uid(),
      label: label.trim() || v,
      type, value: v,
      unreadOnly,
      accountEmails: scope ? [scope] : [],
      enabled: true,
      createdAt: Date.now(),
    };
    patch({ rules: [...settings.rules, rule] });
    setLabel(''); setValue(''); setScope(''); setUnreadOnly(true); setType('sender');
    setAdding(false);
  };

  const updateRule = (id: string, p: Partial<AlertRule>) =>
    patch({ rules: settings.rules.map(r => r.id === id ? { ...r, ...p } : r) });
  const removeRule = (id: string) =>
    patch({ rules: settings.rules.filter(r => r.id !== id) });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
      {!isTauri() && (
        <div style={{ fontSize: '0.74rem', color: t.textMuted, lineHeight: 1.5 }}>
          Desktop notifications fire in the Bozz desktop app, even when it's tucked away in
          the tray. In the browser, rules are saved and sync across devices.
        </div>
      )}

      {/* Master toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '0.88rem', color: t.text }}>Priority alerts</div>
          <div style={{ fontSize: '0.72rem', color: t.textMuted, marginTop: '0.15rem' }}>
            Get pinged when an email that matters lands, like your bank, a landlord, or "interview".
          </div>
        </div>
        <Toggle on={settings.enabled} onClick={() => patch({ enabled: !settings.enabled })} t={t} />
      </div>

      {/* Rules */}
      <div style={{ display: 'grid', gap: '0.4rem' }}>
        {settings.rules.length === 0 && (
          <p style={{ fontSize: '0.75rem', color: t.textDim, fontStyle: 'italic', margin: '0.2rem 0' }}>
            No rules yet — add a sender or keyword to watch for.
          </p>
        )}
        {settings.rules.map(r => (
          <div key={r.id} style={{
            display: 'flex', alignItems: 'center', gap: '0.6rem',
            background: t.todoBg, border: `1px solid ${t.border}`,
            borderRadius: '8px', padding: '0.45rem 0.7rem',
          }}>
            <span style={{
              fontSize: '0.62rem', color: t.textMuted, textTransform: 'uppercase',
              letterSpacing: '0.06em', border: `1px solid ${t.border}`, borderRadius: '5px',
              padding: '0.1rem 0.35rem', flexShrink: 0,
            }}>
              {r.type}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.82rem', color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.label}
              </div>
              <div style={{ fontSize: '0.68rem', color: t.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.value}{r.accountEmails.length ? ` · ${r.accountEmails.join(', ')}` : ''}{r.unreadOnly ? ' · unread' : ''}
              </div>
            </div>
            <Toggle on={r.enabled} onClick={() => updateRule(r.id, { enabled: !r.enabled })} t={t} />
            <button
              onClick={() => removeRule(r.id)}
              aria-label="Delete rule" title="Delete"
              style={{ background: 'transparent', border: 'none', color: t.textMuted, cursor: 'pointer', padding: '0.2rem', flexShrink: 0 }}
            >
              <X size={14} strokeWidth={1.5} />
            </button>
          </div>
        ))}
      </div>

      {/* Add rule */}
      {adding ? (
        <div style={{ border: `1px solid ${t.border}`, borderRadius: '10px', padding: '0.8rem', display: 'grid', gap: '0.5rem' }}>
          <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Name (e.g. Lloyds)" style={inp} />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <select value={type} onChange={e => setType(e.target.value as AlertRule['type'])} style={{ ...inp, flexShrink: 0 }}>
              <option value="sender">Sender</option>
              <option value="keyword">Keyword</option>
            </select>
            <input
              value={value} onChange={e => setValue(e.target.value)}
              placeholder={type === 'sender' ? 'email or domain — lloyds.com' : 'word or phrase — interview'}
              onKeyDown={e => e.key === 'Enter' && addRule()}
              style={{ ...inp, flex: 1 }}
            />
          </div>
          {accounts.length > 0 && (
            <select value={scope} onChange={e => setScope(e.target.value)} style={inp}>
              <option value="">All connected accounts</option>
              {accounts.map(a => <option key={a.email} value={a.email}>{a.email}</option>)}
            </select>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.8rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: t.textMuted, cursor: 'pointer' }}>
              <input type="checkbox" checked={unreadOnly} onChange={e => setUnreadOnly(e.target.checked)} />
              Unread only
            </label>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button onClick={() => setAdding(false)} style={ghost}>Cancel</button>
              <button onClick={addRule} style={{ ...ghost, background: t.text, color: t.bg, border: 'none' }}>Add</button>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <button
            onClick={() => { if (!ruleLimitReached) setAdding(true); }}
            disabled={ruleLimitReached}
            style={{ ...ghost, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', opacity: ruleLimitReached ? 0.55 : 1 }}
          >
            <Plus size={13} strokeWidth={1.6} /> Add rule
          </button>
          {ruleLimitReached && (
            <div style={{ fontSize: '0.72rem', color: t.textMuted, marginTop: '0.45rem' }}>
              Free covers one watch. <span style={{ color: t.text }}>Bozz Plus</span> watches as many as you like.
            </div>
          )}
        </div>
      )}

      {/* Cadence + sound + quiet hours */}
      <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: '0.8rem', display: 'grid', gap: '0.7rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <span style={{ fontSize: '0.82rem', color: t.text }}>Check every</span>
          <div style={{ display: 'inline-flex', border: `1px solid ${t.border}`, borderRadius: '8px', overflow: 'hidden' }}>
            {[1, 3, 5, 15].map((m, i) => {
              const on = settings.pollMinutes === m;
              return (
                <button
                  key={m}
                  onClick={() => patch({ pollMinutes: m })}
                  style={{
                    background: on ? t.bgAlt : 'transparent', color: on ? t.text : t.textMuted,
                    border: 'none', borderLeft: i === 0 ? 'none' : `1px solid ${t.border}`,
                    padding: '0.4rem 0.7rem', fontSize: '0.76rem', fontFamily: 'inherit', cursor: 'pointer',
                  }}
                >
                  {m}m
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.82rem', color: t.text }}>Quiet hours</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Toggle
              on={settings.quietFrom != null}
              onClick={() => patch(settings.quietFrom == null ? { quietFrom: 22, quietTo: 7 } : { quietFrom: null, quietTo: null })}
              t={t}
            />
            {settings.quietFrom != null && (
              <>
                <select value={settings.quietFrom} onChange={e => patch({ quietFrom: Number(e.target.value) })} style={inp}>
                  {HOURS.map(h => <option key={h} value={h}>{h.toString().padStart(2, '0')}:00</option>)}
                </select>
                <span style={{ fontSize: '0.72rem', color: t.textDim }}>to</span>
                <select value={settings.quietTo ?? 7} onChange={e => patch({ quietTo: Number(e.target.value) })} style={inp}>
                  {HOURS.map(h => <option key={h} value={h}>{h.toString().padStart(2, '0')}:00</option>)}
                </select>
              </>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
