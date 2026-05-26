import { useState } from 'react';
import { ChevronDown, ChevronRight, RotateCcw, Trash2 } from 'lucide-react';
import type { ListItem, Theme } from '../../lib/types';
import { iconBtn } from './styles';
import { relativeCompleted } from '../../lib/dates';

interface DonePileProps {
  items: ListItem[];
  t: Theme;
  onRestore: (id: number) => void;
  onDelete: (id: number) => void;
}

/** Collapsible archive of completed tasks, newest-first. Hidden when empty. */
export default function DonePile({ items, t, onRestore, onDelete }: DonePileProps) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;

  const sorted = [...items].sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));

  return (
    <div style={{ marginTop: '1.25rem' }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%',
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: t.textMuted, fontSize: '0.7rem', letterSpacing: '0.12em',
          textTransform: 'uppercase', fontFamily: 'inherit', padding: '0.5rem 0', fontWeight: 400,
        }}
      >
        {open
          ? <ChevronDown size={13} strokeWidth={1.5} />
          : <ChevronRight size={13} strokeWidth={1.5} />}
        {items.length} done · click to {open ? 'collapse' : 'expand'}
      </button>

      {open && (
        <div style={{ display: 'grid', gap: '0.35rem', marginTop: '0.4rem' }}>
          {sorted.map(i => (
            <div
              key={i.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                background: t.doneBg, border: `1px solid ${t.doneBorder}`,
                borderLeft: `3px solid ${t.doneAccent}`, borderRadius: '8px',
                padding: '0.7rem 1rem',
              }}
            >
              <span style={{
                flex: 1, fontSize: '0.85rem', color: t.textDim,
                textDecoration: 'line-through',
              }}>
                {i.text}
              </span>
              <span style={{ fontSize: '0.68rem', color: t.textDim, whiteSpace: 'nowrap' }}>
                {relativeCompleted(i.completedAt)}
              </span>
              <button onClick={() => onRestore(i.id)} title="Restore" aria-label="Restore" style={iconBtn(t)}>
                <RotateCcw size={13} strokeWidth={1.5} />
              </button>
              <button onClick={() => onDelete(i.id)} title="Delete permanently" aria-label="Delete permanently" style={iconBtn(t)}>
                <Trash2 size={13} strokeWidth={1.5} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
