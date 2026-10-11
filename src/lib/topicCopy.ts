// "Duplicate page": a new topic with the same layout and look as another.
//
// Copies layout, widget settings, stages, colour, icon, folder, background and
// title style. Notes/links and tasks are opt-in. Never copied: the page title
// text (the copy shows its own sidebar name), status, keywords (capture would
// route to two pages) and habits (they belong to the original page).
import type { Topic, TopicItem } from './types';
import { nextId } from './ids';

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export interface CopyOptions { notes: boolean; tasks: boolean }

export function duplicateTopic(src: Topic, order: number, opts: CopyOptions): Topic {
  const clone = JSON.parse(JSON.stringify(src)) as Topic;
  const widgetLayout = clone.widgetLayout?.map(it => {
    if (opts.notes || !it.config) return it;
    // Per-widget note text and link lists are page content, not layout.
    const { note: _n, noteHtml: _h, links: _l, ...rest } = it.config;
    const config = { ...rest, ...('note' in it.config ? { note: '' } : {}), ...('links' in it.config ? { links: [] } : {}) };
    return { ...it, config };
  });
  const items: TopicItem[] = opts.tasks
    ? clone.items.map(i => ({ ...i, id: nextId() }))
    : [];
  const copy: Topic = {
    ...clone,
    id: genId(),
    name: `${src.name || 'Page'} copy`,
    order,
    items,
    widgetLayout,
    keywords: [],
    pageTitle: undefined,
    status: undefined,
    statusAt: undefined,
  };
  if (!opts.notes) {
    copy.pinnedNote = undefined;
    copy.pinnedNoteHtml = undefined;
    copy.description = undefined;
    copy.links = undefined;
  }
  return copy;
}
