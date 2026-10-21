// The receipt: what actually changed, computed from the store before and after.
// Never from the model's own description (the Replit incident), and never from
// the op list (an op can be a no-op or do less than it claims).
import type { AssistantStore } from './store';
import { WIDGET_CATALOG } from '../widgetCatalog';
import type { HomeWidgetItem } from '../types';

export interface ReceiptLine { kind: 'added' | 'removed' | 'changed'; text: string }

const label = (w: HomeWidgetItem) => WIDGET_CATALOG[w.type]?.label ?? w.type;

function diffLayout(pageName: string, before: HomeWidgetItem[], after: HomeWidgetItem[], out: ReceiptLine[]) {
  const b = new Map(before.map(w => [w.i, w]));
  const a = new Map(after.map(w => [w.i, w]));
  for (const w of after) if (!b.has(w.i)) out.push({ kind: 'added', text: `${pageName}: added ${label(w)} (${w.w}×${w.h})` });
  for (const w of before) if (!a.has(w.i)) out.push({ kind: 'removed', text: `${pageName}: removed ${label(w)}` });
  for (const w of after) {
    const prev = b.get(w.i);
    if (!prev) continue;
    const what: string[] = [];
    if (prev.w !== w.w || prev.h !== w.h) what.push(`resized to ${w.w}×${w.h}`);
    else if (prev.x !== w.x || prev.y !== w.y) what.push('moved');
    if (JSON.stringify(prev.config ?? {}) !== JSON.stringify(w.config ?? {})) {
      const keys = new Set([...Object.keys(prev.config ?? {}), ...Object.keys(w.config ?? {})].filter(k => JSON.stringify(prev.config?.[k]) !== JSON.stringify(w.config?.[k])));
      what.push(`${[...keys].join(', ')} changed`);
    }
    if (what.length) out.push({ kind: 'changed', text: `${pageName}: ${label(w)} ${what.join(', ')}` });
  }
}

export function diffStore(before: AssistantStore, after: AssistantStore): ReceiptLine[] {
  const out: ReceiptLine[] = [];

  // Pages
  const bt = new Map(before.topics.map(t => [t.id, t]));
  const at = new Map(after.topics.map(t => [t.id, t]));
  for (const t of after.topics) if (!bt.has(t.id)) out.push({ kind: 'added', text: `New page "${t.name}" with ${(t.widgetLayout ?? []).length} widget${(t.widgetLayout ?? []).length === 1 ? '' : 's'}` });
  for (const t of before.topics) if (!at.has(t.id)) out.push({ kind: 'removed', text: `Deleted page "${t.name}" (${t.items.length} task${t.items.length === 1 ? '' : 's'})` });
  for (const t of after.topics) {
    const p = bt.get(t.id);
    if (!p) continue;
    const name = p.name;
    const fields: Array<[string, unknown, unknown]> = [
      ['renamed to', p.name, t.name], ['icon', p.icon, t.icon], ['colour', p.color, t.color], ['folder', p.folderId, t.folderId],
      ['description', p.description, t.description], ['page title', p.pageTitle, t.pageTitle], ['title size', p.pageTitleSize, t.pageTitleSize],
      ['title colour', p.pageTitleColor, t.pageTitleColor], ['status', p.status, t.status], ['note', p.pinnedNote, t.pinnedNote],
    ];
    for (const [f, x, y] of fields) {
      if (JSON.stringify(x) === JSON.stringify(y)) continue;
      out.push({ kind: 'changed', text: f === 'renamed to' ? `Page "${name}" renamed to "${y}"` : `Page "${name}": ${f} ${y === undefined ? 'cleared' : f === 'note' ? 'updated' : `set to ${String(y)}`}` });
    }
    const addedTasks = t.items.filter(i => !p.items.some(j => j.id === i.id));
    if (addedTasks.length) out.push({ kind: 'added', text: `Page "${name}": ${addedTasks.length} task${addedTasks.length === 1 ? '' : 's'} added (${addedTasks.map(i => `"${i.text}"`).join(', ')})` });
    const completed = t.items.filter(i => { const j = p.items.find(k => k.id === i.id); return j && j.completedAt === null && i.completedAt !== null; });
    if (completed.length) out.push({ kind: 'changed', text: `Page "${name}": completed ${completed.map(i => `"${i.text}"`).join(', ')}` });
    diffLayout(`Page "${name}"`, p.widgetLayout ?? [], t.widgetLayout ?? [], out);
  }

  // Folders
  for (const f of after.topicFolders) if (!before.topicFolders.some(g => g.id === f.id)) out.push({ kind: 'added', text: `New folder "${f.name}"` });

  // Home
  diffLayout('Home', before.homeLayout, after.homeLayout, out);

  // Appearance
  const ba = before.appearance, aa = after.appearance;
  for (const k of ['mood', 'font', 'fontSize', 'widgetShape', 'widgetBorder', 'activeWorldId'] as const) {
    if (ba[k] !== aa[k]) out.push({ kind: 'changed', text: `Appearance: ${k === 'activeWorldId' ? 'world' : k} set to ${String(aa[k])}` });
  }
  if (JSON.stringify(ba.readability ?? {}) !== JSON.stringify(aa.readability ?? {})) {
    const r = aa.readability;
    out.push({ kind: 'changed', text: r && Object.keys(r).length
      ? `Readability: ${[r.lineHeight && `line height ${r.lineHeight}`, r.letterSpacing && `letter spacing ${r.letterSpacing}em`, r.wordSpacing && `word spacing ${r.wordSpacing}em`, r.reducedMotion && 'reduced motion'].filter(Boolean).join(', ')}`
      : 'Readability: back to defaults' });
  }

  // Habits
  for (const h of after.habits) if (!before.habits.some(g => g.id === h.id)) {
    const page = h.topicId ? after.topics.find(t => t.id === h.topicId)?.name : null;
    out.push({ kind: 'added', text: `New ${h.frequency === 'weekly' ? 'weekly ' : ''}habit "${h.name}"${page ? ` on page "${page}"` : ''}` });
  }
  for (const h of before.habits) if (!after.habits.some(g => g.id === h.id)) out.push({ kind: 'removed', text: `Removed habit "${h.name}"` });

  return out;
}
