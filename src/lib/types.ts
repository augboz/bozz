export type Status = 'todo' | 'doing' | 'done';
export type SectionId = 'home' | 'calendar' | 'budget' | 'inbox' | 'review' | 'email' | 'settings' | 'planner' | 'dailyPlanner' | 'habits' | 'health' | 'apps';

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
  /** Optional time-of-day for the deadline, minutes from local midnight.
   *  null/undefined = all-day (legacy behaviour — due at local midnight). */
  dueMin?: number | null;
  /** Optional effort estimate — Small / Medium / Large (Round 7, P-B).
   *  Additive + migration-safe: undefined = unset (legacy). Purely
   *  informational — never used to auto-schedule or auto-plan. */
  effort?: Effort;
  /** Free-form notes. */
  notes?: string;
}

/** Effort estimate for a task — Small / Medium / Large (Round 7, P-B). */
export type Effort = 'S' | 'M' | 'L';

export interface TopicLink {
  id: string;
  label: string;
  url: string;
  /** Cached site favicon as a data URL, fetched once so it renders offline. */
  icon?: string;
}

export interface TopicFolder {
  /** Stable id. */
  id: string;
  /** Display name e.g. "Girlfriend". */
  name: string;
  /** Lucide icon name. Falls back to Folder. */
  icon?: string;
  /** Accent colour shown in the nav header. */
  color?: string;
  /** Position in the nav relative to other folders/topics. */
  order: number;
  /** Whether the folder is collapsed in the sidebar. */
  collapsed: boolean;
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
  /** Optional short description shown in the dashboard header. */
  description?: string;
  /** Optional keywords for voice / quick-capture routing. */
  keywords: string[];
  /** Ordered stages — first is the default for new items. */
  stages: TopicStage[];
  /** The items in this topic. */
  items: TopicItem[];
  /** Position in the nav. */
  order: number;
  /** Optional folder this topic belongs to. */
  folderId?: string;
  /** Per-topic sort preference. */
  sortMode?: SortMode;
  /** Pinned links shown in the topic dashboard (Notion pages, docs, etc). */
  links?: TopicLink[];
  /** Freeform pinned note shown in the topic dashboard. */
  pinnedNote?: string;
  /** Per-topic widget layout for the topic page grid. */
  widgetLayout?: HomeWidgetItem[];
  /** Page background photo. posX/posY (0-100) and scale (1-3) let the user
   *  reposition and zoom the photo so it frames correctly on the page. */
  pageBg?: { url: string; dim: number; posX?: number; posY?: number; scale?: number };
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

export interface WAAccount {
  token: string;
  phone?: string;
  name?: string;
}

export interface OAuthAccount {
  provider: EmailProvider;
  email: string;
  clientId: string;
  clientSecret: string;          // empty string for Outlook (public client)
  expiresAt: number;             // unix ms when the access token expires
  lastSync: number | null;
}

/** A generic IMAP inbox connected with email + app-password. */
export interface ImapAccount {
  /** The email address / IMAP username. */
  email: string;
  /** IMAP hostname, e.g. imap.mail.me.com */
  host: string;
  /** IMAP port — almost always 993 (TLS). */
  port: number;
  /** Unix ms of last successful sync, or null. */
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
  /** Predicted topic from voice parsing — pre-selects the destination. */
  suggestedTopicId?: string;
  /** Predicted deadline from voice parsing (unix ms). */
  deadline?: number | null;
  deadlineLabel?: string | null;
  /** Optional effort estimate set during triage (Round 7, P-B). */
  effort?: Effort;
}

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

/** A single block on the daily planner grid. */
export interface PlannerItem {
  id: number;
  /** Unix ms at local midnight — identifies which day this block belongs to. */
  date: number;
  /** Start time in minutes from midnight (e.g. 480 = 08:00). */
  startMin: number;
  /** Duration in minutes (e.g. 60 = 1 hour). */
  duration: number;
  text: string;
  color: string;
  done: boolean;
  /** Optional link to a user topic for colour inheritance. */
  topicId?: string;
}

/** Maps localMidnight-ms-string → array of TopicItem id strings.
 *  Persisted per user so the plan survives app restarts.
 */
export type DailyPlan = Record<string, string[]>;

/**
 * Daily clear-streak — the "close your day" reward loop (Round 7, P-C).
 * Counts consecutive days the user reached zero actionable priorities. Persisted
 * the same local+sync way as Habits streaks; undefined = never closed a day.
 */
export interface ClearStreak {
  /** Consecutive days closed. */
  count: number;
  /** localMidnight-ms-string of the most recent day marked clear. */
  lastClearedKey: string | null;
  /** Best streak ever reached — a small persistent brag. */
  best: number;
}

// ── Habits ──────────────────────────────────────────────────────────────────

export interface Habit {
  /** Stable id. */
  id: string;
  /** Display name e.g. "Morning run". */
  name: string;
  /** Accent colour. */
  color: string;
  /** Optional Lucide icon name. */
  icon?: string;
  /**
   * Days this habit is active: 0=Mon … 6=Sun.
   * Empty array means every day.
   */
  activeDays: number[];
  /**
   * Completion log: localMidnight-ms-string → true.
   * Missing key = not completed that day.
   */
  entries: Record<string, true>;
  /** Nav sort order. */
  order: number;
}

export interface CalendarFeed {
  id: string;
  label: string;
  url: string;
}

export type CalendarProvider = 'googleCalendar' | 'appleCalendar';

/** An OAuth-connected calendar account. */
export interface CalendarConnection {
  provider: CalendarProvider;
  email: string;
  connectedAt: number;
  lastSync: number | null;
  /** Whether to show this account's events in the calendar view. */
  enabled: boolean;
  /** Optional color override for all events from this account. */
  color?: string;
}

/** A user-created calendar event (stored locally). */
export interface CalendarNote {
  id: string;
  title: string;
  /** Local midnight ms — which day this event belongs to.
   *  For a recurring class this is the term-start day (the first day the
   *  pattern may appear); see `repeat` below. */
  date: number;
  /** Start time in minutes from midnight (e.g. 540 = 09:00). null = all-day. */
  startMin: number | null;
  /** End time in minutes from midnight. null = no explicit end. */
  endMin: number | null;
  color: string;
  notes?: string;
  /** Optional room / location, e.g. "Room 3.21". Surfaced in the Today brief. */
  location?: string;
  /**
   * Optional recurrence — set ONLY for recurring classes/timetable entries.
   * Absent (undefined) = a one-off event (legacy behaviour, fully preserved).
   * Expanded client-side in lib/calendar.ts the same way topic deadlines are
   * synthesized — there is no separate stored occurrence.
   */
  repeat?: {
    /** Weekdays the class runs on: 0=Sun … 6=Sat (matches Date.getDay()). */
    weekdays: number[];
    /** Term start — local midnight ms. Occurrences before this are skipped. */
    termStart: number;
    /** Term end — local midnight ms. Occurrences after this are skipped. */
    termEnd: number;
  };
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: number;          // unix ms
  end: number | null;     // unix ms (null = point in time)
  allDay: boolean;
  color: string;
  source: 'ical' | 'deadline' | 'note';
  /** Set on deadline events so the day panel can jump to the section. */
  sectionId?: SectionId;
  /** Minutes from midnight — set for timed note events. */
  startMin?: number;
  endMin?: number;
  /** Optional room / location, e.g. "Room 3.21". Carried from recurring/one-off
   *  notes so the Today brief and Next-class banner can show where to be. */
  location?: string;
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

export type WidgetType =
  | 'summary' | 'miniCalendar' | 'upcomingDeadlines'
  | 'weather' | 'pomodoro' | 'quickCapture' | 'nowPlaying'
  | 'recentEmails' | 'notion' | 'budget' | 'habits' | 'quickAdd'
  | 'clock' | 'photo' | 'dailyPlanner' | 'todaySchedule' | 'today'
  | 'topicTodos' | 'topicLinks' | 'topicNote'
  | 'whatsapp' | 'map' | 'linkedin';

/** A placed widget on the home grid (combines instance + grid position). */
export interface HomeWidgetItem {
  i: string;            // unique instance id, also the react-grid-layout key
  type: WidgetType;
  x: number; y: number; w: number; h: number;
  /** Per-instance configuration (widget-type-specific, optional). */
  config?: Record<string, unknown>;
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

export type MoodId = 'dark' | 'light' | 'warm';
export type FontChoice = 'geist' | 'inter' | 'manrope' | 'quicksand' | 'mono' | 'fraunces';
export type FontSize = 'small' | 'medium' | 'large' | 'xlarge';
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
  /** Folder IDs hidden from the nav (their topics are hidden too). */
  hiddenFolderIds?: string[];
  /** Section the app opens to on launch. Can also be a topic id. */
  defaultSection: SectionId | string;
  /**
   * What the Home section shows: the zero-config "Briefing" (the auto-computed
   * Today brief, full-width), the "Week" surface (the days ahead, fused from
   * classes + deadlines + plan), or the customisable widget "Board".
   * Defaults to 'board' for everyone; changeable in Settings -> "Home shows".
   * Undefined is treated as 'board' for backward-compatibility.
   */
  homeLanding?: 'briefing' | 'week' | 'board';
  /**
   * One-time migration guard: older builds auto-assigned 'briefing' to new
   * accounts, so when this is falsy we reset the landing to 'board' once, then
   * set it true. A landing chosen after the migration sticks.
   */
  homeLandingBoardMigrated?: boolean;
  /**
   * One-time migration guard: the widget grid went from 12 cols / 32px rows to a
   * finer 24 cols / 16px rows so resizing is twice as precise. When falsy we
   * double every saved widget's x/y/w/h once (so boards look identical) and set
   * it true.
   */
  gridFinerMigrated?: boolean;
  /** Corner radius preset for home widgets. */
  widgetShape: WidgetShape;
  /** Border style preset for home widgets. */
  widgetBorder: WidgetBorder;
  /**
   * User's personal colour bank — the ONLY colours shown throughout the UI.
   * Max 30 entries. Empty array means the default palette is shown.
   */
  colorBank: string[];
  /** Ordered list of nav item IDs (topic IDs, folder IDs, section IDs). Controls full nav order. */
  navOrder?: string[];
  /** Global app background (wallpaper) — set by an applied Bozz World. */
  appBackground?: { url: string; dim: number; blur?: number };
  /** The currently-applied Bozz World (gallery 'applied' state + revert). */
  activeWorldId?: string;
  /** Ambient-sound state for the active World's looping audio. */
  ambient?: { worldId: string; volume: number; muted: boolean };
}

// ── Priority alerts (Bozz Plus — "Watch" pillar) ─────────────────────────────

export type AlertMatchType = 'sender' | 'keyword';

export interface AlertRule {
  id: string;
  /** User-facing name, e.g. "Lloyds". */
  label: string;
  type: AlertMatchType;
  /** sender: email/domain · keyword: word/phrase. */
  value: string;
  /** Only fire on unread messages. Default true. */
  unreadOnly: boolean;
  /** Empty = all connected accounts. */
  accountEmails: string[];
  enabled: boolean;
  createdAt: number;
}

export interface PriorityAlertSettings {
  /** Master switch. */
  enabled: boolean;
  rules: AlertRule[];
  /** Poll cadence in minutes. Default 3, floor 1. */
  pollMinutes: number;
  /** Local hour 0-23 quiet-hours start, or null = off. */
  quietFrom: number | null;
  quietTo: number | null;
  /** Whether notifications play a sound. Default true. */
  sound: boolean;
}

/** Dedup state — local-only, never synced (keeps the sync blob small). */
export interface AlertWatchState {
  /** Ring buffer of already-notified message ids, capped ~500. */
  notifiedIds: string[];
  lastCheck: number;
}

// ── Bozz Worlds (Bozz Plus — flagship "Looks/Moods" drops) ───────────────────

export interface BozzWorld {
  id: string;                  // "cozy-autumn"
  name: string;                // "Cozy Autumn"
  description: string;
  author: string;              // "Bozz"
  free: boolean;               // a few are free
  /**
   * 'theme'    = aesthetic only (mood, font, wallpaper) — e.g. Cozy Autumn.
   * 'template' = a pre-made page: widgets + look for a specific use (Shopping).
   */
  kind: 'theme' | 'template';
  // The look — maps onto AppearancePrefs:
  mood: MoodId;
  colorBank: string[];         // palette this World installs (<=30)
  accent: string;              // primary accent hex
  font: FontChoice;
  widgetShape?: WidgetShape;
  widgetBorder?: WidgetBorder;
  background: { url: string; dim: number; blur?: number };   // wallpaper
  ambientSound?: { url: string; name: string };              // looping audio, optional
  previewUrl: string;          // gallery thumbnail
  version: number;
  /** Lucide icon name for the topic/folder a World creates. */
  icon?: string;
  /**
   * Optional widgets a World installs when applied to a topic/folder scope (so
   * e.g. a "Shopping" World drops a ready-made Shopping topic). Empty/undefined
   * = a pure aesthetic World (look only).
   */
  topicWidgets?: HomeWidgetItem[];
  /**
   * Optional bespoke pipeline stages for the topic a template creates (e.g. the
   * Job Hunt template uses Applied / Interviewing / Offer / Rejected instead of
   * the default To do / Doing / Done). Ignored for pure themes.
   */
  stages?: TopicStage[];
}

/** Where an applied World should land. */
export type WorldScope = 'global' | 'newTopic' | 'existingTopic' | 'newFolder';

// ── Entitlement / billing (Bozz Plus — money model) ──────────────────────────

export type PlanTier = 'free' | 'plusMonthly' | 'plusAnnual' | 'worldsLifetime' | 'founding';

export interface Entitlement {
  tier: PlanTier;
  /** Can use the premium World library. */
  worldsAccess: boolean;
  /** Alert power-features, sync depth, etc. */
  plusFeatures: boolean;
  /** Subs only; renew resets it; undefined = perpetual. */
  expiresAt?: number;
  licenseKey?: string;
  source?: 'lemonsqueezy' | 'gumroad' | 'manual' | 'beta';
  activatedAt?: number;
}

export interface ListItem {
  id: number;
  text: string;
  status: Status;
  /** Set to Date.now() when status → 'done'; cleared (null) on restore. */
  completedAt: number | null;
  /** Optional due date, unix ms at local midnight. */
  deadline: number | null;
  /** Optional time-of-day for the deadline, minutes from local midnight.
   *  null/undefined = all-day (legacy behaviour — due at local midnight). */
  dueMin?: number | null;
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

// ── Health data ──────────────────────────────────────────────────────────────

export type HealthProvider = 'appleHealth' | 'googleFit';

export interface HealthConnection {
  provider: HealthProvider;
  connectedAt: number;
  /** Most recent sync timestamp. */
  lastSync: number | null;
}

/** A single day's summary of health metrics. */
export interface HealthDay {
  /** Local midnight unix ms. */
  date: number;
  steps: number | null;
  sleepHours: number | null;
  activeCalories: number | null;
  heartRateAvg: number | null;
}