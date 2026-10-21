/**
 * AssistantPanel: the side rail (Design A).
 *
 * Right-hand panel over the page, Ctrl+J. Each turn's proposed batch shows as
 * a change card (plain-English list from the validated ops) with Apply /
 * Discard; after apply it becomes a receipt written from the real diff, with
 * a persistent "Undo this turn". Deletions always need a second click.
 * Everything the assistant can see or do comes through `api` (Dashboard).
 */
import { useEffect, useReducer, useRef, useState } from 'react';
import { Sparkles, X, Send, Undo2, Check, AlertTriangle, Settings as SettingsIcon } from 'lucide-react';
import type { Theme } from '../lib/types';
import type { AssistantStore } from '../lib/assistant/store';
import type { Op } from '../lib/assistant/ops';
import type { ReceiptLine } from '../lib/assistant/diff';
import type { ChatMessage } from '../lib/assistant/providers/types';
import { runTurn, type Decision, type Proposal } from '../lib/assistant/engine';
import { describeOp } from '../lib/assistant/describe';
import { getApiKey } from '../lib/assistant/keys';
import { PROVIDERS } from '../lib/assistant/providers';
import { saveAssistantSettings, type AssistantSettings } from '../lib/assistant/settings';

export interface AssistantApi {
  getStore: () => AssistantStore;
  currentPageId: string | null;
  currentPageName: string | null;
  /** Apply a validated batch; returns the receipt and an undo handle. */
  apply: (ops: Op[]) => { receipt: ReceiptLine[]; turnId: number };
  /** Restore the store from before that turn. Only the latest turn can be undone. */
  undo: (turnId: number) => boolean;
  latestTurnId: () => number | null;
  openSettings: () => void;
}

type Item =
  | { id: number; kind: 'user'; text: string }
  | { id: number; kind: 'assistant'; text: string }
  | { id: number; kind: 'error'; text: string }
  | { id: number; kind: 'proposal'; proposal: Proposal; lines: string[]; status: 'pending' | 'applied' | 'declined' | 'failed'; receipt?: ReceiptLine[]; turnId?: number; undone?: boolean };

type Action =
  | { type: 'add'; item: Item }
  | { type: 'update'; id: number; patch: Partial<Item> }
  | { type: 'clear' };

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
let nextItemId = 1;
function reducer(state: Item[], a: Action): Item[] {
  if (a.type === 'add') return [...state, a.item];
  if (a.type === 'update') return state.map(it => (it.id === a.id ? ({ ...it, ...a.patch } as Item) : it));
  return [];
}

const CHIPS = ['Make the text easier to read', 'Switch to the warm theme', 'Set this page up with a timer and a note', 'Add a weekly habit here'];

