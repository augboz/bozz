import { useEffect, useRef, useState } from 'react';
import { Calendar, X, Inbox } from 'lucide-react';
import { format } from 'date-fns';
import { routeVoice, describeRoute } from '../lib/voiceRouter';
import { parseVoiceTasks, cleanTaskText } from '../lib/taskParser';
import type { ParsedTask } from '../lib/taskParser';
import VoiceButton from './shared/VoiceButton';
import ChoicePicker, { type Choice } from './shared/ChoicePicker';
import DatePicker from './shared/DatePicker';
import type { InboxItem, Theme, Topic, BudgetData } from '../lib/types';
import { useFocusTrap, dialogProps } from '../hooks/useFocusTrap';
import { nextId } from '../lib/ids';

/**
 * In-app quick-add modal — the browser equivalent of the desktop Ctrl+B
 * QuickCapture window, reworked into a "ramble" surface (à la Todoist Ramble).
 *
 * Three phases:
 *   idle      — type a thought and hit enter (instant capture), or tap the mic.
 *   recording — talk freely; parsed task cards stream in live as you speak.
 *   review    — recording stopped; correct each card (text / topic / date /
 *               drop) before committing. Two ways out:
 *                 • "Add all"   — file each card straight into its chosen topic
 *                                 (cards left on "Quicks" land in the inbox).
 *                 • "Add later" — drop everything into Quicks to triage later.
 *
 * The topic dropdown and date picker are the SAME ChoicePicker / DatePicker
 * used on a Quick in the inbox, so a card here looks and behaves exactly like
 * a Quick. Parsing stays 100% local (parseVoiceTasks) — no API, no token cost.
 */
interface QuickAddModalProps {
  t: Theme;
  topics: Topic[];
  onClose: () => void;
  onAddInbox: (items: InboxItem[]) => void;
  onAddBudget: (transaction: BudgetData['transactions'][number]) => void;
  /** Files a task straight into a topic (the inbox→topic "send" path). */
  onAddToTopic: (topicId: string, text: string, deadline: number | null) => void;
  /** Topic-free dated capture: routes a deadline (no topic chosen) to a predicted
   *  topic or a lazily-created "Deadlines" bucket, so a dated card never stalls in
   *  Quicks on a zero-topic account. */
  onAddDeadline?: (text: string, deadline: number | null) => void;
}

type Phase = 'idle' | 'recording' | 'review';

