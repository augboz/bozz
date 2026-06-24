// Templates / starter packs — the "Build" pillar of Bozz Plus.
//
// A template is a serialisable starter pack assembled from primitives the app
// already has (Topic, TopicFolder, HomeWidgetItem, AppearancePrefs, Habit).
// The bundled starter packs here are FREE: they are the single best activation
// lever and serve the 90-second north star, so they ship in-app, not behind
// Plus. (The browsable gallery + create/share-your-own are the Plus layers,
// deferred to Phase 2.)
//
// Apply remaps every id to fresh ones and MERGES into the user's existing setup
// — it never clobbers data. Templates contain only topics/layout/theme; never
// tokens or account data (lesson from the v0.1.29 leak).

import type {
  AppearancePrefs, BozzTemplate, Habit, HomeWidgetItem, Topic, TopicFolder,
} from './types';

let counter = 0;
function uid(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

// ── Topic factory helpers ────────────────────────────────────────────────────

const TODO_DOING_DONE = () => ([
  { id: 'stg-todo', label: 'To do', color: '#7da7d9', done: false },
  { id: 'stg-doing', label: 'Doing', color: '#e0a16b', done: false },
  { id: 'stg-done', label: 'Done', color: '#7fc8a9', done: true },
]);

function topic(
  name: string, color: string, icon: string, keywords: string[],
  stages: Topic['stages'], items: Array<{ text: string; stageId: string }>,
): Topic {
  return {
    id: `topic-${name.toLowerCase().replace(/\s+/g, '-')}`,
    name, color, icon, keywords, order: 0,
    stages,
    items: items.map((it, i) => ({
      id: i + 1, text: it.text, stageId: it.stageId, completedAt: null, deadline: null,
    })),
    sortMode: 'manual',
  };
}

// ── The bundled starter packs ────────────────────────────────────────────────

export const STARTER_PACKS: BozzTemplate[] = [
  {
    id: 'pack-student',
    name: 'Student',
    description: 'Courses, assignments and revision — sorted.',
    tags: ['study', 'school'],
    topics: [
      topic('Assignments', '#7da7d9', 'GraduationCap', ['assignment', 'essay', 'deadline'],
        TODO_DOING_DONE(), [
          { text: 'Add your next assignment', stageId: 'stg-todo' },
          { text: 'Reading for this week', stageId: 'stg-doing' },
        ]),
      topic('Revision', '#bb9af7', 'BookOpen', ['revise', 'study', 'exam'],
        TODO_DOING_DONE(), [{ text: 'Make a revision timetable', stageId: 'stg-todo' }]),
    ],
    homeWidgetLayout: [
      { i: uid('w'), type: 'today', x: 0, y: 0, w: 6, h: 12 },
      { i: uid('w'), type: 'upcomingDeadlines', x: 6, y: 0, w: 6, h: 12 },
      { i: uid('w'), type: 'quickAdd', x: 0, y: 12, w: 12, h: 8 },
    ],
    appearance: { mood: 'light', font: 'manrope' },
    starterHabits: [
      { id: 'h1', name: 'Study 1 hour', color: '#7da7d9', activeDays: [], entries: {}, order: 0 },
    ],
  },
  {
    id: 'pack-founder',
    name: 'Founder',
    description: 'Ship, talk to users, watch the runway.',
    tags: ['startup', 'work'],
    topics: [
      topic('Build', '#7dbf9a', 'Hammer', ['ship', 'feature', 'build'],
        TODO_DOING_DONE(), [
          { text: 'Next thing to ship', stageId: 'stg-todo' },
          { text: 'In progress', stageId: 'stg-doing' },
        ]),
      topic('Growth', '#d4a86a', 'TrendingUp', ['growth', 'marketing', 'users'],
        TODO_DOING_DONE(), [{ text: 'Talk to 3 users this week', stageId: 'stg-todo' }]),
    ],
    homeWidgetLayout: [
      { i: uid('w'), type: 'today', x: 0, y: 0, w: 6, h: 12 },
      { i: uid('w'), type: 'recentEmails', x: 6, y: 0, w: 6, h: 12 },
      { i: uid('w'), type: 'quickAdd', x: 0, y: 12, w: 12, h: 8 },
    ],
    appearance: { mood: 'dark', font: 'geist' },
  },
  {
    id: 'pack-job-hunt',
    name: 'Job hunt',
    description: 'Track every application from applied to offer.',
    tags: ['career', 'jobs'],
    topics: [
      topic('Applications', '#d47a7a', 'Briefcase', ['apply', 'job', 'application'], [
        { id: 'stg-apply', label: 'To apply', color: '#7da7d9', done: false },
        { id: 'stg-applied', label: 'Applied', color: '#e0a16b', done: false },
        { id: 'stg-interview', label: 'Interview', color: '#bb9af7', done: false },
        { id: 'stg-offer', label: 'Offer', color: '#7fc8a9', done: true },
      ], [
        { text: 'Add a role you want to apply for', stageId: 'stg-apply' },
        { text: 'Tailor your CV', stageId: 'stg-applied' },
      ]),
    ],
    homeWidgetLayout: [
      { i: uid('w'), type: 'today', x: 0, y: 0, w: 6, h: 12 },
      { i: uid('w'), type: 'upcomingDeadlines', x: 6, y: 0, w: 6, h: 12 },
      { i: uid('w'), type: 'quickAdd', x: 0, y: 12, w: 12, h: 8 },
    ],
    appearance: { mood: 'dark', font: 'inter' },
  },
  {
    id: 'pack-calm',
    name: 'Calm minimal',
    description: 'Just today and a gentle place to capture.',
    tags: ['minimal', 'focus'],
    topics: [
      topic('Today', '#9bbf7d', 'Sun', ['today', 'now'],
        TODO_DOING_DONE(), [{ text: 'One thing that matters today', stageId: 'stg-todo' }]),
    ],
    homeWidgetLayout: [
      { i: uid('w'), type: 'clock', x: 0, y: 0, w: 4, h: 6 },
      { i: uid('w'), type: 'today', x: 4, y: 0, w: 8, h: 12 },
      { i: uid('w'), type: 'quickAdd', x: 0, y: 12, w: 12, h: 6 },
    ],
    appearance: { mood: 'warm', font: 'fraunces' },
    starterHabits: [
      { id: 'h1', name: 'Morning pages', color: '#d99058', activeDays: [], entries: {}, order: 0 },
      { id: 'h2', name: 'Walk outside', color: '#9bbf7d', activeDays: [], entries: {}, order: 1 },
    ],
  },
];

// ── Apply ────────────────────────────────────────────────────────────────────

export interface ApplyResult {
  topics: Topic[];
  topicFolders: TopicFolder[];
  habits: Habit[];
  homeWidgetLayout: HomeWidgetItem[];
  appearance?: Partial<AppearancePrefs>;
}

interface CurrentState {
  topics: Topic[];
  topicFolders: TopicFolder[];
  habits: Habit[];
}

/**
 * Deserialise a template with fresh ids and merge into the user's current
 * setup. Returns the merged arrays — caller applies them with its setters.
 * Existing data is preserved; the pack's items are appended after it.
 */
export function applyTemplate(tpl: BozzTemplate, current: CurrentState): ApplyResult {
  // Remap folders first so topics can point at the new folder ids.
  const folderIdMap = new Map<string, string>();
  const baseFolderOrder = current.topicFolders.length;
  const newFolders: TopicFolder[] = (tpl.folders ?? []).map((f, i) => {
    const newId = uid('folder');
    folderIdMap.set(f.id, newId);
    return { ...f, id: newId, order: baseFolderOrder + i, collapsed: false };
  });

  const baseTopicOrder = current.topics.length;
  const newTopics: Topic[] = tpl.topics.map((tp, i) => {
    // Remap stage ids and the item.stageId references that point at them.
    const stageIdMap = new Map<string, string>();
    const stages = tp.stages.map(s => {
      const newId = uid('stg');
      stageIdMap.set(s.id, newId);
      return { ...s, id: newId };
    });
    const items = tp.items.map((it, j) => ({
      ...it,
      id: Date.now() + i * 1000 + j,
      stageId: stageIdMap.get(it.stageId) ?? stages[0]?.id ?? '',
    }));
    return {
      ...tp,
      id: uid('topic'),
      order: baseTopicOrder + i,
      folderId: tp.folderId ? folderIdMap.get(tp.folderId) : undefined,
      stages,
      items,
    };
  });

  const baseHabitOrder = current.habits.length;
  const newHabits: Habit[] = (tpl.starterHabits ?? []).map((h, i) => ({
    ...h,
    id: uid('habit'),
    order: baseHabitOrder + i,
    entries: {},
  }));

  return {
    topics: [...current.topics, ...newTopics],
    topicFolders: [...current.topicFolders, ...newFolders],
    habits: [...current.habits, ...newHabits],
    homeWidgetLayout: tpl.homeWidgetLayout.map(w => ({ ...w, i: uid('w') })),
    appearance: tpl.appearance,
  };
}
