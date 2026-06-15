import { useEffect, useRef, useState } from 'react';
import { routeVoice, describeRoute } from '../lib/voiceRouter';
import { parseVoiceTasks, cleanTaskText } from '../lib/taskParser';
import VoiceButton from './shared/VoiceButton';
import type { InboxItem, Theme, Topic, BudgetData } from '../lib/types';

/**
 * In-app quick-add modal — the browser equivalent of the desktop Ctrl+B
 * QuickCapture window. Opens a centred chat bar; typed text is routed
 * (inbox / topic / budget) just like voice capture.
 */
interface QuickAddModalProps {
  t: Theme;
  topics: Topic[];
  onClose: () => void;
  onAddInbox: (items: InboxItem[]) => void;
  onAddTopicItem: (topicId: string, text: string, deadline: number | null) => void;
  onAddBudget: (transaction: BudgetData['transactions'][number]) => void;
}

export default function QuickAddModal({
  t, topics, onClose, onAddInbox, onAddTopicItem, onAddBudget,
}: QuickAddModalProps) {
  const [text, setText] = useState('');
  const [partial, setPartial] = useState('');
  const [status, setStatus] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const capture = (raw: string) => {
    const value = raw.trim();
    if (!value) { onClose(); return; }

    // Budget signals route directly.
    const route = routeVoice(value, topics);
    if (route.kind === 'budget') {
      onAddBudget(route.transaction);
      setStatus(describeRoute(route));
      return;
    }
    if (route.kind === 'topic') {
      onAddTopicItem(route.topicId, route.item.text, route.item.deadline ?? null);
      setStatus(describeRoute(route));
      return;
    }

    // Otherwise split into inbox tasks with topic + deadline predictions.
    const parsed = parseVoiceTasks(value, topics);
    const now = Date.now();
    const items: InboxItem[] = [];
    if (parsed.length === 0) {
      const fallback = cleanTaskText(value);
      if (fallback.length >= 3) items.push({ id: now, text: fallback, createdAt: now });
    } else {
      parsed.forEach((task, i) => items.push({
        id: now + i,
        text: task.text,
        createdAt: now + i,
        suggestedTopicId: task.topicId ?? undefined,
        deadline: task.deadline ?? undefined,
        deadlineLabel: task.deadlineLabel ?? undefined,
      }));
    }
    if (items.length > 0) onAddInbox(items);
    setStatus(items.length > 1 ? `→ Quicks (${items.length} tasks)` : '→ Quicks');
  };

  const submitText = () => {
    const value = (text || partial).trim();
    if (!value) { onClose(); return; }
    capture(value);
    setText(''); setPartial('');
    setTimeout(onClose, 320);
  };

  const onVoiceTranscript = (final: string) => {
    setText(final);
    capture(final);
    setPartial('');
    setTimeout(() => { setText(''); onClose(); }, 1200);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '18vh',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
        style={{
          width: 'min(560px, 92vw)',
          background: 'var(--glass-bg, ' + t.panel + ')',
          backdropFilter: 'var(--glass-blur, none)',
          WebkitBackdropFilter: 'var(--glass-blur, none)',
          border: `1px solid ${t.borderStrong}`,
          borderRadius: '16px',
          boxShadow: 'var(--widget-shadow, 0 16px 48px rgba(0,0,0,0.5))',
          padding: '1rem 1.15rem', boxSizing: 'border-box',
          fontFamily: 'var(--app-font)',
          animation: 'modalRise 0.4s var(--ease, cubic-bezier(0.16,1,0.3,1)) both',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: '0.62rem', letterSpacing: '0.14em', textTransform: 'uppercase',
          color: t.textDim, marginBottom: '0.45rem',
        }}>
          <span>Quick add · type or talk</span>
          {status && (
            <span style={{ color: t.doneAccent, letterSpacing: '0.06em', textTransform: 'none' }}>
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
              background: t.input, border: `1px solid ${t.border}`,
              borderRadius: '8px', padding: '0.55rem 0.75rem', color: t.text,
              fontSize: '0.93rem', fontFamily: 'inherit', fontWeight: 400, outline: 'none',
            }}
          />
          <VoiceButton
            t={t}
            onTranscript={onVoiceTranscript}
            onPartial={setPartial}
            onError={(msg) => setStatus(`mic error: ${msg}`)}
            iconSize={17}
          />
        </div>
        <div style={{ fontSize: '0.6rem', color: t.textDim, marginTop: '0.45rem' }}>
          enter to save · mic to talk · esc to dismiss
        </div>
      </div>
    </div>
  );
}