export default function QuickAddModal({
  t, topics, onClose, onAddInbox, onAddBudget, onAddToTopic, onAddDeadline,
}: QuickAddModalProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [text, setText] = useState('');
  const [partial, setPartial] = useState('');
  const [status, setStatus] = useState('');
  const [tasks, setTasks] = useState<ParsedTask[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const parseTimer = useRef<number | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => () => { if (parseTimer.current) window.clearTimeout(parseTimer.current); }, []);
  // Trap focus inside the modal, close on Escape (document-level so it fires even
  // if focus drifts onto the page), and restore focus to the opener on close.
  useFocusTrap(panelRef, onClose);

  // Destination dropdown — "Quicks" (leave in inbox) plus every topic, ordered
  // exactly like the inbox's own picker.
  const topicChoices: Choice[] = [
    { id: '', label: 'Quicks', icon: Inbox },
    ...[...topics].sort((a, b) => a.order - b.order)
      .map(top => ({ id: top.id, label: top.name || 'New topic', color: top.color })),
  ];

  // ── Typed fast-lane: enter commits immediately to Quicks (no review step) ─────
  const submitTyped = () => {
    // Submit exactly what the input shows (see the input's value below): in the
    // idle/typed phase that is `text`. Using `text || partial` here could commit a
    // stale voice partial that differs from what the user sees and edited.
    const value = text.trim();
    if (!value) { onClose(); return; }

    const route = routeVoice(value, topics);
    if (route.kind === 'budget') {
      onAddBudget(route.transaction);
      setStatus(describeRoute(route));
      setTimeout(onClose, 320);
      return;
    }

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
    setText(''); setPartial('');
    setTimeout(onClose, 320);
  };

  // ── Voice: live preview while talking ────────────────────────────────────────
  const onRecordingChange = (rec: boolean) => {
    if (rec) {
      setPhase('recording');
      setTasks([]); setPartial(''); setStatus('');
    } else {
      // The final transcript (onVoiceTranscript) has already moved us to review
      // if it produced anything. Otherwise fall back to idle.
      setPhase(p => (p === 'recording' ? 'idle' : p));
    }
  };

  const onVoicePartial = (txt: string) => {
    setPartial(txt);
    if (parseTimer.current) window.clearTimeout(parseTimer.current);
    parseTimer.current = window.setTimeout(() => {
      if (txt.trim().length < 3) { setTasks([]); return; }
      const preview = parseVoiceTasks(txt, topics);
      // Keep stable ids positionally so persisting cards don't re-mount /
      // re-animate on every partial — only genuinely new cards pop in.
      setTasks(prev => preview.map((tk, i) => ({ ...tk, id: prev[i]?.id ?? tk.id })));
    }, 320);
  };

  const onVoiceTranscript = (final: string) => {
    const value = final.trim();
    if (!value) { setPhase('idle'); return; }

    // A budget utterance is unambiguous — route it straight through, no review.
    const route = routeVoice(value, topics);
    if (route.kind === 'budget') {
      onAddBudget(route.transaction);
      setStatus(describeRoute(route));
      setTasks([]); setPartial('');
      setTimeout(onClose, 900);
      return;
    }

    const parsed = parseVoiceTasks(value, topics);
    if (parsed.length === 0) {
      const fb = cleanTaskText(value);
      if (fb.length >= 3) {
        setTasks([{ id: `v-${Date.now()}`, text: fb, topicId: null, topicName: null, topicColor: null, deadline: null, deadlineLabel: null }]);
        setPhase('review');
      } else {
        setPhase('idle');
      }
      setPartial('');
      return;
    }
    setTasks(parsed);
    setPhase('review');
    setPartial('');
  };

  // ── Review-card mutations ────────────────────────────────────────────────────
  const updateTask = (id: string, patch: Partial<ParsedTask>) =>
    setTasks(ts => ts.map(tk => (tk.id === id ? { ...tk, ...patch } : tk)));

  const removeTask = (id: string) =>
    setTasks(ts => {
      const next = ts.filter(tk => tk.id !== id);
      if (next.length === 0) setPhase('idle');
      return next;
    });

  const setTopic = (id: string, choiceId: string) => {
    const tp = topics.find(x => x.id === choiceId) ?? null;
    updateTask(id, { topicId: choiceId || null, topicName: tp?.name ?? null, topicColor: tp?.color ?? null });
  };

  const setDeadline = (id: string, ms: number | null) =>
    // Manual date overrides the parsed label — DatePicker shows the date itself.
    updateTask(id, { deadline: ms, deadlineLabel: null });

  const readyTasks = () => tasks.filter(tk => tk.text.trim().length >= 1);

  // "Add all" — file each card into its chosen topic; cards on "Quicks" (no
  // topic) drop into the inbox.
  const addAll = () => {
    const ready = readyTasks();
    if (ready.length === 0) {
      // Don't just vanish: if there were cards but all were blanked out, say so
      // rather than closing silently (which reads as a lost capture).
      if (tasks.length > 0) { setStatus('nothing to add'); setTimeout(onClose, 700); }
      else onClose();
      return;
    }
    const now = Date.now();
    const inboxItems: InboxItem[] = [];
    let toTopics = 0;
    ready.forEach((tk, i) => {
      const value = tk.text.trim();
      if (tk.topicId) {
        onAddToTopic(tk.topicId, value, tk.deadline ?? null);
        toTopics++;
      } else if (tk.deadline != null && onAddDeadline) {
        // Topic-free but dated — first-class deadline capture rather than letting
        // it stall in Quicks (which has no destination on a zero-topic account).
        onAddDeadline(value, tk.deadline);
        toTopics++;
      } else {
        inboxItems.push({
          id: nextId(), text: value, createdAt: now + i,
          deadline: tk.deadline ?? undefined, deadlineLabel: tk.deadlineLabel ?? undefined,
        });
      }
    });
    if (inboxItems.length) onAddInbox(inboxItems);
    setStatus(
      toTopics && inboxItems.length ? `→ ${toTopics} filed · ${inboxItems.length} to Quicks`
      : toTopics ? `→ ${toTopics} filed`
      : `→ Quicks (${inboxItems.length})`
    );
    setTimeout(onClose, 600);
  };

  // "Add later" — keep everything in Quicks (with its predicted topic + date)
  // to triage from the inbox later.
  const addLater = () => {
    const ready = readyTasks();
    if (ready.length === 0) { onClose(); return; }
    const now = Date.now();
    const items: InboxItem[] = ready.map((tk, i) => ({
      id: now + i,
      text: tk.text.trim(),
      createdAt: now + i,
      suggestedTopicId: tk.topicId ?? undefined,
      deadline: tk.deadline ?? undefined,
      deadlineLabel: tk.deadlineLabel ?? undefined,
    }));
    onAddInbox(items);
    setStatus(items.length > 1 ? `→ Quicks (${items.length} tasks)` : '→ Quicks');
    setTimeout(onClose, 500);
  };

  const headerLabel =
    phase === 'recording' ? 'Listening · ramble away'
    : phase === 'review'  ? `Review · ${tasks.length} task${tasks.length === 1 ? '' : 's'}`
    : 'Quick add · type or talk';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '14vh',
      }}
    >
      <div
        ref={panelRef}
        data-onb="quick-add-modal"
        {...dialogProps('Quick add')}
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(560px, 92vw)',
          maxHeight: '72vh', overflowY: 'auto',
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
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            {headerLabel}
            {phase === 'recording' && <Equaliser color={t.doneAccent} />}
          </span>
          {status && (
            <span style={{ color: t.doneAccent, letterSpacing: '0.06em', textTransform: 'none' }}>
              {status}
            </span>
          )}
        </div>

        {/* Input + mic — hidden once we're reviewing cards. */}
        {phase !== 'review' && (
          <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
            <input
              ref={inputRef}
              value={phase === 'recording' ? partial : text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitTyped(); }}
              placeholder={phase === 'recording' ? 'listening…' : "what's on your mind? a thought, todo, expense…"}
              disabled={phase === 'recording'}
              style={{
                flex: 1,
                background: t.input, border: `1px solid ${t.border}`,
                borderRadius: '8px', padding: '0.55rem 0.75rem', color: t.text,
                fontSize: '0.93rem', fontFamily: 'inherit', fontWeight: 400, outline: 'none',
                opacity: phase === 'recording' ? 0.85 : 1,
              }}
            />
            <VoiceButton
              t={t}
              onTranscript={onVoiceTranscript}
              onPartial={onVoicePartial}
              onRecordingChange={onRecordingChange}
              onError={(msg) => setStatus(`mic error: ${msg}`)}
              iconSize={17}
            />
          </div>
        )}

        {/* Streaming / review task cards */}
        {tasks.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.6rem' }}>
            {tasks.map(task => (
              <TaskCard
                key={task.id}
                t={t}
                task={task}
                topicChoices={topicChoices}
                editable={phase === 'review'}
                onChangeText={v => updateTask(task.id, { text: v })}
                onChangeTopic={id => setTopic(task.id, id)}
                onChangeDeadline={ms => setDeadline(task.id, ms)}
                onRemove={() => removeTask(task.id)}
              />
            ))}
          </div>
        )}

        {/* Review footer */}
        {phase === 'review' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.7rem' }}>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', color: t.textDim,
                fontSize: '0.78rem', fontFamily: 'inherit', padding: '0.45rem 0.2rem',
              }}
            >
              Discard
            </button>
            <div style={{ flex: 1 }} />
            <button
              onClick={addLater}
              title="Keep these in Quicks to triage later"
              style={{
                background: 'none', border: `1px solid ${t.border}`, borderRadius: '8px',
                padding: '0.45rem 0.9rem', cursor: 'pointer', color: t.textMuted,
                fontSize: '0.8rem', fontFamily: 'inherit',
              }}
            >
              Add later
            </button>
            <button
              onClick={addAll}
              title="File each into its topic now (cards on Quicks stay in Quicks)"
              style={{
                background: t.text, border: 'none', borderRadius: '8px',
                padding: '0.45rem 1.05rem', cursor: 'pointer', color: t.panel,
                fontSize: '0.8rem', fontWeight: 600, fontFamily: 'inherit',
              }}
            >
              Add all
            </button>
          </div>
        )}

        <div style={{ fontSize: '0.6rem', color: t.textDim, marginTop: '0.55rem' }}>
          {phase === 'recording' ? 'tap the mic again to finish · esc to dismiss'
            : phase === 'review' ? 'add all → into topics · add later → Quicks · esc to discard'
            : 'enter to save · mic to ramble · esc to dismiss'}
        </div>
      </div>
    </div>
  );
}

