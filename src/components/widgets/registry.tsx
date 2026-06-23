import type { HomeWidgetItem, WidgetType } from '../../lib/types';
import type { WidgetComponent } from './context';
import ApplicationsWidget from './ApplicationsWidget';
import SummaryWidget from './SummaryWidget';
import MiniCalendarWidget from './MiniCalendarWidget';
import UpcomingDeadlinesWidget from './UpcomingDeadlinesWidget';
import BudgetWidget from './BudgetWidget';
import { makeNextTaskWidget } from './NextTaskWidget';
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
import WhatsAppWidget from './WhatsAppWidget';

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
  applications: ready('applications', 'Applications', 'Open applications & status counts', { w: 8, h: 6 }, { w: 4, h: 2 }, ApplicationsWidget),
  nextMusic: ready('nextMusic', 'Next: Music', 'Your next music task', { w: 4, h: 6 }, { w: 3, h: 2 }, makeNextTaskWidget('music')),
  nextLife: ready('nextLife', 'Next: Life', 'Your next life task', { w: 4, h: 6 }, { w: 3, h: 2 }, makeNextTaskWidget('life')),
  nextCv: ready('nextCv', 'Next: CV', 'Your next CV task', { w: 4, h: 6 }, { w: 3, h: 2 }, makeNextTaskWidget('cv')),
  nextOther: ready('nextOther', 'Next: Other', 'Your next misc task', { w: 4, h: 6 }, { w: 3, h: 2 }, makeNextTaskWidget('other')),
  summary: ready('summary', 'Summary strip', 'Doing / to-do / done totals', { w: 12, h: 4 }, { w: 6, h: 2 }, SummaryWidget),
  miniCalendar: ready('miniCalendar', 'Mini calendar', 'This month with deadline dots', { w: 5, h: 10 }, { w: 4, h: 4 }, MiniCalendarWidget),
  upcomingDeadlines: ready('upcomingDeadlines', 'Upcoming deadlines', 'Everything due in the next 7 days', { w: 4, h: 8 }, { w: 3, h: 2 }, UpcomingDeadlinesWidget),
  weather: ready('weather', 'Weather', 'Current conditions for your location', { w: 4, h: 6 }, { w: 3, h: 2 }, WeatherWidget),
  pomodoro: ready('pomodoro', 'Pomodoro', 'Focus timer', { w: 4, h: 8 }, { w: 3, h: 3 }, PomodoroWidget),
  quickCapture: placeholder('quickCapture', 'Quick capture', 'Dump a thought into your inbox', 'M11'),
  nowPlaying: ready('nowPlaying', 'Now playing', 'What you are listening to', { w: 4, h: 6 }, { w: 3, h: 2 }, NowPlayingWidget),
  recentEmails: ready('recentEmails', 'Recent emails', 'Top 2 unread by importance', { w: 5, h: 6 }, { w: 4, h: 2 }, EmailsWidget),
  notion: ready('notion', 'Notion', 'Quick-open a Notion page', { w: 4, h: 8 }, { w: 3, h: 2 }, NotionWidget),
  budget: ready('budget', 'Budget', 'This month: net + top savings goal', { w: 4, h: 6 }, { w: 3, h: 2 }, BudgetWidget),
  quickAdd: ready('quickAdd', 'Quick add', 'Add a task with list + deadline + voice', { w: 12, h: 8 }, { w: 4, h: 3 }, QuickAddWidget),
  dailyPlanner: ready('dailyPlanner', "Today's plan", "See and advance today's planned tasks", { w: 6, h: 10 }, { w: 4, h: 4 }, DailyPlannerWidget),
  clock: readyMulti('clock', 'Clock', 'Current time and date', { w: 4, h: 6 }, { w: 3, h: 1 }, ClockWidget),
  photo: readyMulti('photo', 'Photo', 'Display an image or photo', { w: 4, h: 8 }, { w: 2, h: 1 }, PhotoWidget),
  habits: ready('habits', 'Habits', "Today's habits & streaks", { w: 5, h: 10 }, { w: 3, h: 3 }, HabitsWidget),
  todaySchedule: ready('todaySchedule', "Today's schedule", "Today's timed events, all-day events and deadlines", { w: 5, h: 10 }, { w: 3, h: 3 }, TodayScheduleWidget),
  today: readyMulti('today', 'Today', "Today's events and tasks — configure which sections to show", { w: 6, h: 12 }, { w: 4, h: 3 }, TodayWidget),
  topicTodos: ready('topicTodos', 'Topic tasks', 'Items and stages for this topic', { w: 8, h: 16 }, { w: 4, h: 3 }, TopicTodosWidget),
  topicLinks: ready('topicLinks', 'Links', 'Pinned links for this topic', { w: 4, h: 6 }, { w: 3, h: 2 }, TopicLinksWidget),
  topicNote:  ready('topicNote',  'Pinned note', 'Freeform note for this topic', { w: 4, h: 8 }, { w: 3, h: 2 }, TopicNoteWidget),
  whatsapp:   ready('whatsapp',   'WhatsApp',    'Recent WhatsApp message threads',  { w: 4, h: 12 }, { w: 3, h: 3 }, WhatsAppWidget),
};

/** Widgets shown in the home Add Widget panel. */
const HIDDEN_FROM_HOME_PANEL = new Set([
  'applications', 'nextMusic', 'nextLife', 'nextCv', 'nextOther',
  'summary', 'quickCapture', 'todaySchedule', 'dailyPlanner',
  'topicTodos', 'topicLinks', 'topicNote',   // topic-only widgets
]);
export const WIDGET_LIST: WidgetMeta[] = Object.values(WIDGET_REGISTRY).filter(
  m => !HIDDEN_FROM_HOME_PANEL.has(m.type)
);

/** Widgets available on topic pages (excludes home-only and mandatory topic widgets). */
const HIDDEN_FROM_TOPIC_PANEL = new Set([
  'applications', 'nextMusic', 'nextLife', 'nextCv', 'nextOther',
  'summary', 'quickCapture', 'todaySchedule', 'dailyPlanner',
  'topicTodos', // mandatory — can't add a second one
]);
export const TOPIC_WIDGET_LIST: WidgetMeta[] = Object.values(WIDGET_REGISTRY).filter(
  m => !HIDDEN_FROM_TOPIC_PANEL.has(m.type)
);


/** Default home — a "morning review" starter grid so first run is never empty:
 *  Today (events + tasks) leads, a clock sits top-right, Quick add sits below.
 *  New users land on something real in seconds, then edit from there. */
export const DEFAULT_HOME: HomeWidgetItem[] = [
  { i: 'today',    type: 'today',    x: 0, y: 0,  w: 6,  h: 12 },
  { i: 'clock',    type: 'clock',    x: 6, y: 0,  w: 3,  h: 6  },
  { i: 'quickAdd', type: 'quickAdd', x: 0, y: 12, w: 12, h: 8  },
];