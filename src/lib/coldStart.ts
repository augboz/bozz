/**
 * Cold-start seeding — turns a single "what are you here for?" answer into a
 * personal dashboard so a brand-new account never lands on empty shells.
 * Additive and brand-new-account-only (the caller gates on this).
 *
 * Each option:
 *   - builds a REAL colour-coded topic (via the existing Worlds machinery,
 *     worldToTopic) with a description + keywords so offline routing/prediction
 *     works from the first capture (predictTopic is inert with zero topics),
 *   - names a matching starter home layout to apply.
 *
 * We deliberately do NOT fabricate fake deadlines anymore — the user's REAL
 * timetable (pasted in the welcome flow) is what fills Today + the calendar, and
 * a screen full of placeholder tasks the user has to delete was friction, not a
 * head start. The topic is created empty; the timetable + first captures fill it.
 *
 * Nothing here touches auth, payments or sync — it only returns plain data the
 * caller drops into the existing topics + homeLayout state.
 */

import type { HomeWidgetItem, Topic } from './types';
import { findWorld, worldToTopic } from './worlds';
import { STARTER_TEMPLATES, WIDGET_REGISTRY, DEFAULT_HOME } from '../components/widgets/registry';

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
  },
];

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
 * Build the (empty) real topic + the matching home layout for a cold-start
 * choice. Falls back to a blank topic look if the World is missing, so this never
 * throws on a brand-new account. No fake deadlines: the topic carries its
 * description + keywords (so predictTopic works from the first capture) but starts
 * empty — the user's real timetable + captures fill it.
 */
export function seedColdStart(option: ColdStartOption): ColdStartSeed {
  const world = findWorld(option.worldId) ?? findWorld('default')!;
  const topic = worldToTopic(world, option.topicName, 0);

  // Description + keywords power predictTopic from the very first capture.
  topic.description = option.description;
  topic.keywords = option.keywords;
  topic.items = [];

  return { topic, homeItems: starterHome(option.starterId) };
}
