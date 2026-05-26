import type { ReactNode } from 'react';
import { Plus } from 'lucide-react';
import type { Theme } from '../../lib/types';
import { addBtnStyle } from './styles';

export function SectionHeader({ title, t, hint = '', right }: {
  title: string; t: Theme; hint?: string; right?: ReactNode;
}) {
  if (!title && !hint && !right) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '0 0 1rem' }}>
      {title && <h2 style={{ fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: t.textMuted, fontWeight: 400, margin: 0 }}>{title}</h2>}
      {right
        ? <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>{right}</div>
        : (hint && <p style={{ fontSize: '0.7rem', color: t.textDim, margin: 0, letterSpacing: '0.02em', marginLeft: 'auto' }}>{hint}</p>)}
    </div>
  );
}

export function EmptyState({ text, t }: { text: string; t: Theme }) {
  return (
    <p style={{ color: t.textDim, fontSize: '0.85rem', fontStyle: 'italic', textAlign: 'center', padding: '1.5rem 0', margin: 0 }}>
      {text}
    </p>
  );
}

interface InputRowProps {
  value: string; setValue: (v: string) => void; onAdd: () => void;
  placeholder: string; t: Theme; accent: string;
}

export function InputRow({ value, setValue, onAdd, placeholder, t, accent: _accent }: InputRowProps) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        onKeyDown={(e) => e.key === 'Enter' && onAdd()}
        style={{
          flex: 1, background: t.input, border: `1px solid ${t.border}`, borderRadius: '8px',
          padding: '0.7rem 1rem', color: t.text, fontSize: '0.9rem',
          fontFamily: 'inherit', fontWeight: 300, outline: 'none',
        }}
      />
      <button onClick={onAdd} style={addBtnStyle(t)} aria-label="Add">
        <Plus size={15} strokeWidth={1.5} />
      </button>
    </div>
  );
}
