import type { HomeWidgetItem, WidgetType } from '../../lib/types';
import type { WidgetComponent } from './context';
import SummaryWidget from './SummaryWidget';
import MiniCalendarWidget from './MiniCalendarWidget';
import UpcomingDeadlinesWidget from './UpcomingDeadlinesWidget';
import BudgetWidget from './BudgetWidget';
import { makePlaceholderWidget } from './PlaceholderWidget';
import EmailsWidget from './EmailsWidget';
import PomodoroWidget from './PomodoroWidget';
import WeatherWidget from './WeatherWidget';
import NotionWidget from './NotionWidget';
import NowPlayingWidget from './NowPlayingWidget';
import QuickAddWidget from './QuickAddWidget';
import DailyPlannerWidget from './DailyPlannerWidget';
import ClockWidget from './ClockWidget';
import PhotoWidget from './PhotoWidget';
import HabitsWidget from './HabitsWidget';
import TodayScheduleWidget from './TodayScheduleWidget';
import TodayWidget from './TodayWidget';
import TopicTodosWidget from './TopicTodosWidget';
import TopicLinksWidget from './TopicLinksWidget';
import TopicNoteWidget from './TopicNoteWidget';
import MapWidget from './MapWidget';
import LinkedInWidget from './LinkedInWidget';

export interface WidgetMeta {
  type: WidgetType;
  label: string;
  description: string;
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
  status: 'ready' | 'placeholder';
  Component: WidgetComponent;
  /** If true, multiple instances of this widget can be added to the same grid. */
  allowMultiple?: boolean;
}

const ready = (
  type: WidgetType, label: string, description: string,
  defaultSize: { w: number; h: number }, minSize: { w: number; h: number },
  Component: WidgetComponent,
): WidgetMeta => ({ type, label, description, defaultSize, minSize, status: 'ready', Component });

const readyMulti = (
  type: WidgetType, label: string, description: string,
  defaultSize: { w: number; h: number }, minSize: { w: number; h: number },
  Component: WidgetComponent,
): WidgetMeta => ({ type, label, description, defaultSize, minSize, status: 'ready', Component, allowMultiple: true });

const placeholder = (
  type: WidgetType, label: string, description: string, milestone: string,
): WidgetMeta => ({
  type, label, description,
  defaultSize: { w: 4, h: 6 }, minSize: { w: 3, h: 3 },
  status: 'placeholder', Component: makePlaceholderWidget(label, milestone),
});

export const WIDGET_REGISTRY: Record<WidgetType, WidgetMeta> = {
  // All default h values are doubled from the pre-v2 grid (ROW_H 64→32) so
  // existing layouts look identical after migration. minH values are kept
  // smaller on flexible widgets to allow compact sizing.
  summary: ready('summary', 'Summary strip', 'Doing / to-do / done totals', { w: 24, h: 8 }, { w: 12, h: 4 }, SummaryWidget),
  miniCalendar: ready('miniCalendar', 'Mini calendar', 'This month with deadline dots', { w: 10, h: 20 }, { w: 8, h: 8 }, MiniCalendarWidget),
  upcomingDeadlines: ready('upcomingDeadlines', 'Upcoming deadlines', 'Everything due in the next 7 days', { w: 8, h: 16 }, { w: 6, h: 4 }, UpcomingDeadlinesWidget),
  weather: ready('weather', 'Weather', 'Current conditions for your location', { w: 8, h: 12 }, { w: 6, h: 4 }, WeatherWidget),
  pomodoro: ready('pomodoro', 'Pomodoro', 'Focus timer', { w: 8, h: 16 }, { w: 6, h: 6 }, PomodoroWidget),
  quickCapture: placeholder('quickCapture', 'Quick capture', 'Dump a thought into your inbox', 'M11'),
  nowPlaying: ready('nowPlaying', 'Now playing', 'What you are listening to', { w: 8, h: 12 }, { w: 6, h: 4 }, NowPlayingWidget),
  recentEmails: ready('recentEmails', 'Recent emails', 'Top 2 unread by importance', { w: 10, h: 12 }, { w: 8, h: 4 }, EmailsWidget),
  notion: ready('notion', 'Notion', 'Quick-open a Notion page', { w: 8, h: 16 }, { w: 6, h: 4 }, NotionWidget),
  budget: ready('budget', 'Budget', 'This month: net + top savings goal', { w: 8, h: 12 }, { w: 6, h: 4 }, BudgetWidget),
  quickAdd: ready('quickAdd', 'Quick add', 'Add a task with list + deadline + voice', { w: 24, h: 16 }, { w: 8, h: 6 }, QuickAddWidget),
  dailyPlanner: ready('dailyPlanner', "Today's plan", "See and advance today's planned tasks", { w: 12, h: 20 }, { w: 8, h: 8 }, DailyPlannerWidget),
  clock: readyMulti('clock', 'Clock', 'Current time and date', { w: 8, h: 12 }, { w: 6, h: 2 }, ClockWidget),
  photo: readyMulti('photo', 'Photo', 'Display an image or photo', { w: 8, h: 16 }, { w: 4, h: 2 }, PhotoWidget),
  habits: ready('habits', 'Habits', "Today's habits & streaks", { w: 10, h: 20 }, { w: 6, h: 6 }, HabitsWidget),
  todaySchedule: ready('todaySchedule', "Today's schedule", "Today's timed events, all-day events and deadlines", { w: 10, h: 20 }, { w: 6, h: 6 }, TodayScheduleWidget),
  today: readyMulti('today', 'Today', "Today's events and tasks. Configure which sections to show", { w: 12, h: 24 }, { w: 8, h: 6 }, TodayWidget),
  topicTodos: ready('topicTodos', 'Topic tasks', 'Items and stages for this topic', { w: 8, h: 12 }, { w: 6, h: 6 }, TopicTodosWidget),
  topicLinks: readyMulti('topicLinks', 'Links', 'Pinned links for this topic', { w: 8, h: 12 }, { w: 2, h: 2 }, TopicLinksWidget),
  topicNote:  ready('topicNote',  'Pinned note', 'Freeform note for this topic', { w: 8, h: 16 }, { w: 6, h: 4 }, TopicNoteWidget),
  map:        readyMulti('map',   'Map',         'A map you can drop pins and areas on', { w: 12, h: 24 }, { w: 6, h: 8 }, MapWidget),
  linkedin:   ready('linkedin',   'LinkedIn',    'Quick links to your feed, jobs & messaging', { w: 8, h: 18 }, { w: 6, h: 10 }, LinkedInWidget),
};

