/**
 * VoiceTaskReview — floating panel that appears after voice capture.
 *
 * Shows each AI-parsed task with predicted topic and deadline.
 * User clicks "Accept" to add it to the appropriate topic,
 * or × to dismiss it.
 */

import { useState } from 'react';
import { Check, X, Calendar } from 'lucide-react';
import type { Theme, Topic } from '../lib/types';
import type { ParsedTask } from '../lib/taskParser';
import { format } from 'date-fns';

interface Props {
  t: Theme;
  tasks: ParsedTask[];
  topics: Topic[];
  onAccept: (task: ParsedTask) => void;
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
}

function TopicChip({ topicId, topicName, topicColor, topics, t, onChange }: {
  topicId: string | null;
  topicName: string | null;
  topicColor: string | null;
  topics: Topic[];
  t: Theme;
  onChange: (topicId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        title="Change topic"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
          background: topicColor ? topicColor + '22' : 'transparent',
          border: `1px solid ${topicColor ?? t.border}`,
          borderRadius: '999px', padding: '0.15rem 0.55rem 0.15rem 0.4rem',
          cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.72rem',
          color: topicColor ?? t.textMuted,
        }}
      >
        {topicColor && (
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: topicColor, flexShrink: 0 }} />
        )}
        {topicName ?? 'No topic'}
        <span style={{ fontSize: '0.55rem', opacity: 0.6 }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 100,
          background: t.panel, border: `1px solid ${t.borderStrong}`,
          borderRadius: '10px', padding: '0.35rem',
          boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
          minWidth: '160px',
        }}>
          <button
            onClick={() => { onChange(null); setOpen(false); }}
            style={{
              width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center',
              gap: '0.4rem', padding: '0.3rem 0.5rem', borderRadius: '6px',
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: '0.75rem', color: t.textMuted,
            }}
          >
            No topic
          </button>
          {topics.map(tp => (
            <button
              key={tp.id}
              onClick={() => { onChange(tp.id); setOpen(false); }}
              style={{
                width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center',
                gap: '0.4rem', padding: '0.3rem 0.5rem', borderRadius: '6px',
                background: tp.id === topicId ? tp.color + '18' : 'transparent',
                border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: '0.75rem', color: t.text,
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: tp.color, flexShrink: 0 }} />
              {tp.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function VoiceTaskReview({ t, tasks, topics, onAccept, onDismiss, onDismissAll }: Props) {
  // Per-task local edits (text + topic override)
  const [edits, setEdits] = useState<Record<string, { text?: string; topicId?: string | null; topicColor?: string | null; topicName?: string | null }>>({});

  if (tasks.length === 0) return null;

  const getTask = (task: ParsedTask): ParsedTask => {
    const e = edits[task.id] ?? {};
    const overrideTopic = e.topicId !== undefined
      ? { topicId: e.topicId, topicName: e.topicName ?? null, topicColor: e.topicColor ?? null }
      : {};
    return { ...task, text: e.text ?? task.text, ...overrideTopic };
  };

  const setTopicOverride = (id: string, topicId: string | null) => {
    const topic = topics.find(tp => tp.id === topicId) ?? null;
    setEdits(prev => ({
      ...prev,
      [id]: { ...prev[id], topicId, topicName: topic?.name ?? null, topicColor: topic?.color ?? null },
    }));
  };

  return (
    <div style={{
      position: 'fixed', bottom: '1.5rem', right: '1.5rem',
      width: 'min(380px, calc(100vw - 2rem))',
      zIndex: 9000,
      display: 'flex', flexDirection: 'column', gap: '0.5rem',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: t.panel, border: `1px solid ${t.border}`,
        borderRadius: '12px', padding: '0.6rem 0.85rem',
      }}>
        <span style={{ fontSize: '0.72rem', color: t.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Voice capture · {tasks.length} task{tasks.length > 1 ? 's' : ''}
        </span>
        <button
          onClick={onDismissAll}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textDim, padding: '2px', display: 'flex', fontSize: '0.68rem', fontFamily: 'inherit' }}
        >
          Dismiss all
        </button>
      </div>

      {/* Task cards */}
      {tasks.map(rawTask => {
        const task = getTask(rawTask);
        return (
          <div key={task.id} style={{
            background: t.panel, border: `1px solid ${t.border}`,
            borderRadius: '12px', padding: '0.75rem 0.9rem',
            display: 'flex', flexDirection: 'column', gap: '0.5rem',
          }}>
            {/* Task text (editable) */}
            <input
              value={edits[task.id]?.text ?? task.text}
              onChange={e => setEdits(prev => ({ ...prev, [task.id]: { ...prev[task.id], text: e.target.value } }))}
              style={{
                background: t.input, border: `1px solid ${t.border}`, borderRadius: '7px',
                padding: '0.45rem 0.65rem', color: t.text, fontSize: '0.85rem',
                fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box',
              }}
            />

            {/* Topic + deadline row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <TopicChip
                topicId={task.topicId}
                topicName={task.topicName}
                topicColor={task.topicColor}
                topics={topics}
                t={t}
                onChange={(id) => setTopicOverride(rawTask.id, id)}
              />
              {task.deadline && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                  fontSize: '0.68rem', color: t.textMuted,
                  background: t.bgAlt, borderRadius: '999px',
                  padding: '0.15rem 0.5rem',
                }}>
                  <Calendar size={10} strokeWidth={1.5} />
                  {format(new Date(task.deadline), 'd MMM')}
                  {task.deadlineLabel && ` (${task.deadlineLabel})`}
                </span>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => onDismiss(task.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.25rem',
                  background: 'none', border: `1px solid ${t.border}`, borderRadius: '7px',
                  padding: '0.3rem 0.65rem', cursor: 'pointer', color: t.textMuted,
                  fontSize: '0.75rem', fontFamily: 'inherit',
                }}
              >
                <X size={11} strokeWidth={2} /> Dismiss
              </button>
              <button
                onClick={() => onAccept(task)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.25rem',
                  background: task.topicColor ?? t.text,
                  border: 'none', borderRadius: '7px',
                  padding: '0.3rem 0.8rem', cursor: 'pointer',
                  color: '#fff', fontSize: '0.75rem', fontFamily: 'inherit', fontWeight: 500,
                }}
              >
                <Check size={11} strokeWidth={2.5} /> Accept
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
