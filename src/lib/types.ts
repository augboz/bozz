export type Status = 'todo' | 'doing' | 'done';
export type ApplicationStatus = 'need to apply' | 'applied' | 'interview' | 'offer' | 'rejected';
export type SectionId = 'home' | 'music' | 'applications' | 'life' | 'cv' | 'other' | 'calendar' | 'budget' | 'inbox' | 'review' | 'email' | 'settings';

// ── User-defined topics ─────────────────────────────────────────────────────
// A "topic" is a user-created task list with custom stages (e.g. To do /
// Doing / Done, or Applied / Interview / Offer). Each topic appears in the
// nav and stores its own items. Phase A: types + Settings CRUD UI only —
// rendering still uses the legacy hardcoded sections.

export interface TopicStage {
  /** Stable id, unique within the topic. */
  id: string;
  /** Display name e.g. "To do" / "Applied". */
  label: string;
  /** Optional accent colour for the stage pill. */
  color?: string;
  /** Items in this stage are treated as complete (archived to a Done pile). */
  done?: boolean;
}

export interface TopicItem {
  id: number;
  text: string;
  /** Matches one of the topic's TopicStage.id values. */
  stageId: string;
  /** Unix ms when the item entered a `done: true` stage. */
  completedAt: number | null;
  /** Optional deadline (unix ms at local midnight). */
  deadline: number | null;
  /** Free-form notes. */
  notes?: string;
}

export interface Topic {
  /** Stable id, also used as the section id in the nav. */
  id: string;
  /** Display name e.g. "Music". */
  name: string;
  /** Accent colour used in the nav and as a default stage colour. */
  color: string;
  /** Lucide icon name for the nav. Falls back to ListTree. */
  icon?: string;
  /** Optional keywords for voice / quick-capture routing. */
  keywords: string[];
  /** Ordered stages — first is the default for new items. */
  stages: TopicStage[];
  /** The items in this topic. */
  items: TopicItem[];
  /** Position in the nav. */
  order: number;
  /** Per-topic sort preference. */
  sortMode?: SortMode;
}

export interface WeeklyReview {
  id: string;
  weekStart: number;       // unix ms, Mon 00:00 local
  weekEnd: number;         // unix ms, Sun 23:59:59.999 local
  reviewedAt: number | null;
  note: string;
}

export interface ReviewSettings {
  /** 0=Mon … 6=Sun, default 6 (Sun). */
  dayOfWeek: number;
  /** 0–23 local, default 18. */
  hour: number;
}

export type EmailProvider = 'gmail' | 'outlook';

export interface OAuthAccount {
  provider: EmailProvider;
  email: string;
  clientId: string;
  clientSecret: string;          // empty string for Outlook (public client)
  expiresAt: number;             // unix ms when the access token expires
  lastSync: number | null;
}

export interface EmailMessage {
  id: string;                    // provider message id, prefixed with provider for uniqueness
  provider: EmailProvider;
  accountEmail: string;          // which connected account it came from
  fromName: string;
  fromEmail: string;
  subject: string;
  snippet: string;
  date: number;                  // unix ms
  unread: boolean;
  permalink: string;
  /** Set when score precomputed; used by the home widget. */
  score?: number;
}

export interface InboxItem {
  id: number;
  text: string;
  createdAt: number;
}

/** Where an inbox item can be routed when triaged. */
export type InboxDestination = TaskListKey | 'applications';

export type TransactionType = 'income' | 'expense' | 'owed-to-me' | 'i-owe';
export type RecurFrequency = 'weekly' | 'fortnightly' | 'monthly' | 'yearly';

export interface RecurringItem {
  id: number;
  name: string;
  amount: number;
  dayOfMonth: number;     // 1–31 (used for monthly/yearly)
  dayOfWeek: number;      // 0=Mon … 6=Sun (used for weekly/fortnightly)
  frequency: RecurFrequency;
  category: string;
  type: TransactionType;  // recurring only uses income/expense
}

export interface OneOffTransaction {
  id: number;
  date: number;           // unix ms
  amount: number;
  category: string;
  type: TransactionType;
  note: string;
  /** Set when synced from a bank — used for dedup on subsequent syncs. */
  externalId?: string;
  /** Human label describing the bank/account, e.g. "Monzo · Current". */
  source?: string;
}


