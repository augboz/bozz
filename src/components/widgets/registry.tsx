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

export interface WidgetMeta {
  type: WidgetType;
  label: string;
  description: string;
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
  status: 'ready' | 'placeholder';
  Component: WidgetComponent;
}

const ready = (
  type: WidgetType, label: string, description: string,
  defaultSize: { w: number; h: number }, minSize: { w: number; h: number },
  Component: WidgetComponent,
): WidgetMeta => ({ type, label, description, defaultSize, minSize, status: 'ready', Component });

const placeholder = (
  type: WidgetType, label: string, description: string, milestone: string,
): WidgetMeta => ({
  type, label, description,
  defaultSize: { w: 4, h: 3 }, minSize: { w: 3, h: 2 },
  status: 'placeholder', Component: makePlaceholderWidget(label, milestone),
});

export const WIDGET_REGISTRY: Record<WidgetType, WidgetMeta> = {
  applications: ready('applications', 'Applications', 'Open applications & status counts', { w: 8, h: 3 }, { w: 4, h: 3 }, ApplicationsWidget),
  nextMusic: ready('nextMusic', 'Next: Music', 'Your next music task', { w: 4, h: 3 }, { w: 3, h: 2 }, makeNextTaskWidget('music')),
  nextLife: ready('nextLife', 'Next: Life', 'Your next life task', { w: 4, h: 3 }, { w: 3, h: 2 }, makeNextTaskWidget('life')),
  nextCv: ready('nextCv', 'Next: CV', 'Your next CV task', { w: 4, h: 3 }, { w: 3, h: 2 }, makeNextTaskWidget('cv')),
  nextOther: ready('nextOther', 'Next: Other', 'Your next misc task', { w: 4, h: 3 }, { w: 3, h: 2 }, makeNextTaskWidget('other')),
  summary: ready('summary', 'Summary strip', 'Doing / to-do / done totals', { w: 12, h: 2 }, { w: 6, h: 2 }, SummaryWidget),
  miniCalendar: ready('miniCalendar', 'Mini calendar', 'This month with deadline dots', { w: 5, h: 5 }, { w: 4, h: 4 }, MiniCalendarWidget),
  upcomingDeadlines: ready('upcomingDeadlines', 'Upcoming deadlines', 'Everything due in the next 7 days', { w: 4, h: 4 }, { w: 3, h: 3 }, UpcomingDeadlinesWidget),
  weather: ready('weather', 'Weather', 'Current conditions for your location', { w: 4, h: 3 }, { w: 3, h: 2 }, WeatherWidget),
  pomodoro: ready('pomodoro', 'Pomodoro', 'Focus timer', { w: 4, h: 4 }, { w: 3, h: 3 }, PomodoroWidget),
  quickCapture: placeholder('quickCapture', 'Quick capture', 'Dump a thought into your inbox', 'M11'),
  nowPlaying: ready('nowPlaying', 'Now playing', 'What you are listening to', { w: 4, h: 4 }, { w: 3, h: 3 }, NowPlayingWidget),
  recentEmails: ready('recentEmails', 'Recent emails', 'Top 2 unread by importance', { w: 5, h: 3 }, { w: 4, h: 3 }, EmailsWidget),
  notion: ready('notion', 'Notion', 'Quick-open a Notion page', { w: 4, h: 4 }, { w: 3, h: 3 }, NotionWidget),
  budget: ready('budget', 'Budget', 'This month: net + top savings goal', { w: 4, h: 3 }, { w: 3, h: 2 }, BudgetWidget),
  quickAdd: ready('quickAdd', 'Quick add', 'Add a task with list + deadline + voice', { w: 5, h: 3 }, { w: 4, h: 3 }, QuickAddWidget),
  habits: placeholder('habits', 'Habits', 'Streaks & today’s habits', 'later'),
};

export const WIDGET_LIST: WidgetMeta[] = Object.values(WIDGET_REGISTRY);

/** Default home layout — mirrors the original fixed home page. */
export const DEFAULT_HOME: HomeWidgetItem[] = [
  { i: 'quickAdd', type: 'quickAdd', x: 0, y: 0, w: 8, h: 3 },
  { i: 'upcomingDeadlines', type: 'upcomingDeadlines', x: 8, y: 0, w: 4, h: 5 },
  { i: 'applications', type: 'applications', x: 0, y: 3, w: 8, h: 3 },
  { i: 'nextMusic', type: 'nextMusic', x: 0, y: 6, w: 4, h: 3 },
  { i: 'nextLife', type: 'nextLife', x: 4, y: 6, w: 4, h: 3 },
  { i: 'nextCv', type: 'nextCv', x: 0, y: 9, w: 4, h: 3 },
  { i: 'miniCalendar', type: 'miniCalendar', x: 4, y: 9, w: 5, h: 6 },
  { i: 'summary', type: 'summary', x: 0, y: 12, w: 12, h: 2 },
];
