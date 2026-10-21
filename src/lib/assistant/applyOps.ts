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
import { findWorld, applyWorld, worldToTopic, worldTopicPatch } from '../worlds';
import { nextId } from '../ids';
import type { AssistantStore } from './store';
import type { Op, WidgetConfigInput } from './ops';

export class OpError extends Error {
  constructor(public index: number, message: string) {
    super(message);
    this.name = 'OpError';
  }
}

let seq = 0;
/** Unique per call even inside one millisecond (two widgets in one batch). */
function freshWidgetId(type: string): string {
  seq += 1;
  return `${type}-${Date.now().toString(36)}-${seq}`;
}
function freshId(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}${Math.random().toString(36).slice(2, 5)}`;
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

/** Appends at the bottom (or the top, pushing everything down). Never overlaps. */
function place(layout: HomeWidgetItem[], item: HomeWidgetItem, placement: 'top' | 'bottom'): HomeWidgetItem[] {
  if (placement === 'top') return [{ ...item, x: 0, y: 0 }, ...layout.map(w => ({ ...w, y: w.y + item.h }))];
  const maxY = layout.reduce((m, w) => Math.max(m, w.y + w.h), 0);
  return [...layout, { ...item, x: 0, y: maxY }];
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
      return setLayout(s, op.page, place(layout, item, op.placement ?? 'bottom'));
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
      if (op.placement) layout = place(layout.filter(w => w.i !== op.widgetId), item, op.placement);
      return setLayout(s, loc.page, layout);
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
      if (op.mood !== null) a.mood = op.mood;
      if (op.font !== null) a.font = op.font;
      if (op.fontSize !== null) a.fontSize = op.fontSize;
      if (op.widgetShape !== null) a.widgetShape = op.widgetShape;
      if (op.widgetBorder !== null) a.widgetBorder = op.widgetBorder;
      return { ...s, appearance: a };
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
      requireTopic(s, op.topicId, index);
      const patch = worldTopicPatch(world);
      return { ...s, topics: s.topics.map(t => (t.id === op.topicId ? { ...t, ...patch } : t)) };
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
      const item: TopicItem = { id: nextId(), text: op.text, stageId: stage.id, completedAt: null, deadline };
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

/** Apply every op in order. Throws OpError (with the op's index) on the first bad one; the store is untouched. */
export function applyOps(store: AssistantStore, ops: Op[]): AssistantStore {
  let s = store;
  ops.forEach((op, i) => { s = applyOne(s, op, i); });
  return s;
}
