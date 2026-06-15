import { useEffect, useRef, useState } from 'react';
import { emit } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getItem, setItem } from '../lib/storage';
import { themes } from '../lib/themes';
import { DEFAULT_APPEARANCE } from '../lib/appearance';
import { routeVoice, describeRoute, type VoiceRoute } from '../lib/voiceRouter';
import { parseVoiceTasks, cleanTaskText } from '../lib/taskParser';
import VoiceButton from './shared/VoiceButton';
import { DEFAULT_BUDGET } from '../lib/budget';
import type {
  BudgetData, InboxItem, MoodId, Topic, Theme,
} from '../lib/types';

/**
 * Apply a routed voice transcript by writing directly to the relevant
 * storage key, then notify the main window so it can refresh its state.
 */
async function applyRoute(route: VoiceRoute): Promise<void> {
  if (route.kind === 'inbox') {
    const r = await getItem('inbox');
    const list: InboxItem[] = r?.value ? JSON.parse(r.value) : [];
    list.push({ id: Date.now(), text: route.text, createdAt: Date.now() });
    await setItem('inbox', JSON.stringify(list));
  } else if (route.kind === 'topic') {
    const r = await getItem('topics');
    const topics: Topic[] = r?.value ? JSON.parse(r.value) : [];
    const updated = topics.map(tp => {
      if (tp.id !== route.topicId) return tp;
      return { ...tp, items: [...tp.items, route.item] };
    });
    await setItem('topics', JSON.stringify(updated));
  } else if (route.kind === 'budget') {
    const r = await getItem('budget');
    const b: BudgetData = r?.value ? JSON.parse(r.value) : { ...DEFAULT_BUDGET };
    b.transactions = [...(b.transactions ?? []), route.transaction];
    await setItem('budget', JSON.stringify(b));
  }
  await emit('data:changed');
}

/**
 * Small always-on-top window opened by Ctrl+B. Accepts text (saved to
 * Inbox by default) or voice (auto-routed to the matching section).
 */
export default function QuickCapture() {
  const [text, setText] = useState('');
  const [theme, setTheme] = useState<Theme>(themes[DEFAULT_APPEARANCE.mood]);
  const [partial, setPartial] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getItem('appearance').then(r => {
      if (r?.value) {
        try {
          const a = JSON.parse(r.value) as { mood?: MoodId };
          if (a.mood && themes[a.mood]) setTheme(themes[a.mood]);
        } catch { /* keep default */ }
      }
    });
    inputRef.current?.focus();
  }, []);

  const hide = () => { getCurrentWindow().hide(); };

  const loadTopics = async (): Promise<Topic[]> => {
    try {
      const r = await getItem('topics');
      return r?.value ? JSON.parse(r.value) as Topic[] : [];
    } catch { return []; }
  };

  async function captureTranscript(value: string) {
    const topics = await loadTopics();

    // Budget signals route directly without multi-task splitting
    const route = routeVoice(value, topics);
    if (route.kind === 'budget') {
      setStatus(describeRoute(route));
      try { await applyRoute(route); } catch (e) { console.error('Quick capture error:', e); }
      return;
    }

    // Split into individual tasks with topic + deadline predictions
    const parsed = parseVoiceTasks(value, topics);
    const now = Date.now();

    try {
      const r = await getItem('inbox');
      const list: InboxItem[] = r?.value ? JSON.parse(r.value) : [];
      if (parsed.length === 0) {
        // Only fall back to raw text if there's actual content after stripping filler
        const fallback = cleanTaskText(value.trim());
        if (fallback.length >= 3) list.push({ id: now, text: fallback, createdAt: now });
      } else {
        parsed.forEach((task, i) => list.push({
          id: now + i,
          text: task.text,
          createdAt: now + i,
          suggestedTopicId: task.topicId ?? undefined,
          deadline: task.deadline ?? undefined,
          deadlineLabel: task.deadlineLabel ?? undefined,
        }));
      }
      await setItem('inbox', JSON.stringify(list));
      await emit('data:changed');
    } catch (e) {
      console.error('Quick capture error:', e);
    }

    const count = parsed.length;
    setStatus(count > 1 ? `→ inbox (${count} tasks)` : '→ inbox');
  }

  // Manual submission — also runs through the router so typed thoughts
  // can land in the right place without the user choosing.
  const submitText = async () => {
    const value = (text || partial).trim();
    if (!value) { hide(); return; }
    await captureTranscript(value);
    setText(''); setPartial('');
    setTimeout(hide, 280);
  };

  const onVoiceTranscript = async (final: string) => {
    setText(final);
    await captureTranscript(final);
    setPartial('');
    setTimeout(() => { setText(''); hide(); }, 1200);
  };

  const onVoicePartial = (s: string) => setPartial(s);

  return (
    <div
      style={{
        height: '100vh', width: '100vw', background: theme.panel,
        border: `1px solid ${theme.borderStrong}`, borderRadius: '14px',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '1rem 1.15rem', boxSizing: 'border-box',
        fontFamily: 'var(--app-font)',
      }}
      onKeyDown={e => { if (e.key === 'Escape') hide(); }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: '0.62rem', letterSpacing: '0.14em', textTransform: 'uppercase',
        color: theme.textDim, marginBottom: '0.45rem',
      }}>
        <span>Talk to Bozz · or type</span>
        {status && (
          <span style={{ color: theme.doneAccent, letterSpacing: '0.06em', textTransform: 'none' }}>
            {status}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
        <input
          ref={inputRef}
          value={partial || text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submitText(); }}
          placeholder="a thought, todo, expense…"
          style={{
            flex: 1,
            background: theme.input, border: `1px solid ${theme.border}`,
            borderRadius: '8px', padding: '0.55rem 0.75rem', color: theme.text,
            fontSize: '0.93rem', fontFamily: 'inherit', fontWeight: 400, outline: 'none',
          }}
        />
        <VoiceButton
          t={theme}
          onTranscript={onVoiceTranscript}
          onPartial={onVoicePartial}
          onError={(msg) => setStatus(`mic error: ${msg}`)}
          iconSize={17}
        />
      </div>
      <div style={{ fontSize: '0.6rem', color: theme.textDim, marginTop: '0.45rem' }}>
        enter to save · mic to talk · esc to dismiss
      </div>
    </div>
  );
}
