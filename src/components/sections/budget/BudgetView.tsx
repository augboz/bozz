import React, { useState } from 'react';
import { Lock, Settings2 } from 'lucide-react';
import type { BudgetData, Theme } from '../../../lib/types';
import { SectionHeader } from '../../shared/ui';
import { CURRENCIES } from '../../../lib/budget';

interface Props {
  t: Theme;
  budget: BudgetData;
  setBudget: React.Dispatch<React.SetStateAction<BudgetData>>;
}

export default function BudgetView({ t, budget, setBudget }: Props) {
  const [editing, setEditing] = useState(false);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <SectionHeader title="Budget" t={t} />
        <button
          onClick={() => setEditing(e => !e)}
          title="Edit budget settings"
          aria-pressed={editing}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0,
            background: editing ? t.bgAlt : 'transparent',
            border: `1px solid ${t.border}`, borderRadius: '8px',
            padding: '0.35rem 0.7rem', color: t.textMuted,
            fontSize: '0.76rem', fontFamily: 'inherit', cursor: 'pointer',
          }}
        >
          <Settings2 size={14} strokeWidth={1.6} /> {editing ? 'Done' : 'Edit'}
        </button>
      </div>

      {/* Edit mode — currency lives here now (moved out of Settings) */}
      {editing && (
        <div style={{
          border: `1px solid ${t.border}`, borderRadius: '12px',
          padding: '0.85rem 1.1rem', marginTop: '0.5rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
        }}>
          <div>
            <div style={{ fontSize: '0.88rem', color: t.text, fontWeight: 300 }}>Currency</div>
            <div style={{ fontSize: '0.72rem', color: t.textMuted, marginTop: '0.15rem' }}>
              Used across the Budget section
            </div>
          </div>
          <select
            value={budget.currency}
            onChange={e => setBudget(b => ({ ...b, currency: e.target.value }))}
            aria-label="Currency"
            style={{
              background: t.input, border: `1px solid ${t.border}`, borderRadius: '8px',
              padding: '0.4rem 0.6rem', color: t.text, fontSize: '0.8rem',
              fontFamily: 'inherit', outline: 'none', flexShrink: 0,
            }}
          >
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}

      {/* Coming soon placeholder */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '4rem 2rem', textAlign: 'center', gap: '1rem',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '16px',
          background: t.bgAlt, border: `1px solid ${t.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Lock size={24} strokeWidth={1.5} color={t.textMuted} />
        </div>
        <div>
          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: t.text, marginBottom: '0.4rem' }}>
            Coming soon
          </div>
          <div style={{ fontSize: '0.85rem', color: t.textMuted, maxWidth: '320px', lineHeight: 1.6 }}>
            Budget tracking is being built with security and privacy as the top priority.
            It'll be ready soon.
          </div>
        </div>
      </div>
    </div>
  );
}
