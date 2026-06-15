import type { CSSProperties } from 'react';
import type { Status, Theme } from '../../lib/types';

export const rowStyle = (status: Status, t: Theme): CSSProperties => {
  const bg = status === 'done' ? t.doneBg : status === 'doing' ? t.doingBg : t.todoBg;
  const border = status === 'done' ? t.doneBorder : status === 'doing' ? t.doingBorder : t.todoBorder;
  const leftBar = status === 'done' ? t.doneAccent : status === 'doing' ? t.doingAccent : 'transparent';
  return {
    background: bg, border: `1px solid ${border}`, borderLeft: `3px solid ${leftBar}`,
    borderRadius: '8px', padding: '0.45rem 0.75rem',
    display: 'flex', alignItems: 'center', gap: '0.55rem', transition: 'all 0.2s ease',
  };
};

export const textStyle = (status: Status, t: Theme): CSSProperties => ({
  flex: 1, fontSize: '0.9rem',
  color: status === 'done' ? t.textDim : t.text,
  textDecoration: status === 'done' ? 'line-through' : 'none',
  fontWeight: status === 'doing' ? 400 : 300,
});

export const iconBtn = (t: Theme): CSSProperties => ({
  background: 'transparent', border: 'none', color: t.textMuted, cursor: 'pointer',
  padding: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: 'inherit', fontSize: '1rem', fontWeight: 300, flexShrink: 0,
});

export const addBtnStyle = (t: Theme): CSSProperties => ({
  background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px',
  padding: '0 0.85rem', color: t.textMuted, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
});
