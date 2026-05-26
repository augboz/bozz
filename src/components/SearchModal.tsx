import { useEffect, useMemo, useRef, useState } from 'react';
import Fuse from 'fuse.js';
import type { SearchEntry } from '../lib/search';
import type { SectionId, Theme } from '../lib/types';

interface SearchModalProps {
  t: Theme;
  entries: SearchEntry[];
  recent: string[];
  onClose: () => void;
  onJump: (section: SectionId) => void;
  onRecent: (query: string) => void;
  isMobile?: boolean;
  tbOffset?: number;
}

const GROUP_ORDER = ['Tasks', 'Applications', 'Calendar', 'Budget', 'Inbox', 'Settings'];

export default function SearchModal({ t, entries, recent, onClose, onJump, onRecent, isMobile = false, tbOffset = 0 }: SearchModalProps) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const fuse = useMemo(
    () => new Fuse(entries, { keys: ['label', 'sub'], threshold: 0.4, ignoreLocation: true }),
    [entries],
  );

  const results = useMemo(() => {
    if (!q.trim()) return [];
    const hits = fuse.search(q).map(r => r.item);
    return hits.sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group)).slice(0, 40);
  }, [q, fuse]);

  useEffect(() => { setActive(0); }, [q]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const choose = (e: SearchEntry) => {
    if (q.trim()) onRecent(q.trim());
    onJump(e.section);
    onClose();
  };

  const onKeyDown = (ev: React.KeyboardEvent) => {
    if (ev.key === 'Escape') { onClose(); return; }
    if (ev.key === 'ArrowDown') { ev.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (ev.key === 'Enter' && results[active]) { ev.preventDefault(); choose(results[active]); }
  };

  let lastGroup = '';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        // Mobile: sheet slides up from top of content; Desktop: centred palette
        alignItems: isMobile ? 'flex-start' : 'flex-start',
        justifyContent: 'center',
        paddingTop: isMobile ? tbOffset : '12vh',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          // Mobile: full-width, fills from title bar to bottom of screen
          // Desktop: centred floating palette
          width: isMobile ? '100%' : 'min(560px, 92vw)',
          maxHeight: isMobile ? `calc(100vh - ${tbOffset}px)` : '70vh',
          height: isMobile ? `calc(100vh - ${tbOffset}px)` : undefined,
          display: 'flex', flexDirection: 'column',
          background: t.panel,
          border: isMobile ? 'none' : `1px solid ${t.borderStrong}`,
          borderRadius: isMobile ? 0 : '14px',
          overflow: 'hidden', fontFamily: 'var(--app-font)',
        }}
      >
        <input
          ref={inputRef}
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="search everything…"
          style={{
            background: 'transparent', border: 'none', borderBottom: `1px solid ${t.border}`,
            padding: isMobile ? '1.1rem 1.25rem' : '1rem 1.25rem',
            color: t.text,
            // ≥16px prevents iOS Safari auto-zoom on input focus
            fontSize: '1rem',
            fontFamily: 'inherit', fontWeight: 300, outline: 'none',
            minHeight: 44,
          }}
        />
        <div style={{ overflowY: 'auto' }}>
          {!q.trim() && recent.length > 0 && (
            <div style={{ padding: '0.85rem 1.25rem' }}>
              <div style={{ fontSize: '0.62rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: t.textDim, marginBottom: '0.5rem' }}>
                Recent
              </div>
              {recent.map(r => (
                <button
                  key={r}
                  onClick={() => setQ(r)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', background: 'transparent',
                    border: 'none', color: t.textMuted, cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: '0.85rem', padding: '0.35rem 0',
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          )}

          {q.trim() && results.length === 0 && (
            <div style={{ padding: '1.5rem 1.25rem', color: t.textDim, fontSize: '0.85rem', fontStyle: 'italic' }}>
              nothing found
            </div>
          )}

          {results.map((e, i) => {
            const header = e.group !== lastGroup ? e.group : null;
            lastGroup = e.group;
            const isActive = i === active;
            return (
              <div key={e.id}>
                {header && (
                  <div style={{
                    fontSize: '0.6rem', letterSpacing: '0.14em', textTransform: 'uppercase',
                    color: t.textDim, padding: '0.7rem 1.25rem 0.3rem',
                  }}>
                    {header}
                  </div>
                )}
                <button
                  onClick={() => choose(e)}
                  onMouseEnter={() => setActive(i)}
                  style={{
                    display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '1rem',
                    width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                    background: isActive ? t.bgAlt : 'transparent', border: 'none',
                    padding: '0.6rem 1.25rem',
                  }}
                >
                  <span style={{ color: t.text, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.label}
                  </span>
                  <span style={{ color: t.textDim, fontSize: '0.7rem', flexShrink: 0 }}>{e.sub}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
