import { useState } from 'react';
import { Calendar, X } from 'lucide-react';
import type { Theme } from '../../lib/types';
import { iconBtn } from './styles';
import { dateInputValue, parseDateInput, deadlineLabel, isOverdue } from '../../lib/dates';

interface DeadlineControlProps {
  deadline: number | null;
  onChange: (ts: number | null) => void;
  t: Theme;
}

/**
 * Calendar-icon button when no deadline; a themed chip when one is set
 * (alert-coloured + coral dot when overdue). Click opens a native date input.
 */
export default function DeadlineControl({ deadline, onChange, t }: DeadlineControlProps) {
  const [open, setOpen] = useState(false);
  const overdue = deadline != null && isOverdue(deadline);

  if (open) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
        <input
          type="date"
          autoFocus
          defaultValue={deadline != null ? dateInputValue(deadline) : ''}
          onChange={(e) => onChange(parseDateInput(e.target.value))}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => { if (e.key === 'Escape' || e.key === 'Enter') setOpen(false); }}
          style={{
            background: t.input, border: `1px solid ${t.border}`, borderRadius: '6px',
            padding: '0.2rem 0.4rem', color: t.text, fontSize: '0.75rem',
            fontFamily: 'inherit', outline: 'none',
          }}
        />
        {deadline != null && (
          <button
            onClick={() => { onChange(null); setOpen(false); }}
            aria-label="Clear deadline"
            title="Clear deadline"
            style={iconBtn(t)}
          >
            <X size={12} strokeWidth={1.5} />
          </button>
        )}
      </span>
    );
  }

  if (deadline == null) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Set deadline"
        title="Set deadline"
        style={{ ...iconBtn(t), color: t.textDim }}
      >
        <Calendar size={14} strokeWidth={1.5} />
      </button>
    );
  }

  return (
    <button
      onClick={() => setOpen(true)}
      title="Change deadline"
      aria-label={`Deadline ${deadlineLabel(deadline)}. Click to change.`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
        background: overdue ? t.alertBg : 'transparent',
        border: `1px solid ${overdue ? t.alertBorder : t.border}`,
        color: overdue ? t.alert : t.textMuted,
        padding: '0.15rem 0.5rem', borderRadius: '999px',
        fontSize: '0.68rem', letterSpacing: '0.02em', cursor: 'pointer',
        fontFamily: 'inherit', fontWeight: 400, whiteSpace: 'nowrap', flexShrink: 0,
      }}
    >
      {overdue && (
        <span style={{
          width: '5px', height: '5px', borderRadius: '50%',
          background: t.alert, display: 'inline-block',
        }} />
      )}
      {deadlineLabel(deadline)}
    </button>
  );
}
