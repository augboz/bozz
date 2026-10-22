// applyOps: (store, ops) -> store. Pure, synchronous, no React.
//
// This is the only way the assistant changes anything, which is what makes
// the rest of the design hold: preview = run it on a copy; undo = restore the
// snapshot taken before it ran; receipt = diff before and after; tests = call
// it with fixtures. It throws OpError for anything that would be a lie to the
// user (unknown id, type not allowed on that page, second copy of a
// one-per-page widget), so the caller can send the reason back to the model.
import type { AppearancePrefs, Habit, HomeWidgetItem, Topic, TopicFolder, TopicItem } from '../types';
import { GRID_COLS, WIDGET_CATALOG, allowedOn } from '../widgetCatalog';
import { findWorld, applyWorld, worldToTopic, worldTopicPatch, gradientWallpaper } from '../worlds';
import type { AssistantStore } from './store';
import type { Op, WidgetConfigInput } from './ops';

export class OpError extends Error {
  constructor(public index: number, message: string) {
    super(message);
    this.name = 'OpError';
  }
}

// Ids are derived from a per-run seed plus a counter, so running the same ops
// on the same store twice (once on the assistant's draft, once for real)
// produces the same ids, and an op can refer to something an earlier op in
// the batch created. The seed is a Date.now() string; see applyOps.
let seedMs = Date.now();
let seedTag = seedMs.toString(36);
let seq = 0;
function freshWidgetId(type: string): string {
  seq += 1;
  return `${type}-${seedTag}-${seq}`;
}
function freshId(prefix: string): string {
  seq += 1;
  return `${prefix}-${seedTag}-${seq}`;
}
/** Numeric task ids (TopicItem.id): seed ms plus the counter, like nextId() but reproducible. */
function freshItemId(): number {
  seq += 1;
  return seedMs + seq;
}

/** YYYY-MM-DD -> local midnight ms, rejecting dates that only exist by rollover (2026-13-40). */
function strictLocalMidnight(ymd: string): number | null {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date.getTime();
}

interface WidgetLoc { page: 'home' | string; index: number; item: HomeWidgetItem }

function findWidget(s: AssistantStore, widgetId: string): WidgetLoc | null {
  const h = s.homeLayout.findIndex(w => w.i === widgetId);
  if (h !== -1) return { page: 'home', index: h, item: s.homeLayout[h] };
  for (const t of s.topics) {
    const i = (t.widgetLayout ?? []).findIndex(w => w.i === widgetId);
    if (i !== -1) return { page: t.id, index: i, item: t.widgetLayout![i] };
  }
  return null;
}

function requireTopic(s: AssistantStore, id: string, index: number): Topic {
  const t = s.topics.find(tp => tp.id === id);
  if (!t) throw new OpError(index, `no page with id "${id}"`);
  return t;
}

/** Only keys the catalog lists for this type, plus the colour overrides; drops nulls and `_` keys. */
function cleanConfig(type: HomeWidgetItem['type'], cfg: WidgetConfigInput | null | undefined, existing: Record<string, unknown> = {}): Record<string, unknown> {
  const allowed = new Set([...WIDGET_CATALOG[type].configKeys, 'widgetColor', 'bgColor', 'textColor']);
  const out: Record<string, unknown> = { ...existing };
  for (const [k, v] of Object.entries(cfg ?? {})) {
    if (!allowed.has(k) || k.startsWith('_')) continue;
    if (v === null) delete out[k];
    else if (k === 'links' && Array.isArray(v)) out.links = v.map(l => ({ id: freshId('l'), ...l }));
    else out[k] = v;
  }
  return out;
}

type Placement = 'top' | 'bottom' | 'above' | 'below' | 'leftOf' | 'rightOf';

function overlaps(a: HomeWidgetItem, b: HomeWidgetItem): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Lowest y at or below `fromY` where `item` fits at its x without overlapping. */
function dropIn(layout: HomeWidgetItem[], item: HomeWidgetItem, fromY: number): HomeWidgetItem {
  let y = fromY;
  for (let guard = 0; guard < 500; guard++) {
    const candidate = { ...item, y };
    const hit = layout.find(w => w.i !== item.i && overlaps(candidate, w));
    if (!hit) return candidate;
    y = hit.y + hit.h;
  }
  return { ...item, y };
}

/**
 * Put `item` (not yet in `layout`) somewhere that never overlaps.
 * top/bottom: a row at the top (pushing the rest down) or the end.
 * above/below/leftOf/rightOf: relative to `anchor`; beside-placements use the
 * same row when there is room, otherwise go underneath.
 */
