/**
 * QuickAddWidget — typed capture that runs the offline NL parser.
 *
 * As you type, the same parser the voice path uses (extractDeadline +
 * predictTopic, via parseVoiceTasks) lifts a deadline and a likely topic out of
 * the raw string, e.g. "essay due friday for bio" → { text:'essay', deadline:Fri,
 * topic:Bio }. The parse is shown as an inline confirm chip.
 *
 * On submit:
 *   - if a topic was predicted (high confidence), the item is routed straight to
 *     that topic — skipping the Quicks middle-step;
 *   - else if a deadline was parsed, it's filed via addDeadline (predicts a topic
 *     or a lazily-created "Deadlines" bucket — works on a zero-topic account);
 *   - else it drops into Quicks as before.
 * A dated task then auto-surfaces in the Today brief's dueRows with zero planner
 * ceremony.
 *
 * There's always a clear "→ Quicks" escape hatch so a wrong parse never traps
 * the user — that path dumps the literal text + any chosen deadline to the inbox.
 */

import { useState, useRef, useMemo } from 'react';
import { Plus, Inbox } from 'lucide-react';
import type { WidgetCtx } from './context';
import { Widget } from '../shared/Widget';
import DatePicker from '../shared/DatePicker';
import { parseVoiceTasks } from '../../lib/taskParser';

const ACCENT = '#d4b896';

function deadlineChipLabel(ms: number): string {
  const d = new Date(ms);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((new Date(ms).setHours(0, 0, 0, 0) - today.getTime()) / (24 * 60 * 60 * 1000));
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function QuickAddWidget({ ctx }: { ctx: WidgetCtx }) {
  const { t, addToInbox, addTopicItem, addDeadline, topics } = ctx;
  const [text, setText] = useState('');
  // Manual deadline override. null = use the parsed deadline (if any).
  const [overrideDeadline, setOverrideDeadline] = useState<number | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Live parse of the typed string (same engine as voice). Memoised so it only
  // re-runs as the text or topic list changes.
  const parsed = useMemo(() => {
    const raw = text.trim();
    if (raw.length < 2) return null;
    const tasks = parseVoiceTasks(raw, topics ?? []);
    return tasks[0] ?? null;
  }, [text, topics]);

  // Effective deadline: a manual override always wins, else the parsed one.
  const effectiveDeadline = overrideDeadline ?? parsed?.deadline ?? null;
  const predictedTopic = parsed?.topicId
    ? (topics ?? []).find(tp => tp.id === parsed.topicId) ?? null
    : null;
  // The clean text (date phrase stripped) when the parser found anything useful.
  const cleanText = parsed?.text?.trim() || text.trim();

  const reset = () => {
    setText(''); setOverrideDeadline(null);
    inputRef.current?.focus();
  };
  const showFlash = (msg: string) => {
    setFlash(msg);
    window.setTimeout(() => setFlash(null), 1900);
  };

  // Smart submit: route to predicted topic > deadline bucket > Quicks.
  const submit = () => {
    const raw = text.trim();
    if (!raw) { inputRef.current?.focus(); return; }

    if (predictedTopic) {
      addTopicItem(predictedTopic.id, cleanText, effectiveDeadline);
      showFlash(`added to ${predictedTopic.name}`);
    } else if (effectiveDeadline != null && addDeadline) {
      addDeadline(cleanText, effectiveDeadline);
      showFlash('deadline captured');
    } else {
      // No topic, no date — a plain capture goes to Quicks.
      addToInbox(cleanText, effectiveDeadline);
      showFlash('added to Quicks');
    }
    reset();
  };

  // Explicit escape hatch: dump the literal text + chosen deadline to Quicks,
  // ignoring the parse, so a wrong prediction never traps the user.
  const dumpToQuicks = () => {
    const raw = text.trim();
    if (!raw) { inputRef.current?.focus(); return; }
    addToInbox(cleanText, effectiveDeadline);
    showFlash('added to Quicks');
    reset();
  };

  // Whether the parse surfaced anything worth confirming.
  const hasParse = !!parsed && (predictedTopic != null || effectiveDeadline != null);

  return (
    <Widget t={t} accent={ACCENT}>
      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.9rem' }}>
        <input
          ref={inputRef}
          value={text}
          onChange={e => { setText(e.target.value); setOverrideDeadline(null); }}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          placeholder="e.g. essay due friday for bio"
          style={{
            flex: 1, minWidth: 0,
            background: t.input, border: `1px solid ${t.border}`,
            borderRadius: '8px', padding: '0.5rem 0.7rem',
            color: t.text, fontSize: '0.86rem',
            fontFamily: 'inherit', outline: 'none',
          }}
        />
      </div>

      {/* Inline confirm chip — what the parser understood. */}
      {hasParse && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap',
          marginTop: '0.55rem', padding: '0.4rem 0.55rem',
          background: t.bgAlt, border: `1px solid ${t.border}`, borderRadius: '8px',
        }}>
          <span style={{ fontSize: '0.78rem', color: t.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
            {cleanText}
          </span>
          {predictedTopic && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
              fontSize: '0.66rem', fontWeight: 500, color: predictedTopic.color,
              background: predictedTopic.color + '1f', border: `1px solid ${predictedTopic.color}40`,
              borderRadius: '999px', padding: '0.05rem 0.5rem', flexShrink: 0,
            }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: predictedTopic.color }} />
              {predictedTopic.name}
            </span>
          )}
          {effectiveDeadline != null && (
            <span style={{
              fontSize: '0.66rem', fontWeight: 500, color: t.doneAccent,
              background: t.doneAccent + '1f', border: `1px solid ${t.doneAccent}40`,
              borderRadius: '999px', padding: '0.05rem 0.5rem', flexShrink: 0,
            }}>
              {deadlineChipLabel(effectiveDeadline)}
            </span>
          )}
        </div>
      )}

      <div style={{
        display: 'flex', justifyContent: 'flex-end', gap: '0.45rem',
        marginTop: '0.55rem', alignItems: 'center', flexWrap: 'wrap',
      }}>
        <DatePicker
          t={t}
          value={effectiveDeadline}
          onChange={(v) => setOverrideDeadline(v)}
          placeholder="no deadline"
          allowClear
          size="sm"
        />
        {/* Escape hatch — always dump to Quicks regardless of the parse. */}
        {text.trim() && (
          <button
            onClick={dumpToQuicks}
            title="Send to Quicks instead"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
              background: 'transparent', border: `1px solid ${t.border}`,
              color: t.textMuted, borderRadius: '8px', padding: '0.4rem 0.6rem',
              cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem', flexShrink: 0,
            }}
          >
            <Inbox size={12} strokeWidth={1.8} /> Quicks
          </button>
        )}
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
          <Plus size={13} strokeWidth={1.8} />
          {predictedTopic ? `Add to ${predictedTopic.name}` : 'Add'}
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