export default function AssistantPanel({ t, open, onClose, api, settings, onSettingsChange }: {
  t: Theme; open: boolean; onClose: () => void; api: AssistantApi;
  settings: AssistantSettings; onSettingsChange: (s: AssistantSettings) => void;
}) {
  const [items, dispatch] = useReducer(reducer, []);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const historyRef = useRef<ChatMessage[]>([]);
  const pendingRef = useRef<Map<number, (d: Decision) => void>>(new Map());
  const undoneNoteRef = useRef(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { if (open) { void getApiKey(settings.provider).then(k => setHasKey(!!k)); setTimeout(() => inputRef.current?.focus(), 50); } }, [open, settings.provider]);
  useEffect(() => { threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight }); }, [items, status]);

  // Grow the input with its text, one line at a time, up to five lines; after
  // that it scrolls. Measured from scrollHeight so wrapped long lines count.
  const MAX_INPUT_LINES = 5;
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 18;
    const padding = parseFloat(getComputedStyle(el).paddingTop) + parseFloat(getComputedStyle(el).paddingBottom);
    el.style.height = 'auto';
    const max = lineHeight * MAX_INPUT_LINES + padding;
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
    el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden';
  }, [input, open]);

  const add = (item: DistributiveOmit<Item, 'id'>) => { const id = nextItemId++; dispatch({ type: 'add', item: { ...item, id } as Item }); return id; };

  const decide = (itemId: number, d: Decision, patch: Partial<Item>) => {
    dispatch({ type: 'update', id: itemId, patch });
    const resolve = pendingRef.current.get(itemId);
    pendingRef.current.delete(itemId);
    resolve?.(d);
  };

  const applyItem = (itemId: number, proposal: Proposal) => {
    try {
      const { receipt, turnId } = api.apply(proposal.ops);
      decide(itemId, { kind: 'applied', receipt, turnId }, { status: 'applied', receipt, turnId });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      decide(itemId, { kind: 'failed', message }, { status: 'failed', receipt: [{ kind: 'changed', text: `Could not apply: ${message}` }] });
    }
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput('');
    add({ kind: 'user', text: trimmed });
    setBusy(true);
    const apiKey = await getApiKey(settings.provider);
    if (!apiKey) { add({ kind: 'error', text: 'No API key yet. Add one in Settings > Assistant.' }); setBusy(false); return; }
    const abort = new AbortController(); abortRef.current = abort;
    const userText = undoneNoteRef.current ? `[Note: the user undid your previous change; the dashboard is back to how it was before it.]\n${trimmed}` : trimmed;
    undoneNoteRef.current = false;
    try {
      historyRef.current = await runTurn(
        { settings, apiKey, getStore: api.getStore, currentPageId: api.currentPageId, signal: abort.signal },
        historyRef.current, userText,
        {
          onText: txt => add({ kind: 'assistant', text: txt }),
          onStatus: setStatus,
          onProposal: p => new Promise<Decision>(resolve => {
            const lines = p.ops.map(op => describeOp(op, api.getStore()));
            const id = add({ kind: 'proposal', proposal: p, lines, status: 'pending' });
            pendingRef.current.set(id, resolve);
            if (settings.mode === 'auto' && !p.destructive) applyItem(id, p);
          }),
        },
      );
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) add({ kind: 'error', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false); setStatus(''); abortRef.current = null;
    }
  };

  const undo = (item: Extract<Item, { kind: 'proposal' }>) => {
    if (item.turnId === undefined || !api.undo(item.turnId)) return;
    dispatch({ type: 'update', id: item.id, patch: { undone: true } });
    undoneNoteRef.current = true;
  };

  const setMode = (mode: AssistantSettings['mode']) => { const next = { ...settings, mode }; onSettingsChange(next); void saveAssistantSettings(next); };
  const consent = () => { const next = { ...settings, consented: true }; onSettingsChange(next); void saveAssistantSettings(next); };

  const provider = PROVIDERS[settings.provider];
  const latest = api.latestTurnId();

  const btn = (primary?: boolean, danger?: boolean): React.CSSProperties => ({
    font: 'inherit', fontSize: '0.74rem', fontWeight: 500, borderRadius: '999px', padding: '0.3rem 0.7rem', cursor: 'pointer',
    border: `1px solid ${primary ? t.doneAccent : danger ? t.alertBorder : t.border}`,
    background: primary ? t.doneAccent : 'transparent', color: primary ? '#fff' : danger ? t.alert : t.text,
  });

  return (
    <aside
      aria-label="Bozz Assistant" aria-hidden={!open}
      style={{
        position: 'fixed', top: 10, right: 10, bottom: 10, width: 'min(380px, calc(100vw - 20px))', zIndex: 40,
        display: 'flex', flexDirection: 'column',
        background: `var(--glass-bg, ${t.panel})`, border: `1px solid ${t.borderStrong}`, borderRadius: '16px',
        boxShadow: 'var(--widget-shadow, 0 8px 32px rgba(0,0,0,0.35))',
        transform: open ? 'translateX(0)' : 'translateX(24px)', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none',
        transition: 'transform 200ms cubic-bezier(0.23,1,0.32,1), opacity 200ms',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 0.8rem', borderBottom: `1px solid ${t.border}` }}>
        <Sparkles size={15} strokeWidth={1.6} color={t.doneAccent} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 500, color: t.text }}>Bozz Assistant</div>
          <div style={{ fontSize: '0.65rem', color: t.textDim }}>AI · can be wrong · {provider.label}</div>
        </div>
        <button onClick={api.openSettings} title="Assistant settings" aria-label="Assistant settings" style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', padding: 2, display: 'flex' }}><SettingsIcon size={15} strokeWidth={1.6} /></button>
        <button onClick={onClose} title="Close (Ctrl+J)" aria-label="Close assistant" style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', padding: 2, display: 'flex' }}><X size={16} strokeWidth={1.6} /></button>
      </header>

      <div ref={threadRef} style={{ flex: 1, overflowY: 'auto', padding: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
        {!settings.consented ? (
          <div style={{ fontSize: '0.8rem', color: t.text, lineHeight: 1.55, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '0.8rem' }}>
            <div style={{ fontWeight: 500, marginBottom: '0.4rem' }}>Before you start</div>
            <p style={{ margin: '0 0 0.5rem', color: t.textMuted }}>Each request sends your own API key's provider ({provider.label}) the names of your pages, widgets, habits and theme, plus your message. Task text and notes are sent only when you ask the assistant to read a page. Nothing goes through Bozz's servers; you pay the provider directly.</p>
            <p style={{ margin: '0 0 0.7rem', color: t.textMuted }}>Every change is listed before it happens and can be undone in one click. Deletions always ask first.</p>
            <button onClick={consent} style={btn(true)}>Continue</button>
          </div>
        ) : hasKey === false ? (
          <div style={{ fontSize: '0.8rem', color: t.textMuted, lineHeight: 1.55, border: `1px dashed ${t.border}`, borderRadius: '12px', padding: '0.8rem' }}>
            No API key for {provider.label} yet. <button onClick={api.openSettings} style={{ ...btn(), marginLeft: 4 }}>Add one in Settings</button>
          </div>
        ) : items.length === 0 ? (
          <div style={{ fontSize: '0.78rem', color: t.textMuted, lineHeight: 1.55 }}>
            Ask for a change to {api.currentPageName ? <b style={{ color: t.text, fontWeight: 500 }}>{api.currentPageName}</b> : 'your dashboard'}: widgets, pages, theme, text size, notes, tasks, habits.
          </div>
        ) : null}

        {items.map(item => {
          if (item.kind === 'user') return <div key={item.id} style={{ alignSelf: 'flex-end', maxWidth: '92%', background: t.bgAlt, color: t.text, borderRadius: '12px', padding: '0.45rem 0.65rem', fontSize: '0.82rem', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{item.text}</div>;
          if (item.kind === 'assistant') return <div key={item.id} style={{ alignSelf: 'flex-start', maxWidth: '92%', color: t.textMuted, fontSize: '0.82rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{item.text}</div>;
          if (item.kind === 'error') return <div key={item.id} style={{ color: t.alert, fontSize: '0.78rem', lineHeight: 1.45, display: 'flex', gap: '0.4rem' }}><AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 2 }} />{item.text}</div>;
          return <ChangeCard key={item.id} t={t} item={item} latest={latest} btn={btn}
            onApply={() => applyItem(item.id, item.proposal)}
            onDecline={() => decide(item.id, { kind: 'declined' }, { status: 'declined' })}
            onUndo={() => undo(item)} />;
        })}
        {status && <div style={{ fontSize: '0.72rem', color: t.textDim }}>{status}…</div>}
      </div>

      {settings.consented && items.length === 0 && hasKey && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', padding: '0 0.8rem 0.4rem' }}>
          {CHIPS.map(c => <button key={c} onClick={() => void send(c)} style={{ font: 'inherit', fontSize: '0.68rem', border: `1px solid ${t.border}`, background: 'transparent', color: t.textMuted, borderRadius: '999px', padding: '0.2rem 0.55rem', cursor: 'pointer' }}>{c}</button>)}
        </div>
      )}

      <form onSubmit={e => { e.preventDefault(); void send(input); }} style={{ margin: '0 0.8rem 0.8rem', border: `1px solid ${t.border}`, background: t.input, borderRadius: '12px', padding: '0.45rem 0.55rem', display: 'flex', alignItems: 'flex-end', gap: '0.4rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3, marginBottom: 2 }}>
          <span style={{ fontSize: '0.62rem', background: t.bgAlt, color: t.text, padding: '0.15rem 0.45rem', borderRadius: '999px', whiteSpace: 'nowrap' }} title="What the assistant is looking at">{api.currentPageName ?? 'Home'}</span>
          <div role="radiogroup" aria-label="How changes are applied" style={{ display: 'inline-flex', border: `1px solid ${t.border}`, borderRadius: '999px', overflow: 'hidden' }}>
            {([['check', 'Check', 'Check: every change is shown to you first'], ['auto', 'Auto', 'Auto: changes are applied straight away; deletions still ask']] as const).map(([m, label, title]) => (
              <button key={m} type="button" role="radio" aria-checked={settings.mode === m} title={title} onClick={() => setMode(m)} style={{
                font: 'inherit', fontSize: '0.6rem', fontWeight: 500, padding: '0.1rem 0.45rem', border: 'none', cursor: 'pointer',
                background: settings.mode === m ? t.text : 'transparent', color: settings.mode === m ? t.bg : t.textMuted,
              }}>{label}</button>
            ))}
          </div>
        </div>
        <textarea
          ref={inputRef} value={input} onChange={e => setInput(e.target.value)} rows={1}
          placeholder="Ask for a change…" aria-label="Ask the assistant"
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input); } }}
          disabled={busy || !settings.consented}
          style={{ flex: 1, minWidth: 0, resize: 'none', background: 'transparent', border: 'none', outline: 'none', color: t.text, font: 'inherit', fontSize: '0.84rem', lineHeight: 1.4, padding: 0, overflowY: 'hidden' }}
        />
        {busy
          ? <button type="button" onClick={() => abortRef.current?.abort()} title="Stop" style={{ ...btn(), padding: '0.25rem 0.5rem' }}>Stop</button>
          : <button type="submit" aria-label="Send" disabled={!input.trim()} style={{ background: 'none', border: 'none', color: input.trim() ? t.doneAccent : t.textDim, cursor: 'pointer', padding: 2, display: 'flex' }}><Send size={16} strokeWidth={1.8} /></button>}
      </form>
    </aside>
  );
}

