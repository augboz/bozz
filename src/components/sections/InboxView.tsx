import React, { useState } from 'react';
import { X, ArrowRight } from 'lucide-react';
import type { InboxItem, Theme, Topic } from '../../lib/types';
import { SectionHeader, EmptyState } from '../shared/ui';
import ChoicePicker, { type Choice } from '../shared/ChoicePicker';
import DatePicker from '../shared/DatePicker';

interface InboxViewProps {
  t: Theme;
  inbox: InboxItem[];
  setInbox: React.Dispatch<React.SetStateAction<InboxItem[]>>;
  topics: Topic[];
  /** Routes the inbox item into the given topic. */
  onAssign: (text: string, topicId: string, deadline: number | null) => void;
}

function InboxRow({ item, t, dests, onAssign, onDelete }: {
  item: InboxItem; t: Theme;
  dests: Choice[];
  onAssign: (topicId: string, deadline: number | null) => void;
  onDelete: () => void;
}) {
  const [dest, setDest] = useState<string>(dests[0]?.id ?? '');
  const [deadline, setDeadline] = useState<number | null>(null);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap',
      background: t.todoBg, border: `1px solid ${t.todoBorder}`,
      borderRadius: '8px', padding: '0.7rem 1rem',
    }}>
      <span style={{ flex: 1, minWidth: '160px', fontSize: '0.9rem', color: t.text }}>{item.text}</span>
      <ChoicePicker
        t={t}
        value={dest}
        onChange={(v) => setDest(v)}
        options={dests}
        size="sm"
        minWidth={132}
      />
      <DatePicker
        t={t}
        value={deadline}
        onChange={setDeadline}
        placeholder="no deadline"
        allowClear
        size="sm"
      />
      <button
        onClick={() => onAssign(dest, deadline)}
        disabled={!dest}
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
      <button onClick={onDelete} aria-label="Delete" style={{
        background: 'transparent', border: 'none', color: t.textMuted,
        cursor: 'pointer', padding: '0.2rem', display: 'flex',
      }}>
        <X size={14} strokeWidth={1.5} />
      </button>
    </div>
  );
}

export default function InboxView({ t, inbox, setInbox, topics, onAssign }: InboxViewProps) {
  const remove = (id: number) => setInbox(prev => prev.filter(i => i.id !== id));
  const assign = (item: InboxItem, topicId: string, deadline: number | null) => {
    onAssign(item.text, topicId, deadline);
    remove(item.id);
  };

  // Build the destination dropdown from the user's topics
  const dests: Choice[] = [...topics]
    .sort((a, b) => a.order - b.order)
    .map(top => ({ id: top.id, label: top.name || '(unnamed)', color: top.color }));

  const sorted = [...inbox].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div>
      <SectionHeader title="Inbox" t={t} hint="capture with Ctrl+Shift+N · triage here" />
      {dests.length === 0 && inbox.length > 0 && (
        <div style={{
          padding: '0.85rem 1rem', marginBottom: '0.75rem',
          background: t.todoBg, border: `1px dashed ${t.border}`, borderRadius: '10px',
          fontSize: '0.78rem', color: t.textMuted, lineHeight: 1.55,
        }}>
          You have inbox items but no topics yet — create a topic in <strong style={{ color: t.text }}>Settings → Topics</strong> to send these somewhere.
        </div>
      )}
      <div style={{ display: 'grid', gap: '0.4rem' }}>
        {sorted.map(item => (
          <InboxRow
            key={item.id}
            item={item}
            t={t}
            dests={dests}
            onAssign={(topicId, deadline) => assign(item, topicId, deadline)}
            onDelete={() => remove(item.id)}
          />
        ))}
        {inbox.length === 0 && <EmptyState text="inbox zero ✦" t={t} />}
      </div>
    </div>
  );
}
