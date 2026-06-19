import { useState, useRef } from 'react';
import { Plus } from 'lucide-react';
import type { WidgetCtx } from './context';
import { Widget } from '../shared/Widget';
import DatePicker from '../shared/DatePicker';

const ACCENT = '#d4b896';

export default function QuickAddWidget({ ctx }: { ctx: WidgetCtx }) {
  const { t, addToInbox } = ctx;
  const [text, setText] = useState('');
  const [deadline, setDeadline] = useState<number | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const v = text.trim();
    if (!v) { inputRef.current?.focus(); return; }
    addToInbox(v, deadline);
    setText(''); setDeadline(null);
    setFlash('added to Quicks');
    inputRef.current?.focus();
    window.setTimeout(() => setFlash(null), 1800);
  };

  return (
    <Widget t={t} accent={ACCENT}>
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
        display: 'flex', justifyContent: 'flex-end', gap: '0.45rem',
        marginTop: '0.55rem', alignItems: 'center',
      }}>
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
          disabled={!text.trim()}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
            background: text.trim() ? t.doingAccent : 'transparent',
            border: `1px solid ${text.trim() ? t.doingAccent : t.border}`,
            color: text.trim() ? '#fff' : t.textMuted,
            borderRadius: '8px', padding: '0.4rem 0.85rem',
            cursor: text.trim() ? 'pointer' : 'not-allowed',
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
    </Widget>
  );
}
