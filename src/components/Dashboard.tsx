import { useState, useEffect, useRef, useMemo, useCallback, type ElementType, type CSSProperties } from 'react';
import {
  LayoutDashboard, CalendarDays, Wallet, Inbox, NotebookPen, Mail, Settings,
  PanelLeft, ChevronDown, ChevronRight, Pencil, Zap, Blocks, Plus, ListTree, FolderPlus,
} from 'lucide-react';
import SidebarEditNav from './SidebarEditNav';
import { routeVoice, describeRoute } from '../lib/voiceRouter';
import { predictTopic } from '../lib/taskParser';
import { deadlineEntries, dueTimestamp } from './widgets/util';
import { runNudgeCheck } from '../lib/deadlineNudges';
import { nextId } from '../lib/ids';
import VoiceButton from './shared/VoiceButton';
import { isMobileViewport, isTauri } from '../lib/platform';
import TitleBar, { TITLE_BAR_HEIGHT } from './TitleBar';
import BottomTabBar, { BOTTOM_TAB_HEIGHT, type NavTab } from './BottomTabBar';
import { iconForTopic } from './sections/settings/TopicsBlock';
import { useSession } from './AuthGate';
import { pullSnapshot, schedulePush, pushSnapshot, clearLocalSnapshot, cancelPendingPush, hasLocalData } from '../lib/sync';
import { supabase } from '../lib/supabase';
import { openUrl } from '@tauri-apps/plugin-opener';
import { listen } from '@tauri-apps/api/event';
import { getItem, setItem, initBackup } from '../lib/storage';
import { themes } from '../lib/themes';
import { DEFAULT_APPEARANCE, applyAppearanceVars } from '../lib/appearance';
import { fetchFeed } from '../lib/ical';
import { DEFAULT_BUDGET } from '../lib/budget';
import { buildSearchIndex } from '../lib/search';
import { DEFAULT_REVIEW_SETTINGS, pendingWeekStart, weekEndFromStart } from '../lib/review';
import { connectProvider, type ProviderConfig } from '../lib/oauth';
import { gmailConfig } from '../lib/oauth/gmail';
import { outlookConfig } from '../lib/oauth/outlook';
import { archive as archiveEmail, deleteEmail, disconnectAccount, markRead as markEmailRead, syncAllAccounts } from '../lib/email';
import type {
  SectionId, AppearancePrefs, HomeWidgetItem,
  CalendarFeed, CalendarCache, CalendarEvent, CalendarConnection, CalendarNote, BudgetData, InboxItem,
  WeeklyReview, ReviewSettings, OAuthAccount, EmailMessage, EmailProvider,
  Topic, TopicFolder, PriorityAlertSettings,
} from '../lib/types';
import {
  DEFAULT_ALERT_SETTINGS, startAlertWatcher, stopAlertWatcher, seedWatchState,
} from '../lib/alerts';
import { loadEntitlement } from '../lib/plus';
import { BgLayer } from './shared/BackgroundControls';
import WorldsView from './sections/WorldsView';
import TopicFolderEditModal from './TopicFolderEditModal';
import { makeBlankTopic, normalizeStages } from './sections/settings/TopicsBlock';
import { DEFAULT_HOME, WIDGET_REGISTRY } from './widgets/registry';
import HomeView from './sections/HomeView';
import BriefingView from './sections/BriefingView';
import WeekView from './sections/WeekView';
import TopicView from './sections/TopicView';
import SettingsView from './sections/SettingsView';
import AppsView from './sections/AppsView';
import Onboarding from './onboarding/Onboarding';
import WelcomeThemePicker from './onboarding/WelcomeThemePicker';
import WelcomeColdStart from './onboarding/WelcomeColdStart';
import WelcomeTimetable from './onboarding/WelcomeTimetable';
import HomeCoachChip from './onboarding/HomeCoachChip';
import FirstHoverHints from './shared/FirstHoverHint';
import CalendarView from './sections/calendar/CalendarView';
import { topicDeadlineEvents, noteEvents, eventsOnDay } from '../lib/calendar';
import DailyPlannerView from './sections/DailyPlannerView';
import HabitsView from './sections/HabitsView';
import HealthView from './sections/HealthView';
import QuickAddModal from './QuickAddModal';
import BudgetView from './sections/budget/BudgetView';
import InboxView from './sections/InboxView';
import ReviewView from './sections/review/ReviewView';
import EmailView from './sections/email/EmailView';
import SearchModal from './SearchModal';
import ErrorBoundary from './ErrorBoundary';

const EMAIL_REFRESH_MS = 15 * 60 * 1000;
const PROVIDER_CFG: Record<EmailProvider, ProviderConfig> = { gmail: gmailConfig, outlook: outlookConfig };

const FEED_COLORS = ['#7da7d9', '#c9a8d4', '#b8c7a1', '#d4b896', '#c7a1a1', '#a1bdc7'];
const FEED_REFRESH_MS = 60 * 60 * 1000;
const EMPTY_CACHE: CalendarCache = { lastSync: null, feeds: {} };

