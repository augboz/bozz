import { useState } from 'react';
import { Check } from 'lucide-react';
import type { BozzTemplate, Theme } from '../../../lib/types';
import { STARTER_PACKS } from '../../../lib/templates';

interface Props {
  t: Theme;
  onApply: (tpl: BozzTemplate) => void;
}

export default function StarterPacksBlock({ t, onApply }: Props) {
  const [applied, setApplied] = useState<string | null>(null);

  const apply = (tpl: BozzTemplate) => {
    onApply(tpl);
    setApplied(tpl.id);
    setTimeout(() => setApplied(null), 2500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
      <p style={{ fontSize: '0.76rem', color: t.textMuted, lineHeight: 1.5, margin: 0 }}>
        Apply a starter pack to add ready-made topics, a sensible layout and a matching look.
        It merges into your setup — nothing you already have is removed.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.7rem' }}>
        {STARTER_PACKS.map(tpl => (
          <div key={tpl.id} style={{
            border: `1px solid ${t.border}`, borderRadius: '11px', padding: '0.85rem 0.9rem',
            display: 'flex', flexDirection: 'column', gap: '0.5rem',
          }}>
            <div style={{ fontSize: '0.88rem', color: t.text, fontWeight: 500 }}>{tpl.name}</div>
            <div style={{ fontSize: '0.72rem', color: t.textMuted, lineHeight: 1.45, flex: 1 }}>{tpl.description}</div>
            <button
              onClick={() => apply(tpl)}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
                background: applied === tpl.id ? t.doneBg : 'transparent',
                border: `1px solid ${applied === tpl.id ? t.doneBorder : t.border}`,
                color: applied === tpl.id ? t.doneAccent : t.textMuted,
                borderRadius: '8px', padding: '0.4rem 0.7rem',
                fontSize: '0.76rem', fontFamily: 'inherit', cursor: 'pointer',
              }}
            >
              {applied === tpl.id ? <><Check size={13} strokeWidth={2} /> Applied</> : 'Apply pack'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
