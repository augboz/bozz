/**
 * Settings > Assistant: which provider, which model, the user's own API key
 * (OS keychain on desktop), propose/live mode, and what gets sent.
 */
import { useEffect, useState } from 'react';
import type { Theme } from '../../../lib/types';
import { isTauri } from '../../../lib/platform';
import { selectableProviders, PROVIDERS } from '../../../lib/assistant/providers';
import type { ProviderId } from '../../../lib/assistant/providers/types';
import { getApiKey, setApiKey, clearApiKey } from '../../../lib/assistant/keys';
import { saveAssistantSettings, type AssistantSettings } from '../../../lib/assistant/settings';
import { TOOLS } from '../../../lib/assistant/tools';

export default function AssistantBlock({ t, settings, onChange }: { t: Theme; settings: AssistantSettings; onChange: (s: AssistantSettings) => void }) {
  const [hasKey, setHasKey] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [test, setTest] = useState<{ state: 'idle' | 'testing' | 'ok' | 'error'; text?: string }>({ state: 'idle' });
  const [showSent, setShowSent] = useState(false);
  const provider = PROVIDERS[settings.provider];

  useEffect(() => { void getApiKey(settings.provider).then(k => setHasKey(!!k)); setTest({ state: 'idle' }); }, [settings.provider]);

  const update = (patch: Partial<AssistantSettings>) => { const next = { ...settings, ...patch }; onChange(next); void saveAssistantSettings(next); };
  const pickProvider = (id: ProviderId) => update({ provider: id, model: PROVIDERS[id].models[0] });

  const saveKey = async () => {
    if (!keyInput.trim()) return;
    try {
      await setApiKey(settings.provider, keyInput);
      setKeyInput(''); setHasKey(true);
      setTest({ state: 'ok', text: 'Key saved. Click Test to check it.' });
    } catch (e) {
      setTest({ state: 'error', text: `Could not save the key: ${e instanceof Error ? e.message : String(e)}` });
    }
  };
  const removeKey = async () => { await clearApiKey(settings.provider); setHasKey(false); setTest({ state: 'idle' }); };

  const runTest = async () => {
    setTest({ state: 'testing' });
    try {
      const apiKey = await getApiKey(settings.provider);
      if (!apiKey) throw new Error('no key saved');
      const res = await provider.complete({ system: 'Reply with the single word OK.', messages: [{ role: 'user', text: 'ping' }], tools: [], model: settings.model, apiKey });
      setTest({ state: 'ok', text: `Connected. ${settings.model} replied "${(res.text || '(tool call)').slice(0, 40)}".` });
    } catch (e) {
      setTest({ state: 'error', text: e instanceof Error ? e.message : String(e) });
    }
  };

  const input: React.CSSProperties = { background: t.input, border: `1px solid ${t.border}`, borderRadius: '8px', padding: '0.45rem 0.6rem', color: t.text, fontFamily: 'inherit', fontSize: '0.82rem', outline: 'none' };
  const button: React.CSSProperties = { background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px', padding: '0.4rem 0.75rem', color: t.text, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.78rem' };
  const row: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.55rem 0', flexWrap: 'wrap' };
  const label = (title: string, hint?: string) => (
    <div style={{ minWidth: 0 }}><div style={{ fontSize: '0.88rem', color: t.text, fontWeight: 300 }}>{title}</div>{hint && <div style={{ fontSize: '0.72rem', color: t.textMuted, marginTop: '0.15rem', maxWidth: '36ch' }}>{hint}</div>}</div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <p style={{ fontSize: '0.78rem', color: t.textMuted, lineHeight: 1.5, margin: '0 0 0.4rem', maxWidth: '60ch' }}>
        The assistant uses your own API key and talks to the provider directly. Bozz never sees the key or your messages, and you pay the provider, not Bozz. Open it with <b style={{ color: t.text, fontWeight: 500 }}>Ctrl+J</b>.
      </p>

      <div style={row}>
        {label('Provider')}
        <select value={settings.provider} onChange={e => pickProvider(e.target.value as ProviderId)} aria-label="Assistant provider" style={{ ...input, cursor: 'pointer' }}>
          {selectableProviders().map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </div>

      <div style={row}>
        {label('Model', 'Pick one or type any model id the provider offers')}
        <input list="assistant-models" value={settings.model} onChange={e => update({ model: e.target.value })} aria-label="Assistant model" style={{ ...input, width: '14rem' }} />
        <datalist id="assistant-models">{provider.models.map(m => <option key={m} value={m} />)}</datalist>
      </div>

      {settings.provider !== 'mock' && (
        <div style={{ ...row, alignItems: 'flex-start' }}>
          {label('API key', hasKey ? `Saved${isTauri() ? ' in your system keychain' : ' in this browser'}. It never syncs.` : `Create one at ${provider.keyUrl.replace('https://', '')}`)}
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {hasKey ? (
              <>
                <span style={{ fontSize: '0.8rem', color: t.textMuted, fontFamily: 'monospace' }}>••••••••</span>
                <button onClick={() => void runTest()} disabled={test.state === 'testing'} style={button}>{test.state === 'testing' ? 'Testing…' : 'Test'}</button>
                <button onClick={() => void removeKey()} style={{ ...button, color: t.alert, borderColor: t.alertBorder }}>Remove</button>
              </>
            ) : (
              <>
                <input type="password" value={keyInput} onChange={e => setKeyInput(e.target.value)} placeholder={provider.keyHint} aria-label="API key" autoComplete="off" style={{ ...input, width: '14rem' }} onKeyDown={e => { if (e.key === 'Enter') void saveKey(); }} />
                <button onClick={() => void saveKey()} disabled={!keyInput.trim()} style={button}>Save</button>
              </>
            )}
          </div>
        </div>
      )}
      {test.text && <div style={{ fontSize: '0.75rem', color: test.state === 'ok' ? t.doneAccent : t.alert, padding: '0 0 0.5rem' }}>{test.text}</div>}
      {!isTauri() && settings.provider !== 'mock' && <div style={{ fontSize: '0.72rem', color: t.textMuted, padding: '0 0 0.5rem' }}>In the browser the key is stored in this browser's local storage. The desktop app keeps it in the system keychain.</div>}

      <div style={row}>
        {label('Changes', settings.mode === 'check' ? 'Manual: shown to you first; you click Apply' : 'Auto: applied straight away; deletions still ask')}
        <div role="radiogroup" style={{ display: 'inline-flex', border: `1px solid ${t.border}`, borderRadius: '999px', overflow: 'hidden' }}>
          {(['check', 'auto'] as const).map(m => (
            <button key={m} role="radio" aria-checked={settings.mode === m} onClick={() => update({ mode: m })} style={{ font: 'inherit', fontSize: '0.74rem', padding: '0.3rem 0.7rem', border: 'none', cursor: 'pointer', background: settings.mode === m ? t.text : 'transparent', color: settings.mode === m ? t.bg : t.textMuted }}>
              {m === 'check' ? 'Manual' : 'Auto'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '0.4rem 0 0.2rem' }}>
        <button onClick={() => setShowSent(s => !s)} style={{ ...button, fontSize: '0.74rem' }}>{showSent ? 'Hide' : 'Show'} what gets sent</button>
        {showSent && (
          <div style={{ fontSize: '0.74rem', color: t.textMuted, lineHeight: 1.5, marginTop: '0.5rem', maxWidth: '60ch' }}>
            <p style={{ margin: '0 0 0.4rem' }}>With every message: the names and ids of your pages, folders, widgets (type and size) and habits, your theme settings, which page you are on, and the widget catalog. Not sent: task text, notes, emails, calendar, photos, backgrounds.</p>
            <p style={{ margin: '0 0 0.4rem' }}>When the assistant reads a page (the <code>read_dashboard</code> tool), that page's tasks, notes and links are sent, labelled as user content.</p>
            <p style={{ margin: 0 }}>The assistant can only act through these tools: {TOOLS.map(x => x.name).join(', ')}. It cannot touch sync, your account, connectors or billing.</p>
          </div>
        )}
      </div>
    </div>
  );
}
