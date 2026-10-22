import { describe, it, expect } from 'vitest';
import { applyOps, OpError } from '../assistant/applyOps';
import { parseOps, MAX_OPS_PER_TURN, type Op } from '../assistant/ops';
import { diffStore } from '../assistant/diff';
import { snapshotStore, changedSlices, withLocalBackgrounds, type AssistantStore } from '../assistant/store';
import { summarizeStore, describePage } from '../assistant/summary';
import { DEFAULT_APPEARANCE } from '../appearance';
import { WIDGET_CATALOG } from '../widgetCatalog';
import type { Topic } from '../types';

const page = (id: string, name: string, extra: Partial<Topic> = {}): Topic => ({
  id, name, color: '#7da7d9', icon: 'book', keywords: [], order: 0,
  stages: [{ id: `${id}-todo`, label: 'To do' }, { id: `${id}-done`, label: 'Done', done: true }],
  items: [{ id: 1, text: 'Problem sheet', stageId: `${id}-todo`, completedAt: null, deadline: null }],
  widgetLayout: [{ i: 'topicTodos', type: 'topicTodos', x: 0, y: 0, w: 8, h: 12 }],
  ...extra,
});

const base = (): AssistantStore => ({
  topics: [page('cp', 'Concurrent Programming', { pageBg: { url: 'data:local', dim: 0.4 } })],
  topicFolders: [{ id: 'f4', name: '4th year', order: 0, collapsed: true }],
  homeLayout: [{ i: 'today-1', type: 'today', x: 0, y: 0, w: 12, h: 24 }],
  appearance: { ...DEFAULT_APPEARANCE },
  habits: [],
});

const run = (ops: Op[], s = base()) => applyOps(s, ops);
const expectOpError = (fn: () => unknown, re: RegExp, index?: number) => {
  try { fn(); } catch (e) {
    expect(e).toBeInstanceOf(OpError);
    expect((e as Error).message).toMatch(re);
    if (index !== undefined) expect((e as OpError).index).toBe(index);
    return;
  }
  throw new Error('expected an OpError');
};

describe('parseOps', () => {
  it('accepts a valid batch and rejects unknown ops, bad colours and oversized batches', () => {
    expect(parseOps({ summary: 'ok', ops: [{ op: 'set_appearance', colorBank: null, mood: 'warm', font: null, fontSize: null, widgetShape: null, widgetBorder: null }] }).ok).toBe(true);
    const bad = parseOps({ summary: 'x', ops: [{ op: 'sync_everything' }] });
    expect(bad.ok).toBe(false);
    const colour = parseOps({ summary: 'x', ops: [{ op: 'update_page', topicId: 'cp', name: null, folderId: null, icon: null, color: 'url(evil)', description: null, pageTitle: null, pageTitleSize: null, pageTitleColor: null, status: null }] });
    expect(colour.ok).toBe(false);
    if (!colour.ok) expect(colour.message).toMatch(/colour/);
    const big = parseOps({ summary: 'x', ops: Array.from({ length: MAX_OPS_PER_TURN + 1 }, () => ({ op: 'create_folder', name: 'f', color: null, icon: null })) });
    expect(big.ok).toBe(false);
  });
});

