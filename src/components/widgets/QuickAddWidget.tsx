import { useState, useRef, useMemo } from 'react';
import { Plus } from 'lucide-react';
import type { WidgetCtx } from './context';
import { Widget } from '../shared/Widget';
import DatePicker from '../shared/DatePicker';

const ACCENT = '#d4b896';

export default function QuickAddWidget({ ctx }: { ctx: WidgetCtx }) {
  const { t, topics, addTopicItem } = ctx;
  const [text, setText] = useState('');
  const [topicId, setTopicId] = useState<string>('');
  const [deadline, setDeadline] = useState<number | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Active (non-hidden) topics the user has created
  const activeTopic = useMemo(() => topics.filter(tp => tp.name), [topics]);

  // Keep selected topicId valid when topics change
  const resolvedTopicId = activeTopic.some(tp => tp.id === topicId)
    ? topicId
    : (activeTopic[0]?.id ?? '');

  const submit = () => {
    const v = text.trim();
    if (!v || !resolvedTopicId) { inputRef.current?.focus(); return; }
    const topic = activeTopic.find(tp => tp.id === resolvedTopicId);
    addTopicItem(resolvedTopicId, v, deadline);
    setText(''); setDeadline(null);
    setFlash(`added to ${topic?.name ?? 'topic'}`);
    inputRef.current?.focus();
    window.setTimeout(() => setFlash(null), 1800);
  };

  return (
    <Widget t={t} accent={ACCENT}>

      {activeTopic.length === 0 ? (
        <div style={{
          marginTop: '0.9rem', fontSize: '0.8rem', color: t.textMuted,
          lineHeight: 1.5, padding: '0.5rem 0',
        }}>
          No topics yet — add one in Settings to start capturing tasks here.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.9rem' }}>
            <input
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit(); }}
              placeholder="add a task…"
              style={{
                flex: 1, minWidth: 0,
                background: t.input, border: `1px solid ${t.border}`,
                borderRadius: '8px', padding: '0.5rem 0.7rem',
                color: t.text, fontSize: '0.86rem',
                fontFamily: 'inherit', outline: 'none',
              }}
            />
          </div>

          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: '0.45rem',
            marginTop: '0.55rem', alignItems: 'center',
          }}>
            {/* Topic selector */}
            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
              {activeTopic.map(tp => {
                const active = tp.id === resolvedTopicId;
                return (
                  <button
                    key={tp.id}
                    onClick={() => setTopicId(tp.id)}
                    style={{
                      padding: '0.3rem 0.65rem',
                      borderRadius: '999px',
                      border: `1px solid ${active ? tp.color : t.border}`,
                      background: active ? tp.color + '22' : 'transparent',
                      color: active ? tp.color : t.textMuted,
                      fontSize: '0.72rem', fontWeight: active ? 500 : 400,
                      cursor: 'pointer', fontFamily: 'inherit',
                      transition: 'all 0.1s',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tp.name}
                  </button>
                );
              })}
            </div>

            <DatePicker
              t={t}
              value={deadline}
              onChange={setDeadline}
              placeholder="no deadline"
              allowClear
              size="sm"
            />
            <button
              onClick={submit}
              disabled={!text.trim() || !resolvedTopicId}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                background: text.trim() && resolvedTopicId ? t.doingAccent : 'transparent',
                border: `1px solid ${text.trim() && resolvedTopicId ? t.doingAccent : t.border}`,
                color: text.trim() && resolvedTopicId ? '#fff' : t.textMuted,
                borderRadius: '8px', padding: '0.4rem 0.85rem',
                cursor: text.trim() && resolvedTopicId ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 500,
                transition: 'background 0.12s, color 0.12s',
                flexShrink: 0,
              }}
            >
              <Plus size={13} strokeWidth={1.8} /> Add
            </button>
          </div>

          <div style={{
            fontSize: '0.7rem', color: t.doneAccent,
            marginTop: '0.5rem', minHeight: '1em',
            opacity: flash ? 1 : 0,
            transition: 'opacity 0.18s ease',
          }}>
            {flash ?? ' '}
          </div>
        </>
      )}
    </Widget>
  );
}