function ChangeCard({ t, item, latest, btn, onApply, onDecline, onUndo }: {
  t: Theme; item: Extract<Item, { kind: 'proposal' }>; latest: number | null;
  btn: (primary?: boolean, danger?: boolean) => React.CSSProperties;
  onApply: () => void; onDecline: () => void; onUndo: () => void;
}) {
  const [armed, setArmed] = useState(false);
  const { proposal: p, status } = item;
  const label = (k: ReceiptLine['kind']) => (k === 'added' ? '+' : k === 'removed' ? '−' : '~');
  return (
    <div style={{ border: `1px solid ${status === 'applied' ? t.doneAccent + '66' : t.border}`, borderLeft: `3px solid ${status === 'applied' ? t.doneAccent : status === 'declined' ? t.textDim : p.destructive ? t.alert : t.borderStrong}`, borderRadius: '10px', padding: '0.55rem 0.7rem', fontSize: '0.78rem', color: t.text, background: t.panel }}>
      <div style={{ fontSize: '0.62rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: t.textDim, marginBottom: '0.35rem' }}>
        {status === 'pending' ? `Proposed · ${p.ops.length} change${p.ops.length === 1 ? '' : 's'}` : status === 'applied' ? (item.undone ? 'Undone' : 'Applied') : status === 'declined' ? 'Discarded' : 'Failed'}
        {p.destructive && status === 'pending' && <span style={{ color: t.alert, marginLeft: 6 }}>· deletes something</span>}
      </div>
      {status === 'pending' || status === 'declined' ? (
        <>
          <div style={{ color: t.textMuted, marginBottom: '0.3rem' }}>{p.summary}</div>
          <ul style={{ margin: 0, paddingLeft: '1rem', lineHeight: 1.45 }}>{item.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
          {status === 'pending' && (
            <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.55rem' }}>
              {p.destructive && !armed
                ? <button onClick={() => setArmed(true)} style={btn(false, true)}>Apply (asks again)</button>
                : <button onClick={onApply} style={btn(true)}><Check size={11} strokeWidth={2.5} style={{ marginRight: 4, verticalAlign: -1 }} />{p.destructive ? 'Yes, delete' : 'Apply'}</button>}
              <button onClick={onDecline} style={btn()}>Discard</button>
            </div>
          )}
        </>
      ) : (
        <>
          <ul style={{ margin: 0, paddingLeft: '1rem', lineHeight: 1.45, textDecoration: item.undone ? 'line-through' : 'none', color: item.undone ? t.textDim : t.text }}>
            {(item.receipt ?? []).map((l, i) => <li key={i}><span style={{ color: t.textDim, marginRight: 4 }}>{label(l.kind)}</span>{l.text}</li>)}
            {status === 'applied' && !(item.receipt ?? []).length && <li style={{ color: t.textDim }}>Nothing visible changed.</li>}
          </ul>
          {status === 'applied' && !item.undone && item.turnId !== undefined && (
            <div style={{ marginTop: '0.5rem' }}>
              <button onClick={onUndo} disabled={latest !== item.turnId} title={latest !== item.turnId ? 'Only the most recent change can be undone' : undefined} style={{ ...btn(), opacity: latest !== item.turnId ? 0.5 : 1 }}>
                <Undo2 size={11} strokeWidth={2} style={{ marginRight: 4, verticalAlign: -1 }} />Undo this turn
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
