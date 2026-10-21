// The widget catalog: everything about a widget type except its React
// component. One source of truth for the registry (which adds the component),
// the Add panels, and the assistant (which can only add what is listed here).
import type { WidgetType } from './types';

export interface WidgetCatalogEntry {
  type: WidgetType;
  label: string;
  description: string;
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
  /** Several of this widget can sit on one grid. */
  allowMultiple: boolean;
  /** 'home' = Home only, 'topic' = topic pages only, 'any' = both. */
  where: 'home' | 'topic' | 'any';
  /** Not offered in any Add panel (arrives through templates or old layouts). */
  hidden: boolean;
  /** Keys the widget reads from its per-instance config, for the assistant. */
  configKeys: string[];
}

const entry = (
  type: WidgetType, label: string, description: string,
  defaultSize: { w: number; h: number }, minSize: { w: number; h: number },
  extra: Partial<Pick<WidgetCatalogEntry, 'allowMultiple' | 'where' | 'hidden' | 'configKeys'>> = {},
): WidgetCatalogEntry => ({
  type, label, description, defaultSize, minSize,
  allowMultiple: false, where: 'any', hidden: false, configKeys: [], ...extra,
});

export const WIDGET_CATALOG: Record<WidgetType, WidgetCatalogEntry> = {
  summary: entry('summary', 'Summary strip', 'Doing / to-do / done totals', { w: 24, h: 8 }, { w: 12, h: 4 }, { hidden: true }),
  miniCalendar: entry('miniCalendar', 'Mini calendar', 'This month with deadline dots', { w: 10, h: 20 }, { w: 8, h: 8 }, { configKeys: ['view'] }),
  upcomingDeadlines: entry('upcomingDeadlines', 'Upcoming deadlines', 'Everything due in the next 7 days', { w: 8, h: 16 }, { w: 6, h: 4 }),
  weather: entry('weather', 'Weather', 'Current conditions for your location', { w: 8, h: 12 }, { w: 6, h: 4 }),
  pomodoro: entry('pomodoro', 'Pomodoro', 'Focus timer', { w: 8, h: 16 }, { w: 6, h: 6 }),
  quickCapture: entry('quickCapture', 'Quick capture', 'Dump a thought into your inbox', { w: 4, h: 6 }, { w: 3, h: 3 }, { hidden: true }),
  nowPlaying: entry('nowPlaying', 'Now playing', 'What you are listening to', { w: 8, h: 12 }, { w: 6, h: 4 }),
  recentEmails: entry('recentEmails', 'Recent emails', 'Top 2 unread by importance', { w: 10, h: 12 }, { w: 8, h: 4 }, { configKeys: ['filters'] }),
  notion: entry('notion', 'Notion', 'Quick-open a Notion page', { w: 8, h: 16 }, { w: 6, h: 4 }),
  budget: entry('budget', 'Budget', 'This month: net + top savings goal', { w: 8, h: 12 }, { w: 6, h: 4 }),
  quickAdd: entry('quickAdd', 'Quick add', 'Add a task with list + deadline + voice', { w: 24, h: 16 }, { w: 8, h: 6 }),
  dailyPlanner: entry('dailyPlanner', "Today's plan", "See and advance today's planned tasks", { w: 12, h: 20 }, { w: 8, h: 8 }, { hidden: true }),
  clock: entry('clock', 'Clock', 'Current time and date', { w: 8, h: 12 }, { w: 6, h: 2 }, { allowMultiple: true }),
  photo: entry('photo', 'Photo', 'Display an image or photo', { w: 8, h: 16 }, { w: 4, h: 2 }, { allowMultiple: true, configKeys: ['caption'] }),
  habits: entry('habits', 'Habits', "Today's habits & streaks", { w: 10, h: 20 }, { w: 6, h: 6 }),
  todaySchedule: entry('todaySchedule', "Today's schedule", "Today's timed events, all-day events and deadlines", { w: 10, h: 20 }, { w: 6, h: 6 }, { hidden: true }),
  today: entry('today', 'Today', "Today's events and tasks. Configure which sections to show", { w: 12, h: 24 }, { w: 8, h: 6 }, { allowMultiple: true, configKeys: ['showEvents', 'showTasks'] }),
  topicTodos: entry('topicTodos', 'Topic tasks', 'Items and stages for this topic', { w: 8, h: 12 }, { w: 6, h: 6 }, { where: 'topic' }),
  topicLinks: entry('topicLinks', 'Links', 'Pinned links for this topic', { w: 8, h: 12 }, { w: 2, h: 2 }, { allowMultiple: true, where: 'topic', configKeys: ['links', 'linkSize', 'iconsOnly', 'logoSize'] }),
  topicNote: entry('topicNote', 'Note', 'Freeform note for this topic. Add as many as you like', { w: 8, h: 16 }, { w: 6, h: 4 }, { allowMultiple: true, where: 'topic', configKeys: ['note'] }),
  topicTimer: entry('topicTimer', 'Study timer', 'Start/stop stopwatch that totals your time on this page: today, this week, all time', { w: 8, h: 12 }, { w: 6, h: 6 }, { where: 'topic' }),
  topicStatus: entry('topicStatus', 'Status', 'Mark this page On track or Needs work. Shows as a dot in the sidebar', { w: 8, h: 8 }, { w: 4, h: 4 }, { where: 'topic' }),
  map: entry('map', 'Map', 'A map you can drop pins and areas on', { w: 12, h: 24 }, { w: 6, h: 8 }, { allowMultiple: true, configKeys: ['center', 'zoom'] }),
  linkedin: entry('linkedin', 'LinkedIn', 'Quick links to your feed, jobs & messaging', { w: 8, h: 18 }, { w: 6, h: 10 }),
};

/** Per-widget colour overrides every widget understands (see HomeView/TopicView wrappers). */
export const COMMON_CONFIG_KEYS = ['widgetColor', 'bgColor', 'textColor'] as const;

export const GRID_COLS = 24;

export const isWidgetType = (t: string): t is WidgetType => t in WIDGET_CATALOG;

/** Can this widget type be placed on this kind of page? */
export function allowedOn(type: WidgetType, page: 'home' | 'topic'): boolean {
  const w = WIDGET_CATALOG[type].where;
  return w === 'any' || w === page;
}
