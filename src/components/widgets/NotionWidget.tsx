import { useState, useEffect, useCallback } from 'react';
import { BookOpen, RefreshCw } from 'lucide-react';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { openUrl } from '@tauri-apps/plugin-opener';
import { getItem } from '../../lib/storage';
import { Widget, WidgetHeader, EmptyWidget } from '../shared/Widget';
import type { WidgetCtx } from './context';

const ACCENT = '#bfa8c9';
const NOTION_VERSION = '2022-06-28';

interface NotionPageRef {
  id: string;
  label: string;
}
interface NotionConfig {
  token: string;
  pages: NotionPageRef[];
}
interface NotionPage {
  id: string;
  display: string;
  url: string;
}

function toUuid(id: string): string {
  const h = id.replace(/-/g, '');
  if (h.length !== 32) return id;
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Migrate legacy `{ token, pageIds: string[] }` shape if found. */
function normaliseConfig(raw: unknown): NotionConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as { token?: string; pages?: NotionPageRef[]; pageIds?: string[] };
  if (typeof o.token !== 'string') return null;
  if (Array.isArray(o.pages)) {
    return {
      token: o.token,
      pages: o.pages.map(p => ({ id: String(p.id), label: typeof p.label === 'string' ? p.label : '' })),
    };
  }
  if (Array.isArray(o.pageIds)) {
    return { token: o.token, pages: o.pageIds.map(id => ({ id: String(id), label: '' })) };
  }
  return { token: o.token, pages: [] };
}

export default function NotionWidget({ ctx }: { ctx: WidgetCtx }) {
  const { t } = ctx;
  const [pages, setPages] = useState<NotionPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasToken, setHasToken] = useState(false);
  const [hasPages, setHasPages] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    const saved = await getItem('notionWidget');
    if (!saved?.value) {
      setHasToken(false); setHasPages(false); setPages([]); setLoading(false);
      return;
    }
    let cfg: NotionConfig | null = null;
    try { cfg = normaliseConfig(JSON.parse(saved.value)); } catch { /* ignore */ }
    if (!cfg) { setHasToken(false); setHasPages(false); setPages([]); setLoading(false); return; }

    setHasToken(!!cfg.token);
    setHasPages(cfg.pages.length > 0);
    if (!cfg.token || cfg.pages.length === 0) { setPages([]); setLoading(false); return; }

    const results: NotionPage[] = [];
    for (const ref of cfg.pages) {
      const apiId = toUuid(ref.id);
      try {
        const res = await tauriFetch(`https://api.notion.com/v1/pages/${apiId}`, {
          headers: { Authorization: `Bearer ${cfg.token}`, 'Notion-Version': NOTION_VERSION },
        });
        if (!res.ok) {
          results.push({
            id: ref.id,
            display: ref.label || `Page ${ref.id.slice(0, 8)}…`,
            url: `https://notion.so/${ref.id}`,
          });
          continue;
        }
        const data = (await res.json()) as {
          id: string; url: string;
          properties: Record<string, { type: string; title?: Array<{ plain_text: string }> }>;
        };
        let fetched = '';
        for (const prop of Object.values(data.properties)) {
          if (prop.type === 'title' && prop.title?.length) {
            fetched = prop.title.map(seg => seg.plain_text).join('');
            break;
          }
        }
        results.push({
          id: ref.id,
          display: ref.label || fetched || 'Untitled',
          url: data.url,
        });
      } catch (e) {
        setFetchError(String(e));
        results.push({
          id: ref.id,
          display: ref.label || `Page ${ref.id.slice(0, 8)}…`,
          url: `https://notion.so/${ref.id}`,
        });
      }
    }
    setPages(results);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return (
    <Widget t={t} accent={ACCENT}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <WidgetHeader label="Notion" accent={ACCENT} t={t} icon={BookOpen} />
        <button
          onClick={reload}
          aria-label="Reload"
          title="Reload from settings"
          style={{
            background: 'transparent', border: 'none', color: t.textDim,
            cursor: 'pointer', padding: '0.15rem', display: 'flex',
          }}
        >
          <RefreshCw size={11} strokeWidth={1.5} />
        </button>
      </div>

      {loading && <EmptyWidget text="Loading…" t={t} />}

      {!loading && !hasToken && (
        <EmptyWidget text="Set up Notion in Settings → Connectors" t={t} />
      )}

      {!loading && hasToken && !hasPages && (
        <EmptyWidget text="Add pages in Settings → Connectors" t={t} />
      )}

      {!loading && pages.length > 0 && (
        <div style={{ display: 'grid', gap: '0.35rem', marginTop: '0.85rem' }}>
          {pages.map(p => (
            <button
              key={p.id}
              onClick={() => openUrl(p.url)}
              title={p.url}
              style={{
                textAlign: 'left', background: t.todoBg,
                border: `1px solid ${t.border}`, borderRadius: '7px',
                padding: '0.4rem 0.65rem', color: t.text,
                cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              {p.display}
            </button>
          ))}
        </div>
      )}

      {fetchError && (
        <div style={{ fontSize: '0.68rem', color: t.alert, marginTop: '0.4rem' }}>
          {fetchError}
        </div>
      )}
    </Widget>
  );
}