/** Widgets shown in the home Add Widget panel. */
const HIDDEN_FROM_HOME_PANEL = new Set([
  'summary', 'quickCapture', 'todaySchedule', 'dailyPlanner',
  'topicTodos', 'topicLinks', 'topicNote',   // topic-only widgets
]);
export const WIDGET_LIST: WidgetMeta[] = Object.values(WIDGET_REGISTRY).filter(
  m => !HIDDEN_FROM_HOME_PANEL.has(m.type)
);

/** Widgets available on topic pages (excludes home-only and mandatory topic widgets). */
const HIDDEN_FROM_TOPIC_PANEL = new Set([
  'summary', 'quickCapture', 'todaySchedule', 'dailyPlanner',
  'topicTodos', // mandatory — can't add a second one
]);
export const TOPIC_WIDGET_LIST: WidgetMeta[] = Object.values(WIDGET_REGISTRY).filter(
  m => !HIDDEN_FROM_TOPIC_PANEL.has(m.type)
);


/** Default home — empty. New accounts open to a clean home showing only the
 *  "Getting started" card (rendered by Onboarding), so a first-time user runs a
 *  walkthrough instead of staring at demo widgets. Existing users keep their
 *  saved layout (a stored homeLayout overrides this default). */
export const DEFAULT_HOME: HomeWidgetItem[] = [];

/** A one-click starter layout offered on the empty home, so a brand-new user can
 *  go from a blank canvas to a structured "morning view" in a single tap instead
 *  of hunting for the add-widget flow. Only account-free, ready widgets are used
 *  so the layout renders something sensible before anything is connected. The
 *  `i` keys are generated when the template is applied (see HomeView). */
export interface StarterTemplate {
  id: string;
  label: string;
  description: string;
  items: Array<Omit<HomeWidgetItem, 'i'>>;
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'student',
    label: 'Student',
    description: 'Today, deadlines, a focus timer and quick capture.',
    items: [
      { type: 'today', x: 0, y: 0, w: 12, h: 24 },
      { type: 'upcomingDeadlines', x: 12, y: 0, w: 12, h: 12 },
      { type: 'pomodoro', x: 12, y: 12, w: 12, h: 12 },
      { type: 'quickAdd', x: 0, y: 24, w: 24, h: 16 },
    ],
  },
  {
    id: 'freelancer',
    label: 'Freelancer',
    description: 'Today, your budget, a clock and quick capture.',
    items: [
      { type: 'today', x: 0, y: 0, w: 12, h: 24 },
      { type: 'budget', x: 12, y: 0, w: 12, h: 12 },
      { type: 'clock', x: 12, y: 12, w: 12, h: 12 },
      { type: 'quickAdd', x: 0, y: 24, w: 24, h: 16 },
    ],
  },
  {
    id: 'essentials',
    label: 'Just the essentials',
    description: 'Today, weather and quick capture. Nothing extra.',
    items: [
      { type: 'today', x: 0, y: 0, w: 16, h: 24 },
      { type: 'weather', x: 16, y: 0, w: 8, h: 12 },
      { type: 'clock', x: 16, y: 12, w: 8, h: 12 },
      { type: 'quickAdd', x: 0, y: 24, w: 24, h: 16 },
    ],
  },
];