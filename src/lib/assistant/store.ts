// The slice of app state the assistant can see and change, as one plain value.
// Dashboard builds it from its React state, hands it to applyOps, and writes
// back whichever slices changed. Keeping it a plain object is what makes
// preview, undo and tests trivial.
import type { AppearancePrefs, Habit, HomeWidgetItem, Topic, TopicFolder } from '../types';

export interface AssistantStore {
  topics: Topic[];
  topicFolders: TopicFolder[];
  homeLayout: HomeWidgetItem[];
  appearance: AppearancePrefs;
  habits: Habit[];
}

export const STORE_SLICES = ['topics', 'topicFolders', 'homeLayout', 'appearance', 'habits'] as const;
export type StoreSlice = (typeof STORE_SLICES)[number];

/** Deep copy without photos/page backgrounds, which are large and never the assistant's business. */
export function snapshotStore(s: AssistantStore): AssistantStore {
  const copy = JSON.parse(JSON.stringify({
    ...s,
    topics: s.topics.map(t => { const { pageBg: _bg, ...rest } = t; return rest; }),
  })) as AssistantStore;
  return copy;
}

/** Put page backgrounds from `current` back onto a snapshot being restored. */
export function withLocalBackgrounds(restored: AssistantStore, current: AssistantStore): AssistantStore {
  const bg = new Map(current.topics.filter(t => t.pageBg).map(t => [t.id, t.pageBg]));
  return {
    ...restored,
    topics: restored.topics.map(t => (bg.has(t.id) ? { ...t, pageBg: bg.get(t.id) } : t)),
  };
}

export function changedSlices(a: AssistantStore, b: AssistantStore): StoreSlice[] {
  return STORE_SLICES.filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
}
