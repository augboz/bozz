// Bozz Worlds — one-tap aesthetic bundles (theme + wallpaper + fonts + optional
// ambient sound). The flagship Plus hook. This file ships the FREE bundled
// Worlds for instant, offline day-one beauty; premium Worlds come later from a
// server catalog (Phase 2).
//
// Applying a World is appearance-only and NEVER touches user data (tasks,
// budget, calendar). The wallpaper reuses the existing page-background render
// path (homeBackground → BgLayer) so there is no new global render layer.

import type { AppearancePrefs, BozzWorld, HomeWidgetItem, Topic, TopicFolder, WidgetType } from './types';
import { hasWorldsAccess } from './plus';

// ── Wallpaper generation (offline, no binary assets) ─────────────────────────
// Each bundled World ships a lightweight SVG-gradient wallpaper encoded as a
// data URI, so they look good instantly with zero downloads and stay
// licence-clean. Premium Worlds will swap these for server-delivered art.

function gradientWallpaper(stops: string[], angle = 145): string {
  const id = 'g';
  const offsets = stops.map((c, i) => {
    const off = stops.length === 1 ? 0 : (i / (stops.length - 1)) * 100;
    return `<stop offset="${off}%" stop-color="${c}"/>`;
  }).join('');
  // Angle → gradient vector.
  const rad = (angle * Math.PI) / 180;
  const x2 = (50 + Math.cos(rad) * 50).toFixed(2);
  const y2 = (50 + Math.sin(rad) * 50).toFixed(2);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000">` +
    `<defs><linearGradient id="${id}" x1="0%" y1="0%" x2="${x2}%" y2="${y2}%">${offsets}</linearGradient>` +
    `<radialGradient id="v" cx="50%" cy="38%" r="75%">` +
    `<stop offset="55%" stop-color="rgba(0,0,0,0)"/><stop offset="100%" stop-color="rgba(0,0,0,0.28)"/>` +
    `</radialGradient></defs>` +
    `<rect width="1600" height="1000" fill="url(#${id})"/>` +
    `<rect width="1600" height="1000" fill="url(#v)"/>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function world(w: Omit<BozzWorld, 'background' | 'previewUrl' | 'author' | 'version'> & {
  gradient: string[]; dim: number;
}): BozzWorld {
  const url = gradientWallpaper(w.gradient);
  return {
    id: w.id, name: w.name, description: w.description, free: w.free, kind: w.kind,
    mood: w.mood, colorBank: w.colorBank, accent: w.accent, font: w.font,
    widgetShape: w.widgetShape, widgetBorder: w.widgetBorder,
    ambientSound: w.ambientSound,
    icon: w.icon, topicWidgets: w.topicWidgets, stages: w.stages,
    author: 'Bozz',
    background: { url, dim: w.dim },
    previewUrl: url,
    version: 1,
  };
}

let wcount = 0;
const wid = () => { wcount += 1; return `ww-${wcount}`; };
/** A positioned widget for a template's bespoke topic-page layout (12-col grid). */
function tw(type: WidgetType, x: number, y: number, w: number, h: number): HomeWidgetItem {
  return { i: wid(), type, x, y, w, h };
}

// ── The bundled free Worlds ──────────────────────────────────────────────────

export const BUNDLED_WORLDS: BozzWorld[] = [
  // ── Themes — aesthetic only (mood, font, wallpaper) ──────────────────────────
  world({
    id: 'default', name: 'Default', free: true, kind: 'theme',
    description: 'Bozz as it comes. Clean and calm.',
    mood: 'dark', font: 'inter', accent: '#6ba8d4',
    colorBank: ['#6ba8d4', '#7dbf9a', '#d4c860', '#d4a86a', '#d47a7a', '#6abfbf'],
    widgetShape: 'rounded', widgetBorder: 'subtle',
    gradient: ['#0a0a0a', '#141414'], dim: 1,
  }),
  world({
    id: 'cozy-autumn', name: 'Cozy Autumn', free: true, kind: 'theme',
    description: 'Warm ambers and soft terracotta for slow mornings.',
    mood: 'warm', font: 'fraunces', accent: '#c4683a',
    colorBank: ['#c4683a', '#d99058', '#e0b878', '#a85a3c', '#8a6f4a', '#cf9b6c'],
    widgetShape: 'rounded', widgetBorder: 'normal',
    gradient: ['#3a1c12', '#6e3a1f', '#a8623a'], dim: 0.62,
  }),
  world({
    id: 'tokyo-night', name: 'Tokyo Night', free: true, kind: 'theme',
    description: 'Neon dusk: deep indigo with electric magenta.',
    mood: 'dark', font: 'geist', accent: '#7aa2f7',
    colorBank: ['#7aa2f7', '#bb9af7', '#f7768e', '#7dcfff', '#9ece6a', '#e0af68'],
    widgetShape: 'rounded', widgetBorder: 'subtle',
    gradient: ['#0f0f1e', '#1a1b3a', '#3b1f56'], dim: 0.58,
  }),
  world({
    id: 'minimal-cream', name: 'Minimal Cream', free: true, kind: 'theme',
    description: 'Quiet paper-white with the gentlest warmth.',
    mood: 'light', font: 'manrope', accent: '#9a8f7a',
    colorBank: ['#9a8f7a', '#b9a98c', '#c9b89a', '#8a7d66', '#a89878', '#d8cdb6'],
    widgetShape: 'rounded', widgetBorder: 'normal',
    gradient: ['#f5f1e8', '#ece5d6', '#e3dac6'], dim: 0.35,
  }),
  world({
    id: 'forest-calm', name: 'Forest Calm', free: true, kind: 'theme',
    description: 'Deep pine greens and moss. Grounded and still.',
    mood: 'dark', font: 'inter', accent: '#7dbf9a',
    colorBank: ['#7dbf9a', '#a3c98a', '#5e9d7a', '#c8d6a0', '#4a7d63', '#9bbf7d'],
    widgetShape: 'rounded', widgetBorder: 'subtle',
    gradient: ['#0c1812', '#163024', '#1f4733'], dim: 0.58,
  }),
  world({
    id: 'nordic-frost', name: 'Nordic Frost', free: true, kind: 'theme',
    description: 'Cool slate and glacier blue. Crisp and bright.',
    mood: 'light', font: 'geist', accent: '#5b8fb0',
    colorBank: ['#5b8fb0', '#7fb0c9', '#a7c7d9', '#4a7a96', '#88a8bd', '#c2dae6'],
    widgetShape: 'sharp', widgetBorder: 'normal',
    gradient: ['#eef3f6', '#dce7ee', '#cad9e4'], dim: 0.32,
  }),

  // ── Templates — bespoke pre-made pages (widgets + look) for one real use ─────
  // Applied as a topic/folder, each drops a fully arranged page in one tap — its
  // own widget mix (incl. connected-app widgets), palette, font and wallpaper.
  // Two are free (activation); the rest are Plus (preview teased, names shown).
  world({
    id: 'study', name: 'Study', free: true, kind: 'template',
    description: 'Assignments, revision and deadlines, with a timetable and a focus timer.',
    mood: 'light', font: 'manrope', accent: '#5b8fb0', icon: 'study',
    colorBank: ['#5b8fb0', '#7da7d9', '#9b8cc4', '#7fc8a9', '#e0b06a', '#c98a8a'],
    widgetShape: 'rounded', widgetBorder: 'normal',
    topicWidgets: [
      tw('topicTodos', 0, 0, 7, 14),        // assignments by subject
      tw('upcomingDeadlines', 7, 0, 5, 7),  // what's due
      tw('pomodoro', 7, 7, 5, 7),           // revision sprints
      tw('miniCalendar', 0, 14, 5, 10),     // timetable (Calendar)
      tw('topicNote', 5, 14, 4, 10),        // revision notes
      tw('topicLinks', 9, 14, 3, 10),       // course portal + resources
    ],
    gradient: ['#eef3f8', '#dce8f2', '#c8dcee'], dim: 0.3,
  }),
  world({
    id: 'job-hunt', name: 'Job Hunt', free: true, kind: 'template',
    description: 'Track every application, catch recruiter replies and prep for interviews.',
    mood: 'dark', font: 'inter', accent: '#d4886a', icon: 'work',
    colorBank: ['#d4886a', '#e0a16b', '#cf9b6c', '#7da7d9', '#7fc8a9', '#b0b0b0'],
    widgetShape: 'rounded', widgetBorder: 'subtle',
    // A real application pipeline (ids are regenerated on apply). "Rejected" is a
    // done stage so closed-out apps archive away; "Offer" stays on the board.
    stages: [
      { id: 'jh-toapply',   label: 'To apply',     color: '#b0b0b0', done: false },
      { id: 'jh-applied',   label: 'Applied',      color: '#7da7d9', done: false },
      { id: 'jh-interview', label: 'Interviewing', color: '#e0a16b', done: false },
      { id: 'jh-offer',     label: 'Offer',        color: '#7fc8a9', done: false },
      { id: 'jh-rejected',  label: 'Rejected',     color: '#c98a8a', done: true  },
    ],
    topicWidgets: [
      tw('topicTodos', 0, 0, 7, 14),        // application pipeline (stages)
      tw('recentEmails', 7, 0, 5, 7),       // recruiter replies (Email)
      tw('upcomingDeadlines', 7, 7, 5, 7),  // interviews + closing dates
      tw('topicLinks', 0, 14, 4, 8),        // LinkedIn + job boards
      tw('topicNote', 4, 14, 5, 8),         // prep + talking points
      tw('miniCalendar', 9, 14, 3, 8),      // interview schedule (Calendar)
    ],
    gradient: ['#16100e', '#2a1a14', '#3d2418'], dim: 0.55,
  }),
  world({
    id: 'shopping', name: 'Shopping', free: false, kind: 'template',
    description: 'Lists, wishlists and a budget, one calm place to shop.',
    mood: 'warm', font: 'quicksand', accent: '#d4756a', icon: 'shopping',
    colorBank: ['#d4756a', '#e0936b', '#d9b06a', '#c98a7a', '#b8625a', '#e8c4a0'],
    widgetShape: 'pill', widgetBorder: 'normal',
    topicWidgets: [
      tw('topicTodos', 0, 0, 7, 13),        // shopping list / to-buy
      tw('budget', 7, 0, 5, 6),             // spend this month
      tw('topicLinks', 7, 6, 5, 7),         // product links + wishlists
      tw('topicNote', 0, 13, 6, 7),         // gift ideas, sizes
      tw('photo', 6, 13, 6, 7),             // inspiration board
    ],
    gradient: ['#3a201c', '#6e3328', '#a85544'], dim: 0.5,
  }),
  world({
    id: 'family', name: 'Family', free: false, kind: 'template',
    description: "Your child's week: schedule, to-dos, routines and the things you can't forget.",
    mood: 'warm', font: 'quicksand', accent: '#7bb274', icon: 'social',
    colorBank: ['#7bb274', '#e0b358', '#7da7d9', '#e08a8a', '#bb9af7', '#9cc7a0'],
    widgetShape: 'rounded', widgetBorder: 'normal',
    topicWidgets: [
      tw('miniCalendar', 0, 0, 5, 11),      // school + clubs + appts (Calendar)
      tw('topicTodos', 5, 0, 7, 11),        // to-dos for the kids
      tw('habits', 0, 11, 4, 10),           // chores + bedtime + reading
      tw('upcomingDeadlines', 4, 11, 4, 6), // forms + payments due
      tw('topicNote', 8, 11, 4, 6),         // allergies, sizes, contacts
      tw('topicLinks', 4, 17, 8, 4),        // school portal + class app
    ],
    gradient: ['#f6f0e0', '#ece2c4', '#e0d2a8'], dim: 0.3,
  }),
  world({
    id: 'holiday', name: 'Holiday', free: false, kind: 'template',
    description: 'Plan a trip: packing, budget, itinerary and the destination forecast.',
    mood: 'light', font: 'manrope', accent: '#4fb0a6', icon: 'travel',
    colorBank: ['#4fb0a6', '#6fc8c0', '#e0b878', '#e89a6a', '#7fb0d0', '#a7d9d2'],
    widgetShape: 'pill', widgetBorder: 'normal',
    topicWidgets: [
      tw('topicTodos', 0, 0, 7, 13),        // packing + to-book checklist
      tw('budget', 7, 0, 5, 6),             // trip budget
      tw('weather', 7, 6, 5, 7),            // destination forecast (Weather)
      tw('miniCalendar', 0, 13, 5, 9),      // trip dates / itinerary (Calendar)
      tw('topicLinks', 5, 13, 4, 9),        // flights + hotel bookings
      tw('topicNote', 9, 13, 3, 9),         // addresses + itinerary notes
    ],
    gradient: ['#e6f3f1', '#cfe8e2', '#b4dcd4'], dim: 0.3,
  }),
  world({
    id: 'calm', name: 'Calm', free: false, kind: 'template',
    description: 'A quiet corner: journal, gentle habits and a slow to-do.',
    mood: 'dark', font: 'fraunces', accent: '#8aa892', icon: 'nature',
    colorBank: ['#8aa892', '#a3bca8', '#b6a890', '#9a8f7a', '#7d9488', '#c4b8a0'],
    widgetShape: 'rounded', widgetBorder: 'subtle',
    topicWidgets: [
      tw('topicNote', 0, 0, 7, 12),         // journal / gratitude (leads)
      tw('habits', 7, 0, 5, 12),            // water, breathe, sleep, walk
      tw('topicTodos', 0, 12, 7, 10),       // a gentle, short to-do
      tw('photo', 7, 12, 5, 6),             // a calming image
      tw('clock', 7, 18, 5, 4),             // a quiet clock
    ],
    gradient: ['#121815', '#1c2620', '#27332c'], dim: 0.5,
  }),
  world({
    id: 'deep-work', name: 'Deep Work', free: false, kind: 'template',
    description: 'Heads-down focus: a timer, your tasks and nothing else.',
    mood: 'dark', font: 'mono', accent: '#8ab4f8', icon: 'energy',
    colorBank: ['#8ab4f8', '#9aa5b5', '#c0c8d4', '#6a8fd0', '#7d8694', '#b0c4de'],
    widgetShape: 'sharp', widgetBorder: 'subtle',
    topicWidgets: [
      tw('topicTodos', 0, 0, 8, 14),        // the focus list
      tw('pomodoro', 8, 0, 4, 8),           // focus timer
      tw('clock', 8, 8, 4, 6),              // time
      tw('topicNote', 0, 14, 6, 6),         // scratchpad
      tw('nowPlaying', 6, 14, 6, 6),        // focus music (Spotify)
    ],
    gradient: ['#0a0c0f', '#13171d', '#1b212b'], dim: 0.55,
  }),
];

/** Look up a World by id across bundled (and later, catalog) Worlds. */
export function findWorld(id: string | undefined): BozzWorld | null {
  if (!id) return null;
  return BUNDLED_WORLDS.find(w => w.id === id) ?? null;
}

// ── Apply / revert ───────────────────────────────────────────────────────────

/**
 * Returns appearance prefs with the World's look applied. Appearance-only.
 * The wallpaper itself is applied separately (writeWorldBackground) because it
 * lives in the homeBackground store key, not in AppearancePrefs.
 */
export function applyWorld(world: BozzWorld, prefs: AppearancePrefs): AppearancePrefs {
  return {
    ...prefs,
    mood: world.mood,
    font: world.font,
    colorBank: world.colorBank.slice(0, 30),
    widgetShape: world.widgetShape ?? prefs.widgetShape,
    widgetBorder: world.widgetBorder ?? prefs.widgetBorder,
    appBackground: world.id === 'default' ? undefined : { ...world.background },
    activeWorldId: world.id,
    ambient: world.ambientSound
      ? { worldId: world.id, volume: prefs.ambient?.volume ?? 0.25, muted: prefs.ambient?.muted ?? false }
      : undefined,
  };
}

/** The pseudo-"Default" World, so a user can revert in one tap. */
export function revertToDefault(prefs: AppearancePrefs): AppearancePrefs {
  const def = BUNDLED_WORLDS[0];
  return { ...applyWorld(def, prefs), appBackground: undefined, activeWorldId: undefined, ambient: undefined };
}

/** True if the user may apply this World (free, or has access during/after beta). */
export function canApply(world: BozzWorld): boolean {
  return world.free || hasWorldsAccess();
}

// ── Topic / folder scopes ────────────────────────────────────────────────────
// Applying a World to a topic is appearance + layout only: it sets the topic's
// colour, icon, page background and (if the World ships them) a ready-made
// widget layout. It never touches the topic's items.

let idc = 0;
const freshId = (p: string) => { idc += 1; return `${p}-${Date.now().toString(36)}-${idc}`; };

const DEFAULT_STAGES: Topic['stages'] = [
  { id: 'stg-todo', label: 'To do', color: '#7da7d9', done: false },
  { id: 'stg-doing', label: 'Doing', color: '#e0a16b', done: false },
  { id: 'stg-done', label: 'Done', color: '#7fc8a9', done: true },
];

/** Build a fresh Topic from a World (used by the "New topic" scope). */
export function worldToTopic(world: BozzWorld, name: string, order: number, folderId?: string): Topic {
  const base = world.stages && world.stages.length ? world.stages : DEFAULT_STAGES;
  const stages = base.map(s => ({ ...s, id: freshId('stg') }));
  return {
    id: freshId('topic'),
    name: name.trim() || world.name,
    color: world.accent,
    icon: world.icon,
    keywords: [],
    order,
    stages,
    items: [],
    sortMode: 'manual',
    widgetLayout: (world.topicWidgets ?? []).map(w => ({ ...w, i: freshId('w') })),
    pageBg: { url: world.background.url, dim: world.background.dim },
    folderId,
  };
}

/** Patch an existing Topic with a World's look (+ layout if the World ships one). */
export function worldTopicPatch(world: BozzWorld): Partial<Topic> {
  const patch: Partial<Topic> = {
    color: world.accent,
    icon: world.icon,
    pageBg: { url: world.background.url, dim: world.background.dim },
  };
  if (world.topicWidgets && world.topicWidgets.length) {
    patch.widgetLayout = world.topicWidgets.map(w => ({ ...w, i: freshId('w') }));
  }
  return patch;
}

/** Build a fresh folder from a World (used by the "New folder" scope). */
export function worldToFolder(world: BozzWorld, name: string, order: number): TopicFolder {
  return {
    id: freshId('folder'),
    name: name.trim() || world.name,
    icon: world.icon,
    color: world.accent,
    order,
    collapsed: false,
  };
}
