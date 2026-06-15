import React from 'react';
import { Lock } from 'lucide-react';
import type { BudgetData, Theme } from '../../../lib/types';
import { SectionHeader } from '../../shared/ui';

interface Props {
  t: Theme;
  budget: BudgetData;
  setBudget: React.Dispatch<React.SetStateAction<BudgetData>>;
}

export default function BudgetView({ t }: Props) {
  return (
    <div>
      <SectionHeader title="Budget" t={t} />
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