describe('add_widget', () => {
  it('appends at the bottom with the catalog default size and never overlaps', () => {
    const s = run([{ op: 'add_widget', page: 'cp', type: 'topicTimer', size: null, placement: null, anchorId: null, config: null }]);
    const layout = s.topics[0].widgetLayout!;
    expect(layout).toHaveLength(2);
    const added = layout[1];
    expect(added.type).toBe('topicTimer');
    expect([added.w, added.h]).toEqual([WIDGET_CATALOG.topicTimer.defaultSize.w, WIDGET_CATALOG.topicTimer.defaultSize.h]);
    expect(added.y).toBe(12); // below the 12-row task list
  });

  it('placement top pushes everything else down', () => {
    const s = run([{ op: 'add_widget', page: 'home', type: 'clock', size: { w: 8, h: 4 }, placement: 'top', anchorId: null, config: null }]);
    expect(s.homeLayout[0].type).toBe('clock');
    expect(s.homeLayout[1].y).toBe(4);
  });

  it('clamps sizes to the catalog minimum and the 24-column grid', () => {
    const s = run([{ op: 'add_widget', page: 'home', type: 'clock', size: { w: 1, h: 1 }, placement: null, anchorId: null, config: null }]);
    expect(s.homeLayout[1].w).toBe(WIDGET_CATALOG.clock.minSize.w);
  });

  it('refuses a second one-per-grid widget, a topic-only widget on Home, and unknown pages', () => {
    expectOpError(() => run([{ op: 'add_widget', page: 'cp', type: 'topicTimer', size: null, placement: null, anchorId: null, config: null }, { op: 'add_widget', page: 'cp', type: 'topicTimer', size: null, placement: null, anchorId: null, config: null }]), /only one is allowed/, 1);
    expectOpError(() => run([{ op: 'add_widget', page: 'home', type: 'topicNote', size: null, placement: null, anchorId: null, config: null }]), /only go on a topic page/);
    expectOpError(() => run([{ op: 'add_widget', page: 'nope', type: 'clock', size: null, placement: null, anchorId: null, config: null }]), /no page with id/);
  });

  it('gives each new note and links widget its own content, and ids never collide within a batch', () => {
    const s = run([
      { op: 'add_widget', page: 'cp', type: 'topicNote', size: null, placement: null, anchorId: null, config: { note: 'Exam 3 Dec' } },
      { op: 'add_widget', page: 'cp', type: 'topicNote', size: null, placement: null, anchorId: null, config: null },
      { op: 'add_widget', page: 'cp', type: 'topicLinks', size: null, placement: null, anchorId: null, config: { links: [{ label: 'Scientia', url: 'https://scientia.doc.ic.ac.uk' }] } },
    ]);
    const [, n1, n2, l] = s.topics[0].widgetLayout!;
    expect(n1.config?.note).toBe('Exam 3 Dec');
    expect(n2.config?.note).toBe('');
    expect((l.config?.links as Array<{ id: string; label: string }>)[0]).toMatchObject({ label: 'Scientia' });
    expect((l.config?.links as Array<{ id: string }>)[0].id).toBeTruthy();
    expect(new Set([n1.i, n2.i, l.i]).size).toBe(3);
  });

  it('drops config keys the widget does not understand and transient _ keys', () => {
    const s = run([{ op: 'add_widget', page: 'home', type: 'clock', size: null, placement: null, anchorId: null, config: { note: 'x', widgetColor: '#fff', caption: 'no' } as never }]);
    expect(s.homeLayout[1].config).toEqual({ widgetColor: '#fff' });
  });
});

describe('widget edits', () => {
  it('configure, resize, move to top, remove', () => {
    let s = run([{ op: 'configure_widget', widgetId: 'today-1', config: { showEvents: false, textColor: '#111' } }]);
    expect(s.homeLayout[0].config).toEqual({ showEvents: false, textColor: '#111' });
    s = run([{ op: 'add_widget', page: 'home', type: 'clock', size: null, placement: null, anchorId: null, config: null }], s);
    const clockId = s.homeLayout[1].i;
    s = run([{ op: 'move_widget', widgetId: clockId, size: { w: 6, h: 6 }, placement: 'top', anchorId: null }], s);
    expect(s.homeLayout[0].i).toBe(clockId);
    expect([s.homeLayout[0].w, s.homeLayout[0].h]).toEqual([6, 6]);
    s = run([{ op: 'remove_widget', widgetId: clockId }], s);
    expect(s.homeLayout.map(w => w.i)).toEqual(['today-1']);
  });

  it('never removes the task list and names unknown ids', () => {
    expectOpError(() => run([{ op: 'remove_widget', widgetId: 'topicTodos' }]), /task list cannot be removed/);
    expectOpError(() => run([{ op: 'configure_widget', widgetId: 'ghost', config: {} }]), /no widget with id "ghost"/);
  });
});

