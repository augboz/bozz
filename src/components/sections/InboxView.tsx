import React, { useEffect, useRef, useState } from 'react';
import { X, ArrowRight, Sparkles, Pencil, Check, Zap, Command, FolderPlus } from 'lucide-react';
import type { InboxItem, Theme, Topic } from '../../lib/types';
import { SectionHeader } from '../shared/ui';
import ChoicePicker, { type Choice } from '../shared/ChoicePicker';
import DatePicker from '../shared/DatePicker';
import { isTauri } from '../../lib/platform';
import { predictTopic } from '../../lib/taskParser';

interface InboxViewProps {
  t: Theme;
  inbox: InboxItem[];
  setInbox: React.Dispatch<React.SetStateAction<InboxItem[]>>;
  topics: Topic[];
  /** Routes the inbox item into the given topic. */
  onAssign: (text: string, topicId: string, deadline: number | null) => void;
  /** Spin up a brand-new topic seeded with this quick's text + deadline, so a
   *  first capture on a zero-topic account never stalls with nowhere to go. */
  onCreateTopicFromQuick?: (text: string, deadline: number | null) => void;
}

function InboxRow({ item, t, dests, topics, onAssign, onDelete, onRename, onCreateTopic }: {
  item: InboxItem; t: Theme;
  dests: Choice[];
  topics: Topic[];
  onAssign: (topicId: string, deadline: number | null) => void;
  onDelete: () => void;
  onRename: (text: string) => void;
  /** Present only when there are no topics to send to — spins up a new topic
   *  from this quick instead of leaving the row with a disabled "send". */
  onCreateTopic?: (deadline: number | null) => void;
}) {
  // Re-predicted on every render against the CURRENT topic list — never
  // cached — so a topic created after this item was captured still gets
  // picked up without the user having to do anything.
  const predicted = predictTopic(item.text, topics);
  const predictedId = predicted && dests.some(d => d.id === predicted.id) ? predicted.id : null;
  const hasSuggestion = Boolean(predictedId);
  const suggestedColor = dests.find(d => d.id === predictedId)?.color;

  const [dest, setDest] = useState<string>(predictedId ?? dests[0]?.id ?? '');
  const touchedRef = useRef(false);

  // Keep the dropdown synced to the live prediction until the user
  // explicitly picks something themselves.
  useEffect(() => {
    if (!touchedRef.current && predictedId && predictedId !== dest) setDest(predictedId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [predictedId]);

  const [deadline, setDeadline] = useState<number | null>(item.deadline ?? null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(item.text);
  const editRef = useRef<HTMLInputElement>(null);

  const startEdit = () => { setEditText(item.text); setEditing(true); setTimeout(() => editRef.current?.select(), 0); };
  const commitEdit = () => { const v = editText.trim(); if (v) onRename(v); setEditing(false); };

  return (
    <div
      data-onb="inbox-row"
      onKeyDown={e => {
        // Enter while the row's controls (not the rename input) are focused files
        // it to the currently-selected destination — keyboard triage.
        if (e.key !== 'Enter' || editing || !dest) return;
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        onAssign(dest, deadline);
      }}
      style={{
        background: t.todoBg, border: `1px solid ${hasSuggestion ? (suggestedColor ?? t.todoBorder) + '55' : t.todoBorder}`,
        borderRadius: '8px', padding: '0.7rem 1rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        {/* Task text or edit input, with optional inline predicted badge */}
        <div style={{ flex: 1, minWidth: '160px', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          {editing ? (
            <input
              ref={editRef}
              value={editText}
              onChange={e => setEditText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false); }}
              onBlur={commitEdit}
              style={{
                flex: 1, fontSize: '0.9rem', color: t.text,
                background: t.input, border: `1px solid ${t.borderStrong}`, borderRadius: '6px',
                padding: '0.2rem 0.4rem', fontFamily: 'inherit', outline: 'none',
              }}
            />
          ) : (
            <span style={{ fontSize: '0.9rem', color: t.text }}>{item.text}</span>
          )}
          {hasSuggestion && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', flexShrink: 0 }}>
              <Sparkles size={9} strokeWidth={1.5} color={suggestedColor ?? t.textDim} />
              <span style={{ fontSize: '0.62rem', color: suggestedColor ?? t.textDim, letterSpacing: '0.04em' }}>
                predicted{item.deadlineLabel ? ` · ${item.deadlineLabel}` : ''}
              </span>
            </span>
          )}
        </div>
        <button onClick={editing ? commitEdit : startEdit} title={editing ? 'Save' : 'Edit title'} style={{
          background: 'transparent', border: 'none', color: t.textMuted, cursor: 'pointer', padding: '0.2rem', display: 'flex',
        }}>
          {editing ? <Check size={14} strokeWidth={1.5} /> : <Pencil size={13} strokeWidth={1.5} />}
        </button>
        {dests.length > 0 && (
          <ChoicePicker
            t={t}
            value={dest}
            onChange={(v) => { touchedRef.current = true; setDest(v); }}
            options={dests}
            size="sm"
            minWidth={132}
          />
        )}
        <DatePicker
          t={t}
          value={deadline}
          onChange={setDeadline}
          placeholder="no deadline"
          allowClear
          size="sm"
        />
        {dests.length === 0 && onCreateTopic ? (
          <button
            onClick={() => onCreateTopic(deadline)}
            data-onb="inbox-new-topic"
            title="Create a topic from this quick"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
              background: t.doingBg, border: `1px solid ${t.doingBorder}`, borderRadius: '8px',
              padding: '0.4rem 0.7rem', color: t.doingAccent,
              cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: 500,
            }}
          >
            <FolderPlus size={13} strokeWidth={1.6} /> new topic
          </button>
        ) : (
          <button
            onClick={() => onAssign(dest, deadline)}
            disabled={!dest}
            data-onb="inbox-send"
            title="Send to topic"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
              background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px',
              padding: '0.4rem 0.7rem', color: t.textMuted,
              cursor: dest ? 'pointer' : 'not-allowed', opacity: dest ? 1 : 0.4,
              fontFamily: 'inherit', fontSize: '0.78rem',
            }}
          >
            send <ArrowRight size={13} strokeWidth={1.5} />
          </button>
        )}
        <button onClick={onDelete} aria-label="Delete" style={{
          background: 'transparent', border: 'none', color: t.textMuted,
          cursor: 'pointer', padding: '0.2rem', display: 'flex',
        }}>
          <X size={14} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

export default function InboxView({ t, inbox, setInbox, topics, onAssign, onCreateTopicFromQuick }: InboxViewProps) {
  const remove = (id: number) => setInbox(prev => prev.filter(i => i.id !== id));
  const rename = (id: number, text: string) => setInbox(prev => prev.map(i => i.id === id ? { ...i, text } : i));
  const assign = (item: InboxItem, topicId: string, deadline: number | null) => {
    onAssign(item.text, topicId, deadline);
    remove(item.id);
  };
  const createTopicFrom = (item: InboxItem, deadline: number | null) => {
    onCreateTopicFromQuick?.(item.text, deadline);
    remove(item.id);
  };

  // Build the destination dropdown from the user's topics
  const dests: Choice[] = [...topics]
    .sort((a, b) => a.order - b.order)
    .map(top => ({ id: top.id, label: top.name || 'New topic', color: top.color }));

  const sorted = [...inbox].sort((a, b) => b.createdAt - a.createdAt);

  // Items with a confident predicted topic that's a valid destination — mirrors
  // the per-row prediction so "Accept all" routes exactly where the badges point.
  const predictedItems = sorted.flatMap(item => {
    const predicted = predictTopic(item.text, topics);
    const id = predicted && dests.some(d => d.id === predicted.id) ? predicted.id : null;
    return id ? [{ item, topicId: id }] : [];
  });

  const acceptAllPredicted = () => {
    for (const { item, topicId } of predictedItems) {
      onAssign(item.text, topicId, item.deadline ?? null);
    }
    const filedIds = new Set(predictedItems.map(p => p.item.id));
    setInbox(prev => prev.filter(i => !filedIds.has(i.id)));
  };

  const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform);
  const modKey = isMac ? '⌘' : 'Ctrl';

  return (
    <div>
      <SectionHeader title="Quicks" t={t} hint="capture anything · triage later" />
      {predictedItems.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.7rem', flexWrap: 'wrap',
          marginBottom: '0.75rem',
        }}>
          <button
            onClick={acceptAllPredicted}
            title="File every predicted item into its predicted topic"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              background: t.doingBg, border: `1px solid ${t.doingBorder}`, borderRadius: '8px',
              padding: '0.45rem 0.8rem', color: t.doingAccent,
              cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 500,
            }}
          >
            <Sparkles size={13} strokeWidth={1.8} />
            Accept all predicted
            <span style={{
              fontSize: '0.7rem', fontWeight: 600,
              background: t.doingAccent + '22', borderRadius: '999px', padding: '0.05rem 0.4rem',
            }}>
              {predictedItems.length}
            </span>
          </button>
          <span style={{ fontSize: '0.72rem', color: t.textDim }}>
            files each into its predicted topic
          </span>
        </div>
      )}
      {dests.length === 0 && inbox.length > 0 && (
        <div style={{
          padding: '0.85rem 1rem', marginBottom: '0.75rem',
          background: t.todoBg, border: `1px dashed ${t.border}`, borderRadius: '10px',
          fontSize: '0.78rem', color: t.textMuted, lineHeight: 1.55,
        }}>
          {onCreateTopicFromQuick
            ? <>No topics yet — hit <strong style={{ color: t.text }}>new topic</strong> on any quick below to spin one up from it, or create topics in <strong style={{ color: t.text }}>Settings → Topics</strong>.</>
            : <>You have items but no topics yet — create a topic in <strong style={{ color: t.text }}>Settings → Topics</strong> to send these somewhere.</>}
        </div>
      )}
      <div style={{ display: 'grid', gap: '0.4rem' }}>
        {sorted.map(item => (
          <InboxRow
            key={item.id}
            item={item}
            t={t}
            dests={dests}
            topics={topics}
            onAssign={(topicId, deadline) => assign(item, topicId, deadline)}
            onDelete={() => remove(item.id)}
            onRename={(text) => rename(item.id, text)}
            onCreateTopic={onCreateTopicFromQuick ? (deadline) => createTopicFrom(item, deadline) : undefined}
          />
        ))}
        {inbox.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: '1.1rem', padding: '3rem 1.5rem', textAlign: 'center',
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: '14px',
              background: t.panel, border: `1px solid ${t.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Zap size={22} strokeWidth={1.4} color={t.textDim} />
            </div>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 500, color: t.text, marginBottom: '0.4rem' }}>
                Nothing here yet
              </div>
              <div style={{ fontSize: '0.82rem', color: t.textMuted, lineHeight: 1.65, maxWidth: 340 }}>
                Quicks is your scratchpad. dump anything on your mind without breaking flow,
                then sort it into your topics whenever you're ready.
              </div>
            </div>
            {isTauri() ? (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.5rem 0.9rem',
                background: t.panel, border: `1px solid ${t.border}`, borderRadius: '8px',
                fontSize: '0.75rem', color: t.textMuted,
              }}>
                <span>Press</span>
                <kbd style={{
                  display: 'inline-flex', alignItems: 'center', gap: '2px',
                  background: t.bgAlt, border: `1px solid ${t.borderStrong}`,
                  borderRadius: '5px', padding: '0.15rem 0.4rem',
                  fontSize: '0.72rem', fontFamily: 'monospace', color: t.text,
                }}>
                  {isMac ? <Command size={11} strokeWidth={1.5} /> : null}{modKey}+B
                </kbd>
                <span>anywhere to pop up quick add (desktop app)</span>
              </div>
            ) : (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.5rem 0.9rem',
                background: t.panel, border: `1px solid ${t.border}`, borderRadius: '8px',
                fontSize: '0.75rem', color: t.textMuted,
              }}>
                <Zap size={13} strokeWidth={1.6} color={t.textMuted} />
                <span>tap <strong style={{ color: t.text }}>Quick add</strong> in the sidebar (or press {modKey}+B) to capture a quick</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