export default function Dashboard() {
  const session = useSession();
  const userId = session?.user.id ?? null;
  const [appearance, setAppearance] = useState<AppearancePrefs>(DEFAULT_APPEARANCE);
  const [activeSection, setActiveSection] = useState<string>('home');
  const [loading, setLoading] = useState(true);
  const [homeItems, setHomeItems] = useState<HomeWidgetItem[]>(DEFAULT_HOME);
  const [calendarFeeds, setCalendarFeeds] = useState<CalendarFeed[]>([]);
  const [calendarCache, setCalendarCache] = useState<CalendarCache>(EMPTY_CACHE);
  const [calendarConnections, setCalendarConnections] = useState<CalendarConnection[]>([]);
  const [gcalEvents, setGcalEvents] = useState<CalendarEvent[]>([]);
  const [gcalError, setGcalError] = useState<string | null>(null);
  const [, setFeedsSyncing] = useState(false);
  const syncingRef = useRef(false);
  const [budget, setBudget] = useState<BudgetData>(DEFAULT_BUDGET);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [reviews, setReviews] = useState<WeeklyReview[]>([]);
  const [reviewSettings, setReviewSettings] = useState<ReviewSettings>(DEFAULT_REVIEW_SETTINGS);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  // Calendar focus request — set when a specific event is clicked elsewhere so
  // the Calendar opens in DAY mode on that event's date. A fresh object per click
  // (CalendarView keys its focus effect on identity) re-focuses even on same date.
  const [calendarFocus, setCalendarFocus] = useState<{ date: number; mode?: import('../lib/types').CalendarViewMode } | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [oauthAccounts, setOauthAccounts] = useState<OAuthAccount[]>([]);
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [emailsSyncing, setEmailsSyncing] = useState(false);
  const [emailSyncErrors, setEmailSyncErrors] = useState<Array<{ account: string; error: string }>>([]);
  const emailSyncRef = useRef(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
  const [voicePartial, setVoicePartial] = useState<string>('');
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicFolders, setTopicFolders] = useState<TopicFolder[]>([]);
  const [sidebarEditing, setSidebarEditing] = useState(false);
  const [collapsedFolderOpen, setCollapsedFolderOpen] = useState<string | null>(null);
  const [onbDismissed, setOnbDismissed] = useState(false);
  // When a walkthrough is active the Onboarding component must stay mounted
  // even when the user navigates away from home so the spotlight persists.
  const [onbKeepMounted, setOnbKeepMounted] = useState(false);
  // Replay mode: force the getting-started guide to show even after every step
  // is complete, so "Replay walkthroughs" in Settings can always bring it back.
  const [onbForced, setOnbForced] = useState(false);
  const onbInit = useRef(false);
  // First-run flow — shown once to brand-new accounts before anything else.
  // 'theme' = pick dark/light, 'coldstart' = guided "what are you here for?"
  // seeding, 'timetable' = paste your real calendar feed, then null = done. Every
  // step is skippable.
  const [welcomePhase, setWelcomePhase] = useState<'theme' | 'coldstart' | 'timetable' | null>(null);
  // Topic/folder rename modal (opened from sidebar edit mode); declared early so
  // the onboarding ctx signals below can read the topic being edited.
  const [editTopicId, setEditTopicId] = useState<string | null>(null);
  const [editFolderId, setEditFolderId] = useState<string | null>(null);

  // Exit edit mode automatically when the user navigates away or collapses the sidebar
  useEffect(() => { setSidebarEditing(false); }, [activeSection, sidebarCollapsed]);
  const [calendarNotes, setCalendarNotes] = useState<CalendarNote[]>([]);
  const [dailyPlan, setDailyPlan] = useState<import('../lib/types').DailyPlan>({});
  const [habits, setHabits] = useState<import('../lib/types').Habit[]>([]);
  const [clearStreak, setClearStreak] = useState<import('../lib/types').ClearStreak>({ count: 0, lastClearedKey: null, best: 0 });
  const [healthDays, setHealthDays] = useState<import('../lib/types').HealthDay[]>([]);
  const [priorityAlerts, setPriorityAlerts] = useState<PriorityAlertSettings>(DEFAULT_ALERT_SETTINGS);
  const alertsSeededRef = useRef(false);
  // Phone-width auto-collapse: on viewports under 768px (iPhone-ish), the
  // 232px sidebar would swallow most of the screen. Force-collapse it and
  // re-evaluate on resize so the sidebar pops back open on orientation
  // change or split-view.
  const [isMobile, setIsMobile] = useState<boolean>(() => isMobileViewport());
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 768px)');
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  // When the viewport flips to mobile we auto-collapse; we don't auto-
  // expand on the way back, so the user's preference is respected when
  // they're on desktop.
  useEffect(() => {
    if (isMobile && !sidebarCollapsed) setSidebarCollapsed(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

  useEffect(() => {
    async function loadData() {
      if (userId) {
        // If there's local data that was never pushed (e.g. push failed on sign-out,
        // or app was force-closed), push it first before pulling — otherwise the
        // pull would overwrite it with the older Supabase snapshot.
        if (await hasLocalData()) {
          await pushSnapshot(userId);
        }
        await pullSnapshot(userId);
      }

      const keys = [
        'darkMode', 'appearance', 'homeLayout',
        'calendarFeeds', 'calendarCache', 'calendarConnections', 'budget', 'inbox', 'recentSearches',
        'reviews', 'reviewSettings', 'oauthAccounts', 'emailsCache', 'sidebarCollapsed',
        'topics', 'topicFolders',
        'calendarNotes', 'dailyPlan', 'habits', 'clearStreak', 'healthDays',
        'priorityAlerts',
      ];
      let appr: AppearancePrefs = { ...DEFAULT_APPEARANCE };
      let appearanceLoaded = false;
      let legacyDark: boolean | undefined;
      let loadedTopics: Topic[] | null = null;
      let loadedHomeItems: HomeWidgetItem[] | null = null;
      let gridV = 2; // assume new format unless we see an old-style array

      for (const key of keys) {
        try {
          const result = await getItem(key);
          if (result?.value) {
            const val: unknown = JSON.parse(result.value);
            if (key === 'darkMode') {
              legacyDark = val as boolean;
            } else if (key === 'homeLayout') {
              if (Array.isArray(val)) {
                // v1 format: plain array (ROW_H=64) — migrate by doubling h and y.
                const valid = (val as HomeWidgetItem[]).filter(
                  w => w && typeof w.i === 'string' && w.type in WIDGET_REGISTRY,
                );
                if (valid.length > 0) { loadedHomeItems = valid; gridV = 1; }
              } else if (val && typeof val === 'object' && (val as Record<string, unknown>).v === 2) {
                // v2 format: { v: 2, items: [...] } — load directly, no migration.
                const items = (val as { v: 2; items: HomeWidgetItem[] }).items;
                if (Array.isArray(items)) {
                  const valid = items.filter(w => w && typeof w.i === 'string' && w.type in WIDGET_REGISTRY);
                  if (valid.length > 0) loadedHomeItems = valid;
                }
              }
            } else if (key === 'calendarFeeds' && Array.isArray(val)) {
              setCalendarFeeds(val as CalendarFeed[]);
            } else if (key === 'calendarCache' && val && typeof val === 'object') {
              const c = val as CalendarCache;
              if (c.feeds) setCalendarCache({ lastSync: c.lastSync ?? null, feeds: c.feeds });
            } else if (key === 'calendarConnections' && Array.isArray(val)) {
              setCalendarConnections(val as CalendarConnection[]);
            } else if (key === 'budget' && val && typeof val === 'object') {
              const raw = val as Partial<BudgetData> & {
                ious?: Array<{ id: number; person: string; amount: number; direction: 'owedToMe' | 'iOwe'; note: string; settled: boolean; date: number }>;
              };
              const b = { ...DEFAULT_BUDGET, ...raw };
              // Older recurring items predate frequency/dayOfWeek.
              b.recurring = b.recurring.map(r => ({
                ...r, frequency: r.frequency ?? 'monthly', dayOfWeek: r.dayOfWeek ?? 0,
              }));
              // Legacy IOUs are now just transactions.
              if (Array.isArray(raw.ious)) {
                const migrated = raw.ious
                  .filter(i => !i.settled)
                  .map(i => ({
                    id: i.id, date: i.date, amount: i.amount,
                    category: 'IOU',
                    type: (i.direction === 'owedToMe' ? 'owed-to-me' : 'i-owe') as BudgetData['transactions'][number]['type'],
                    note: i.person + (i.note ? `: ${i.note}` : ''),
                  }));
                b.transactions = [...b.transactions, ...migrated];
              }
              setBudget(b);
            } else if (key === 'inbox' && Array.isArray(val)) {
              setInbox(val as InboxItem[]);
            } else if (key === 'recentSearches' && Array.isArray(val)) {
              setRecentSearches(val as string[]);
            } else if (key === 'reviews' && Array.isArray(val)) {
              setReviews(val as WeeklyReview[]);
            } else if (key === 'reviewSettings' && val && typeof val === 'object') {
              setReviewSettings({ ...DEFAULT_REVIEW_SETTINGS, ...(val as Partial<ReviewSettings>) });
            } else if (key === 'oauthAccounts' && Array.isArray(val)) {
              setOauthAccounts(val as OAuthAccount[]);
            } else if (key === 'emailsCache' && Array.isArray(val)) {
              setEmails(val as EmailMessage[]);
            } else if (key === 'appearance' && val && typeof val === 'object') {
              appr = { ...DEFAULT_APPEARANCE, ...(val as Partial<AppearancePrefs>) };
              appearanceLoaded = true;
            } else if (key === 'sidebarCollapsed' && typeof val === 'boolean') {
              setSidebarCollapsed(val);
            } else if (key === 'topics' && Array.isArray(val)) {
              loadedTopics = val as Topic[];
            } else if (key === 'topicFolders' && Array.isArray(val)) {
              setTopicFolders((val as TopicFolder[]).map(f => ({ ...f, collapsed: true })));
            } else if (key === 'calendarNotes' && Array.isArray(val)) {
              setCalendarNotes(val as CalendarNote[]);
            } else if (key === 'dailyPlan' && val && typeof val === 'object') {
              setDailyPlan(val as import('../lib/types').DailyPlan);
            } else if (key === 'habits' && Array.isArray(val)) {
              setHabits(val as import('../lib/types').Habit[]);
            } else if (key === 'clearStreak' && val && typeof val === 'object') {
              const cs = val as Partial<import('../lib/types').ClearStreak>;
              setClearStreak({
                count: typeof cs.count === 'number' ? cs.count : 0,
                lastClearedKey: typeof cs.lastClearedKey === 'string' ? cs.lastClearedKey : null,
                best: typeof cs.best === 'number' ? cs.best : 0,
              });
            } else if (key === 'healthDays' && Array.isArray(val)) {
              setHealthDays(val as import('../lib/types').HealthDay[]);
            } else if (key === 'priorityAlerts' && val && typeof val === 'object') {
              setPriorityAlerts({ ...DEFAULT_ALERT_SETTINGS, ...(val as Partial<PriorityAlertSettings>), rules: (val as PriorityAlertSettings).rules ?? [] });
            }
          }
        } catch { /* ignore individual key errors */ }
      }

      // Migrate the old boolean dark/light toggle into a mood, only if the
      // new appearance prefs were never written.
      if (!appearanceLoaded && legacyDark !== undefined) {
        appr.mood = legacyDark ? 'dark' : 'light';
      }
      // Migrate any old mood names to valid values
      if (appr.mood !== 'dark' && appr.mood !== 'light' && appr.mood !== 'warm') appr.mood = 'dark';

      // Migrate v1 grid layouts (ROW_H=64) → v2 (ROW_H=32): double h and y.
      if (gridV === 1) {
        if (loadedHomeItems) {
          loadedHomeItems = loadedHomeItems.map(it => ({ ...it, h: it.h * 2, y: it.y * 2 }));
        }
        if (loadedTopics) {
          loadedTopics = loadedTopics.map(tp => ({
            ...tp,
            widgetLayout: tp.widgetLayout?.map(it => ({ ...it, h: it.h * 2, y: it.y * 2 })),
          }));
        }
      }
      if (loadedHomeItems) setHomeItems(loadedHomeItems);

      // Brand-new accounts start with NO topics — the Home walkthroughs guide
      // the user through creating their first one. Existing users load theirs.
      // Normalize stages so the last stage is the done one (migrates topics that
      // predate the "last stage = done, always" rule).
      setTopics(
        loadedTopics && loadedTopics.length > 0
          ? loadedTopics.map(tp => ({ ...tp, stages: normalizeStages(tp.stages ?? []) }))
          : [],
      );

      // A genuinely brand-new account — nothing of theirs in storage. Computed
      // before setAppearance so the home-landing default below lands in one pass.
      const brandNewAccount = !appearanceLoaded && !loadedHomeItems
        && (!loadedTopics || loadedTopics.length === 0);

      // Home landing surface: default everyone to the Board (the customisable
      // widget home). Only defaulted when the user has no explicit stored
      // preference, so a returning user's saved choice always wins. The landing
      // is changeable any time in Settings -> "Home shows".
      if (appr.homeLanding == null) {
        appr.homeLanding = 'board';
      }

      setAppearance(appr);
      if (appr.defaultSection !== 'settings' && (appr.hiddenSections as string[]).includes(appr.defaultSection)) {
        setActiveSection('home');
      } else {
        setActiveSection(appr.defaultSection);
      }

      // First-run welcome (theme picker): only for a genuinely brand-new
      // account — nothing of theirs in storage and no prior choice yet. Decided
      // here from the loaded data so it can never race with async state.
      const welcomeChosen = await getItem('welcomeComplete');
      if (welcomeChosen?.value == null && brandNewAccount) setWelcomePhase('theme');

      setLoading(false);
      initBackup();
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const save = async (key: string, value: unknown) => {
    try { await setItem(key, JSON.stringify(value)); }
    catch (e) { console.error('Save error:', e); }
    // Debounced push to Supabase whenever any synced key changes
    if (userId) schedulePush(userId);
  };

  // Onboarding visibility: show the getting-started walkthroughs to brand-new
  // accounts; respect a stored dismissal for everyone else (and after the user
  // replays them from Settings).
  useEffect(() => {
    if (loading || onbInit.current) return;
    onbInit.current = true;
    getItem('onboardingDismissed').then(r => {
      if (r?.value != null) {
        try { setOnbDismissed(JSON.parse(r.value) === true); } catch { /* ignore */ }
      } else {
        const established = oauthAccounts.length > 0 || topics.length > 0;
        setOnbDismissed(established);
      }
    }).catch(() => {});
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const chooseWelcomeMood = (mood: 'dark' | 'light') => {
    setAppearance(a => ({ ...a, mood }));
    // Advance to the guided cold-start step rather than finishing here, so a
    // brand-new account lands on a populated dashboard, not an empty home.
    setWelcomePhase('coldstart');
  };

  // Guided cold-start: seed a real (empty) colour-coded topic per chosen "what are
  // you here for?" answer (MULTI-select, P4) — each carries its keyword set so
  // predictTopic can route the first capture — then advance to the timetable step
  // so their REAL classes fill Today + the calendar. The home layout uses the
  // first choice's starter. Only ever runs for brand-new accounts (gated by
  // welcomePhase), so existing users are unaffected.
  const chooseColdStart = (options: import('../lib/coldStart').ColdStartOption[]) => {
    const chosen = options ?? [];
    if (chosen.length === 0) { setWelcomePhase('timetable'); return; }
    void (async () => {
      const { seedColdStart } = await import('../lib/coldStart');
      const seeds = chosen.map(seedColdStart);
      // Re-number topic order so each seeded topic gets a distinct nav slot.
      const seededTopics = seeds.map((s, i) => ({ ...s.topic, order: i }));
      setTopics(prev => [...prev, ...seededTopics]);
      setHomeItems(seeds[0].homeItems);
      setWelcomePhase('timetable');
    })();
  };

  const skipColdStart = () => {
    setWelcomePhase('timetable');
  };

  // Finish the welcome flow: land on the populated home and mark welcome done so
  // the flow never re-runs. P4: the outcome-driven welcome (theme → cold-start →
  // timetable) already hands a new account a populated Briefing, so DON'T also
  // gate them behind the four spotlight tours — dismiss those by default. They
  // stay fully re-runnable from Settings ("Replay walkthroughs").
  const finishWelcome = () => {
    setActiveSection('home');
    setWelcomePhase(null);
    setOnbDismissed(true);
    void save('welcomeComplete', true);
    void save('onboardingDismissed', true);
  };

  // Timetable step: the validated feed lands via setCalendarFeeds (the existing
  // refreshFeeds effect then fetches + caches it, filling Today + the calendar).
  const addWelcomeFeed = (feed: import('../lib/types').CalendarFeed) => {
    setCalendarFeeds(prev => [...prev, feed]);
    finishWelcome();
  };

  // Timetable step (type path): typed recurring classes land directly as
  // CalendarNotes — noteEvents() expands them onto Today + the calendar with no
  // fetch needed. The shared id minting mirrors saveNote() in CalendarView.
  const addWelcomeNotes = (notes: Array<Omit<import('../lib/types').CalendarNote, 'id'>>) => {
    if ((notes ?? []).length === 0) { finishWelcome(); return; }
    setCalendarNotes(prev => [
      ...prev,
      ...notes.map(n => ({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ...n })),
    ]);
    finishWelcome();
  };

  const dismissOnboarding = () => {
    setOnbKeepMounted(false);
    setOnbForced(false);
    setOnbDismissed(true);
    void save('onboardingDismissed', true);
  };
  const replayWalkthroughs = () => {
    // Force the guide to show even when every step is already complete, and
    // navigate home where it lives — so it's always reachable from Settings.
    // The tours spotlight Board controls (Add widget, Edit layout…), so switch
    // the Home landing to the Board first or the spotlight has nothing to anchor.
    setOnbForced(true);
    setOnbDismissed(false);
    void save('onboardingDismissed', false);
    setHomeLanding('board');
    setActiveSection('home');
  };

  // Onboarding step signals (auto-check the walkthrough steps as they're done).
  // Onboarding ctx signals — drive the walkthrough auto-advance.
  const onbCurrentTopicId = topics.some(tp => tp.id === activeSection) ? activeSection : null;
  const onbTopicWidgetTypes = onbCurrentTopicId
    ? (topics.find(tp => tp.id === onbCurrentTopicId)?.widgetLayout ?? []).map(w => w.type).filter(ty => ty !== 'topicTodos')
    : [];
  // The topic open in the rename modal — drives the "customise icon/stages" steps.
  const onbEditTopic = editTopicId ? topics.find(tp => tp.id === editTopicId) : null;
  const onbIconCustomised = !!onbEditTopic && onbEditTopic.icon !== 'list';
  const onbStagesCustomised = !!onbEditTopic && (
    onbEditTopic.stages.length !== 3 ||
    onbEditTopic.stages.some((s, i) => s.label !== ['To do', 'Doing', 'Done'][i])
  );
  // Walkthroughs are always re-runnable — the guide shows until the user
  // dismisses it (or replays from Settings); there's no "completed" state.
  const showOnboarding = onbForced || !onbDismissed;

  useEffect(() => { applyAppearanceVars(appearance); }, [appearance]);

  useEffect(() => { if (!loading) save('appearance', appearance); }, [appearance, loading]);
  useEffect(() => { if (!loading) save('homeLayout', { v: 2, items: homeItems }); }, [homeItems, loading]);
  useEffect(() => { if (!loading) save('calendarFeeds', calendarFeeds); }, [calendarFeeds, loading]);
  useEffect(() => { if (!loading) save('calendarCache', calendarCache); }, [calendarCache, loading]);
  useEffect(() => { if (!loading) save('calendarConnections', calendarConnections); }, [calendarConnections, loading]);
  useEffect(() => { if (!loading) save('budget', budget); }, [budget, loading]);
  useEffect(() => { if (!loading) save('inbox', inbox); }, [inbox, loading]);
  useEffect(() => { if (!loading) save('recentSearches', recentSearches); }, [recentSearches, loading]);
  useEffect(() => { if (!loading) save('reviews', reviews); }, [reviews, loading]);
  useEffect(() => { if (!loading) save('reviewSettings', reviewSettings); }, [reviewSettings, loading]);
  useEffect(() => { if (!loading) save('oauthAccounts', oauthAccounts); }, [oauthAccounts, loading]);
  useEffect(() => { if (!loading) save('emailsCache', emails); }, [emails, loading]);
  useEffect(() => { if (!loading) save('sidebarCollapsed', sidebarCollapsed); }, [sidebarCollapsed, loading]);
  useEffect(() => { if (!loading) save('topics', topics); }, [topics, loading]);
  useEffect(() => { if (!loading) save('topicFolders', topicFolders); }, [topicFolders, loading]);
  useEffect(() => { if (!loading) save('calendarNotes', calendarNotes); }, [calendarNotes, loading]);
  useEffect(() => { if (!loading) save('dailyPlan', dailyPlan); }, [dailyPlan, loading]);
  useEffect(() => { if (!loading) save('habits', habits); }, [habits, loading]);
  useEffect(() => { if (!loading) save('clearStreak', clearStreak); }, [clearStreak, loading]);
  useEffect(() => { if (!loading) save('healthDays', healthDays); }, [healthDays, loading]);
  useEffect(() => { if (!loading) save('priorityAlerts', priorityAlerts); }, [priorityAlerts, loading]);

  // Hydrate the Plus entitlement (license) into the sync cache once on mount.
  useEffect(() => { void loadEntitlement(); }, []);

  // ── Priority-alert watcher ─────────────────────────────────────────────────
  // Start/stop/restart the background email watcher as auth, settings (rules /
  // cadence) and connected accounts change. On first enable, seed the watch
  // state so only genuinely new mail fires (no back-dump of existing inbox).
  useEffect(() => {
    if (loading) { stopAlertWatcher(); return; }
    const active = priorityAlerts.enabled
      && priorityAlerts.rules.some(r => r.enabled)
      && oauthAccounts.length > 0;
    if (!active) {
      alertsSeededRef.current = false;
      stopAlertWatcher();
      return;
    }
    let cancelled = false;
    (async () => {
      if (!alertsSeededRef.current) {
        alertsSeededRef.current = true;
        await seedWatchState(oauthAccounts);
      }
      if (cancelled) return;
      startAlertWatcher({
        settings: priorityAlerts,
        accounts: oauthAccounts,
        onCaught: () => {
          // Bring the main window forward when a watched email is caught.
          if (isTauri()) {
            import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
              try { const w = getCurrentWindow(); void w.show(); void w.setFocus(); } catch { /* ignore */ }
            }).catch(() => {});
          }
        },
      });
    })();
    return () => { cancelled = true; stopAlertWatcher(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, priorityAlerts, oauthAccounts]);

  const lastEmailSync = useMemo(() => {
    if (oauthAccounts.length === 0) return null;
    const stamps = oauthAccounts.map(a => a.lastSync).filter((s): s is number => s != null);
    return stamps.length > 0 ? Math.max(...stamps) : null;
  }, [oauthAccounts]);

  const syncEmails = useCallback(async (accountsArg?: OAuthAccount[]) => {
    const accounts = accountsArg ?? oauthAccounts;
    if (emailSyncRef.current || accounts.length === 0) return;
    emailSyncRef.current = true;
    setEmailsSyncing(true);
    try {
      const result = await syncAllAccounts(accounts);
      setOauthAccounts(result.accounts);
      setEmails(result.messages);
      setEmailSyncErrors(result.errors);
      if (result.errors.length > 0) console.warn('Email sync errors:', result.errors);
    } catch (e) {
      console.error('Email sync failed:', e);
    }
    emailSyncRef.current = false;
    setEmailsSyncing(false);
  }, [oauthAccounts]);

  // Sync on startup and whenever the account list changes.
  useEffect(() => {
    if (!loading && oauthAccounts.length > 0) syncEmails(oauthAccounts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, oauthAccounts.length]);

  // Periodic refresh.
  useEffect(() => {
    if (loading) return;
    const id = setInterval(() => { syncEmails(); }, EMAIL_REFRESH_MS);
    return () => clearInterval(id);
  }, [loading, syncEmails]);

  const connectAccount = async (provider: EmailProvider, clientId: string) => {
    const account = await connectProvider(PROVIDER_CFG[provider], clientId);
    const next = [
      ...oauthAccounts.filter(a => !(a.provider === provider && a.email === account.email)),
      account,
    ];
    setOauthAccounts(next);
    await syncEmails(next);
  };

  const disconnect = async (provider: EmailProvider, email: string) => {
    const acc = oauthAccounts.find(a => a.provider === provider && a.email === email);
    if (acc) await disconnectAccount(acc);
    setOauthAccounts(prev => prev.filter(a => !(a.provider === provider && a.email === email)));
    setEmails(prev => prev.filter(m => !(m.provider === provider && m.accountEmail === email)));
    setEmailSyncErrors(prev => prev.filter(e => e.account !== email));
  };

  const onEmailMarkRead = async (m: EmailMessage) => {
    const account = oauthAccounts.find(a => a.provider === m.provider && a.email === m.accountEmail);
    if (!account) return;
    try {
      await markEmailRead(account, m, a => setOauthAccounts(prev => prev.map(p => p.email === a.email && p.provider === a.provider ? a : p)));
      setEmails(prev => prev.map(x => x.id === m.id ? { ...x, unread: false } : x));
    } catch (e) { console.error('Mark read failed:', e); }
  };

  const onEmailArchive = async (m: EmailMessage) => {
    const account = oauthAccounts.find(a => a.provider === m.provider && a.email === m.accountEmail);
    if (!account) return;
    try {
      await archiveEmail(account, m, a => setOauthAccounts(prev => prev.map(p => p.email === a.email && p.provider === a.provider ? a : p)));
      setEmails(prev => prev.filter(x => x.id !== m.id));
    } catch (e) { console.error('Archive failed:', e); }
  };

  const onEmailDelete = async (m: EmailMessage) => {
    const account = oauthAccounts.find(a => a.provider === m.provider && a.email === m.accountEmail);
    if (!account) return;
    try {
      await deleteEmail(account, m, a => setOauthAccounts(prev => prev.map(p => p.email === a.email && p.provider === a.provider ? a : p)));
      setEmails(prev => prev.filter(x => x.id !== m.id));
    } catch (e) { console.error('Delete failed:', e); }
  };

  const onEmailOpen = (m: EmailMessage) => { openUrl(m.permalink).catch(console.error); };

  // Once a week, when the configured trigger has passed, create a pending review.
  useEffect(() => {
    if (loading) return;
    const tick = () => {
      const ws = pendingWeekStart(new Date(), reviewSettings, reviews);
      if (ws == null) return;
      if (reviews.some(r => r.weekStart === ws)) return;
      setReviews(prev => [...prev, {
        id: `rev-${ws}`, weekStart: ws, weekEnd: weekEndFromStart(ws),
        reviewedAt: null, note: '',
      }]);
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [loading, reviewSettings, reviews]);

  // Quick-capture window may write to any of these keys (voice routing
  // dispatches into tasks / budget / inbox). Reload them all when notified.
  useEffect(() => {
    const reloadAll = async () => {
      const reload = async <T,>(key: string, setter: (v: T) => void) => {
        const r = await getItem(key);
        if (r?.value) {
          try { setter(JSON.parse(r.value) as T); } catch { /* ignore */ }
        }
      };
      await Promise.all([
        reload<InboxItem[]>('inbox', setInbox),
        reload<Topic[]>('topics', setTopics),
        reload<BudgetData>('budget', setBudget),
      ]);
    };
    const un = listen('data:changed', () => { void reloadAll(); });
    return () => { un.then(f => f()); };
  }, []);

  // Sidebar voice handler — routes the transcript locally (no storage write
  // needed, the state-change effects above persist it).
  const handleVoiceTranscript = useCallback((transcript: string) => {
    const route = routeVoice(transcript);
    setVoiceStatus(`→ ${describeRoute(route)}`);
    if (route.kind === 'inbox') {
      setInbox(prev => [...prev, { id: nextId(), text: route.text, createdAt: Date.now() }]);
    } else if (route.kind === 'topic') {
      addTopicItem(route.topicId, route.item.text, route.item.deadline ?? null);
    } else if (route.kind === 'budget') {
      setBudget(b => ({ ...b, transactions: [...b.transactions, route.transaction] }));
    }
    setVoicePartial('');
    // Clear the status after a moment
    window.setTimeout(() => setVoiceStatus(null), 2200);
  }, []);

  // Ctrl/Cmd+K opens global search. Ctrl/Cmd+B opens Quicks.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'k' || e.key.toLowerCase() === 'f')) {
        e.preventDefault();
        setSearchOpen(o => !o);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        // Desktop opens the native always-on-top capture window; in the
        // browser we show the in-app quick-add modal instead.
        if (isTauri()) setActiveSection('inbox');
        else setQuickAddOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const t = themes[appearance.mood];

  const addMenuItem: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '0.45rem',
    background: 'transparent', border: 'none', borderRadius: '6px',
    padding: '0.4rem 0.6rem', color: t.text, cursor: 'pointer',
    fontFamily: 'inherit', fontSize: '0.8rem', textAlign: 'left', width: '100%',
  };

  // Sidebar may have a dark background (e.g. warm terracotta) while the main
  // content is light — use CSS vars so the sidebar text always contrasts.
  const sT = {
    text:         'var(--sidebar-text, ' + t.text + ')',
    textMuted:    'var(--sidebar-text-muted, ' + t.textMuted + ')',
    textDim:      'var(--sidebar-text-dim, ' + t.textDim + ')',
    bgAlt:        'var(--sidebar-bg-alt, ' + t.bgAlt + ')',
    border:       'var(--sidebar-border, ' + t.border + ')',
    borderStrong: 'var(--sidebar-border-strong, ' + t.borderStrong + ')',
    panel:        'var(--sidebar-bg-alt, ' + t.panel + ')',
    doneAccent:   t.doneAccent,
  };

  const patchAppearance = (patch: Partial<AppearancePrefs>) =>
    setAppearance(prev => ({ ...prev, ...patch }));
  const resetAppearance = () => setAppearance(DEFAULT_APPEARANCE);
  const resetHomeLayout = () => setHomeItems(DEFAULT_HOME);

  // Home landing surface (P1): 'briefing' = the zero-config Today brief,
  // 'week' = the days-ahead week surface, 'board' = the customisable widget grid.
  // Undefined → 'board' (existing users).
  const homeLanding: 'briefing' | 'week' | 'board' = appearance.homeLanding ?? 'board';
  const setHomeLanding = (mode: 'briefing' | 'week' | 'board') => patchAppearance({ homeLanding: mode });

  // Open the Calendar focused on a specific event's date, in DAY mode. Used when
  // a user clicks a concrete calendar event (Today / Week / mini-calendar) so the
  // calendar lands on that day rather than the default month/today.
  const openCalendarOnDate = (ts: number) => {
    setCalendarFocus({ date: ts, mode: 'day' });
    setActiveSection('calendar');
  };

  // ── Topic / folder editing from the sidebar edit mode ──────────────────────
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  const addTopicFromNav = () => {
    const fresh = makeBlankTopic(topics.length, appearance.colorBank ?? []);
    setTopics(prev => [...prev, fresh]);
    setEditTopicId(fresh.id);
  };
  const addFolderFromNav = () => {
    const folder: TopicFolder = {
      id: `folder-${Date.now().toString(36)}`, name: '',
      color: (appearance.colorBank ?? [])[0], order: topicFolders.length, collapsed: false,
    };
    setTopicFolders(prev => [...prev, folder]);
    setEditFolderId(folder.id);
  };
  const updateTopic = (id: string, patch: Partial<Topic>) =>
    setTopics(prev => prev.map(tp => tp.id === id ? { ...tp, ...patch } : tp));
  const deleteTopic = (id: string) => {
    setTopics(prev => prev.filter(tp => tp.id !== id).map((tp, i) => ({ ...tp, order: i })));
    setEditTopicId(null);
  };
  const updateFolder = (id: string, patch: Partial<TopicFolder>) =>
    setTopicFolders(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));
  const deleteFolder = (id: string) => {
    setTopicFolders(prev => prev.filter(f => f.id !== id));
    setTopics(prev => prev.map(tp => tp.folderId === id ? { ...tp, folderId: undefined } : tp));
    setEditFolderId(null);
  };
  const toggleHiddenTopic = (id: string) =>
    setAppearance(a => {
      const cur = a.hiddenTopicIds ?? [];
      return { ...a, hiddenTopicIds: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id] };
    });
  const toggleHiddenFolder = (id: string) =>
    setAppearance(a => {
      const cur = a.hiddenFolderIds ?? [];
      return { ...a, hiddenFolderIds: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id] };
    });
  const toggleHiddenSection = (id: SectionId) =>
    setAppearance(a => {
      const cur = a.hiddenSections;
      const next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id];
      const defaultSection = (next as string[]).includes(a.defaultSection) ? 'home' : a.defaultSection;
      return { ...a, hiddenSections: next, defaultSection };
    });

  const addTopicItem = (topicId: string, text: string, deadline: number | null, stageId?: string) => {
    setTopics(prev => prev.map(top => {
      if (top.id !== topicId) return top;
      const targetStage = stageId
        ? top.stages.find(s => s.id === stageId)
        : top.stages.find(s => !s.done);
      const sid = targetStage?.id ?? top.stages[0]?.id ?? '';
      return {
        ...top,
        items: [...top.items, { id: nextId(), text, stageId: sid, completedAt: null, deadline }],
      };
    }));
  };

  const addToInbox = (text: string, deadline: number | null) => {
    const suggested = predictTopic(text, topics);
    setInbox(prev => [...prev, {
      id: nextId(), text, createdAt: Date.now(),
      suggestedTopicId: suggested?.id, deadline: deadline ?? undefined,
    }]);
  };

  // First-class, topic-free deadline capture. Routes a dated task to a sensible
  // default destination so logging "stats essay due friday" works even on a
  // zero-topic account: predict a topic if one matches, else reuse/lazily create
  // a single "Deadlines" bucket. Done in one setTopics updater so the create +
  // append never races. `setActiveSection` is intentionally not called — capture
  // shouldn't yank the user off Home.
  const DEADLINES_TOPIC_NAME = 'Deadlines';
  const addDeadline = (text: string, deadline: number | null) => {
    setTopics(prev => {
      // 1. Best matching existing topic (keyword/name/description scoring).
      const predicted = predictTopic(text, prev);
      // 2. Else an existing "Deadlines" bucket, if the user already has one.
      const existingDeadlines = prev.find(tp => tp.name.trim().toLowerCase() === DEADLINES_TOPIC_NAME.toLowerCase());
      // 3. Else any existing topic at all (so a single-topic account just files there).
      const target = predicted ?? existingDeadlines ?? prev[0] ?? null;

      const newItem = (t: Topic) => ({
        id: nextId(),
        text,
        stageId: (t.stages.find(s => !s.done) ?? t.stages[0])?.id ?? '',
        completedAt: null,
        deadline,
      });

      if (target) {
        return prev.map(tp => tp.id === target.id ? { ...tp, items: [...tp.items, newItem(tp)] } : tp);
      }

      // 4. Zero topics — lazily spin up a real "Deadlines" topic to capture into.
      const bucket = makeBlankTopic(prev.length, appearance.colorBank ?? []);
      bucket.name = DEADLINES_TOPIC_NAME;
      bucket.icon = 'flame';
      bucket.keywords = ['deadline', 'due', 'exam', 'submission', 'coursework', 'assignment'];
      bucket.items = [newItem(bucket)];
      return [...prev, bucket];
    });
  };

  const onAdvanceStage = (topicId: string, itemId: number) => {
    setTopics(prev => prev.map(top => {
      if (top.id !== topicId) return top;
      return {
        ...top,
        items: top.items.map(item => {
          if (item.id !== itemId) return item;
          const idx = top.stages.findIndex(s => s.id === item.stageId);
          const next = top.stages[idx + 1];
          if (!next) return item;
          return { ...item, stageId: next.id, completedAt: next.done ? Date.now() : null };
        }),
      };
    }));
  };

  const refreshFeeds = useCallback(async () => {
    if (syncingRef.current || calendarFeeds.length === 0) return;
    syncingRef.current = true;
    setFeedsSyncing(true);
    const feeds: CalendarCache['feeds'] = {};
    await Promise.all(calendarFeeds.map(async (feed, idx) => {
      const color = FEED_COLORS[idx % FEED_COLORS.length];
      try {
        feeds[feed.id] = { fetchedAt: Date.now(), events: await fetchFeed(feed, color) };
      } catch (e) {
        feeds[feed.id] = { fetchedAt: Date.now(), events: [], error: String(e) };
      }
    }));
    setCalendarCache({ lastSync: Date.now(), feeds });
    syncingRef.current = false;
    setFeedsSyncing(false);
  }, [calendarFeeds]);

  // Refresh feeds on startup and whenever the feed list changes.
  useEffect(() => {
    if (!loading && calendarFeeds.length > 0) refreshFeeds();
  }, [loading, calendarFeeds, refreshFeeds]);

  // Hourly background refresh.
  useEffect(() => {
    if (loading) return;
    const id = setInterval(() => { refreshFeeds(); }, FEED_REFRESH_MS);
    return () => clearInterval(id);
  }, [loading, refreshFeeds]);

  const feedEvents = useMemo<CalendarEvent[]>(() => {
    const ids = new Set(calendarFeeds.map(f => f.id));
    const icsEvents = Object.entries(calendarCache.feeds)
      .filter(([id]) => ids.has(id))
      .flatMap(([, entry]) => entry.events);
    // Merge in Google Calendar events from enabled connections.
    return [...icsEvents, ...gcalEvents];
  }, [calendarFeeds, calendarCache, gcalEvents]);

  const todayEvents = useMemo(() => {
    const allEvents = [
      ...topicDeadlineEvents(topics),
      ...feedEvents,
      ...noteEvents(calendarNotes),
    ];
    return eventsOnDay(allEvents, new Date());
  }, [topics, feedEvents, calendarNotes]);

  // Calendar events over the next ~14 days (from today's local midnight), fed to
  // deadline-aware widgets so imported exams/coursework appear in Today Priorities
  // and Upcoming deadlines. Topic deadlines are intentionally excluded here —
  // deadlineEntries() already surfaces those from topic items, so re-adding them
  // would double-count.
  const upcomingEvents = useMemo<CalendarEvent[]>(() => {
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const from = startOfToday.getTime();
    const to = from + 14 * 24 * 60 * 60 * 1000;
    return [...feedEvents, ...noteEvents(calendarNotes)]
      .filter(e => e.start >= from && e.start <= to);
  }, [feedEvents, calendarNotes]);

  // Calendar events across the CURRENT week (Mon→Sun), fed to the Week landing
  // surface so it can lay out classes per day — including days earlier in the
  // week than today (which upcomingEvents, anchored at today, omits). Feed +
  // note events only; topic deadlines are surfaced separately via deadlineEntries.
  const weekEvents = useMemo<CalendarEvent[]>(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    const offset = (d.getDay() + 6) % 7; // days since Monday
    d.setDate(d.getDate() - offset);
    const from = d.getTime();
    const to = from + 7 * 24 * 60 * 60 * 1000;
    return [...feedEvents, ...noteEvents(calendarNotes)]
      .filter(e => e.start >= from && e.start < to);
  }, [feedEvents, calendarNotes]);

  // Calendar events over a LONG window (term-length, ~120 days) AND any overdue.
  // Fed ONLY to the Deadlines hub so its "Later" bucket is meaningful — the
  // 14-day upcomingEvents above (used by widgets) is intentionally left untouched.
  // Includes events from before today so overdue imported deadlines still show.
  const deadlineWindowEvents = useMemo<CalendarEvent[]>(() => {
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const to = startOfToday.getTime() + 120 * 24 * 60 * 60 * 1000;
    return [...feedEvents, ...noteEvents(calendarNotes)]
      .filter(e => e.start <= to);
  }, [feedEvents, calendarNotes]);

  // ── Proactive LOCAL deadline nudges (P2) ───────────────────────────────────
  // Free, on-device, no Plus gate, no server. Drives off the SAME deadline
  // stream the Today brief uses (deadlineEntries → dueTimestamp) plus the next
  // upcoming class. Fires a once-per-morning digest + day-before / morning-of
  // per-deadline nudges, deduped + permission-aware (see lib/deadlineNudges).
  useEffect(() => {
    if (loading) return;
    const check = () => {
      // Project the deadline stream into the minimal shape the nudger needs.
      const ctxLike = {
        topics,
        upcomingEvents: deadlineWindowEvents,
      } as unknown as import('./widgets/context').WidgetCtx;
      const deadlines = deadlineEntries(ctxLike)
        .map(e => {
          const due = dueTimestamp(e.item);
          return due == null ? null : { id: `${e.section}:${e.item.id}`, text: e.item.text, due };
        })
        .filter((d): d is { id: string; text: string; due: number } => d != null);

      // Next still-upcoming timed event today → "14:00" label.
      const now = Date.now();
      const nextTimed = (todayEvents ?? [])
        .filter(e => !e.allDay && e.start >= now)
        .sort((a, b) => a.start - b.start)[0];
      const nextEventLabel = nextTimed
        ? new Date(nextTimed.start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        : null;

      void runNudgeCheck({ deadlines, nextEventLabel });
    };
    // Run shortly after load (let initial state settle) then every 30 min.
    const initial = window.setTimeout(check, 4000);
    const id = setInterval(check, 30 * 60_000);
    return () => { clearTimeout(initial); clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, topics, deadlineWindowEvents, todayEvents]);

  // Fetch Google Calendar events whenever there's an enabled connection.
  const gcalConn = useMemo(
    () => calendarConnections.find(c => c.provider === 'googleCalendar' && c.enabled),
    [calendarConnections],
  );
  useEffect(() => {
    if (loading) return;
    if (!gcalConn) { setGcalEvents([]); setGcalError(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const { fetchGCalEvents } = await import('../lib/gcal');
        const events = await fetchGCalEvents(gcalConn.color);
        if (!cancelled) { setGcalEvents(events); setGcalError(null); }
      } catch (e) {
        if (!cancelled) { setGcalEvents([]); setGcalError(String(e instanceof Error ? e.message : e)); }
      }
    })();
    return () => { cancelled = true; };
  }, [gcalConn, loading]);

  const allSections: Array<{ id: SectionId; label: string; icon: ElementType }> = [
    { id: 'home', label: 'Home', icon: LayoutDashboard },
    { id: 'calendar', label: 'Calendar', icon: CalendarDays },
    { id: 'budget', label: 'Budget', icon: Wallet },
    { id: 'inbox', label: 'Inbox', icon: Inbox },
    { id: 'review', label: 'Review', icon: NotebookPen },
    { id: 'email', label: 'Email', icon: Mail },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  // Unified nav: Home → topics (in sidebar order) → other visible sections
  const hiddenTopicIds = appearance.hiddenTopicIds ?? [];
  const hiddenFolderIds = appearance.hiddenFolderIds ?? [];
  const navItems: NavTab[] = useMemo(() => {
    const visibleSections = allSections.filter(
      s => s.id !== 'settings' && s.id !== 'inbox' && !appearance.hiddenSections.includes(s.id),
    );
    const home   = visibleSections.find(s => s.id === 'home');
    const middle = visibleSections.filter(s => s.id !== 'home');

    const allVisible = topics.filter(tp => !hiddenTopicIds.includes(tp.id) && !(tp.folderId && hiddenFolderIds.includes(tp.folderId)));
    const unfiled    = allVisible.filter(tp => !tp.folderId);

    // Mirror the sidebar order: unfiled topics + folders interleaved by unified order,
    // then folder topics nested under their folder's position.
    type TLItem = { order: number; tabs: NavTab[] };
    const topLevel: TLItem[] = [
      ...unfiled.map(tp => ({
        order: tp.order,
        tabs: [{ id: tp.id, label: tp.name || 'New topic', icon: iconForTopic(tp.icon), accent: tp.color }],
      })),
      ...topicFolders.filter(f => !hiddenFolderIds.includes(f.id)).map(f => ({
        order: f.order,
        tabs: allVisible
          .filter(tp => tp.folderId === f.id)
          .sort((a, b) => a.order - b.order)
          .map(tp => ({ id: tp.id, label: tp.name || 'New topic', icon: iconForTopic(tp.icon), accent: tp.color })),
      })),
    ].sort((a, b) => a.order - b.order);

    return [
      ...(home ? [{ id: home.id, label: home.label, icon: home.icon }] : []),
      ...topLevel.flatMap(i => i.tabs),
      ...middle.map(s => ({ id: s.id, label: s.label, icon: s.icon })),
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appearance.hiddenSections, hiddenTopicIds, hiddenFolderIds, topics, topicFolders]);

  // If the item you're viewing gets hidden, fall back to home.
  // 'settings' and 'inbox' are intentionally absent from navItems but still valid sections.
  // Built-in sections (email, calendar, budget, etc.) remain valid even when hidden from
  // the sidebar — only bounce if it's a topic ID that no longer exists.
  const builtInSectionIds = new Set(['home', 'settings', 'inbox', 'apps',
    'calendar', 'budget', 'review', 'email', 'planner', 'dailyPlanner', 'habits', 'health',
    'worlds']);
  useEffect(() => {
    if (builtInSectionIds.has(activeSection)) return; // always valid, even if hidden from nav
    const stillVisible = navItems.some(n => n.id === activeSection);
    if (!stillVisible) setActiveSection('home');
  }, [navItems, activeSection]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    const m = themes[DEFAULT_APPEARANCE.mood];
    return (
      <div style={{
        minHeight: '100vh', background: m.bg, color: m.textMuted,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--app-font)',
        fontWeight: 300, letterSpacing: '0.05em', fontSize: '0.9rem',
      }}>
        loading
      </div>
    );
  }

  // When running inside Tauri, offset all fixed-position content below the title bar.
  const tbOffset = isTauri() ? TITLE_BAR_HEIGHT : 0;

  return (
    <div style={{
      display: 'flex', minHeight: '100vh', backgroundColor: t.bg, color: t.text,
      backgroundImage: 'var(--app-gradient)',
      backgroundAttachment: 'fixed',
      fontFamily: 'var(--app-font)',
      fontWeight: 300, transition: 'background 0.3s, color 0.3s',
      // Push content below the fixed title bar
      paddingTop: tbOffset,
    }}>
      {/* Custom frameless title bar — renders only inside Tauri */}
      <TitleBar theme={t} />

      {/* Global app background — set by an applied Bozz World (appearance-only). */}
      {appearance.appBackground && <BgLayer bg={appearance.appBackground} t={t} />}

      {/* No mobile sidebar backdrop — sidebar is hidden on mobile.
          Navigation is handled by BottomTabBar on small viewports. */}

      {/* ── Sidebar — desktop only. Mobile navigation is handled by BottomTabBar. */}
      <aside data-onb="sidebar-nav" style={{
        display: isMobile ? 'none' : 'flex',
        width: sidebarCollapsed ? '64px' : '220px',
        flexShrink: 0,
        background: 'var(--sidebar-bg, ' + t.panel + ')',
        backdropFilter: 'var(--sidebar-blur, none)',
        WebkitBackdropFilter: 'var(--sidebar-blur, none)',
        border: `1px solid ${sT.border}`,
        borderRadius: '16px',
        boxShadow: 'var(--widget-shadow, 0 8px 32px rgba(0,0,0,0.35)), 0 0 0 0.5px ' + sT.border,
        padding: '1rem 0.6rem 0.85rem',
        flexDirection: 'column',
        position: 'sticky',
        top: tbOffset + 10, left: 0,
        zIndex: 1,
        margin: `10px 0 10px 10px`,
        height: `calc(100vh - ${tbOffset}px - 20px)`,
        overflowY: 'auto', overflowX: 'hidden',
        transition: 'width 0.35s var(--ease, cubic-bezier(0.16,1,0.3,1))',
      }}>
        {/* Brand row — name navigates home. Expanded: "BOZZ" wordmark on the
            left + collapse chevron on the right (row). Collapsed: the chevron on
            top with the B-logo mark beneath it (column). */}
        <div style={{
          display: 'flex',
          flexDirection: sidebarCollapsed ? 'column-reverse' : 'row',
          alignItems: 'center',
          gap: sidebarCollapsed ? '0.6rem' : '0.4rem',
          padding: '0.3rem 0.05rem 1.2rem',
          minWidth: 0,
          justifyContent: sidebarCollapsed ? 'center' : 'space-between',
        }}>
          {/* Home — "BOZZ" wordmark when expanded, the B-logo mark when collapsed. */}
          <button
            onClick={() => setActiveSection('home')}
            aria-label="Go to home"
            title="Home"
            style={{
              background: 'transparent', border: 'none',
              color: sT.text, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              fontSize: '1.02rem', fontWeight: 700, letterSpacing: '-0.01em',
              padding: '0.1rem 0.05rem', textAlign: 'left',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              flex: sidebarCollapsed ? '0 0 auto' : 1, minWidth: 0,
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
            }}
          >
            {sidebarCollapsed ? (
              <img
                src="/brand/bozz-mark-dark.png"
                alt="BOZZ"
                width={22} height={22}
                style={{
                  width: '22px', height: '22px', borderRadius: '7px', flexShrink: 0,
                  objectFit: 'cover', display: 'block',
                }}
              />
            ) : (
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>BOZZ</span>
            )}
          </button>

          {/* Chevron — collapses when expanded, expands when collapsed. */}
          <button
            onClick={() => setSidebarCollapsed(c => !c)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{
              background: 'transparent', border: 'none',
              color: sT.textDim, cursor: 'pointer',
              padding: '0.3rem', display: 'flex', flexShrink: 0,
              borderRadius: '6px',
              transition: 'background 0.12s, color 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = sT.bgAlt; e.currentTarget.style.color = sT.textMuted; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = sT.textDim; }}
          >
            <PanelLeft size={17} strokeWidth={1.6} />
          </button>
        </div>

        {/* Nav — folder-aware rendering, or edit mode drag list */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.05rem', flex: 1, overflowY: sidebarEditing ? 'auto' : undefined }}>
          {sidebarEditing ? (
            <SidebarEditNav
              topics={topics}
              topicFolders={topicFolders}
              hiddenTopicIds={hiddenTopicIds}
              hiddenFolderIds={hiddenFolderIds}
              hiddenSectionIds={appearance.hiddenSections}
              sections={allSections.filter(s => s.id !== 'settings' && s.id !== 'inbox' && s.id !== 'home')}
              navOrder={appearance.navOrder}
              sidebarCollapsed={sidebarCollapsed}
              t={t}
              onTopicsChange={setTopics}
              onTopicFoldersChange={setTopicFolders}
              onNavOrderChange={order => setAppearance(a => ({ ...a, navOrder: order }))}
              onToggleHiddenTopic={toggleHiddenTopic}
              onToggleHiddenFolder={toggleHiddenFolder}
              onToggleHiddenSection={(id) => toggleHiddenSection(id as SectionId)}
              onEditTopic={setEditTopicId}
              onEditFolder={setEditFolderId}
            />
          ) : (() => {
            const visibleSections = allSections.filter(
              s => s.id !== 'settings' && s.id !== 'inbox' && !appearance.hiddenSections.includes(s.id),
            );
            const middleSections = visibleSections.filter(s => s.id !== 'home');
            const visibleTopics = [...topics]
              .filter(top => !hiddenTopicIds.includes(top.id) && !(top.folderId && hiddenFolderIds.includes(top.folderId)));
            const unfiledTopics = visibleTopics.filter(top => !top.folderId);

            // Unified nav: topics + folders + sections, all sorted by navOrder if present
            type NavTopItem =
              | { type: 'topic'; order: number; topic: typeof visibleTopics[0] }
              | { type: 'folder'; order: number; folder: typeof topicFolders[0] }
              | { type: 'section'; order: number; section: typeof middleSections[0] };

            const navOrder = appearance.navOrder;
            const orderOf = (id: string, fallback: number) =>
              navOrder ? (navOrder.indexOf(id) === -1 ? 9999 + fallback : navOrder.indexOf(id)) : fallback;

            const topLevelNav: NavTopItem[] = [
              ...unfiledTopics.map(tp  => ({ type: 'topic'   as const, order: orderOf(tp.id, tp.order), topic: tp })),
              ...topicFolders.filter(f => !hiddenFolderIds.includes(f.id)).map(f => ({ type: 'folder'  as const, order: orderOf(f.id, f.order),   folder: f })),
              ...middleSections.map((s, i) => ({ type: 'section' as const, order: orderOf(s.id, 1000 + i), section: s })),
            ].sort((a, b) => a.order - b.order);

            const navBtn = (id: string, label: string, Icon: ElementType, _accent?: string, indent = false) => {
              const isActive = activeSection === id;
              return (
                <button
                  key={id}
                  data-onb={id === 'home' ? 'nav-home' : topics.some(tp => tp.id === id) ? 'topic-nav-item' : undefined}
                  onClick={() => setActiveSection(id)}
                  title={sidebarCollapsed ? label : undefined}
                  style={{
                    display: 'flex', alignItems: 'center',
                    justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                    gap: '0.5rem',
                    width: '100%',
                    background: isActive ? sT.bgAlt : 'transparent',
                    border: 'none',
                    color: isActive ? sT.text : sT.textMuted,
                    padding: sidebarCollapsed ? '0.5rem' : indent ? '0.42rem 0.6rem 0.42rem 1.4rem' : '0.42rem 0.6rem',
                    cursor: 'pointer', borderRadius: '8px',
                    fontSize: '0.875rem', fontWeight: isActive ? 500 : 400, letterSpacing: '-0.01em',
                    fontFamily: 'inherit', textAlign: 'left',
                    transition: 'background 0.15s, color 0.15s, transform 0.12s',
                    position: 'relative',
                  }}
                  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = sT.bgAlt; e.currentTarget.style.color = sT.text; if (sidebarCollapsed) e.currentTarget.style.transform = 'scale(1.12)'; } }}
                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = sT.textMuted; if (sidebarCollapsed) e.currentTarget.style.transform = 'scale(1)'; } }}
                >
                  {sidebarCollapsed ? (
                    <Icon size={16} strokeWidth={1.5} style={{ flexShrink: 0 }} />
                  ) : (
                    <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                      {label}
                    </span>
                  )}
                </button>
              );
            };

            return (
              <>
                {/* Home always first */}
                {navBtn('home', 'Home', LayoutDashboard)}
                {topLevelNav.map(item => {
                  if (item.type === 'topic') {
                    const top = item.topic;
                    return navBtn(top.id, top.name || 'New topic', iconForTopic(top.icon), top.color);
                  }
                  if (item.type === 'section') {
                    const s = item.section;
                    return navBtn(s.id, s.label, s.icon);
                  }
                  // Folder
                  const folder = item.folder;
                  const folderTopics = visibleTopics.filter(top => top.folderId === folder.id);
                  const FolderIcon = iconForTopic(folder.icon);

                  if (sidebarCollapsed) {
                    // Collapsed: show folder icon, click to toggle inline topic icons
                    if (folderTopics.length === 0) return null;
                    const isOpen = collapsedFolderOpen === folder.id;
                    return (
                      <div key={folder.id}>
                        <button
                          onClick={() => setCollapsedFolderOpen(isOpen ? null : folder.id)}
                          title={folder.name}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '100%',
                            background: isOpen ? sT.bgAlt : 'transparent',
                            border: 'none',
                            color: isOpen ? sT.text : sT.textMuted,
                            padding: '0.5rem', cursor: 'pointer',
                            borderRadius: isOpen ? '8px 8px 0 0' : '8px',
                            transition: 'background 0.15s, color 0.15s, border-radius 0.15s, transform 0.12s',
                          }}
                          onMouseEnter={e => { if (!isOpen) { e.currentTarget.style.background = sT.bgAlt; e.currentTarget.style.color = sT.text; e.currentTarget.style.transform = 'scale(1.12)'; } }}
                          onMouseLeave={e => { if (!isOpen) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = sT.textMuted; e.currentTarget.style.transform = 'scale(1)'; } }}
                        >
                          <FolderIcon size={16} strokeWidth={1.5} />
                        </button>
                        {isOpen && (
                          <div style={{
                            background: sT.bgAlt,
                            borderRadius: '0 0 8px 8px',
                            borderTop: `1px solid ${sT.border}`,
                            paddingTop: '0.2rem',
                            paddingBottom: '0.2rem',
                          }}>
                            {folderTopics.map(top =>
                              navBtn(top.id, top.name || 'New topic', iconForTopic(top.icon), top.color)
                            )}
                          </div>
                        )}
                      </div>
                    );
                  }

                  // Expanded: show folder name with collapse chevron
                  const isCollapsed = folder.collapsed;
                  return (
                    <div key={folder.id}>
                      <button
                        onClick={() => setTopicFolders(prev => prev.map(f => f.id === folder.id ? { ...f, collapsed: !f.collapsed } : f))}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.4rem',
                          background: 'transparent', border: 'none',
                          color: sT.textMuted, padding: '0.42rem 0.6rem',
                          cursor: 'pointer', borderRadius: '8px',
                          fontSize: '0.875rem', fontWeight: 400, letterSpacing: '-0.01em',
                          fontFamily: 'inherit', textAlign: 'left', width: '100%',
                          transition: 'background 0.15s, color 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = sT.bgAlt; e.currentTarget.style.color = sT.text; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = sT.textMuted; }}
                      >
                        <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                          {folder.name || '(folder)'}
                        </span>
                        {isCollapsed
                          ? <ChevronRight size={11} strokeWidth={1.5} color={sT.textDim} style={{ flexShrink: 0 }} />
                          : <ChevronDown size={11} strokeWidth={1.5} color={sT.textDim} style={{ flexShrink: 0 }} />
                        }
                      </button>
                      {!isCollapsed && (
                        <div style={{
                          borderLeft: `2px solid ${sT.border}`,
                          marginLeft: '0.9rem',
                          paddingLeft: '0.3rem',
                          marginBottom: '0.1rem',
                        }}>
                          {folderTopics.map(top =>
                            navBtn(top.id, top.name || 'New topic', iconForTopic(top.icon), top.color)
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            );
          })()}
        </nav>

        {/* Voice status — only useful when there's room to read it */}
        <div style={{
          padding: voiceStatus && !sidebarCollapsed ? '0.4rem 0.7rem' : '0 0.7rem',
          fontSize: '0.7rem', color: t.doneAccent,
          letterSpacing: '0.02em',
          maxHeight: voiceStatus && !sidebarCollapsed ? '2em' : '0',
          opacity: voiceStatus && !sidebarCollapsed ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.18s ease, opacity 0.18s ease, padding 0.18s ease',
        }}>
          {voiceStatus}
        </div>
        <div style={{
          padding: voicePartial && !sidebarCollapsed ? '0 0.7rem 0.4rem' : '0 0.7rem',
          fontSize: '0.72rem', color: sT.textMuted, fontStyle: 'italic',
          maxHeight: voicePartial && !sidebarCollapsed ? '3.2em' : '0',
          opacity: voicePartial && !sidebarCollapsed ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.18s ease, opacity 0.18s ease, padding 0.18s ease',
        }}>
          {voicePartial}
        </div>

        {/* Quick add + Edit row — compact, side by side */}
        {!sidebarCollapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.1rem 0' }}>
            <button
              onClick={() => setQuickAddOpen(true)}
              data-onb="quick-add"
              title="Quick add"
              aria-label="Quick add"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                flexShrink: 0,
                background: 'transparent',
                border: `1px solid ${sT.border}`,
                color: sT.textMuted,
                cursor: 'pointer', borderRadius: '6px',
                padding: '0.28rem 0.6rem',
                fontSize: '0.75rem', fontWeight: 500,
                fontFamily: 'inherit',
                transition: 'background 0.15s, color 0.15s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = sT.bgAlt; e.currentTarget.style.color = sT.text; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = sT.textMuted; }}
            >
              <Zap size={10} strokeWidth={1.8} style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Quick add</span>
            </button>
            <button
              onClick={() => setSidebarEditing(e => !e)}
              data-onb="edit-nav"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
                flexShrink: 0,
                background: sidebarEditing ? t.doneAccent : 'transparent',
                border: `1px solid ${sidebarEditing ? t.doneAccent : sT.border}`,
                borderRadius: '6px',
                padding: '0.28rem 0.6rem',
                fontSize: '0.75rem', fontWeight: 500,
                color: sidebarEditing ? '#fff' : sT.textMuted,
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {sidebarEditing ? <><span style={{ fontSize: '0.7rem' }}>✓</span> Done</> : <><Pencil size={9} strokeWidth={1.8} /> Edit</>}
            </button>
            {sidebarEditing && (
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <button
                  onClick={() => setAddMenuOpen(o => !o)}
                  data-onb="nav-add-menu"
                  title="Add topic or folder"
                  aria-label="Add topic or folder"
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    background: 'transparent', border: `1px solid ${sT.border}`, borderRadius: '6px',
                    padding: '0.3rem 0.4rem', color: sT.textMuted, cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'background 0.15s, color 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = sT.bgAlt; e.currentTarget.style.color = sT.text; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = sT.textMuted; }}
                >
                  <Plus size={13} strokeWidth={2} />
                </button>
                {addMenuOpen && (
                  <div style={{
                    position: 'absolute', bottom: '34px', right: 0, zIndex: 60,
                    background: t.panel, border: `1px solid ${t.borderStrong}`, borderRadius: '9px',
                    padding: '0.25rem', minWidth: '130px', boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
                    display: 'flex', flexDirection: 'column', gap: '0.1rem',
                  }}>
                    <button data-onb="nav-new-topic" onClick={() => { setAddMenuOpen(false); addTopicFromNav(); }} style={addMenuItem}
                      onMouseEnter={e => { e.currentTarget.style.background = t.bgAlt; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                      <ListTree size={13} strokeWidth={1.6} /> New topic
                    </button>
                    <button data-onb="nav-new-folder" onClick={() => { setAddMenuOpen(false); addFolderFromNav(); }} style={addMenuItem}
                      onMouseEnter={e => { e.currentTarget.style.background = t.bgAlt; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                      <FolderPlus size={13} strokeWidth={1.6} /> New folder
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Bottom row: mic + settings gear always visible, date fades when collapsed. */}
        <div style={{
          display: 'flex', flexDirection: sidebarCollapsed ? 'column' : 'row',
          alignItems: 'center',
          gap: '0.3rem',
          padding: '0.7rem 0.15rem 0.1rem',
          borderTop: `1px solid ${sT.border}`,
          marginTop: '0.4rem',
          minWidth: 0,
        }}>
          <VoiceButton
            t={t}
            onTranscript={handleVoiceTranscript}
            onPartial={setVoicePartial}
            iconOnly={sidebarCollapsed}
            label={false}
            iconSize={17}
          />
          {/* Collapsed-sidebar capture entry. The full "Quick add" button only
              shows when expanded, so without this a collapsed user (and any web
              user, where there's no global Ctrl+B) has no visible way to capture. */}
          {sidebarCollapsed && (
            <button
              onClick={() => setQuickAddOpen(true)}
              title={isTauri() ? 'Quick add (Ctrl+B)' : 'Quick add (Ctrl+B)'}
              aria-label="Quick add"
              data-onb="quick-add"
              style={{
                background: 'transparent', border: 'none',
                color: sT.textDim, cursor: 'pointer', borderRadius: '6px',
                padding: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'background 0.12s, color 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = sT.bgAlt; e.currentTarget.style.color = sT.text; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = sT.textDim; }}
            >
              <Zap size={17} strokeWidth={1.6} />
            </button>
          )}
          <button
            onClick={() => setActiveSection('settings')}
            title="Settings"
            aria-label="Settings"
            data-onb="nav-settings"
            style={{
              background: 'transparent', border: 'none',
              color: sT.textDim, cursor: 'pointer', borderRadius: '6px',
              padding: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'background 0.12s, color 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = sT.bgAlt; e.currentTarget.style.color = sT.text; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = sT.textDim; }}
          >
            <Settings size={17} strokeWidth={1.5} />
          </button>
          <button
            onClick={() => setActiveSection('apps')}
            title="Apps"
            aria-label="Apps"
            data-onb="apps"
            style={{
              background: activeSection === 'apps' ? sT.panel : 'transparent',
              border: 'none',
              color: activeSection === 'apps' ? sT.text : sT.textDim,
              cursor: 'pointer', borderRadius: '6px',
              padding: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'background 0.12s, color 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = sT.bgAlt; e.currentTarget.style.color = sT.text; }}
            onMouseLeave={e => { e.currentTarget.style.background = activeSection === 'apps' ? sT.panel : 'transparent'; e.currentTarget.style.color = activeSection === 'apps' ? sT.text : sT.textDim; }}
          >
            <Blocks size={17} strokeWidth={1.5} />
          </button>
          <button
            onClick={() => setActiveSection('inbox')}
            data-onb="nav-quicks"
            title={isTauri() ? 'Quicks (Ctrl+B)' : 'Quicks'}
            aria-label="Quicks"
            style={{
              background: activeSection === 'inbox' ? sT.panel : 'transparent',
              border: 'none',
              color: activeSection === 'inbox' ? sT.text : sT.textDim,
              cursor: 'pointer', borderRadius: '6px',
              padding: '0.4rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              position: 'relative',
              transition: 'background 0.12s, color 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = sT.bgAlt; e.currentTarget.style.color = sT.text; }}
            onMouseLeave={e => { e.currentTarget.style.background = activeSection === 'inbox' ? sT.panel : 'transparent'; e.currentTarget.style.color = activeSection === 'inbox' ? sT.text : sT.textDim; }}
          >
            <Inbox size={17} strokeWidth={1.5} />
            {inbox.length > 0 && (
              <span style={{
                position: 'absolute', top: 2, right: 2,
                width: '6px', height: '6px', borderRadius: '50%',
                background: t.doneAccent, pointerEvents: 'none',
              }} />
            )}
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      {/* position:relative + zIndex:1 keeps section content above the global
          appBackground BgLayer (portalled to body at zIndex 0); without it an
          applied World's wallpaper paints over Settings/Worlds and swallows
          clicks visually. Home wraps its own content the same way. */}
      <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
        <div style={{
          maxWidth: '1600px', margin: '0 auto',
          padding: isMobile ? '1.25rem 1rem 1.5rem' : '2.5rem 3.25rem',
          // Respect iOS safe-area insets when running as PWA.
          paddingTop: `max(${isMobile ? '1.25rem' : '2.5rem'}, env(safe-area-inset-top))`,
          // On mobile, leave room below for the bottom tab bar + safe area.
          paddingBottom: isMobile
            ? `max(${BOTTOM_TAB_HEIGHT + 16}px, calc(${BOTTOM_TAB_HEIGHT}px + env(safe-area-inset-bottom) + 16px))`
            : `max(2.5rem, env(safe-area-inset-bottom))`,
        }}>


        <main>
          {welcomePhase === 'theme' && <WelcomeThemePicker onChoose={chooseWelcomeMood} />}
          {welcomePhase === 'coldstart' && (
            <WelcomeColdStart onChoose={chooseColdStart} onSkip={skipColdStart} />
          )}
          {welcomePhase === 'timetable' && (
            <WelcomeTimetable
              t={t}
              colorBank={appearance.colorBank ?? []}
              onAdd={addWelcomeFeed}
              onAddNotes={addWelcomeNotes}
              onSkip={finishWelcome}
            />
          )}
          <FirstHoverHints />
          {(activeSection === 'home' || onbKeepMounted) && showOnboarding && (
            <ErrorBoundary label="the getting-started guide">
              <Onboarding
                t={t}
                activeSection={activeSection}
                currentTopicId={onbCurrentTopicId}
                sidebarEditing={sidebarEditing}
                topicCount={topics.length}
                topicWidgetTypes={onbTopicWidgetTypes}
                inboxCount={inbox.length}
                emailConnected={oauthAccounts.length > 0}
                iconCustomised={onbIconCustomised}
                stagesCustomised={onbStagesCustomised}
                onDismiss={dismissOnboarding}
                onWalkStart={() => setOnbKeepMounted(true)}
                onWalkEnd={() => setOnbKeepMounted(false)}
                onExitSidebarEdit={() => setSidebarEditing(false)}
              />
            </ErrorBoundary>
          )}
          {/* Home stays mounted (display toggle) so returning is instant and the
              widget grid never re-animates — see gridReady in HomeView.
              Home has two landing surfaces (P1): the zero-config Briefing and the
              customisable Board. The Board (HomeView) always stays mounted (only
              its visibility toggles) so its grid never re-animates; the Briefing
              renders on top of it when selected. */}
          <ErrorBoundary label="the home view">
          {activeSection === 'home' && homeLanding === 'briefing' && (
            <BriefingView
              ctx={{
                t, budget, emails,
                setActiveSection,
                openCalendarOnDate,
                topics, addTopicItem, addToInbox, addDeadline, dailyPlan, onDailyPlanChange: setDailyPlan,
                onAdvanceStage, colorBank: appearance.colorBank ?? [],
                habits, onHabitsChange: setHabits,
                clearStreak, onClearStreakChange: setClearStreak,
                todayEvents, upcomingEvents, weekEvents, calendarNotes, onCalendarNotesChange: setCalendarNotes,
                widgetConfig: {}, onWidgetConfig: () => {},
                onTopicChange: (next) => setTopics(prev => prev.map(tp => tp.id === next.id ? next : tp)),
              }}
            />
          )}
          {activeSection === 'home' && homeLanding === 'week' && (
            <WeekView
              ctx={{
                t, budget, emails,
                setActiveSection,
                openCalendarOnDate,
                topics, addTopicItem, addToInbox, addDeadline, dailyPlan, onDailyPlanChange: setDailyPlan,
                onAdvanceStage, colorBank: appearance.colorBank ?? [],
                habits, onHabitsChange: setHabits,
                clearStreak, onClearStreakChange: setClearStreak,
                todayEvents, upcomingEvents, weekEvents, calendarNotes, onCalendarNotesChange: setCalendarNotes,
                widgetConfig: {}, onWidgetConfig: () => {},
                onTopicChange: (next) => setTopics(prev => prev.map(tp => tp.id === next.id ? next : tp)),
              }}
            />
          )}
          <div style={{ display: activeSection === 'home' && homeLanding === 'board' ? undefined : 'none' }}>
            {activeSection === 'home' && homeLanding === 'board' && welcomePhase == null && homeItems.length > 0 && (
              <HomeCoachChip
                t={t}
                signals={{
                  feedCount: calendarFeeds.length,
                  inboxCount: inbox.length,
                  plannedToday: (dailyPlan[String(new Date().setHours(0, 0, 0, 0))] ?? []).length,
                  emailConnected: oauthAccounts.length > 0,
                }}
                setActiveSection={setActiveSection}
              />
            )}
            <HomeView
              visible={activeSection === 'home' && homeLanding === 'board'}
              items={homeItems}
              setItems={setHomeItems}
              onReplayWalkthroughs={replayWalkthroughs}
              widgetShape={appearance.widgetShape ?? 'rounded'}
              widgetBorder={appearance.widgetBorder ?? 'normal'}
              onWidgetShape={(s) => patchAppearance({ widgetShape: s })}
              onWidgetBorder={(b) => patchAppearance({ widgetBorder: b })}
              ctx={{
                t, budget, emails,
                setActiveSection,
                openCalendarOnDate,
                topics, addTopicItem, addToInbox, addDeadline, dailyPlan, onDailyPlanChange: setDailyPlan,
                onAdvanceStage, colorBank: appearance.colorBank ?? [],
                habits, onHabitsChange: setHabits,
                clearStreak, onClearStreakChange: setClearStreak,
                todayEvents, upcomingEvents, calendarNotes, onCalendarNotesChange: setCalendarNotes,
                widgetConfig: {}, onWidgetConfig: () => {},
                onTopicChange: (next) => setTopics(prev => prev.map(tp => tp.id === next.id ? next : tp)),
              }}
            />
          </div>
          </ErrorBoundary>
          <ErrorBoundary key={activeSection} label="this section" onReset={() => setActiveSection('home')}>
          {activeSection === 'calendar' && (
            <CalendarView
              t={t}
              feedEvents={feedEvents}
              calendarFeeds={calendarFeeds}
              onAddFeed={(feed) => setCalendarFeeds(prev => [...prev, feed])}
              topics={topics}
              onAddTopicItem={(topicId, text, deadline) => {
                setTopics(prev => prev.map(tp =>
                  tp.id !== topicId ? tp : {
                    ...tp,
                    items: [...tp.items, { id: Date.now(), text, stageId: tp.stages[0]?.id ?? '', completedAt: null, deadline }],
                  }
                ));
              }}
              calendarNotes={calendarNotes}
              onCalendarNotesChange={setCalendarNotes}
              calendarConnections={calendarConnections}
              onCalendarConnectionsChange={setCalendarConnections}
              gcalError={gcalError ?? undefined}
              colorBank={appearance.colorBank ?? []}
              tbOffset={tbOffset}
              focusRequest={calendarFocus ?? undefined}
            />
          )}
          {activeSection === 'dailyPlanner' && (
            <DailyPlannerView
              t={t}
              topics={topics}
              plan={dailyPlan}
              onPlanChange={setDailyPlan}
              onAdvanceStage={onAdvanceStage}
            />
          )}
          {activeSection === 'habits' && (
            <HabitsView
              t={t}
              habits={habits}
              onChange={setHabits}
              colorBank={appearance.colorBank ?? []}
            />
          )}
          {activeSection === 'health' && (
            <HealthView
              t={t}
              healthDays={healthDays}
              onChange={setHealthDays}
              userRef={session?.user.email ?? session?.user.id ?? 'anon'}
            />
          )}
          {activeSection === 'budget' && (
            <BudgetView t={t} budget={budget} setBudget={setBudget} />
          )}
          {activeSection === 'review' && (
            <ReviewView
              t={t}
              reviews={reviews}
              setReviews={setReviews}
              budget={budget}
              topics={topics}
            />
          )}
          {activeSection === 'email' && (
            <EmailView
              t={t}
              accounts={oauthAccounts}
              messages={emails}
              syncing={emailsSyncing}
              lastSync={lastEmailSync}
              onRefresh={() => syncEmails()}
              onMarkRead={onEmailMarkRead}
              onArchive={onEmailArchive}
              onDelete={onEmailDelete}
              onOpen={onEmailOpen}
              priorityAlerts={priorityAlerts}
              onPriorityAlertsChange={setPriorityAlerts}
            />
          )}
          {activeSection === 'inbox' && (
            <InboxView
              t={t}
              inbox={inbox}
              setInbox={setInbox}
              topics={topics}
              onAssign={(text, topicId, deadline, effort) => {
                setTopics(prev => prev.map(top => {
                  if (top.id !== topicId) return top;
                  const firstStage = top.stages.find(s => !s.done) ?? top.stages[0];
                  return {
                    ...top,
                    items: [...top.items, {
                      id: Date.now(),
                      text,
                      stageId: firstStage?.id ?? '',
                      completedAt: null,
                      deadline,
                      ...(effort ? { effort } : {}),
                    }],
                  };
                }));
              }}
              onCreateTopicFromQuick={(text, deadline, effort) => {
                // First capture on a zero-topic account: spin up a real topic
                // seeded with this quick, then open the editor so the user can
                // name + tweak it — no dead-end, no Settings detour.
                const fresh = makeBlankTopic(topics.length, appearance.colorBank ?? []);
                fresh.items = [{
                  id: nextId(),
                  text,
                  stageId: (fresh.stages.find(s => !s.done) ?? fresh.stages[0])?.id ?? '',
                  completedAt: null,
                  deadline,
                  ...(effort ? { effort } : {}),
                }];
                setTopics(prev => [...prev, fresh]);
                setEditTopicId(fresh.id);
              }}
            />
          )}
          {(() => {
            const activeTopic = topics.find(top => top.id === activeSection);
            if (activeTopic) {
              return (
                <TopicView
                  topic={activeTopic}
                  onChange={(next) => setTopics(prev => prev.map(t => t.id === next.id ? next : t))}
                  t={t}
                  ctx={{
                    t, budget, emails,
                    setActiveSection,
                    openCalendarOnDate,
                    topics, addTopicItem, addToInbox, addDeadline, dailyPlan, onDailyPlanChange: setDailyPlan,
                    onAdvanceStage, colorBank: appearance.colorBank ?? [],
                    habits, onHabitsChange: setHabits,
                    todayEvents, upcomingEvents, calendarNotes, onCalendarNotesChange: setCalendarNotes,
                    widgetConfig: {}, onWidgetConfig: () => {},
                    currentTopicId: activeTopic.id,
                    onTopicChange: (next) => setTopics(prev => prev.map(tp => tp.id === next.id ? next : tp)),
                  }}
                />
              );
            }
            return null;
          })()}
          {activeSection === 'apps' && (
            <AppsView
              t={t}
              colorBank={appearance.colorBank}
              oauthAccounts={oauthAccounts}
              emailSyncErrors={emailSyncErrors}
              onConnectAccount={connectAccount}
              onDisconnectAccount={disconnect}
              calendarConnections={calendarConnections}
              onCalendarConnectionsChange={setCalendarConnections}
              healthConnections={[]}
              onHealthConnectionsChange={() => {}}
            />
          )}
          {activeSection === 'worlds' && (
            <WorldsView
              t={t}
              appearance={appearance}
              patchAppearance={patchAppearance}
              topics={topics}
              topicFolders={topicFolders}
              onTopicsChange={setTopics}
              onTopicFoldersChange={setTopicFolders}
              onNavigate={setActiveSection}
              onBack={() => setActiveSection('settings')}
            />
          )}
          {activeSection === 'settings' && (
            <SettingsView
              t={t}
              appearance={appearance}
              patchAppearance={patchAppearance}
              resetAppearance={resetAppearance}
              resetHomeLayout={resetHomeLayout}
              onClearTopics={() => {
                setTopics([]);
                setTopicFolders([]);
                patchAppearance({ hiddenTopicIds: [], hiddenFolderIds: [] });
              }}
              sections={allSections
                .filter(s => ['budget','calendar','email','review'].includes(s.id))
                .map(s => ({ id: s.id, label: s.label }))}
              hiddenTopicIds={hiddenTopicIds}
              accountEmail={session?.user.email ?? null}
              onSignOut={async () => {
                cancelPendingPush();
                // Push all local data to Supabase before wiping.
                // Only clear local storage if push succeeds — if it fails the data
                // stays locally and gets pushed again on next sign-in (recovery path).
                let pushOk = !userId; // no userId = nothing to push, treat as ok
                try { if (userId) pushOk = await pushSnapshot(userId); } catch { /* ignore */ }
                if (pushOk) {
                  try { await clearLocalSnapshot(); } catch { /* ignore */ }
                }
                // scope:'local' clears the session without needing a network call.
                // onAuthStateChange SIGNED_OUT fires → AuthGate shows login screen.
                try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* ignore */ }
              }}
              reviewSettings={reviewSettings}
              onReviewSettingsChange={setReviewSettings}
              onOpenApps={() => setActiveSection('apps')}
              onReplayWalkthroughs={replayWalkthroughs}
              topics={topics}
              onOpenWorlds={() => setActiveSection('worlds')}
            />
          )}
          </ErrorBoundary>
        </main>
        </div>
      </div>

      {quickAddOpen && (
        <QuickAddModal
          t={t}
          topics={topics}
          onClose={() => setQuickAddOpen(false)}
          onAddInbox={(items) => setInbox(prev => [...prev, ...items])}
          onAddBudget={(transaction) => setBudget(b => ({ ...b, transactions: [...b.transactions, transaction] }))}
          onAddToTopic={(topicId, text, deadline) => addTopicItem(topicId, text, deadline)}
          onAddDeadline={addDeadline}
        />
      )}

      {/* Topic / folder editor — opened from the sidebar edit mode */}
      {editTopicId && (() => {
        const topic = topics.find(tp => tp.id === editTopicId);
        if (!topic) return null;
        return (
          <TopicFolderEditModal
            t={t}
            bank={appearance.colorBank ?? []}
            topic={topic}
            onChangeTopic={(patch) => updateTopic(topic.id, patch)}
            onDelete={() => deleteTopic(topic.id)}
            onClose={() => setEditTopicId(null)}
          />
        );
      })()}
      {editFolderId && (() => {
        const folder = topicFolders.find(f => f.id === editFolderId);
        if (!folder) return null;
        return (
          <TopicFolderEditModal
            t={t}
            bank={appearance.colorBank ?? []}
            folder={folder}
            onChangeFolder={(patch) => updateFolder(folder.id, patch)}
            onDelete={() => deleteFolder(folder.id)}
            onClose={() => setEditFolderId(null)}
          />
        );
      })()}

      {searchOpen && (
        <SearchModal
          t={t}
          entries={buildSearchIndex({
            budget, inbox, feedEvents,
          })}
          recent={recentSearches}
          onClose={() => setSearchOpen(false)}
          onJump={(section) => setActiveSection(section)}
          onRecent={(query) =>
            setRecentSearches(prev => [query, ...prev.filter(x => x !== query)].slice(0, 5))}
          isMobile={isMobile}
          tbOffset={tbOffset}
        />
      )}

      {/* Bottom tab bar — mobile only */}
      {isMobile && (
        <BottomTabBar
          tabs={navItems}
          active={activeSection}
          onSelect={setActiveSection}
          quicksCount={inbox.length}
          onQuicks={() => setActiveSection('inbox')}
          onApps={() => setActiveSection('apps')}
          onSettings={() => setActiveSection('settings')}
          micButton={
            <VoiceButton
              t={t}
              onTranscript={handleVoiceTranscript}
              onPartial={setVoicePartial}
              iconOnly
              label={false}
              iconSize={16}
            />
          }
          t={t}
          tbOffset={tbOffset}
        />
      )}
    </div>
  );
}
