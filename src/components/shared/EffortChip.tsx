/**
 * EffortChip — the optional Small / Medium / Large effort estimate (Round 7,
 * P-B). Purely informational: it never schedules or auto-plans anything.
 *
 * Two modes:
 *   - read-only (no onChange): a single tiny pill showing S / M / L, or nothing
 *     when unset.
 *   - editable (onChange): three small S/M/L toggles; tapping the active one
 *     clears it back to unset.
 */

import type { Effort, Theme } from '../../lib/types';

const ORDER: Effort[] = ['S', 'M', 'L'];

const META: Record<Effort, { label: string; color: string; title: string }> = {
  S: { label: 'S', color: '#7fae7f', title: 'Small effort' },
  M: { label: 'M', color: '#e0a23b', title: 'Medium effort' },
  L: { label: 'L', color: '#d77a6c', title: 'Large effort' },
};

/** Numeric weight for sorting (S=1, M=2, L=3, unset=0). Larger = more effort. */
export function effortRank(effort: Effort | undefined): number {
  if (!effort) return 0;
  return ORDER.indexOf(effort) + 1;
}

export function EffortChip({ effort }: { effort: Effort | undefined }) {
  if (!effort) return null;
  const m = META[effort];
  return (
    <span
      title={m.title}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        minWidth: '16px', height: '16px', padding: '0 4px',
        borderRadius: '5px', flexShrink: 0,
        background: m.color + '22', border: `1px solid ${m.color}55`,
        color: m.color, fontSize: '0.6rem', fontWeight: 700, lineHeight: 1,
      }}
    >
      {m.label}
    </span>
  );
}

/**
 * EffortPicker — the editable S/M/L selector used when adding / triaging a task.
 * Tapping the active level clears it back to unset.
 */
export function EffortPicker({ value, onChange, t, size = 'md' }: {
  value: Effort | undefined;
  onChange: (next: Effort | undefined) => void;
  t: Theme;
  size?: 'sm' | 'md';
}) {
  const dim = size === 'sm' ? '20px' : '24px';
  const font = size === 'sm' ? '0.62rem' : '0.7rem';
  return (
    <div
      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
      title="Effort estimate (optional)"
    >
      {ORDER.map(e => {
        const on = value === e;
        const m = META[e];
        return (
          <button
            key={e}
            type="button"
            onClick={() => onChange(on ? undefined : e)}
            title={m.title}
            style={{
              width: dim, height: dim, borderRadius: '6px', flexShrink: 0,
              background: on ? m.color + '26' : 'transparent',
              border: `1px solid ${on ? m.color : t.border}`,
              color: on ? m.color : t.textDim,
              fontSize: font, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit', lineHeight: 1,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.12s',
            }}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
