import { useState, useEffect, useCallback } from 'react';
import { BookOpen, RefreshCw, Plus } from 'lucide-react';
import { isTauri } from '../../lib/platform';
import { getItem, setItem } from '../../lib/storage';
import { extractNotionPageId } from '../../lib/notion';
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
  const [adding, setAdding] = useState(false);
  const [urlInput, setUrlInput] = useState('');

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
        if (!isTauri()) {
          results.push({ id: ref.id, display: ref.label || `Page ${ref.id.slice(0, 8)}…`, url: `https://notion.so/${ref.id}` });
          continue;
        }
        const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
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

  // Add a page straight from the widget: paste its "Copy link" URL, we pull the
  // id out and append it to the saved Notion config, then reload to fetch its
  // title. Mirrors the Settings → Connectors flow so both stay in sync.
  const addPage = useCallback(async () => {
    const raw = urlInput.trim();
    if (!raw) return;
    const id = extractNotionPageId(raw);
    if (!id) return;
    const saved = await getItem('notionWidget');
    let cfg: NotionConfig | null = null;
    try { cfg = saved?.value ? normaliseConfig(JSON.parse(saved.value)) : null; } catch { /* ignore */ }
    if (!cfg) cfg = { token: '', pages: [] };
    if (!cfg.pages.some(p => p.id === id)) {
      cfg = { ...cfg, pages: [...cfg.pages, { id, label: '' }] };
      await setItem('notionWidget', JSON.stringify(cfg));
    }
    setUrlInput('');
    setAdding(false);
    await reload();
  }, [urlInput, reload]);

  useEffect(() => { reload(); }, [reload]);

  return (
    <Widget t={t} accent={ACCENT}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <WidgetHeader label="Notion" accent={ACCENT} t={t} icon={BookOpen} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.1rem' }}>
          {hasToken && (
            <button
              onClick={() => setAdding(a => !a)}
              aria-label="Add a page"
              title="Add a page by its link"
              style={{
                background: 'transparent', border: 'none', color: t.textDim,
                cursor: 'pointer', padding: '0.15rem', display: 'flex',
              }}
            >
              <Plus size={12} strokeWidth={1.8} />
            </button>
          )}
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
      </div>

      {adding && hasToken && (
        <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.6rem' }}>
          <input
            autoFocus
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') void addPage();
              if (e.key === 'Escape') { setAdding(false); setUrlInput(''); }
            }}
            placeholder="Paste a Notion page link"
            style={{
              flex: 1, minWidth: 0, background: t.input, border: `1px solid ${t.border}`,
              borderRadius: '7px', padding: '0.35rem 0.55rem', color: t.text,
              fontSize: '0.78rem', fontFamily: 'inherit', outline: 'none',
            }}
          />
          <button
            onClick={() => void addPage()}
            style={{
              background: ACCENT, border: 'none', borderRadius: '7px',
              padding: '0.35rem 0.7rem', color: '#fff', fontSize: '0.76rem',
              fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            Add
          </button>
        </div>
      )}

      {loading && <EmptyWidget text="Loading…" t={t} />}

      {!loading && !hasToken && (
        <EmptyWidget text="Set up Notion in Settings → Connectors" t={t} />
      )}

      {!loading && hasToken && !hasPages && !adding && (
        <EmptyWidget text="No pages yet." t={t} actionLabel="add a page →" onAction={() => setAdding(true)} />
      )}

      {!loading && pages.length > 0 && (
        <div style={{ display: 'grid', gap: '0.35rem', marginTop: '0.85rem' }}>
          {pages.map(p => (
            <button
              key={p.id}
              onClick={() => { if (isTauri()) { void import('@tauri-apps/plugin-opener').then(m => m.openUrl(p.url)); } else { window.open(p.url, '_blank'); } }}
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