function place(layout: HomeWidgetItem[], item: HomeWidgetItem, placement: Placement, anchor?: HomeWidgetItem): HomeWidgetItem[] {
  if (placement === 'top') return [{ ...item, x: 0, y: 0 }, ...layout.map(w => ({ ...w, y: w.y + item.h }))];
  if (placement === 'bottom' || !anchor) {
    const maxY = layout.reduce((m, w) => Math.max(m, w.y + w.h), 0);
    return [...layout, { ...item, x: 0, y: maxY }];
  }
  if (placement === 'above') {
    const moved = layout.map(w => (w.y >= anchor.y ? { ...w, y: w.y + item.h } : w));
    return [...moved, dropIn(moved, { ...item, x: anchor.x }, anchor.y)];
  }
  if (placement !== 'below') {
    const x = placement === 'rightOf' ? anchor.x + anchor.w : anchor.x - item.w;
    if (x >= 0 && x + item.w <= GRID_COLS) {
      const candidate = { ...item, x, y: anchor.y };
      if (!layout.some(w => overlaps(candidate, w))) return [...layout, candidate];
    }
  }
  // below, or no room beside: go underneath the anchor.
  const moved = layout.map(w => (w.y >= anchor.y + anchor.h ? { ...w, y: w.y + item.h } : w));
  return [...moved, dropIn(moved, { ...item, x: anchor.x }, anchor.y + anchor.h)];
}

/** Lay the given rows out top to bottom; each row shares the width, scaled from the widgets' current widths. */
function arrangeRows(layout: HomeWidgetItem[], rows: string[][], index: number): HomeWidgetItem[] {
  const byId = new Map(layout.map(w => [w.i, w]));
  const seen = new Set<string>();
  const out: HomeWidgetItem[] = [];
  let y = 0;
  for (const row of rows) {
    const items = row.map(id => {
      const w = byId.get(id);
      if (!w) throw new OpError(index, `no widget with id "${id}" on that page`);
      if (seen.has(id)) throw new OpError(index, `widget "${id}" listed twice`);
      seen.add(id);
      return w;
    });
    const total = items.reduce((n, w) => n + w.w, 0);
    const widths = items.map(w => Math.max(WIDGET_CATALOG[w.type]?.minSize.w ?? 2, Math.round((w.w / total) * GRID_COLS)));
    // Rounding and minimums can leave a gap or an overrun: settle it on the widest widget.
    const used = widths.reduce((a, b) => a + b, 0);
    const widest = widths.indexOf(Math.max(...widths));
    widths[widest] = Math.max(1, widths[widest] + GRID_COLS - used);
    const rowH = Math.max(...items.map(w => w.h));
    let x = 0;
    items.forEach((w, i) => { out.push({ ...w, x, y, w: widths[i] }); x += widths[i]; });
    y += rowH;
  }
  // Anything the model left out keeps its order, appended underneath.
  for (const w of layout) if (!seen.has(w.i)) { out.push({ ...w, x: 0, y }); y += w.h; }
  return out;
}

function makeWidget(page: 'home' | 'topic', layout: HomeWidgetItem[], spec: { type: HomeWidgetItem['type']; size: { w: number; h: number } | null; config: WidgetConfigInput | null }, index: number): HomeWidgetItem {
  const meta = WIDGET_CATALOG[spec.type];
  if (!meta || meta.hidden) throw new OpError(index, `"${spec.type}" is not a widget that can be added`);
  if (!allowedOn(spec.type, page)) throw new OpError(index, `${meta.label} can only go on ${meta.where === 'home' ? 'Home' : 'a topic page'}`);
  if (!meta.allowMultiple && layout.some(w => w.type === spec.type)) throw new OpError(index, `this page already has a ${meta.label} widget, and only one is allowed`);
  const w = Math.min(GRID_COLS, Math.max(meta.minSize.w, spec.size?.w ?? meta.defaultSize.w));
  const h = Math.max(meta.minSize.h, spec.size?.h ?? meta.defaultSize.h);
  // New notes and links own their content (see TopicNoteWidget / TopicLinksWidget).
  const seed: Record<string, unknown> = spec.type === 'topicNote' ? { note: '' } : spec.type === 'topicLinks' ? { links: [] } : {};
  const config = cleanConfig(spec.type, spec.config, seed);
  return { i: freshWidgetId(spec.type), type: spec.type, x: 0, y: 0, w, h, ...(Object.keys(config).length ? { config } : {}) };
}

