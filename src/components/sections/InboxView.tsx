import React, { useState } from 'react';
import { X, ArrowRight } from 'lucide-react';
import type { InboxDestination, InboxItem, Theme } from '../../lib/types';
import { SectionHeader, EmptyState } from '../shared/ui';
import { sectionAccents } from '../../lib/themes';
import ChoicePicker, { type Choice } from '../shared/ChoicePicker';
import DatePicker from '../shared/DatePicker';

interface InboxViewProps {
  t: Theme;
  inbox: InboxItem[];
  setInbox: React.Dispatch<React.SetStateAction<InboxItem[]>>;
  onAssign: (text: string, dest: InboxDestination, deadline: number | null) => void;
}

const DESTS: Choice[] = [
  { id: 'life',         label: 'Life',         color: sectionAccents.life },
  { id: 'music',        label: 'Music',        color: sectionAccents.music },
  { id: 'cv',           label: 'CV',           color: sectionAccents.cv },
  { id: 'other',        label: 'Other',        color: sectionAccents.other },
  { id: 'applications', label: 'Applications', color: sectionAccents.applications },
];

function InboxRow({ item, t, onAssign, onDelete }: {
  item: InboxItem; t: Theme;
  onAssign: (dest: InboxDestination, deadline: number | null) => void;
  onDelete: () => void;
}) {
  const [dest, setDest] = useState<InboxDestination>('life');
  const [deadline, setDeadline] = useState<number | null>(null);
  // Deadlines don't apply to applications — hide the date input there.
  const allowsDeadline = dest !== 'applications';

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
        onChange={(v) => setDest(v as InboxDestination)}
        options={DESTS}
        size="sm"
        minWidth={132}
      />
      {allowsDeadline && (
        <DatePicker
          t={t}
          value={deadline}
          onChange={setDeadline}
          placeholder="no deadline"
          allowClear
          size="sm"
        />
      )}
      <button
        onClick={() => onAssign(dest, allowsDeadline ? deadline : null)}
        title="Send to list"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
          background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px',
          padding: '0.4rem 0.7rem', color: t.textMuted, cursor: 'pointer',
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

export default function InboxView({ t, inbox, setInbox, onAssign }: InboxViewProps) {
  const remove = (id: number) => setInbox(prev => prev.filter(i => i.id !== id));
  const assign = (item: InboxItem, dest: InboxDestination, deadline: number | null) => {
    onAssign(item.text, dest, deadline);
    remove(item.id);
  };

  const sorted = [...inbox].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div>
      <SectionHeader title="Inbox" t={t} hint="capture with Ctrl+Shift+N · triage here" />
      <div style={{ display: 'grid', gap: '0.4rem' }}>
        {sorted.map(item => (
          <InboxRow
            key={item.id}
            item={item}
            t={t}
            onAssign={(dest, deadline) => assign(item, dest, deadline)}
            onDelete={() => remove(item.id)}
          />
        ))}
        {inbox.length === 0 && <EmptyState text="inbox zero ✦" t={t} />}
      </div>
    </div>
  );
}
