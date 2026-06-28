import { useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { Widget } from '../shared/Widget';
import type { WidgetCtx } from './context';
import type { TopicLink } from '../../lib/types';
import { isTauri } from '../../lib/platform';

const ACCENT = '#a1bdc7';

async function openLink(url: string) {
  if (isTauri()) {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

type LinkSize = 'compact' | 'cozy' | 'full';
const SIZE_ORDER: LinkSize[] = ['compact', 'cozy', 'full'];
const SIZE_LABEL: Record<LinkSize, string> = { compact: 'Compact', cozy: 'Cozy', full: 'Full width' };

export default function TopicLinksWidget({ ctx }: { ctx: WidgetCtx }) {
  const { t, topics, currentTopicId, onTopicChange, editing, widgetConfig, onWidgetConfig } = ctx;
  const topic = topics.find(tp => tp.id === currentTopicId);

  const [addingLink, setAddingLink] = useState(false);
  const [linkLabel, setLinkLabel] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  const size: LinkSize = (widgetConfig?.linkSize as LinkSize) ?? 'cozy';
  const cycleSize = () => {
    const next = SIZE_ORDER[(SIZE_ORDER.indexOf(size) + 1) % SIZE_ORDER.length];
    onWidgetConfig?.({ ...widgetConfig, linkSize: next });
  };

  if (!topic || !onTopicChange) {
    return (
      <Widget t={t} accent={ACCENT}>
        <div style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: t.textDim, fontStyle: 'italic' }}>
          No topic selected.
        </div>
      </Widget>
    );
  }

  const links = topic.links ?? [];
  const accent = topic.color ?? ACCENT;

  const inp: React.CSSProperties = {
    background: t.input, border: `1px solid ${t.border}`, borderRadius: '7px',
    padding: '0.4rem 0.6rem', color: t.text, fontSize: '0.78rem',
    fontFamily: 'inherit', outline: 'none',
  };

  const addLink = () => {
    const label = linkLabel.trim();
    let url = linkUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    const newLink: TopicLink = { id: Date.now().toString(36), label: label || url, url };
    onTopicChange({ ...topic, links: [...links, newLink] });
    setLinkLabel(''); setLinkUrl(''); setAddingLink(false);
  };

  const removeLink = (id: string) =>
    onTopicChange({ ...topic, links: links.filter(l => l.id !== id) });

  return (
    <Widget t={t} accent={accent}>
      {editing && (
        <div className="widget-interactive" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', marginBottom: '0.65rem' }}>
          <button
            onClick={() => setAddingLink(v => !v)}
            style={{
              background: 'none', border: `1px solid ${t.border}`, borderRadius: '6px',
              padding: '0.2rem 0.55rem', cursor: 'pointer', color: t.textMuted,
              fontSize: '0.68rem', fontFamily: 'inherit',
            }}
          >
            + add
          </button>
          <button
            onClick={cycleSize}
            title="Change how much space links take"
            style={{
              background: 'none', border: `1px solid ${t.border}`, borderRadius: '6px',
              padding: '0.2rem 0.55rem', cursor: 'pointer', color: t.textMuted,
              fontSize: '0.68rem', fontFamily: 'inherit',
            }}
          >
            {SIZE_LABEL[size]}
          </button>
        </div>
      )}

      {editing && addingLink && (
        <div className="widget-interactive" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.65rem' }}>
          <input
            autoFocus
            value={linkLabel}
            onChange={e => setLinkLabel(e.target.value)}
            placeholder="Label (e.g. Notion page)"
            style={inp}
          />
          <input
            value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addLink()}
            placeholder="https://…"
            style={inp}
          />
          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
            <button
              onClick={() => { setAddingLink(false); setLinkLabel(''); setLinkUrl(''); }}
              style={{ background: 'none', border: `1px solid ${t.border}`, borderRadius: '7px', padding: '0.3rem 0.65rem', cursor: 'pointer', color: t.textMuted, fontSize: '0.75rem', fontFamily: 'inherit' }}
            >
              Cancel
            </button>
            <button
              onClick={addLink}
              style={{ background: accent, border: 'none', borderRadius: '7px', padding: '0.3rem 0.75rem', color: '#fff', fontSize: '0.75rem', fontFamily: 'inherit', cursor: 'pointer' }}
            >
              Add
            </button>
          </div>
        </div>
      )}

      {links.length === 0 && !addingLink ? (
        <div style={{ fontSize: '0.78rem', color: t.textDim, fontStyle: 'italic' }}>
          {editing ? 'No links yet — click + add to pin one.' : 'No links pinned.'}
        </div>
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: size === 'full' ? 'column' : 'row',
          flexWrap: size === 'full' ? 'nowrap' : 'wrap',
          gap: size === 'compact' ? '0.3rem' : size === 'full' ? '0.4rem' : '0.45rem',
        }}>
          {links.map(l => {
            const fontSize = size === 'compact' ? '0.72rem' : size === 'full' ? '0.86rem' : '0.8rem';
            const pad = size === 'compact'
              ? '0.18rem 0.45rem 0.18rem 0.4rem'
              : size === 'full'
                ? '0.5rem 0.7rem'
                : '0.3rem 0.6rem 0.3rem 0.5rem';
            const icon = size === 'compact' ? 10 : size === 'full' ? 14 : 12;
            return (
              <div key={l.id} style={{
                display: size === 'full' ? 'flex' : 'inline-flex',
                alignItems: 'center', gap: '0.3rem',
                width: size === 'full' ? '100%' : undefined,
                background: accent + '18', border: `1px solid ${accent}44`,
                borderRadius: size === 'full' ? '10px' : '999px', padding: pad,
              }}>
                <button
                  onClick={() => openLink(l.url)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.32rem',
                    flex: size === 'full' ? 1 : undefined, minWidth: 0,
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: accent, fontFamily: 'inherit', fontSize, padding: 0,
                    textAlign: 'left',
                  }}
                >
                  <ExternalLink size={icon} strokeWidth={1.5} style={{ flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.label}</span>
                </button>
                {editing && (
                  <button
                    className="widget-interactive"
                    onClick={() => removeLink(l.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textDim, padding: '0 0 0 1px', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                  >
                    <X size={size === 'full' ? 12 : 9} strokeWidth={2} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Widget>
  );
}