// ── A single streaming / review card ───────────────────────────────────────────
function TaskCard({
  t, task, topicChoices, editable, onChangeText, onChangeTopic, onChangeDeadline, onRemove,
}: {
  t: Theme;
  task: ParsedTask;
  topicChoices: Choice[];
  editable: boolean;
  onChangeText: (v: string) => void;
  onChangeTopic: (topicId: string) => void;
  onChangeDeadline: (ms: number | null) => void;
  onRemove: () => void;
}) {
  return (
    <div style={{
      background: t.todoBg, border: `1px solid ${task.topicColor ? task.topicColor + '55' : t.todoBorder}`,
      borderLeft: `2px solid ${task.topicColor ?? t.todoBorder}`,
      borderRadius: '8px', padding: '0.6rem 0.65rem 0.6rem 0.75rem',
      display: 'flex', flexDirection: 'column', gap: '0.5rem',
      animation: 'taskPop 0.22s var(--ease, cubic-bezier(0.16,1,0.3,1)) both',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        {editable ? (
          <input
            value={task.text}
            onChange={e => onChangeText(e.target.value)}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: t.text, fontSize: '0.88rem', fontFamily: 'inherit', padding: '0.1rem 0',
            }}
          />
        ) : (
          <span style={{ flex: 1, color: t.text, fontSize: '0.88rem' }}>{task.text}</span>
        )}
        <button
          onClick={onRemove}
          title="Drop this task"
          style={{
            background: 'none', border: 'none', cursor: 'pointer', color: t.textDim,
            display: 'flex', padding: '2px', flexShrink: 0,
          }}
        >
          <X size={13} strokeWidth={2} />
        </button>
      </div>

      {editable ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <ChoicePicker
            t={t}
            value={task.topicId ?? ''}
            onChange={onChangeTopic}
            options={topicChoices}
            size="sm"
            minWidth={132}
          />
          <DatePicker
            t={t}
            value={task.deadline ?? null}
            onChange={onChangeDeadline}
            placeholder="schedule"
            allowClear
            size="sm"
          />
        </div>
      ) : (
        // Live preview (read-only) — compact chips while still talking.
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          {task.topicName && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
              fontSize: '0.7rem', color: task.topicColor ?? t.textMuted,
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: task.topicColor ?? t.textMuted }} />
              {task.topicName}
            </span>
          )}
          {task.deadline && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
              fontSize: '0.68rem', color: t.textMuted,
              background: t.input, borderRadius: '999px', padding: '0.12rem 0.5rem',
            }}>
              <Calendar size={10} strokeWidth={1.5} />
              {format(new Date(task.deadline), 'd MMM')}
              {task.deadlineLabel && task.deadlineLabel !== format(new Date(task.deadline), 'MMMM d') && ` · ${task.deadlineLabel}`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Live "listening" equaliser ─────────────────────────────────────────────────
function Equaliser({ color }: { color: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'flex-end', gap: '2px', height: '10px' }}>
      {[0, 1, 2, 3].map(i => (
        <span
          key={i}
          style={{
            width: '2px', height: '10px', background: color, borderRadius: '1px',
            transformOrigin: 'bottom',
            animation: `voiceBar 0.9s ${i * 0.12}s infinite ease-in-out`,
          }}
        />
      ))}
    </span>
  );
}