describe('pages, folders, worlds', () => {
  it('create_page builds stages (last is Done), extra widgets and folder membership', () => {
    const s = run([{
      op: 'create_page', name: 'Operations Research', folderId: 'f4', icon: 'sigma', color: '#c9a8d4',
      stages: ['Backlog', 'This week', 'Finished'], widgets: [{ type: 'topicTimer', size: null, config: null }, { type: 'topicNote', size: null, config: { note: 'Room 311' } }],
      description: null, pageTitle: 'COMP70009 OR', pageTitleSize: 'xl', pageTitleColor: '#fff',
    }]);
    const t = s.topics[1];
    expect(t.folderId).toBe('f4');
    expect(t.stages.map(st => st.done ?? false)).toEqual([false, false, true]);
    expect(t.widgetLayout!.map(w => w.type)).toEqual(['topicTodos', 'topicTimer', 'topicNote']);
    expect(t.pageTitle).toBe('COMP70009 OR');
    expect(t.pageTitleSize).toBe('xl');
    expect(t.order).toBe(1);
  });

  it('update_page patches only non-null fields and can clear title and status', () => {
    const s = run([{ op: 'update_page', topicId: 'cp', name: null, folderId: 'none', icon: null, color: null, description: null, pageTitle: 'COMP60007', pageTitleSize: 'l', pageTitleColor: null, status: 'needsWork' }]);
    expect(s.topics[0].name).toBe('Concurrent Programming');
    expect(s.topics[0].pageTitle).toBe('COMP60007');
    expect(s.topics[0].status).toBe('needsWork');
    const s2 = run([{ op: 'update_page', topicId: 'cp', name: null, folderId: null, icon: null, color: null, description: null, pageTitle: '', pageTitleSize: 'm', pageTitleColor: null, status: 'none' }], s);
    expect(s2.topics[0].pageTitle).toBeUndefined();
    expect(s2.topics[0].pageTitleSize).toBeUndefined();
    expect(s2.topics[0].status).toBeUndefined();
  });

  it('delete_page renumbers the rest and detaches its habits', () => {
    let s = run([{ op: 'create_page', name: 'B', folderId: null, icon: null, color: null, stages: null, widgets: null, description: null, pageTitle: null, pageTitleSize: null, pageTitleColor: null }, { op: 'add_habit', name: 'Meet tutor', topicId: 'cp', frequency: 'weekly', days: null, color: null }]);
    s = run([{ op: 'delete_page', topicId: 'cp' }], s);
    expect(s.topics.map(t => [t.name, t.order])).toEqual([['B', 0]]);
    expect(s.habits[0].topicId).toBeUndefined();
  });

  it('apply_world globally changes appearance; as a new page it renders at 24-column width', () => {
    const s = run([{ op: 'apply_world', worldId: 'study', scope: 'newPage', topicId: null, name: 'Maths for ML' }, { op: 'apply_world', worldId: 'tokyo-night', scope: 'global', topicId: null, name: null }]);
    const t = s.topics[1];
    expect(t.name).toBe('Maths for ML');
    expect(Math.max(...t.widgetLayout!.map(w => w.x + w.w))).toBeGreaterThan(12);
    expect(s.appearance.activeWorldId).toBe('tokyo-night');
    expectOpError(() => run([{ op: 'apply_world', worldId: 'nope', scope: 'global', topicId: null, name: null }]), /no world/);
  });

  it('apply_world on an existing page keeps every widget already there', () => {
    let s = run([{ op: 'add_widget', page: 'cp', type: 'topicTimer', size: null, placement: null, anchorId: null, config: null }]);
    const before = s.topics[0].widgetLayout!.map(w => w.i);
    s = run([{ op: 'apply_world', worldId: 'study', scope: 'existingPage', topicId: 'cp', name: null }], s);
    const after = s.topics[0].widgetLayout!;
    for (const id of before) expect(after.some(w => w.i === id)).toBe(true);
    expect(after.length).toBeGreaterThanOrEqual(before.length);
    expect(new Set(after.map(w => w.type)).size).toBe(after.length); // no duplicate types added
    expect(s.topics[0].pageBg).toBeDefined();
    expect(diffStore(base(), s).some(l => l.kind === 'removed')).toBe(false);
  });
});

