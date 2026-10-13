// Copy a widget on one topic page, paste it on another.
//
// Kept per device (localStorage) so it survives switching pages and restarts;
// it is a convenience, not data, so a missing or blocked store just means an
// empty clipboard.
import type { HomeWidgetItem, Topic } from './types';

export interface WidgetClip {
  type: HomeWidgetItem['type'];
  w: number;
  h: number;
  config?: Record<string, unknown>;
}

const KEY = 'bozz:widgetClipboard';
const EVENT = 'bozz:widget-clipboard';
let memory: WidgetClip | null = null;

export function readWidgetClip(): WidgetClip | null {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(KEY);
    memory = raw ? (JSON.parse(raw) as WidgetClip) : null;
  } catch { memory = null; }
  return memory;
}

/** Snapshot a widget. Older Note/Links widgets keep their content on the topic
 *  (pinnedNote / links) instead of in config; pull it in so it travels too. */
export function copyWidget(item: HomeWidgetItem, topic: Topic): WidgetClip {
  const config: Record<string, unknown> = JSON.parse(JSON.stringify(item.config ?? {}));
  if (item.type === 'topicNote' && typeof config.note !== 'string') {
    config.note = topic.pinnedNote ?? '';
    if (topic.pinnedNoteHtml) config.noteHtml = topic.pinnedNoteHtml;
  }
  if (item.type === 'topicLinks' && !Array.isArray(config.links)) {
    config.links = JSON.parse(JSON.stringify(topic.links ?? []));
  }
  memory = { type: item.type, w: item.w, h: item.h, ...(Object.keys(config).length ? { config } : {}) };
  try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch { /* memory copy still works */ }
  window.dispatchEvent(new Event(EVENT));
  return memory;
}

export function onWidgetClipChange(fn: () => void): () => void {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}
