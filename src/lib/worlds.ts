// Bozz Worlds — one-tap aesthetic bundles (theme + wallpaper + fonts + optional
// ambient sound). The flagship Plus hook. This file ships the FREE bundled
// Worlds for instant, offline day-one beauty; premium Worlds come later from a
// server catalog (Phase 2).
//
// Applying a World is appearance-only and NEVER touches user data (tasks,
// budget, calendar). The wallpaper reuses the existing page-background render
// path (homeBackground → BgLayer) so there is no new global render layer.

import type { AppearancePrefs, BozzWorld, HomeWidgetItem, Topic, TopicFolder } from './types';
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
    icon: w.icon, topicWidgets: w.topicWidgets,
    author: 'Bozz',
    background: { url, dim: w.dim },
    previewUrl: url,
    version: 1,
  };
}

let wcount = 0;
const wid = () => { wcount += 1; return `ww-${wcount}`; };
/** A compact ready-made topic-page layout for topic/folder-scoped Worlds. */
function topicLayout(extra: HomeWidgetItem['type'][]): HomeWidgetItem[] {
  const base: HomeWidgetItem[] = [
    { i: wid(), type: 'topicTodos', x: 0, y: 0, w: 7, h: 12 },
    { i: wid(), type: 'topicNote', x: 7, y: 0, w: 5, h: 6 },
    { i: wid(), type: 'topicLinks', x: 7, y: 6, w: 5, h: 6 },
  ];
  let y = 12;
  for (const type of extra) { base.push({ i: wid(), type, x: 0, y, w: 6, h: 6 }); y += 6; }
  return base;
}

// ── The bundled free Worlds ──────────────────────────────────────────────────

export const BUNDLED_WORLDS: BozzWorld[] = [
  // ── Themes — aesthetic only (mood, font, wallpaper) ──────────────────────────
  world({
    id: 'default', name: 'Default', free: true, kind: 'theme',
    description: 'Bozz as it comes — clean and calm.',
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
    description: 'Neon dusk — deep indigo with electric magenta.',
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
    description: 'Deep pine greens and moss — grounded and still.',
    mood: 'dark', font: 'inter', accent: '#7dbf9a',
    colorBank: ['#7dbf9a', '#a3c98a', '#5e9d7a', '#c8d6a0', '#4a7d63', '#9bbf7d'],
    widgetShape: 'rounded', widgetBorder: 'subtle',
    gradient: ['#0c1812', '#163024', '#1f4733'], dim: 0.58,
  }),
  world({
    id: 'nordic-frost', name: 'Nordic Frost', free: true, kind: 'theme',
    description: 'Cool slate and glacier blue — crisp and bright.',
    mood: 'light', font: 'geist', accent: '#5b8fb0',
    colorBank: ['#5b8fb0', '#7fb0c9', '#a7c7d9', '#4a7a96', '#88a8bd', '#c2dae6'],
    widgetShape: 'sharp', widgetBorder: 'normal',
    gradient: ['#eef3f6', '#dce7ee', '#cad9e4'], dim: 0.32,
  }),

  // ── Templates — pre-made pages (widgets + look) for a specific use ───────────
  // Applied as a New topic, these drop a fully set-up section in one tap. Two are
  // free (activation); the rest are Plus (teased blurred until unlocked).
  world({
    id: 'job-hunt', name: 'Job Hunt', free: true, kind: 'template',
    description: 'Track every application from applied to offer.',
    mood: 'dark', font: 'inter', accent: '#d47a7a', icon: 'Briefcase',
    colorBank: ['#d47a7a', '#e0a16b', '#7da7d9', '#bb9af7', '#7fc8a9', '#c8c8c8'],
    widgetShape: 'rounded', widgetBorder: 'normal',
    topicWidgets: topicLayout(['upcomingDeadlines', 'quickAdd']),
    gradient: ['#1a1216', '#2a1a22', '#3a2230'], dim: 0.55,
  }),
  world({
    id: 'study', name: 'Study', free: true, kind: 'template',
    description: 'Assignments, revision and deadlines — sorted.',
    mood: 'light', font: 'manrope', accent: '#7da7d9', icon: 'GraduationCap',
    colorBank: ['#7da7d9', '#bb9af7', '#7fc8a9', '#e0a16b', '#9a8f7a', '#a7c7d9'],
    widgetShape: 'rounded', widgetBorder: 'normal',
    topicWidgets: topicLayout(['today', 'upcomingDeadlines']),
    gradient: ['#eef2f7', '#dde6f0', '#cdd9e8'], dim: 0.32,
  }),
  world({
    id: 'shopping', name: 'Shopping', free: false, kind: 'template',
    description: 'A ready-made shopping space — lists, links and budget, themed.',
    mood: 'warm', font: 'quicksand', accent: '#d4756a', icon: 'ShoppingBag',
    colorBank: ['#d4756a', '#e0a16b', '#d4b078', '#c98a7a', '#b86a5c', '#e8c4a0'],
    widgetShape: 'pill', widgetBorder: 'normal',
    topicWidgets: topicLayout(['budget', 'quickAdd']),
    gradient: ['#3a201c', '#74332c', '#b8625a'], dim: 0.55,
  }),
  world({
    id: 'deep-work', name: 'Deep Work', free: false, kind: 'template',
    description: 'A focused workspace — timer, today and a clean dark canvas.',
    mood: 'dark', font: 'mono', accent: '#8ab4f8', icon: 'Target',
    colorBank: ['#8ab4f8', '#a0a0a0', '#c8c8c8', '#6a8fd0', '#7d7d7d', '#b0c4de'],
    widgetShape: 'sharp', widgetBorder: 'subtle',
    topicWidgets: topicLayout(['pomodoro', 'clock']),
    gradient: ['#0b0d10', '#15191f', '#1d242e'], dim: 0.55,
  }),
  world({
    id: 'travel', name: 'Travel', free: false, kind: 'template',
    description: 'Plan a trip — checklist, budget and links in one place.',
    mood: 'light', font: 'quicksand', accent: '#5bb0a8', icon: 'Plane',
    colorBank: ['#5bb0a8', '#7fc8c0', '#e0b878', '#d99058', '#88bdd0', '#a7d9d2'],
    widgetShape: 'pill', widgetBorder: 'normal',
    topicWidgets: topicLayout(['budget', 'today']),
    gradient: ['#e8f2f0', '#d2e8e4', '#bcdcd6'], dim: 0.32,
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
  const stages = DEFAULT_STAGES.map(s => ({ ...s, id: freshId('stg') }));
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