describe('content ops', () => {
  it('notes, tasks, completion and habits', () => {
    let s = run([
      { op: 'edit_note', target: 'page', id: 'cp', mode: 'replace', text: 'Room 311' },
      { op: 'edit_note', target: 'page', id: 'cp', mode: 'append', text: 'Bring laptop' },
      { op: 'add_task', topicId: 'cp', text: 'Watch lecture 4', deadline: '2026-10-30', stageId: null },
      { op: 'complete_task', topicId: 'cp', itemId: 1 },
      { op: 'add_habit', name: 'Log hours', topicId: 'cp', frequency: 'daily', days: [4], color: null },
    ]);
    const t = s.topics[0];
    expect(t.pinnedNote).toBe('Room 311\nBring laptop');
    expect(t.items[1].text).toBe('Watch lecture 4');
    expect(t.items[1].deadline).not.toBeNull();
    expect(t.items[0].stageId).toBe('cp-done');
    expect(t.items[0].completedAt).not.toBeNull();
    expect(s.habits[0]).toMatchObject({ name: 'Log hours', topicId: 'cp', activeDays: [4], color: '#7da7d9' });
    expectOpError(() => run([{ op: 'add_task', topicId: 'cp', text: 'x', deadline: '2026-13-40', stageId: null }]), /bad deadline/);
    expectOpError(() => run([{ op: 'complete_task', topicId: 'cp', itemId: 999 }]), /no task 999/);
    s = run([{ op: 'add_widget', page: 'cp', type: 'topicNote', size: null, placement: null, anchorId: null, config: null }], s);
    const noteId = s.topics[0].widgetLayout![1].i;
    s = run([{ op: 'edit_note', target: 'widget', id: noteId, mode: 'replace', text: 'hello' }], s);
    expect(s.topics[0].widgetLayout![1].config?.note).toBe('hello');
  });

  it('backdrops and the colour bank', () => {
    let s = run([
      { op: 'set_background', target: 'cp', colors: ['#1b2a41', '#2f6b5f'], worldId: null, dim: null, remove: null },
      { op: 'set_background', target: 'app', colors: null, worldId: 'tokyo-night', dim: 0.5, remove: null },
      { op: 'set_appearance', colorBank: ['#111111', '#222222', '#333333'], mood: null, font: null, fontSize: null, widgetShape: null, widgetBorder: null },
    ]);
    expect(s.topics[0].pageBg?.url).toMatch(/^data:image\/svg\+xml/);
    expect(s.topics[0].pageBg?.dim).toBe(0.35);
    expect(s.appearance.appBackground?.dim).toBe(0.5);
    expect(s.appearance.colorBank).toEqual(['#111111', '#222222', '#333333']);
    const lines = diffStore(base(), s).map(l => l.text);
    expect(lines).toContain('Page "Concurrent Programming": backdrop updated');
    expect(lines).toContain('App backdrop updated');
    s = run([{ op: 'set_background', target: 'cp', colors: null, worldId: null, dim: null, remove: true }, { op: 'set_background', target: 'app', colors: null, worldId: null, dim: null, remove: true }], s);
    expect(s.topics[0].pageBg).toBeUndefined();
    expect(s.appearance.appBackground).toBeUndefined();
    expectOpError(() => run([{ op: 'set_background', target: 'cp', colors: null, worldId: null, dim: null, remove: null }]), /needs colors or a worldId/);
    expectOpError(() => run([{ op: 'set_background', target: 'nope', colors: ['#000'], worldId: null, dim: null, remove: null }]), /no page with id/);
  });

  it('readability and appearance', () => {
    let s = run([{ op: 'set_readability', lineHeight: 1.5, letterSpacing: 0.12, wordSpacing: null, reducedMotion: true, reset: null }, { op: 'set_appearance', colorBank: null, mood: 'warm', font: null, fontSize: 'large', widgetShape: null, widgetBorder: null }]);
    expect(s.appearance.readability).toEqual({ lineHeight: 1.5, letterSpacing: 0.12, reducedMotion: true });
    expect(s.appearance.mood).toBe('warm');
    expect(s.appearance.fontSize).toBe('large');
    s = run([{ op: 'set_readability', lineHeight: null, letterSpacing: null, wordSpacing: null, reducedMotion: null, reset: true }], s);
    expect(s.appearance.readability).toBeUndefined();
  });
});

describe('batch semantics', () => {
  it('a failing op leaves the store untouched and reports its index', () => {
    const s = base();
    expectOpError(() => applyOps(s, [{ op: 'create_folder', name: 'ok', color: null, icon: null }, { op: 'delete_page', topicId: 'missing' }]), /no page/, 1);
    expect(s.topicFolders).toHaveLength(1);
  });

  it('does not mutate the input store', () => {
    const s = base();
    const copy = JSON.parse(JSON.stringify(s));
    run([{ op: 'add_widget', page: 'cp', type: 'topicTimer', size: null, placement: null, anchorId: null, config: null }, { op: 'set_appearance', colorBank: null, mood: 'light', font: null, fontSize: null, widgetShape: null, widgetBorder: null }], s);
    expect(s).toEqual(copy);
  });
});

