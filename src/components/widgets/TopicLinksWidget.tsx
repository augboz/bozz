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

// Favicon for a link's domain via Google's favicon service. Returns null for
// unparseable URLs so the caller can fall back to a generic glyph.
function faviconUrl(url: string, px: number): string | null {
  try {
    const host = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?sz=${Math.max(32, px)}&domain=${host}`;
  } catch {
    return null;
  }
}

// Renders the site's favicon, falling back to a generic link glyph if the icon
// fails to load (offline, blocked, or no favicon).
function LinkFavicon({ url, px, accent }: { url: string; px: number; accent: string }) {
  const [failed, setFailed] = useState(false);
  const src = faviconUrl(url, px * 2);
  if (!src || failed) {
    return <ExternalLink size={px} strokeWidth={1.5} style={{ flexShrink: 0, color: accent }} />;
  }
  return (
    <img
      src={src}
      alt=""
      width={px}
      height={px}
      loading="lazy"
      onError={() => setFailed(true)}
      style={{ width: px, height: px, borderRadius: 4, objectFit: 'contain', flexShrink: 0, display: 'block' }}
    />
  );
}

const TILE: Record<LinkSize, number> = { compact: 36, cozy: 46, full: 58 };

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
  // Icons-only mode: show just the site logos as clickable tiles (no labels).
  const iconsOnly = Boolean(widgetConfig?.iconsOnly);
  const toggleIconsOnly = () => onWidgetConfig?.({ ...widgetConfig, iconsOnly: !iconsOnly });

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
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              onClick={toggleIconsOnly}
              title="Toggle between logos-only and labelled links"
              style={{
                background: iconsOnly ? accent + '22' : 'none',
                border: `1px solid ${iconsOnly ? accent + '88' : t.border}`, borderRadius: '6px',
                padding: '0.2rem 0.55rem', cursor: 'pointer', color: iconsOnly ? accent : t.textMuted,
                fontSize: '0.68rem', fontFamily: 'inherit',
              }}
            >
              {iconsOnly ? 'Logos only' : 'With names'}
            </button>
            <button
              onClick={cycleSize}
              title="Change link size"
              style={{
                background: 'none', border: `1px solid ${t.border}`, borderRadius: '6px',
                padding: '0.2rem 0.55rem', cursor: 'pointer', color: t.textMuted,
                fontSize: '0.68rem', fontFamily: 'inherit',
              }}
            >
              {SIZE_LABEL[size]}
            </button>
          </div>
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
      ) : iconsOnly ? (
        // Logos-only launcher: clickable favicon tiles, no labels.
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem', alignItems: 'center' }}>
          {links.map(l => {
            const px = TILE[size];
            return (
              <div key={l.id} style={{ position: 'relative', display: 'inline-flex' }}>
                <button
                  onClick={() => openLink(l.url)}
                  title={l.label}
                  aria-label={l.label}
                  style={{
                    width: px, height: px, borderRadius: size === 'compact' ? 9 : 13,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: t.input, border: `1px solid ${accent}33`,
                    cursor: 'pointer', padding: 0, transition: 'border-color 0.15s, transform 0.1s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = accent + '99'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = accent + '33'; e.currentTarget.style.transform = 'none'; }}
                >
                  <LinkFavicon url={l.url} px={Math.round(px * 0.58)} accent={accent} />
                </button>
                {editing && (
                  <button
                    className="widget-interactive"
                    onClick={() => removeLink(l.id)}
                    aria-label={`Remove ${l.label}`}
                    style={{
                      position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%',
                      background: t.panel, border: `1px solid ${t.borderStrong}`, color: t.textMuted,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                    }}
                  >
                    <X size={10} strokeWidth={2} />
                  </button>
                )}
              </div>
            );
          })}
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
              ? '0.2rem 0.5rem 0.2rem 0.35rem'
              : size === 'full'
                ? '0.5rem 0.7rem'
                : '0.32rem 0.65rem 0.32rem 0.45rem';
            const icon = size === 'compact' ? 14 : size === 'full' ? 18 : 16;
            return (
              <div key={l.id} style={{
                display: size === 'full' ? 'flex' : 'inline-flex',
                alignItems: 'center', gap: '0.3rem',
                width: size === 'full' ? '100%' : undefined,
                background: accent + '14', border: `1px solid ${accent}3a`,
                borderRadius: size === 'full' ? '10px' : '999px', padding: pad,
              }}>
                <button
                  onClick={() => openLink(l.url)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                    flex: size === 'full' ? 1 : undefined, minWidth: 0,
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: t.text, fontFamily: 'inherit', fontSize, padding: 0,
                    textAlign: 'left',
                  }}
                >
                  <LinkFavicon url={l.url} px={icon} accent={accent} />
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
