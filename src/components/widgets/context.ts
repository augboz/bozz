import type React from 'react';
import type {
  Application, BudgetData, CalendarEvent, CalendarNote, DailyPlan, EmailMessage, Habit, ListItem,
  Theme, Topic,
} from '../../lib/types';

/** Everything a home widget might need. Passed uniformly to every widget. */
export interface WidgetCtx {
  t: Theme;
  musicItems: ListItem[];
  lifeItems: ListItem[];
  cvItems: ListItem[];
  otherItems: ListItem[];
  applications: Application[];
  budget: BudgetData;
  emails: EmailMessage[];
  /** No-op while the home grid is in edit mode (prevents accidental nav). */
  setActiveSection: (id: string) => void;
  /** Push a new task into one of the legacy four lists (kept for calendar etc). */
  addTask: (list: 'music' | 'life' | 'cv' | 'other', text: string, deadline: number | null) => void;
  /** The user's topics — used by QuickAdd and any topic-aware widget. */
  topics: Topic[];
  /** Add an item to a topic's first non-done stage (or the specified stageId). */
  addTopicItem: (topicId: string, text: string, deadline: number | null, stageId?: string) => void;
  /** Today's daily plan — maps dateKey → TopicItem id strings. */
  dailyPlan: DailyPlan;
  /** Update the daily plan. */
  onDailyPlanChange: (plan: DailyPlan) => void;
  /** Advance a topic item to its next non-done stage. */
  onAdvanceStage: (topicId: string, itemId: number) => void;
  /** The user's habits — used by the habits widget. */
  habits?: Habit[];
  /** Update the habits list. */
  onHabitsChange?: (habits: Habit[]) => void;
  /** Today's calendar events (feed + deadlines + notes). */
  todayEvents?: CalendarEvent[];
  /** User-created calendar notes. */
  calendarNotes?: CalendarNote[];
  /** Update calendar notes. */
  onCalendarNotesChange?: (notes: CalendarNote[]) => void;
  /** The unique ID of this widget instance (grid item key). */
  widgetId?: string;
  /** Per-instance config for this widget (read). Empty object when not set. */
  widgetConfig: Record<string, unknown>;
  /** Persist an updated config for this widget instance. */
  onWidgetConfig: (config: Record<string, unknown>) => void;
  /** The topic ID of the currently viewed topic page (if any). */
  currentTopicId?: string;
  /** Update a specific topic in the topics array. */
  onTopicChange?: (next: Topic) => void;
  /** User's personal colour bank — every colour picker in the app uses these. */
  colorBank: string[];
  /** True when the containing grid/page is in edit mode. */
  editing?: boolean;
}

export type WidgetComponent = React.FC<{ ctx: WidgetCtx }>;