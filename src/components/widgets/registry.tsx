import type { HomeWidgetItem, WidgetType } from '../../lib/types';
import { WIDGET_CATALOG, allowedOn, type WidgetCatalogEntry } from '../../lib/widgetCatalog';
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
import TopicStatusWidget from './TopicStatusWidget';
import TopicTimerWidget from './TopicTimerWidget';
import MapWidget from './MapWidget';
import LinkedInWidget from './LinkedInWidget';

export interface WidgetMeta extends WidgetCatalogEntry {
  status: 'ready' | 'placeholder';
  Component: WidgetComponent;
}

// Sizes, labels and placement rules live in lib/widgetCatalog.ts (shared with
// the assistant); this file only attaches the React component to each entry.
const COMPONENTS: Record<WidgetType, WidgetComponent | null> = {
  summary: SummaryWidget,
  miniCalendar: MiniCalendarWidget,
  upcomingDeadlines: UpcomingDeadlinesWidget,
  weather: WeatherWidget,
  pomodoro: PomodoroWidget,
  quickCapture: null, // placeholder, milestone M11
  nowPlaying: NowPlayingWidget,
  recentEmails: EmailsWidget,
  notion: NotionWidget,
  budget: BudgetWidget,
  quickAdd: QuickAddWidget,
  dailyPlanner: DailyPlannerWidget,
  clock: ClockWidget,
  photo: PhotoWidget,
  habits: HabitsWidget,
  todaySchedule: TodayScheduleWidget,
  today: TodayWidget,
  topicTodos: TopicTodosWidget,
  topicLinks: TopicLinksWidget,
  topicNote: TopicNoteWidget,
  topicTimer: TopicTimerWidget,
  topicStatus: TopicStatusWidget,
  map: MapWidget,
  linkedin: LinkedInWidget,
};

export const WIDGET_REGISTRY: Record<WidgetType, WidgetMeta> = Object.fromEntries(
  (Object.keys(WIDGET_CATALOG) as WidgetType[]).map(type => {
    const meta = WIDGET_CATALOG[type];
    const Component = COMPONENTS[type];
    return [type, Component
      ? { ...meta, status: 'ready', Component }
      : { ...meta, status: 'placeholder', Component: makePlaceholderWidget(meta.label, 'M11') }];
  }),
) as Record<WidgetType, WidgetMeta>;

/** Widgets shown in the home Add Widget panel. */
export const WIDGET_LIST: WidgetMeta[] = Object.values(WIDGET_REGISTRY).filter(
  m => !m.hidden && allowedOn(m.type, 'home'),
);

/** Widgets available on topic pages (the mandatory task list can't be added twice). */
export const TOPIC_WIDGET_LIST: WidgetMeta[] = Object.values(WIDGET_REGISTRY).filter(
  m => !m.hidden && allowedOn(m.type, 'topic') && m.type !== 'topicTodos',
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