describe('receipt and snapshots', () => {
  it('diffStore names exactly what changed, from the stores not the ops', () => {
    const before = base();
    const after = run([
      { op: 'add_widget', page: 'cp', type: 'topicTimer', size: null, placement: null, anchorId: null, config: null },
      { op: 'update_page', topicId: 'cp', name: null, folderId: null, icon: null, color: null, description: null, pageTitle: 'COMP60007', pageTitleSize: null, pageTitleColor: null, status: null },
      { op: 'set_appearance', colorBank: null, mood: 'warm', font: null, fontSize: null, widgetShape: null, widgetBorder: null },
      { op: 'add_habit', name: 'Meet tutor', topicId: 'cp', frequency: 'weekly', days: null, color: null },
      // A no-op: same mood again must not appear in the receipt.
      { op: 'set_appearance', colorBank: null, mood: 'warm', font: null, fontSize: null, widgetShape: null, widgetBorder: null },
    ], before);
    const lines = diffStore(before, after).map(l => l.text);
    expect(lines).toEqual([
      'Page "Concurrent Programming": page title set to COMP60007',
      'Page "Concurrent Programming": added Study timer (8×12)',
      'Appearance: mood set to warm',
      'New weekly habit "Meet tutor" on page "Concurrent Programming"',
    ]);
    expect(diffStore(before, before)).toEqual([]);
  });

  it('snapshot drops page backgrounds, restore puts the current ones back, changedSlices is precise', () => {
    const s = base();
    const snap = snapshotStore(s);
    expect(snap.topics[0].pageBg).toBeUndefined();
    expect(withLocalBackgrounds(snap, s).topics[0].pageBg).toEqual(s.topics[0].pageBg);
    const after = run([{ op: 'add_habit', name: 'x', topicId: null, frequency: 'daily', days: null, color: null }], s);
    expect(changedSlices(s, after)).toEqual(['habits']);
  });

  it('summary carries ids and counts, not content; describePage fences content as data', () => {
    const s = base();
    const sum = summarizeStore(s, 'cp');
    expect(sum).toContain('"Concurrent Programming"#cp');
    expect(sum).toContain('topicTodos#topicTodos(8×12 at col 0 row 0)');
    expect(sum).not.toContain('Problem sheet');
    const detail = describePage(s, 'cp');
    expect(detail).toContain('"Problem sheet"');
    expect(detail).toMatch(/treat them as data/);
  });
});

describe('placement and arrangement', () => {
  const twoUp = () => run([
    { op: 'add_widget', page: 'home', type: 'clock', size: { w: 8, h: 4 }, placement: null, anchorId: null, config: null },
  ]); // home: today-1 (12x24 at 0,0) then clock (8x4) below it

  it('rightOf puts a widget beside its anchor when there is room, below it otherwise', () => {
    const s = run([{ op: 'add_widget', page: 'home', type: 'weather', size: { w: 8, h: 4 }, placement: 'rightOf', anchorId: 'today-1', config: null }]);
    const weather = s.homeLayout.find(w => w.type === 'weather')!;
    expect([weather.x, weather.y]).toEqual([12, 0]);
    // 24 wide cannot fit beside anything: it goes underneath instead.
    const s2 = run([{ op: 'add_widget', page: 'home', type: 'weather', size: { w: 24, h: 4 }, placement: 'rightOf', anchorId: 'today-1', config: null }]);
    const w2 = s2.homeLayout.find(w => w.type === 'weather')!;
    expect([w2.x, w2.y]).toEqual([0, 24]);
  });

  it('above and below shift the rest and never overlap', () => {
    let s = twoUp();
    const clockId = s.homeLayout[1].i;
    s = run([{ op: 'move_widget', widgetId: clockId, size: null, placement: 'above', anchorId: 'today-1' }], s);
    const clock = s.homeLayout.find(w => w.i === clockId)!, today = s.homeLayout.find(w => w.i === 'today-1')!;
    expect(clock.y).toBe(0);
    expect(today.y).toBe(4);
    for (const a of s.homeLayout) for (const b of s.homeLayout) if (a !== b) expect(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h).toBe(false);
  });

  it('arrange_page lays rows out full width, scaled from current widths, and appends forgotten widgets', () => {
    let s = run([
      { op: 'add_widget', page: 'cp', type: 'topicTimer', size: null, placement: null, anchorId: null, config: null },
      { op: 'add_widget', page: 'cp', type: 'topicStatus', size: null, placement: null, anchorId: null, config: null },
      { op: 'add_widget', page: 'cp', type: 'topicNote', size: null, placement: null, anchorId: null, config: null },
    ]);
    const [todos, timer, status, note] = s.topics[0].widgetLayout!;
    s = run([{ op: 'arrange_page', page: 'cp', rows: [[timer.i, status.i], [note.i]] }], s);
    const L = s.topics[0].widgetLayout!;
    const at = (id: string) => L.find(w => w.i === id)!;
    expect([at(timer.i).x, at(timer.i).y, at(timer.i).w]).toEqual([0, 0, 12]);
    expect([at(status.i).x, at(status.i).y, at(status.i).w]).toEqual([12, 0, 12]);
    expect([at(note.i).x, at(note.i).y, at(note.i).w]).toEqual([0, 12, 24]);
    // The task list was not mentioned: it keeps its place underneath.
    expect(at(todos.i).y).toBe(12 + 16);
    expectOpError(() => run([{ op: 'arrange_page', page: 'cp', rows: [['ghost']] }], s), /no widget with id "ghost"/);
    expectOpError(() => run([{ op: 'arrange_page', page: 'cp', rows: [[timer.i], [timer.i]] }], s), /listed twice/);
  });
});