export interface SavingsContribution {
  id: number;
  date: number;           // unix ms
  amount: number;
}

export interface SavingsGoal {
  id: number;
  name: string;
  target: number;
  targetDate: number | null;
  contributions: SavingsContribution[];
}

export interface BudgetData {
  recurring: RecurringItem[];
  transactions: OneOffTransaction[];
  goals: SavingsGoal[];
  currency: string;       // ISO 4217, default 'GBP'
}

export type CalendarViewMode = 'month' | 'week' | 'day';

export interface CalendarFeed {
  id: string;
  label: string;
  url: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: number;          // unix ms
  end: number | null;     // unix ms (null = point in time)
  allDay: boolean;
  color: string;
  source: 'ical' | 'deadline';
  /** Set on deadline events so the day panel can jump to the section. */
  sectionId?: SectionId;
}

export interface FeedCacheEntry {
  fetchedAt: number;
  events: CalendarEvent[];
  error?: string;
}

export interface CalendarCache {
  lastSync: number | null;
  feeds: Record<string, FeedCacheEntry>;
}

export type SortMode = 'manual' | 'deadline' | 'status';

/** The four ListItem-backed lists that support archive/deadline/sort. */
export type TaskListKey = 'music' | 'life' | 'cv' | 'other';

export type WidgetType =
  | 'applications' | 'nextMusic' | 'nextLife' | 'nextCv' | 'nextOther'
  | 'summary' | 'miniCalendar' | 'upcomingDeadlines'
  | 'weather' | 'pomodoro' | 'quickCapture' | 'nowPlaying'
  | 'recentEmails' | 'notion' | 'budget' | 'habits' | 'quickAdd';

/** A placed widget on the home grid (combines instance + grid position). */
export interface HomeWidgetItem {
  i: string;            // unique instance id, also the react-grid-layout key
  type: WidgetType;
  x: number; y: number; w: number; h: number;
}

export interface SpotifyAccount {
  clientId: string;
  userId: string;
  displayName: string;
  expiresAt: number;
  lastChecked: number | null;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artist: string;
  albumArt: string | null;
  progressMs: number;
  durationMs: number;
  isPlaying: boolean;
}

export type MoodId =
  | 'midnight' | 'sunset' | 'coffee' | 'forest'
  | 'stone' | 'ocean' | 'light' | 'linen' | 'candy';
export type FontChoice = 'inter' | 'manrope' | 'quicksand' | 'mono';
export type FontSize = 'small' | 'medium' | 'large';
export type WidgetShape = 'rounded' | 'sharp' | 'pill';
export type WidgetBorder = 'subtle' | 'normal' | 'bold';

export interface AppearancePrefs {
  mood: MoodId;
  font: FontChoice;
  fontSize: FontSize;
  /** Sections hidden from the nav (Settings can never be hidden). */
  hiddenSections: SectionId[];
  /** Topic IDs hidden from the nav. */
  hiddenTopicIds: string[];
  /** Section the app opens to on launch. */
  defaultSection: SectionId;
  /** Corner radius preset for home widgets. */
  widgetShape: WidgetShape;
  /** Border style preset for home widgets. */
  widgetBorder: WidgetBorder;
}

export interface ListItem {
  id: number;
  text: string;
  status: Status;
  /** Set to Date.now() when status → 'done'; cleared (null) on restore. */
  completedAt: number | null;
  /** Optional due date, unix ms at local midnight. */
  deadline: number | null;
}

export interface Application {
  id: number;
  name: string;
  status: ApplicationStatus;
}

export interface Theme {
  bg: string;
  bgAlt: string;
  panel: string;
  text: string;
  textMuted: string;
  textDim: string;
  border: string;
  borderStrong: string;
  input: string;
  todoBg: string;
  todoBorder: string;
  todoText: string;
  doingBg: string;
  doingBgStrong: string;
  doingBorder: string;
  doingAccent: string;
  doneBg: string;
  doneBgStrong: string;
  doneBorder: string;
  doneAccent: string;
  pendingBg: string;
  pendingBorder: string;
  pendingAccent: string;
  alert: string;
  alertBg: string;
  alertBorder: string;
}
