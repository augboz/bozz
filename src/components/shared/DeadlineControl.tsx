import { useState } from 'react';
import { X } from 'lucide-react';
import type { Theme } from '../../lib/types';
import { iconBtn } from './styles';
import { deadlineLabel, isOverdue } from '../../lib/dates';
import DatePicker from './DatePicker';

interface DeadlineControlProps {
  deadline: number | null;
  onChange: (ts: number | null) => void;
  t: Theme;
  /** Optional time-of-day, minutes from local midnight (null = all-day). */
  dueMin?: number | null;
  /** Persist a changed time-of-day. Omit to keep deadlines all-day. */
  onDueMin?: (next: number | null) => void;
}

/** "14:30" for a minutes-from-midnight value. */
function dueMinLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export default function DeadlineControl({ deadline, onChange, t, dueMin, onDueMin }: DeadlineControlProps) {
  const [open, setOpen] = useState(false);
  const overdue = deadline != null && isOverdue(deadline);
  const hasTime = onDueMin != null && dueMin != null;

  // When open, show DatePicker that immediately opens its calendar.
  // When DatePicker closes (selection or outside click), sync back.
  // In time mode the picker stays open after a date pick so the time can be set,
  // so we only close on an explicit onClose (selection-set / outside click).
  if (open) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
        <DatePicker
          t={t}
          value={deadline}
          onChange={(ts) => { onChange(ts); if (ts != null && onDueMin == null) setOpen(false); }}
          dueMin={onDueMin != null ? dueMin : undefined}
          onDueMin={onDueMin}
          allowClear
          defaultOpen
          onClose={() => setOpen(false)}
          size="sm"
        />
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
        {/* calendar icon via DatePicker's trigger is shown when open; here just the icon */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      </button>
    );
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(true)}
        title="Change deadline"
        aria-label={`Deadline ${deadlineLabel(deadline)}. Click to change.`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
          background: overdue ? t.alertBg : 'transparent',
          border: `1px solid ${overdue ? t.alertBorder : t.border}`,
          color: overdue ? t.alert : t.textMuted,
          padding: '0.1rem 0.4rem', borderRadius: '999px',
          fontSize: '0.63rem', letterSpacing: '0.01em', cursor: 'pointer',
          fontFamily: 'inherit', fontWeight: 400, whiteSpace: 'nowrap',
        }}
      >
        {overdue && (
          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: t.alert, display: 'inline-block' }} />
        )}
        {deadlineLabel(deadline)}{hasTime ? ` · ${dueMinLabel(dueMin!)}` : ''}
      </button>
      <button
        onClick={() => onChange(null)}
        aria-label="Clear deadline"
        title="Clear deadline"
        style={iconBtn(t)}
      >
        <X size={11} strokeWidth={1.5} />
      </button>
    </span>
  );
}