function setLayout(s: AssistantStore, page: 'home' | string, layout: HomeWidgetItem[]): AssistantStore {
  if (page === 'home') return { ...s, homeLayout: layout };
  return { ...s, topics: s.topics.map(t => (t.id === page ? { ...t, widgetLayout: layout } : t)) };
}
function getLayout(s: AssistantStore, page: 'home' | string, index: number): HomeWidgetItem[] {
  if (page === 'home') return s.homeLayout;
  return requireTopic(s, page, index).widgetLayout ?? [{ i: 'topicTodos', type: 'topicTodos', x: 0, y: 0, w: 8, h: 12 }];
}

function applyOne(s: AssistantStore, op: Op, index: number): AssistantStore {
  switch (op.op) {
    case 'add_widget': {
      const kind = op.page === 'home' ? 'home' : 'topic';
      const layout = getLayout(s, op.page, index);
      const item = makeWidget(kind, layout, op, index);
      const anchor = op.anchorId ? layout.find(w => w.i === op.anchorId) : undefined;
      if (op.anchorId && !anchor) throw new OpError(index, `no widget with id "${op.anchorId}" on that page`);
      return setLayout(s, op.page, place(layout, item, op.placement ?? 'bottom', anchor));
    }
    case 'configure_widget': {
      const loc = findWidget(s, op.widgetId);
      if (!loc) throw new OpError(index, `no widget with id "${op.widgetId}"`);
      const config = cleanConfig(loc.item.type, op.config, loc.item.config ?? {});
      const layout = getLayout(s, loc.page, index).map(w => (w.i === op.widgetId ? { ...w, config } : w));
      return setLayout(s, loc.page, layout);
    }
    case 'move_widget': {
      const loc = findWidget(s, op.widgetId);
      if (!loc) throw new OpError(index, `no widget with id "${op.widgetId}"`);
      const meta = WIDGET_CATALOG[loc.item.type];
      let item = loc.item;
      if (op.size) item = { ...item, w: Math.min(GRID_COLS, Math.max(meta.minSize.w, op.size.w)), h: Math.max(meta.minSize.h, op.size.h) };
      let layout = getLayout(s, loc.page, index).map(w => (w.i === op.widgetId ? item : w));
      if (op.placement) {
        const rest = layout.filter(w => w.i !== op.widgetId);
        const anchor = op.anchorId ? rest.find(w => w.i === op.anchorId) : undefined;
        if (op.anchorId && !anchor) throw new OpError(index, `no widget with id "${op.anchorId}" on that page`);
        layout = place(rest, item, op.placement, anchor);
      }
      return setLayout(s, loc.page, layout);
    }
    case 'arrange_page': {
      return setLayout(s, op.page, arrangeRows(getLayout(s, op.page, index), op.rows, index));
    }
    case 'remove_widget': {
      const loc = findWidget(s, op.widgetId);
      if (!loc) throw new OpError(index, `no widget with id "${op.widgetId}"`);
      if (loc.item.type === 'topicTodos') throw new OpError(index, 'the task list cannot be removed from a page');
      return setLayout(s, loc.page, getLayout(s, loc.page, index).filter(w => w.i !== op.widgetId));
    }
    case 'create_page': {
      if (op.folderId && !s.topicFolders.some(f => f.id === op.folderId)) throw new OpError(index, `no folder with id "${op.folderId}"`);
      const stageNames = op.stages ?? ['To do', 'Doing', 'Done'];
      const stages = stageNames.map((label, i) => ({ id: freshId('stg'), label, done: i === stageNames.length - 1 }));
      let layout: HomeWidgetItem[] = [{ i: 'topicTodos', type: 'topicTodos', x: 0, y: 0, w: 8, h: 12 }];
      for (const spec of op.widgets ?? []) {
        if (spec.type === 'topicTodos') continue;
        layout = place(layout, makeWidget('topic', layout, spec, index), 'bottom');
      }
      const topic: Topic = {
        id: freshId('topic'),
        name: op.name,
        color: op.color ?? s.appearance.colorBank?.[s.topics.length % Math.max(1, s.appearance.colorBank.length)] ?? '#7da7d9',
        icon: op.icon ?? 'list',
        keywords: [],
        stages,
        items: [],
        order: s.topics.length,
        sortMode: 'manual',
        widgetLayout: layout,
        ...(op.folderId ? { folderId: op.folderId } : {}),
        ...(op.description ? { description: op.description } : {}),
        ...(op.pageTitle ? { pageTitle: op.pageTitle } : {}),
        ...(op.pageTitleSize && op.pageTitleSize !== 'm' ? { pageTitleSize: op.pageTitleSize } : {}),
        ...(op.pageTitleColor ? { pageTitleColor: op.pageTitleColor } : {}),
      };
      return { ...s, topics: [...s.topics, topic] };
    }
    case 'update_page': {
      requireTopic(s, op.topicId, index);
      if (op.folderId && op.folderId !== 'none' && !s.topicFolders.some(f => f.id === op.folderId)) throw new OpError(index, `no folder with id "${op.folderId}"`);
      return {
        ...s,
        topics: s.topics.map(t => {
          if (t.id !== op.topicId) return t;
          const next: Topic = { ...t };
          if (op.name !== null) next.name = op.name;
          if (op.folderId !== null) { if (op.folderId === 'none') delete next.folderId; else next.folderId = op.folderId; }
          if (op.icon !== null) next.icon = op.icon;
          if (op.color !== null) next.color = op.color;
          if (op.description !== null) next.description = op.description || undefined;
          if (op.pageTitle !== null) next.pageTitle = op.pageTitle || undefined;
          if (op.pageTitleSize !== null) next.pageTitleSize = op.pageTitleSize === 'm' ? undefined : op.pageTitleSize;
          if (op.pageTitleColor !== null) next.pageTitleColor = op.pageTitleColor;
          if (op.status !== null) {
            if (op.status === 'none') { delete next.status; delete next.statusAt; }
            else { next.status = op.status; next.statusAt = Date.now(); }
          }
          return next;
        }),
      };
    }
    case 'delete_page': {
      requireTopic(s, op.topicId, index);
      return {
        ...s,
        topics: s.topics.filter(t => t.id !== op.topicId).map((t, i) => ({ ...t, order: i })),
        habits: s.habits.map(h => (h.topicId === op.topicId ? { ...h, topicId: undefined } : h)),
      };
    }
    case 'create_folder': {
      const folder: TopicFolder = {
        id: freshId('folder'), name: op.name, order: s.topicFolders.length, collapsed: false,
        ...(op.color ? { color: op.color } : {}), ...(op.icon ? { icon: op.icon } : {}),
      };
      return { ...s, topicFolders: [...s.topicFolders, folder] };
    }
    case 'set_appearance': {
      const a: AppearancePrefs = { ...s.appearance };
      if (op.colorBank !== null) a.colorBank = op.colorBank;
      if (op.mood !== null) a.mood = op.mood;
      if (op.font !== null) a.font = op.font;
      if (op.fontSize !== null) a.fontSize = op.fontSize;
      if (op.widgetShape !== null) a.widgetShape = op.widgetShape;
      if (op.widgetBorder !== null) a.widgetBorder = op.widgetBorder;
      return { ...s, appearance: a };
    }
    case 'set_background': {
      const isApp = op.target === 'app';
      if (!isApp) requireTopic(s, op.target, index);
      if (op.remove) {
        if (isApp) { const { appBackground: _bg, ...rest } = s.appearance; return { ...s, appearance: rest }; }
        return { ...s, topics: s.topics.map(t => { if (t.id !== op.target) return t; const { pageBg: _bg, ...rest } = t; return rest; }) };
      }
      let url: string;
      if (op.worldId) {
        const w = findWorld(op.worldId);
        if (!w) throw new OpError(index, `no world with id "${op.worldId}"`);
        url = w.background.url;
      } else if (op.colors && op.colors.length) {
        url = gradientWallpaper(op.colors);
      } else {
        throw new OpError(index, 'set_background needs colors or a worldId (or remove: true)');
      }
      const dim = op.dim ?? 0.35;
      if (isApp) return { ...s, appearance: { ...s.appearance, appBackground: { url, dim } } };
      return { ...s, topics: s.topics.map(t => (t.id === op.target ? { ...t, pageBg: { url, dim } } : t)) };
    }
    case 'set_readability': {
      if (op.reset) { const { readability: _r, ...rest } = s.appearance; return { ...s, appearance: rest }; }
      const r = { ...(s.appearance.readability ?? {}) };
      if (op.lineHeight !== null) r.lineHeight = op.lineHeight;
      if (op.letterSpacing !== null) r.letterSpacing = op.letterSpacing;
      if (op.wordSpacing !== null) r.wordSpacing = op.wordSpacing;
      if (op.reducedMotion !== null) r.reducedMotion = op.reducedMotion;
      return { ...s, appearance: { ...s.appearance, readability: r } };
    }
    case 'apply_world': {
      const world = findWorld(op.worldId);
      if (!world) throw new OpError(index, `no world with id "${op.worldId}"`);
      if (op.scope === 'global') return { ...s, appearance: applyWorld(world, s.appearance) };
      if (op.scope === 'newPage') {
        const topic = worldToTopic(world, op.name ?? world.name, s.topics.length);
        return { ...s, topics: [...s.topics, topic] };
      }
      if (!op.topicId) throw new OpError(index, 'existingPage needs a topicId');
      const target = requireTopic(s, op.topicId, index);
      const { widgetLayout: templateLayout, ...patch } = worldTopicPatch(world);
      // The world's look applies; its widgets are added only where the page
      // has none of that type. Nothing already on the page is removed: the
      // assistant may never drop a widget unless the user asked (remove_widget).
      let layout = target.widgetLayout ?? [];
      for (const w of templateLayout ?? []) {
        if (layout.some(x => x.type === w.type)) continue;
        layout = place(layout, { ...w, i: freshWidgetId(w.type) }, 'bottom');
      }
      return { ...s, topics: s.topics.map(t => (t.id === op.topicId ? { ...t, ...patch, widgetLayout: layout } : t)) };
    }
    case 'edit_note': {
      if (op.target === 'page') {
        const t = requireTopic(s, op.id, index);
        const text = op.mode === 'append' && t.pinnedNote ? `${t.pinnedNote}\n${op.text}` : op.text;
        return { ...s, topics: s.topics.map(tp => (tp.id === op.id ? { ...tp, pinnedNote: text || undefined, pinnedNoteHtml: undefined } : tp)) };
      }
      const loc = findWidget(s, op.id);
      if (!loc) throw new OpError(index, `no widget with id "${op.id}"`);
      if (loc.item.type !== 'topicNote') throw new OpError(index, `widget "${op.id}" is not a Note`);
      const existing = typeof loc.item.config?.note === 'string' ? loc.item.config.note : '';
      const text = op.mode === 'append' && existing ? `${existing}\n${op.text}` : op.text;
      const layout = getLayout(s, loc.page, index).map(w => (w.i === op.id ? { ...w, config: { ...(w.config ?? {}), note: text, noteHtml: undefined } } : w));
      return setLayout(s, loc.page, layout);
    }
    case 'add_task': {
      const t = requireTopic(s, op.topicId, index);
      const stage = op.stageId ? t.stages.find(st => st.id === op.stageId) : t.stages.find(st => !st.done) ?? t.stages[0];
      if (!stage) throw new OpError(index, op.stageId ? `no stage "${op.stageId}" on that page` : 'that page has no stages');
      const deadline = op.deadline ? strictLocalMidnight(op.deadline) : null;
      if (op.deadline && deadline === null) throw new OpError(index, `bad deadline "${op.deadline}"`);
      const item: TopicItem = { id: freshItemId(), text: op.text, stageId: stage.id, completedAt: null, deadline };
      return { ...s, topics: s.topics.map(tp => (tp.id === op.topicId ? { ...tp, items: [...tp.items, item] } : tp)) };
    }
    case 'complete_task': {
      const t = requireTopic(s, op.topicId, index);
      const done = t.stages.find(st => st.done);
      if (!done) throw new OpError(index, 'that page has no Done stage');
      if (!t.items.some(i => i.id === op.itemId)) throw new OpError(index, `no task ${op.itemId} on that page`);
      return { ...s, topics: s.topics.map(tp => (tp.id === op.topicId ? { ...tp, items: tp.items.map(i => (i.id === op.itemId ? { ...i, stageId: done.id, completedAt: Date.now() } : i)) } : tp)) };
    }
    case 'add_habit': {
      if (op.topicId) requireTopic(s, op.topicId, index);
      const color = op.color ?? (op.topicId ? s.topics.find(t => t.id === op.topicId)?.color : undefined) ?? '#a8c4a0';
      const habit: Habit = {
        id: freshId('h'), name: op.name, color, activeDays: op.frequency === 'weekly' ? [] : (op.days ?? []),
        entries: {}, order: s.habits.length,
        ...(op.topicId ? { topicId: op.topicId } : {}),
        ...(op.frequency === 'weekly' ? { frequency: 'weekly' as const } : {}),
      };
      return { ...s, habits: [...s.habits, habit] };
    }
  }
}

/** A fresh seed for one assistant turn: pass the same one to every applyOps run of that turn. */
export function newOpSeed(): string {
  return String(Date.now());
}

/**
 * Apply every op in order. Throws OpError (with the op's index) on the first
 * bad one; the store is untouched. `seed` makes generated ids reproducible:
 * the same ops with the same seed always create the same ids.
 */
export function applyOps(store: AssistantStore, ops: Op[], seed: string = newOpSeed()): AssistantStore {
  seedMs = Number(seed) || Date.now();
  seedTag = seedMs.toString(36);
  seq = 0;
  let s = store;
  ops.forEach((op, i) => { s = applyOne(s, op, i); });
  return s;
}
