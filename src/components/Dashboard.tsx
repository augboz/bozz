import { useState, useEffect, useRef, useMemo, useCallback, type ElementType } from 'react';
import {
  Music, Briefcase, Sparkles, BookOpen,
  LayoutDashboard, FileText, CalendarDays, Wallet, Inbox, NotebookPen, Mail, Settings,
  PanelLeft, ChevronDown, ChevronRight, Pencil, Zap, LayoutGrid,
} from 'lucide-react';
import SidebarEditNav from './SidebarEditNav';
import { routeVoice, describeRoute } from '../lib/voiceRouter';
import { predictTopic } from '../lib/taskParser';
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
import { themes, sectionAccents } from '../lib/themes';
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
  ListItem, Application, Status, SectionId, SortMode, TaskListKey, AppearancePrefs, HomeWidgetItem,
  CalendarFeed, CalendarCache, CalendarEvent, CalendarConnection, CalendarNote, BudgetData, InboxItem,
  WeeklyReview, ReviewSettings, OAuthAccount, EmailMessage, EmailProvider,
  Topic, TopicFolder,
} from '../lib/types';
import { DEFAULT_HOME, WIDGET_REGISTRY } from './widgets/registry';
import HomeView from './sections/HomeView';
import SimpleListView from './sections/SimpleListView';
import TopicView from './sections/TopicView';
import ApplicationsView from './sections/ApplicationsView';
import SettingsView from './sections/SettingsView';
import AppsView from './sections/AppsView';
import Onboarding from './onboarding/Onboarding';
import CalendarView from './sections/calendar/CalendarView';
import { deadlineEvents, topicDeadlineEvents, noteEvents, eventsOnDay } from '../lib/calendar';
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
  const [musicItems, setMusicItems] = useState<ListItem[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [lifeItems, setLifeItems] = useState<ListItem[]>([]);
  const [cvItems, setCvItems] = useState<ListItem[]>([]);
  const [otherItems, setOtherItems] = useState<ListItem[]>([]);
  const [taskSortPrefs, setTaskSortPrefs] = useState<Record<TaskListKey, SortMode>>({
    music: 'manual', life: 'manual', cv: 'manual', other: 'manual',
  });
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

  // Exit edit mode automatically when the user navigates away or collapses the sidebar
  useEffect(() => { setSidebarEditing(false); }, [activeSection, sidebarCollapsed]);
  const [calendarNotes, setCalendarNotes] = useState<CalendarNote[]>([]);
  const [dailyPlan, setDailyPlan] = useState<import('../lib/types').DailyPlan>({});
  const [habits, setHabits] = useState<import('../lib/types').Habit[]>([]);
  const [healthDays, setHealthDays] = useState<import('../lib/types').HealthDay[]>([]);
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
    // Legacy types — old storage may include `done` or `tasks` shapes
    type LegacyItem = {
      id: number; text: string; status?: Status; done?: boolean;
      completedAt?: number | null; deadline?: number | null;
    };
    type LegacyTrack = {
      id?: number; name: string;
      tasks?: Array<{ id?: number; text: string; status?: Status; done?: boolean }>;
    };

    function normaliseItem(i: LegacyItem): ListItem {
      const status: Status = i.status ?? (i.done ? 'done' : 'todo');
      return {
        id: i.id, text: i.text, status,
        completedAt: i.completedAt ?? null,
        deadline: i.deadline ?? null,
      };
    }

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
        'musicItems', 'tracks', 'applications', 'lifeItems', 'cvItems', 'otherItems',
        'darkMode', 'taskSortPrefs', 'appearance', 'homeLayout',
        'calendarFeeds', 'calendarCache', 'calendarConnections', 'budget', 'inbox', 'recentSearches',
        'reviews', 'reviewSettings', 'oauthAccounts', 'emailsCache', 'sidebarCollapsed',
        'topics', 'topicFolders',
        'calendarNotes', 'dailyPlan', 'habits', 'healthDays',
      ];
      let musicLoaded = false;
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
            if (key === 'tracks' && Array.isArray(val) && !musicLoaded) {
              const flattened: ListItem[] = [];
              for (const tr of val as LegacyTrack[]) {
                if (tr.tasks && tr.tasks.length > 0) {
                  for (const tk of tr.tasks) {
                    flattened.push({
                      id: tk.id ?? Date.now() + Math.random(),
                      text: `${tr.name} — ${tk.text}`,
                      status: tk.status ?? (tk.done ? 'done' : 'todo'),
                      completedAt: null, deadline: null,
                    });
                  }
                } else {
                  flattened.push({ id: tr.id ?? Date.now(), text: tr.name, status: 'todo', completedAt: null, deadline: null });
                }
              }
              if (flattened.length > 0) setMusicItems(flattened);
            } else if (key === 'musicItems' && Array.isArray(val)) {
              setMusicItems((val as LegacyItem[]).map(normaliseItem));
              musicLoaded = true;
            } else if (['lifeItems', 'otherItems', 'cvItems'].includes(key) && Array.isArray(val)) {
              const items = (val as LegacyItem[]).map(normaliseItem);
              if (key === 'lifeItems') setLifeItems(items);
              else if (key === 'otherItems') setOtherItems(items);
              else if (key === 'cvItems') setCvItems(items);
            } else if (key === 'applications' && Array.isArray(val)) {
              setApplications(val as Application[]);
            } else if (key === 'darkMode') {
              legacyDark = val as boolean;
            } else if (key === 'taskSortPrefs' && val && typeof val === 'object') {
              setTaskSortPrefs(prev => ({ ...prev, ...(val as Partial<Record<TaskListKey, SortMode>>) }));
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
                    note: i.person + (i.note ? ` — ${i.note}` : ''),
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
            } else if (key === 'healthDays' && Array.isArray(val)) {
              setHealthDays(val as import('../lib/types').HealthDay[]);
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

      // Seed a default General topic for brand-new users so they have something
      // to explore. Only injected when the account has no topics at all.
      const DEFAULT_GENERAL_TOPIC: Topic = {
        id: 'topic-general-default',
        name: 'General',
        color: '#7da7d9',
        keywords: [],
        order: 0,
        stages: [
          { id: 'stg-todo',  label: 'To do',  color: '#7da7d9', done: false },
          { id: 'stg-doing', label: 'Doing',  color: '#e0a16b', done: false },
          { id: 'stg-done',  label: 'Done',   color: '#7fc8a9', done: true  },
        ],
        items: [
          { id: 1, text: 'Add your first task here', stageId: 'stg-todo', completedAt: null, deadline: null },
          { id: 2, text: 'Move tasks between stages with the pill button', stageId: 'stg-doing', completedAt: null, deadline: null },
        ],
        sortMode: 'manual',
      };
      if (loadedTopics && loadedTopics.length > 0) {
        setTopics(loadedTopics);
      } else {
        // No topics stored (new account or empty array) → seed default so the
        // user has something to explore. They can delete it if they want.
        setTopics([DEFAULT_GENERAL_TOPIC]);
      }

      setAppearance(appr);
      if (appr.defaultSection !== 'settings' && (appr.hiddenSections as string[]).includes(appr.defaultSection)) {
        setActiveSection('home');
      } else {
        setActiveSection(appr.defaultSection);
      }

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
        const established = oauthAccounts.length > 0 || topics.some(tp => tp.id !== 'topic-general-default');
        setOnbDismissed(established);
      }
    }).catch(() => {});
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const dismissOnboarding = () => {
    setOnbKeepMounted(false);
    setOnbForced(false);
    setOnbDismissed(true);
    void save('onboardingDismissed', true);
  };
  const replayWalkthroughs = () => {
    // Force the guide to show even when every step is already complete, and
    // navigate home where it lives — so it's always reachable from Settings.
    setOnbForced(true);
    setOnbDismissed(false);
    void save('onboardingDismissed', false);
    setActiveSection('home');
  };
  // Onboarding step signals (auto-check the walkthrough steps as they're done).
  const gmailConnected = oauthAccounts.some(a => a.provider === 'gmail');
  const emailsWidgetAdded = homeItems.some(it => it.type === 'recentEmails');
  const topicAdded = topics.length > 1;
  const topicInFolder = topics.some(tp => !!tp.folderId);
  const showOnboarding = onbForced || (!onbDismissed && !(gmailConnected && emailsWidgetAdded && topicAdded && topicInFolder));

  useEffect(() => { applyAppearanceVars(appearance); }, [appearance]);

  useEffect(() => { if (!loading) save('appearance', appearance); }, [appearance, loading]);
  useEffect(() => { if (!loading) save('musicItems', musicItems); }, [musicItems, loading]);
  useEffect(() => { if (!loading) save('applications', applications); }, [applications, loading]);
  useEffect(() => { if (!loading) save('lifeItems', lifeItems); }, [lifeItems, loading]);
  useEffect(() => { if (!loading) save('cvItems', cvItems); }, [cvItems, loading]);
  useEffect(() => { if (!loading) save('otherItems', otherItems); }, [otherItems, loading]);
  useEffect(() => { if (!loading) save('taskSortPrefs', taskSortPrefs); }, [taskSortPrefs, loading]);
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
  useEffect(() => { if (!loading) save('healthDays', healthDays); }, [healthDays, loading]);

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
        reload<ListItem[]>('musicItems', setMusicItems),
        reload<ListItem[]>('lifeItems', setLifeItems),
        reload<ListItem[]>('cvItems', setCvItems),
        reload<ListItem[]>('otherItems', setOtherItems),
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
      setInbox(prev => [...prev, { id: Date.now(), text: route.text, createdAt: Date.now() }]);
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

  const setSort = (k: TaskListKey) => (m: SortMode) =>
    setTaskSortPrefs(p => ({ ...p, [k]: m }));

  const patchAppearance = (patch: Partial<AppearancePrefs>) =>
    setAppearance(prev => ({ ...prev, ...patch }));
  const resetAppearance = () => setAppearance(DEFAULT_APPEARANCE);
  const resetHomeLayout = () => setHomeItems(DEFAULT_HOME);

  const addTaskToList = (list: TaskListKey, text: string, deadline: number | null) => {
    const item: ListItem = {
      id: Date.now(), text, status: 'todo', completedAt: null, deadline,
    };
    const setter =
      list === 'music' ? setMusicItems
        : list === 'life' ? setLifeItems
          : list === 'cv' ? setCvItems
            : setOtherItems;
    setter(prev => [...prev, item]);
  };
  const addTaskWithDeadline = (list: TaskListKey, text: string, deadlineMs: number) =>
    addTaskToList(list, text, deadlineMs);

  const addTopicItem = (topicId: string, text: string, deadline: number | null, stageId?: string) => {
    setTopics(prev => prev.map(top => {
      if (top.id !== topicId) return top;
      const targetStage = stageId
        ? top.stages.find(s => s.id === stageId)
        : top.stages.find(s => !s.done);
      const sid = targetStage?.id ?? top.stages[0]?.id ?? '';
      return {
        ...top,
        items: [...top.items, { id: Date.now(), text, stageId: sid, completedAt: null, deadline }],
      };
    }));
  };

  const addToInbox = (text: string, deadline: number | null) => {
    const suggested = predictTopic(text, topics);
    setInbox(prev => [...prev, {
      id: Date.now(), text, createdAt: Date.now(),
      suggestedTopicId: suggested?.id, deadline: deadline ?? undefined,
    }]);
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
      ...deadlineEvents({ music: musicItems, life: lifeItems, cv: cvItems, other: otherItems }),
      ...topicDeadlineEvents(topics),
      ...feedEvents,
      ...noteEvents(calendarNotes),
    ];
    return eventsOnDay(allEvents, new Date());
  }, [musicItems, lifeItems, cvItems, otherItems, topics, feedEvents, calendarNotes]);

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
    { id: 'music', label: 'Music', icon: Music },
    { id: 'applications', label: 'Applications', icon: Briefcase },
    { id: 'life', label: 'Life', icon: Sparkles },
    { id: 'cv', label: 'CV', icon: FileText },
    { id: 'other', label: 'Other', icon: BookOpen },
    { id: 'calendar', label: 'Calendar', icon: CalendarDays },
    { id: 'budget', label: 'Budget', icon: Wallet },
    { id: 'inbox', label: 'Inbox', icon: Inbox },
    { id: 'review', label: 'Review', icon: NotebookPen },
    { id: 'email', label: 'Email', icon: Mail },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  // Unified nav: Home → topics (in sidebar order) → other visible sections
  const hiddenTopicIds = appearance.hiddenTopicIds ?? [];
  const navItems: NavTab[] = useMemo(() => {
    const visibleSections = allSections.filter(
      s => s.id !== 'settings' && s.id !== 'inbox' && !appearance.hiddenSections.includes(s.id),
    );
    const home   = visibleSections.find(s => s.id === 'home');
    const middle = visibleSections.filter(s => s.id !== 'home');

    const allVisible = topics.filter(tp => !hiddenTopicIds.includes(tp.id));
    const unfiled    = allVisible.filter(tp => !tp.folderId);

    // Mirror the sidebar order: unfiled topics + folders interleaved by unified order,
    // then folder topics nested under their folder's position.
    type TLItem = { order: number; tabs: NavTab[] };
    const topLevel: TLItem[] = [
      ...unfiled.map(tp => ({
        order: tp.order,
        tabs: [{ id: tp.id, label: tp.name || '(unnamed)', icon: iconForTopic(tp.icon), accent: tp.color }],
      })),
      ...topicFolders.map(f => ({
        order: f.order,
        tabs: allVisible
          .filter(tp => tp.folderId === f.id)
          .sort((a, b) => a.order - b.order)
          .map(tp => ({ id: tp.id, label: tp.name || '(unnamed)', icon: iconForTopic(tp.icon), accent: tp.color })),
      })),
    ].sort((a, b) => a.order - b.order);

    return [
      ...(home ? [{ id: home.id, label: home.label, icon: home.icon }] : []),
      ...topLevel.flatMap(i => i.tabs),
      ...middle.map(s => ({ id: s.id, label: s.label, icon: s.icon })),
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appearance.hiddenSections, hiddenTopicIds, topics, topicFolders]);

  // If the item you're viewing gets hidden, fall back to home.
  // 'settings' and 'inbox' are intentionally absent from navItems but still valid sections.
  // Built-in sections (email, calendar, budget, etc.) remain valid even when hidden from
  // the sidebar — only bounce if it's a topic ID that no longer exists.
  const builtInSectionIds = new Set(['home', 'settings', 'inbox', 'apps', 'music', 'life', 'cv', 'other',
    'applications', 'calendar', 'budget', 'review', 'email', 'planner', 'dailyPlanner', 'habits', 'health']);
  useEffect(() => {
    if (builtInSectionIds.has(activeSection)) return; // always valid, even if hidden from nav
    const stillVisible = navItems.some(n => n.id === activeSection);
    if (!stillVisible) setActiveSection('home');
  }, [navItems, activeSection]); // eslint-disable-line react-hooks/exhaustive-deps

  const today = new Date();

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
      display: 'flex', minHeight: '100vh', background: t.bg, color: t.text,
      backgroundImage: 'var(--app-gradient)',
      backgroundAttachment: 'fixed',
      fontFamily: 'var(--app-font)',
      fontWeight: 300, transition: 'background 0.3s, color 0.3s',
      // Push content below the fixed title bar
      paddingTop: tbOffset,
    }}>
      {/* Custom frameless title bar — renders only inside Tauri */}
      <TitleBar theme={t} />

      {/* No mobile sidebar backdrop — sidebar is hidden on mobile.
          Navigation is handled by BottomTabBar on small viewports. */}

      {/* ── Sidebar — desktop only. Mobile navigation is handled by BottomTabBar. */}
      <aside style={{
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
        {/* Brand row — BOZZ wordmark navigates home; chevron collapses/expands. */}
        <div style={{
          display: 'flex', alignItems: 'center',
          gap: '0.4rem',
          padding: '0.3rem 0.05rem 1.2rem',
          minWidth: 0,
          justifyContent: sidebarCollapsed ? 'center' : 'space-between',
        }}>
          {/* BOZZ wordmark — go to home. Hidden when collapsed. */}
          <button
            onClick={() => setActiveSection('home')}
            aria-label="Go to home"
            title="Home"
            style={{
              background: 'transparent', border: 'none',
              color: sT.text, cursor: 'pointer', fontFamily: 'inherit',
              display: sidebarCollapsed ? 'none' : 'flex', alignItems: 'center', gap: '0.5rem',
              fontSize: '1.02rem', fontWeight: 700, letterSpacing: '-0.01em',
              padding: '0.1rem 0.05rem', textAlign: 'left',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              flex: 1, minWidth: 0,
              opacity: sidebarCollapsed ? 0 : 1,
              pointerEvents: sidebarCollapsed ? 'none' : 'auto',
              transition: 'opacity 0.18s ease',
            }}
          >
            <span style={{
              width: '22px', height: '22px', borderRadius: '7px', flexShrink: 0,
              background: sectionAccents.home, color: '#16161a',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.78rem', fontWeight: 800,
            }}>B</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>BOZZ</span>
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
              sections={allSections.filter(s => s.id !== 'settings' && s.id !== 'inbox' && s.id !== 'home' && !appearance.hiddenSections.includes(s.id))}
              navOrder={appearance.navOrder}
              sidebarCollapsed={sidebarCollapsed}
              t={t}
              onTopicsChange={setTopics}
              onTopicFoldersChange={setTopicFolders}
              onNavOrderChange={order => setAppearance(a => ({ ...a, navOrder: order }))}
            />
          ) : (() => {
            const visibleSections = allSections.filter(
              s => s.id !== 'settings' && s.id !== 'inbox' && !appearance.hiddenSections.includes(s.id),
            );
            const middleSections = visibleSections.filter(s => s.id !== 'home');
            const visibleTopics = [...topics]
              .filter(top => !hiddenTopicIds.includes(top.id));
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
              ...topicFolders.map(f   => ({ type: 'folder'  as const, order: orderOf(f.id, f.order),   folder: f })),
              ...middleSections.map((s, i) => ({ type: 'section' as const, order: orderOf(s.id, 1000 + i), section: s })),
            ].sort((a, b) => a.order - b.order);

            const navBtn = (id: string, label: string, Icon: ElementType, _accent?: string, indent = false) => {
              const isActive = activeSection === id;
              return (
                <button
                  key={id}
                  data-onb={id === 'home' ? 'nav-home' : undefined}
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
                    return navBtn(top.id, top.name || '(unnamed)', iconForTopic(top.icon), top.color);
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
                              navBtn(top.id, top.name || '(unnamed)', iconForTopic(top.icon), top.color)
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
                            navBtn(top.id, top.name || '(unnamed)', iconForTopic(top.icon), top.color)
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
          <button
            onClick={() => setActiveSection('settings')}
            title="Settings"
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
            <LayoutGrid size={17} strokeWidth={1.5} />
          </button>
          <button
            onClick={() => setActiveSection('inbox')}
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
            onMouseEnter={e => { e.currentTarget.style.background = sT.panel; e.currentTarget.style.color = sT.textMuted; }}
            onMouseLeave={e => { e.currentTarget.style.background = activeSection === 'inbox' ? sT.panel : 'transparent'; e.currentTarget.style.color = activeSection === 'inbox' ? sT.text : sT.textDim; }}
          >
            <Zap size={17} strokeWidth={1.5} />
            {inbox.length > 0 && (
              <span style={{
                position: 'absolute', top: 2, right: 2,
                width: '6px', height: '6px', borderRadius: '50%',
                background: t.doneAccent, pointerEvents: 'none',
              }} />
            )}
          </button>
          {!sidebarCollapsed && (
          <span style={{
            fontSize: '0.7rem', color: sT.textDim,
            letterSpacing: '0.02em', textAlign: 'right',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'clip',
            flex: 1, minWidth: 0,
          }}>
            {today.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
          )}
        </div>
      </aside>

      {/* ── Main content ── */}
      <div style={{ flex: 1, minWidth: 0 }}>
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
          {(activeSection === 'home' || onbKeepMounted) && showOnboarding && (
            <ErrorBoundary label="the getting-started guide">
              <Onboarding
                t={t}
                replay={onbForced}
                activeSection={activeSection}
                gmailConnected={gmailConnected}
                emailsWidgetAdded={emailsWidgetAdded}
                topicAdded={topicAdded}
                folderCreated={topicFolders.length > 0}
                topicInFolder={topicInFolder}
                onGo={setActiveSection}
                onDismiss={dismissOnboarding}
                onWalkStart={() => setOnbKeepMounted(true)}
                onWalkEnd={() => setOnbKeepMounted(false)}
              />
            </ErrorBoundary>
          )}
          {/* Home stays mounted (display toggle) so returning is instant and the
              widget grid never re-animates — see gridReady in HomeView. */}
          <ErrorBoundary label="the home view">
          <div style={{ display: activeSection === 'home' ? undefined : 'none' }}>
            <HomeView
              visible={activeSection === 'home'}
              items={homeItems}
              setItems={setHomeItems}
              widgetShape={appearance.widgetShape ?? 'rounded'}
              widgetBorder={appearance.widgetBorder ?? 'normal'}
              onWidgetShape={(s) => patchAppearance({ widgetShape: s })}
              onWidgetBorder={(b) => patchAppearance({ widgetBorder: b })}
              ctx={{
                t, musicItems, lifeItems, cvItems, otherItems, applications, budget, emails,
                setActiveSection, addTask: addTaskToList,
                topics, addTopicItem, addToInbox, dailyPlan, onDailyPlanChange: setDailyPlan,
                onAdvanceStage, colorBank: appearance.colorBank ?? [],
                habits, onHabitsChange: setHabits,
                todayEvents, calendarNotes, onCalendarNotesChange: setCalendarNotes,
                widgetConfig: {}, onWidgetConfig: () => {},
              }}
            />
          </div>
          </ErrorBoundary>
          <ErrorBoundary key={activeSection} label="this section" onReset={() => setActiveSection('home')}>
          {activeSection === 'music' && (
            <SimpleListView items={musicItems} setItems={setMusicItems} t={t}
              accent={sectionAccents.music} placeholder="add a music task…" emptyText="no music tasks yet"
              sortMode={taskSortPrefs.music} setSortMode={setSort('music')} />
          )}
          {activeSection === 'applications' && (
            <ApplicationsView applications={applications} setApplications={setApplications}
              t={t} accent={sectionAccents.applications} />
          )}
          {activeSection === 'life' && (
            <SimpleListView items={lifeItems} setItems={setLifeItems} t={t}
              accent={sectionAccents.life} placeholder="add something…" emptyText="nothing here yet"
              sortMode={taskSortPrefs.life} setSortMode={setSort('life')} />
          )}
          {activeSection === 'cv' && (
            <SimpleListView items={cvItems} setItems={setCvItems} t={t}
              accent={sectionAccents.cv} placeholder="add a CV item — project, experience…" emptyText="nothing here yet"
              sortMode={taskSortPrefs.cv} setSortMode={setSort('cv')} />
          )}
          {activeSection === 'other' && (
            <SimpleListView items={otherItems} setItems={setOtherItems} t={t}
              accent={sectionAccents.other} placeholder="add a note, book, idea…" emptyText="nothing here yet"
              sortMode={taskSortPrefs.other} setSortMode={setSort('other')} />
          )}
          {activeSection === 'calendar' && (
            <CalendarView
              t={t}
              feedEvents={feedEvents}
              lists={{ music: musicItems, life: lifeItems, cv: cvItems, other: otherItems }}
              onAddTask={addTaskWithDeadline}
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
              lists={{ music: musicItems, life: lifeItems, cv: cvItems, other: otherItems }}
              applications={applications}
              budget={budget}
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
            />
          )}
          {activeSection === 'inbox' && (
            <InboxView
              t={t}
              inbox={inbox}
              setInbox={setInbox}
              topics={topics}
              onAssign={(text, topicId, deadline) => {
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
                    }],
                  };
                }));
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
                    t, musicItems, lifeItems, cvItems, otherItems, applications, budget, emails,
                    setActiveSection, addTask: addTaskToList,
                    topics, addTopicItem, addToInbox, dailyPlan, onDailyPlanChange: setDailyPlan,
                    onAdvanceStage, colorBank: appearance.colorBank ?? [],
                    habits, onHabitsChange: setHabits,
                    todayEvents, calendarNotes, onCalendarNotesChange: setCalendarNotes,
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
          {activeSection === 'settings' && (
            <SettingsView
              t={t}
              appearance={appearance}
              patchAppearance={patchAppearance}
              resetAppearance={resetAppearance}
              resetHomeLayout={resetHomeLayout}
              sections={allSections
                .filter(s => ['budget','calendar','email','review'].includes(s.id))
                .map(s => ({ id: s.id, label: s.label }))}
              hiddenTopicIds={hiddenTopicIds}
              onResetNavigation={() => patchAppearance({
                hiddenSections: DEFAULT_APPEARANCE.hiddenSections,
                hiddenTopicIds: [],
                defaultSection: DEFAULT_APPEARANCE.defaultSection,
              })}
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
              onTopicsChange={setTopics}
              topicFolders={topicFolders}
              onTopicFoldersChange={setTopicFolders}
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
        />
      )}

      {searchOpen && (
        <SearchModal
          t={t}
          entries={buildSearchIndex({
            lists: { music: musicItems, life: lifeItems, cv: cvItems, other: otherItems },
            applications, budget, inbox, feedEvents,
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
