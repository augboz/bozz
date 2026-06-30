/**
 * Cold-start seeding — turns a single "what are you here for?" answer into a
 * POPULATED, personal dashboard so a brand-new account never lands on empty
 * shells. Additive and brand-new-account-only (the caller gates on this).
 *
 * Each option:
 *   - builds a REAL colour-coded topic (via the existing Worlds machinery,
 *     worldToTopic) with a description + keywords so offline routing/prediction
 *     works from the first capture (predictTopic is inert with zero topics),
 *   - seeds 2-3 example timed deadlines so Today / Upcoming deadlines / the
 *     mini-calendar light up immediately,
 *   - names a matching starter home layout to apply.
 *
 * Nothing here touches auth, payments or sync — it only returns plain data the
 * caller drops into the existing topics + homeLayout state.
 */

import type { HomeWidgetItem, Topic, TopicItem } from './types';
import { findWorld, worldToTopic } from './worlds';
import { STARTER_TEMPLATES, WIDGET_REGISTRY, DEFAULT_HOME } from '../components/widgets/registry';
import { nextId } from './ids';

export interface ColdStartOption {
  id: string;
  /** Chip label shown to the user. */
  label: string;
  /** Emoji shown on the chip. */
  emoji: string;
  /** The bundled World whose look + (for templates) layout to reuse. */
  worldId: string;
  /** Topic name to create. */
  topicName: string;
  /** Topic description — also mined by predictTopic for routing. */
  description: string;
  /** Routing keywords for quick-capture / voice. */
  keywords: string[];
  /** The home starter layout id to apply (from STARTER_TEMPLATES). */
  starterId: string;
  /** Sample tasks: text + how many days from today the deadline falls (+ optional time). */
  samples: Array<{ text: string; inDays: number; dueMin?: number }>;
}

export const COLD_START_OPTIONS: ColdStartOption[] = [
  {
    id: 'uni',
    label: 'Uni',
    emoji: '🎓',
    worldId: 'study',
    topicName: 'Uni',
    description: 'assignments, lectures, revision, deadlines, exam, essay, coursework',
    keywords: ['assignment', 'lecture', 'revision', 'essay', 'exam', 'coursework', 'seminar', 'reading'],
    starterId: 'student',
    samples: [
      { text: 'Read this week’s lecture notes', inDays: 1, dueMin: 18 * 60 },
      { text: 'Start the first assignment draft', inDays: 3 },
      { text: 'Revise for the upcoming quiz', inDays: 6 },
    ],
  },
  {
    id: 'job',
    label: 'Job hunt',
    emoji: '💼',
    worldId: 'job-hunt',
    topicName: 'Job hunt',
    description: 'applications, recruiters, interviews, CV, cover letter, LinkedIn, follow up',
    keywords: ['application', 'apply', 'recruiter', 'interview', 'cv', 'resume', 'cover letter', 'linkedin'],
    starterId: 'freelancer',
    samples: [
      { text: 'Update CV and LinkedIn', inDays: 1 },
      { text: 'Apply to 3 roles', inDays: 2 },
      { text: 'Follow up on this week’s applications', inDays: 5 },
    ],
  },
  {
    id: 'gym',
    label: 'Gym',
    emoji: '🏋️',
    worldId: 'calm',
    topicName: 'Gym',
    description: 'workout, training, exercise, run, lift, cardio, class, fitness',
    keywords: ['workout', 'gym', 'training', 'run', 'lift', 'cardio', 'class', 'fitness'],
    starterId: 'essentials',
    samples: [
      { text: 'Workout — full body', inDays: 0, dueMin: 18 * 60 },
      { text: 'Plan next week’s sessions', inDays: 2 },
      { text: 'Rest + stretch day', inDays: 4 },
    ],
  },
  {
    id: 'work',
    label: 'Work',
    emoji: '🗂️',
    worldId: 'deep-work',
    topicName: 'Work',
    description: 'meetings, projects, deadlines, clients, reports, tasks, deliverables',
    keywords: ['meeting', 'project', 'deadline', 'client', 'report', 'deliverable', 'task', 'review'],
    starterId: 'freelancer',
    samples: [
      { text: 'Plan today’s top 3 tasks', inDays: 0, dueMin: 9 * 60 },
      { text: 'Prep for the next meeting', inDays: 1, dueMin: 10 * 60 },
      { text: 'Wrap up the weekly report', inDays: 4 },
    ],
  },
];

const DAY_MS = 24 * 60 * 60 * 1000;

function localMidnightInDays(days: number): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime() + days * DAY_MS;
}

/** The home layout for an option, with fresh `i` keys + min-size clamping (mirrors HomeView). */
function starterHome(starterId: string): HomeWidgetItem[] {
  const tpl = STARTER_TEMPLATES.find(s => s.id === starterId);
  if (!tpl) return DEFAULT_HOME;
  const stamp = Date.now().toString(36);
  return tpl.items.map((it, idx) => {
    const meta = WIDGET_REGISTRY[it.type];
    return {
      ...it,
      i: `${it.type}-${stamp}-${idx}`,
      w: Math.max(it.w, meta.minSize.w),
      h: Math.max(it.h, meta.minSize.h),
    };
  });
}

export interface ColdStartSeed {
  topic: Topic;
  homeItems: HomeWidgetItem[];
}

/**
 * Build the topic (with sample timed deadlines) + the matching home layout for a
 * cold-start choice. Falls back to a blank topic look if the World is missing, so
 * this never throws on a brand-new account.
 */
export function seedColdStart(option: ColdStartOption): ColdStartSeed {
  const world = findWorld(option.worldId) ?? findWorld('default')!;
  const topic = worldToTopic(world, option.topicName, 0);

  // Description + keywords power predictTopic from the very first capture.
  topic.description = option.description;
  topic.keywords = option.keywords;

  // Seed sample tasks into the first non-done stage so they show as active.
  const firstStage = topic.stages.find(s => !s.done) ?? topic.stages[0];
  const items: TopicItem[] = option.samples.map(s => ({
    id: nextId(),
    text: s.text,
    stageId: firstStage?.id ?? '',
    completedAt: null,
    deadline: localMidnightInDays(s.inDays),
    dueMin: s.dueMin ?? null,
  }));
  topic.items = items;

  return { topic, homeItems: starterHome(option.starterId) };
}
