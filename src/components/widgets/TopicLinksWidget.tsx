import { useEffect, useRef, useState } from 'react';
import { ExternalLink, X, Minus, Plus } from 'lucide-react';
import { Widget } from '../shared/Widget';
import type { WidgetCtx } from './context';
import type { TopicLink } from '../../lib/types';
import { isTauri } from '../../lib/platform';
import { fetchFaviconDataUrl } from '../../lib/favicon';

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

const MIN_LOGO = 28;
const MAX_LOGO = 240;

// Live favicon URL (used as a fallback before the icon is cached, and on web).
// DuckDuckGo returns the site's real icon and 404s for unknown domains, rather
// than the grey "globe" placeholder Google's service returns.
function faviconUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    return `https://icons.duckduckgo.com/ip3/${host}.ico`;
  } catch {
    return null;
  }
}

// Renders the site's logo: the cached data-URL icon if we have it (works
// offline), otherwise the live favicon service, otherwise a generic glyph.
function LinkFavicon({ link, px, accent }: { link: TopicLink; px: number; accent: string }) {
  const [failed, setFailed] = useState(false);
  const src = link.icon ?? faviconUrl(link.url);
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

// Single logo stretched to fill the whole widget (Fill mode).
function FillLogo({ link, accent }: { link: TopicLink; accent: string }) {
  const [failed, setFailed] = useState(false);
  const src = link.icon ?? faviconUrl(link.url);
  if (!src || failed) {
    return <ExternalLink size={64} strokeWidth={1.2} style={{ color: accent, opacity: 0.6 }} />;
  }
  return (
    <img
      src={src}
      alt={link.label}
      onError={() => setFailed(true)}
      style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
    />
  );
}

export default function TopicLinksWidget({ ctx }: { ctx: WidgetCtx }) {
  const { t, topics, currentTopicId, editing, widgetConfig, onWidgetConfig } = ctx;
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
  // Logo size (px) used in icons-only mode — small multiple logos up to one big
  // logo that fills the widget. Adjusted with the +/- stepper.
  const logoSize = Math.min(MAX_LOGO, Math.max(MIN_LOGO, Number(widgetConfig?.logoSize) || 46));
  const changeLogoSize = (delta: number) =>
    onWidgetConfig?.({ ...widgetConfig, logoSize: Math.min(MAX_LOGO, Math.max(MIN_LOGO, logoSize + delta)) });
  // Fill mode: a single logo stretched to fill the whole widget, nothing else.
  const fill = Boolean(iconsOnly && widgetConfig?.fill);
  const toggleFill = () => onWidgetConfig?.({ ...widgetConfig, fill: !widgetConfig?.fill });

  // Links live in THIS widget's own config so multiple Links widgets on one topic
  // stay independent. Existing single-widget users fall back to the legacy
  // topic.links until their first edit (or icon backfill) migrates them in.
  const storedLinks = widgetConfig?.links as TopicLink[] | undefined;
  const links: TopicLink[] = storedLinks ?? topic?.links ?? [];
  const setLinks = (next: TopicLink[]) => onWidgetConfig?.({ ...widgetConfig, links: next });

  // Backfill missing favicons once: fetch each link's icon (Tauri native fetch
  // bypasses CORS), cache it as a data URL so it renders offline afterwards.
  // `attempted` stops us re-hitting the network for icons that failed this
  // session; a fresh launch retries them.
  const latestRef = useRef<{ links: TopicLink[]; setLinks: (n: TopicLink[]) => void }>({ links: [], setLinks: () => {} });
  latestRef.current = { links, setLinks };
  const attempted = useRef<Set<string>>(new Set());
  const linksKey = links.map(l => l.id + (l.icon ? '1' : '0')).join('|');
  useEffect(() => {
    const cur = latestRef.current.links;
    const missing = cur.filter(l => !l.icon && !attempted.current.has(l.id));
    if (!missing.length) return;
    missing.forEach(l => attempted.current.add(l.id));
    let cancelled = false;
    void (async () => {
      const results = await Promise.all(
        missing.map(async l => ({ id: l.id, icon: await fetchFaviconDataUrl(l.url) })),
      );
      if (cancelled) return;
      const map = new Map(results.filter(r => r.icon).map(r => [r.id, r.icon as string]));
      if (!map.size) return;
      const fresh = latestRef.current.links;
      latestRef.current.setLinks(fresh.map(l => (map.has(l.id) ? { ...l, icon: map.get(l.id) } : l)));
    })();
    return () => { cancelled = true; };
  }, [linksKey]);

  if (!topic) {
    return (
      <Widget t={t} accent={ACCENT}>
        <div style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: t.textDim, fontStyle: 'italic' }}>
          No topic selected.
        </div>
      </Widget>
    );
  }

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
    setLinks([...links, newLink]);
    setLinkLabel(''); setLinkUrl(''); setAddingLink(false);
  };

  const removeLink = (id: string) =>
    setLinks(links.filter(l => l.id !== id));

  const stepBtn: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted,
    padding: '0.1rem 0.25rem', display: 'flex', alignItems: 'center',
  };

  return (
    <Widget t={t} accent={accent} noPadding={fill && !editing && links.length > 0}>
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
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
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
            {iconsOnly && (
              <button
                onClick={toggleFill}
                title="One logo fills the whole widget"
                style={{
                  background: fill ? accent + '22' : 'none',
                  border: `1px solid ${fill ? accent + '88' : t.border}`, borderRadius: '6px',
                  padding: '0.2rem 0.55rem', cursor: 'pointer', color: fill ? accent : t.textMuted,
                  fontSize: '0.68rem', fontFamily: 'inherit',
                }}
              >
                Fill
              </button>
            )}
            {!iconsOnly ? (
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
            ) : !fill ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.1rem', border: `1px solid ${t.border}`, borderRadius: '6px', padding: '0.05rem 0.1rem' }} title="Logo size">
                <button onClick={() => changeLogoSize(-12)} aria-label="Smaller logos" style={stepBtn}><Minus size={12} strokeWidth={2} /></button>
                <span style={{ fontSize: '0.62rem', color: t.textMuted, minWidth: 24, textAlign: 'center' }}>{logoSize}</span>
                <button onClick={() => changeLogoSize(12)} aria-label="Bigger logos" style={stepBtn}><Plus size={12} strokeWidth={2} /></button>
              </div>
            ) : null}
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
      ) : fill && links.length > 0 ? (
        // Fill mode: the first link's logo fills the whole widget, nothing else.
        <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button
            onClick={() => openLink(links[0].url)}
            title={links[0].label}
            aria-label={links[0].label}
            style={{
              width: '100%', height: '100%', minHeight: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', cursor: 'pointer', padding: editing ? '0.3rem' : 0,
            }}
          >
            <FillLogo link={links[0]} accent={accent} />
          </button>
          {editing && (
            <button
              className="widget-interactive"
              onClick={() => removeLink(links[0].id)}
              aria-label={`Remove ${links[0].label}`}
              style={{
                position: 'absolute', top: 0, right: 0, width: 20, height: 20, borderRadius: '50%',
                background: t.panel, border: `1px solid ${t.borderStrong}`, color: t.textMuted,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
              }}
            >
              <X size={11} strokeWidth={2} />
            </button>
          )}
        </div>
      ) : iconsOnly ? (
        // Logos-only launcher: clickable logo tiles, no labels. Tile size is the
        // user-set logoSize, so one big logo can fill the widget or many small
        // ones can sit side by side.
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem', alignItems: 'center' }}>
          {links.map(l => {
            const px = logoSize;
            return (
              <div key={l.id} style={{ position: 'relative', display: 'inline-flex' }}>
                <button
                  onClick={() => openLink(l.url)}
                  title={l.label}
                  aria-label={l.label}
                  style={{
                    width: px, height: px, borderRadius: Math.max(8, Math.round(px * 0.22)),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: t.input, border: `1px solid ${accent}33`,
                    cursor: 'pointer', padding: 0, transition: 'border-color 0.15s, transform 0.1s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = accent + '99'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = accent + '33'; e.currentTarget.style.transform = 'none'; }}
                >
                  <LinkFavicon link={l} px={Math.round(px * 0.62)} accent={accent} />
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
                  <LinkFavicon link={l} px={icon} accent={accent} />
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
