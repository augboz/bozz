import { useEffect, useMemo, useRef, useState } from 'react';
import Fuse from 'fuse.js';
import { Plus, Flag, Wallet, Timer, ArrowRight, Inbox, CornerDownLeft } from 'lucide-react';
import type { SearchEntry } from '../lib/search';
import type { CommandAction } from '../lib/commands';
import type { Theme } from '../lib/types';
import { useFocusTrap, dialogProps } from '../hooks/useFocusTrap';

interface SearchModalProps {
  t: Theme;
  entries: SearchEntry[];
  recent: string[];
  onClose: () => void;
  onJump: (section: string) => void;
  onRecent: (query: string) => void;
  /** Build the executable actions for the current query (command palette, P3).
   *  Optional so older call sites stay valid; when absent it's jump-only. */
  buildActions?: (query: string) => CommandAction[];
  isMobile?: boolean;
  tbOffset?: number;
}

const GROUP_ORDER = ['Topics', 'Tasks', 'Applications', 'Calendar', 'Budget', 'Inbox', 'Settings'];

const ACTION_ICON = { plus: Plus, flag: Flag, wallet: Wallet, timer: Timer, arrow: ArrowRight, inbox: Inbox } as const;

export default function SearchModal({ t, entries, recent, onClose, onJump, onRecent, buildActions, isMobile = false, tbOffset = 0 }: SearchModalProps) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, onClose);

  const fuse = useMemo(
    () => new Fuse(entries, { keys: ['label', 'sub'], threshold: 0.4, ignoreLocation: true }),
    [entries],
  );

  const results = useMemo(() => {
    if (!q.trim()) return [];
    const hits = fuse.search(q).map(r => r.item);
    return hits.sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group)).slice(0, 40);
  }, [q, fuse]);

  // Actions that the typed query maps to (verbs that DO things). Above results.
  const actions = useMemo(() => {
    if (!q.trim() || !buildActions) return [];
    try { return buildActions(q); } catch { return []; }
  }, [q, buildActions]);

  // Keyboard navigation runs across one flat list: actions first, then results.
  const total = actions.length + results.length;

  useEffect(() => { setActive(0); }, [q]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const runAction = (a: CommandAction) => {
    if (q.trim()) onRecent(q.trim());
    a.run();
    onClose();
  };

  const chooseEntry = (e: SearchEntry) => {
    if (q.trim()) onRecent(q.trim());
    onJump(e.section);
    onClose();
  };

  const runActive = () => {
    if (active < actions.length) {
      const a = actions[active];
      if (a) runAction(a);
    } else {
      const e = results[active - actions.length];
      if (e) chooseEntry(e);
    }
  };

  const onKeyDown = (ev: React.KeyboardEvent) => {
    if (ev.key === 'Escape') { onClose(); return; }
    if (ev.key === 'ArrowDown') { ev.preventDefault(); setActive(a => Math.min(a + 1, total - 1)); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (ev.key === 'Enter' && total > 0) { ev.preventDefault(); runActive(); }
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
        ref={panelRef}
        {...dialogProps('Search')}
        onClick={e => e.stopPropagation()}
        style={{
          // Mobile: full-width, fills from title bar to bottom of screen
          // Desktop: centred floating palette
          width: isMobile ? '100%' : 'min(560px, 92vw)',
          maxHeight: isMobile ? `calc(100vh - ${tbOffset}px)` : '70vh',
          height: isMobile ? `calc(100vh - ${tbOffset}px)` : undefined,
          display: 'flex', flexDirection: 'column',
          background: 'var(--glass-bg, ' + t.panel + ')',
          backdropFilter: 'var(--glass-blur, none)',
          WebkitBackdropFilter: 'var(--glass-blur, none)',
          border: isMobile ? 'none' : `1px solid ${t.borderStrong}`,
          borderRadius: isMobile ? 0 : '16px',
          boxShadow: 'var(--widget-shadow, none)',
          overflow: 'hidden', fontFamily: 'var(--app-font)',
          animation: 'modalRise 0.4s var(--ease, cubic-bezier(0.16,1,0.3,1)) both',
        }}
      >
        <input
          ref={inputRef}
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="search or type a command…"
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

          {/* Actions — typed verbs that DO things. Shown above jump results. */}
          {actions.length > 0 && (
            <>
              <div style={{
                fontSize: '0.6rem', letterSpacing: '0.14em', textTransform: 'uppercase',
                color: t.textDim, padding: '0.7rem 1.25rem 0.3rem',
              }}>
                Actions
              </div>
              {actions.map((a, i) => {
                const isActive = i === active;
                const Icon = ACTION_ICON[a.icon] ?? Plus;
                return (
                  <button
                    key={a.id}
                    onClick={() => runAction(a)}
                    onMouseEnter={() => setActive(i)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.6rem',
                      width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                      background: isActive ? t.bgAlt : 'transparent', border: 'none',
                      padding: '0.6rem 1.25rem',
                    }}
                  >
                    <span style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0,
                      background: t.doingAccent + '22', color: t.doingAccent,
                    }}>
                      <Icon size={13} strokeWidth={2} />
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                      <span style={{ color: t.text, fontSize: '0.82rem', fontWeight: 500 }}>{a.label}</span>
                      <span style={{ color: t.textMuted, fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.detail}
                      </span>
                    </span>
                    {isActive && <CornerDownLeft size={13} strokeWidth={2} color={t.textDim} style={{ flexShrink: 0 }} />}
                  </button>
                );
              })}
            </>
          )}

          {q.trim() && total === 0 && (
            <div style={{ padding: '1.5rem 1.25rem', color: t.textDim, fontSize: '0.85rem', fontStyle: 'italic' }}>
              nothing found
            </div>
          )}

          {results.map((e, i) => {
            const flatIndex = actions.length + i;
            const header = e.group !== lastGroup ? e.group : null;
            lastGroup = e.group;
            const isActive = flatIndex === active;
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
                  onClick={() => chooseEntry(e)}
                  onMouseEnter={() => setActive(flatIndex)}
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
