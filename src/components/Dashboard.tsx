import { useState, useEffect, useRef, useMemo, useCallback, type ElementType } from 'react';
import {
  Music, Briefcase, Sparkles, BookOpen,
  LayoutDashboard, FileText, CalendarDays, Wallet, Inbox, NotebookPen, Mail, Settings,
  PanelLeft,
} from 'lucide-react';
import { routeVoice, describeRoute } from '../lib/voiceRouter';
import VoiceButton from './shared/VoiceButton';
import { isMobileViewport, isTauri } from '../lib/platform';
import TitleBar, { TITLE_BAR_HEIGHT } from './TitleBar';
import BottomTabBar, { BOTTOM_TAB_HEIGHT, type NavTab } from './BottomTabBar';
import { iconForTopic } from './sections/settings/TopicsBlock';
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
  CalendarFeed, CalendarCache, CalendarEvent, BudgetData, InboxItem,
  WeeklyReview, ReviewSettings, OAuthAccount, EmailMessage, EmailProvider,
  Topic,
} from '../lib/types';
import { DEFAULT_HOME, WIDGET_REGISTRY } from './widgets/registry';
import HomeView from './sections/HomeView';
import SimpleListView from './sections/SimpleListView';
import TopicView from './sections/TopicView';
import ApplicationsView from './sections/ApplicationsView';
import SettingsView from './sections/SettingsView';
import CalendarView from './sections/calendar/CalendarView';
import BudgetView from './sections/budget/BudgetView';
import InboxView from './sections/InboxView';
import ReviewView from './sections/review/ReviewView';
import EmailView from './sections/email/EmailView';
import SearchModal from './SearchModal';

const EMAIL_REFRESH_MS = 15 * 60 * 1000;
const PROVIDER_CFG: Record<EmailProvider, ProviderConfig> = { gmail: gmailConfig, outlook: outlookConfig };

const FEED_COLORS = ['#7da7d9', '#c9a8d4', '#b8c7a1', '#d4b896', '#c7a1a1', '#a1bdc7'];
const FEED_REFRESH_MS = 60 * 60 * 1000;
const EMPTY_CACHE: CalendarCache = { lastSync: null, feeds: {} };

export default function Dashboard() {
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
  const [feedsSyncing, setFeedsSyncing] = useState(false);
  const syncingRef = useRef(false);
  const [budget, setBudget] = useState<BudgetData>(DEFAULT_BUDGET);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [reviews, setReviews] = useState<WeeklyReview[]>([]);
  const [reviewSettings, setReviewSettings] = useState<ReviewSettings>(DEFAULT_REVIEW_SETTINGS);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [oauthAccounts, setOauthAccounts] = useState<OAuthAccount[]>([]);
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [emailsSyncing, setEmailsSyncing] = useState(false);
  const [emailSyncErrors, setEmailSyncErrors] = useState<Array<{ account: string; error: string }>>([]);
  const emailSyncRef = useRef(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
  const [voicePartial, setVoicePartial] = useState<string>('');
  const [topics, setTopics] = useState<Topic[]>([]);
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
      const keys = [
        'musicItems', 'tracks', 'applications', 'lifeItems', 'cvItems', 'otherItems',
        'darkMode', 'taskSortPrefs', 'appearance', 'homeLayout',
        'calendarFeeds', 'calendarCache', 'budget', 'inbox', 'recentSearches',
        'reviews', 'reviewSettings', 'oauthAccounts', 'emailsCache', 'sidebarCollapsed',
        'topics',
      ];
      let musicLoaded = false;
      let appr: AppearancePrefs = { ...DEFAULT_APPEARANCE };
      let appearanceLoaded = false;
      let legacyDark: boolean | undefined;
      let loadedTopics: Topic[] | null = null;

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
            } else if (key === 'homeLayout' && Array.isArray(val)) {
              const valid = (val as HomeWidgetItem[]).filter(
                w => w && typeof w.i === 'string' && w.type in WIDGET_REGISTRY,
              );
              if (valid.length > 0) setHomeItems(valid);
            } else if (key === 'calendarFeeds' && Array.isArray(val)) {
              setCalendarFeeds(val as CalendarFeed[]);
            } else if (key === 'calendarCache' && val && typeof val === 'object') {
              const c = val as CalendarCache;
              if (c.feeds) setCalendarCache({ lastSync: c.lastSync ?? null, feeds: c.feeds });
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
            }
          }
        } catch { /* ignore individual key errors */ }
      }

      // Migrate the old boolean dark/light toggle into a mood, only if the
      // new appearance prefs were never written.
      if (!appearanceLoaded && legacyDark !== undefined) {
        appr.mood = legacyDark ? 'midnight' : 'light';
      }

      // No seeding — user starts with zero topics and creates their own.
      if (loadedTopics) setTopics(loadedTopics);

      setAppearance(appr);
      if (appr.defaultSection !== 'settings' && appr.hiddenSections.includes(appr.defaultSection)) {
        setActiveSection('home');
      } else {
        setActiveSection(appr.defaultSection);
      }

      setLoading(false);
      initBackup();
    }
    loadData();
  }, []);

  const save = async (key: string, value: unknown) => {
    try { await setItem(key, JSON.stringify(value)); }
    catch (e) { console.error('Save error:', e); }
  };

  useEffect(() => { applyAppearanceVars(appearance); }, [appearance]);

  useEffect(() => { if (!loading) save('appearance', appearance); }, [appearance, loading]);
  useEffect(() => { if (!loading) save('musicItems', musicItems); }, [musicItems, loading]);
  useEffect(() => { if (!loading) save('applications', applications); }, [applications, loading]);
  useEffect(() => { if (!loading) save('lifeItems', lifeItems); }, [lifeItems, loading]);
  useEffect(() => { if (!loading) save('cvItems', cvItems); }, [cvItems, loading]);
  useEffect(() => { if (!loading) save('otherItems', otherItems); }, [otherItems, loading]);
  useEffect(() => { if (!loading) save('taskSortPrefs', taskSortPrefs); }, [taskSortPrefs, loading]);
  useEffect(() => { if (!loading) save('homeLayout', homeItems); }, [homeItems, loading]);
  useEffect(() => { if (!loading) save('calendarFeeds', calendarFeeds); }, [calendarFeeds, loading]);
  useEffect(() => { if (!loading) save('calendarCache', calendarCache); }, [calendarCache, loading]);
  useEffect(() => { if (!loading) save('budget', budget); }, [budget, loading]);
  useEffect(() => { if (!loading) save('inbox', inbox); }, [inbox, loading]);
  useEffect(() => { if (!loading) save('recentSearches', recentSearches); }, [recentSearches, loading]);
  useEffect(() => { if (!loading) save('reviews', reviews); }, [reviews, loading]);
  useEffect(() => { if (!loading) save('reviewSettings', reviewSettings); }, [reviewSettings, loading]);
  useEffect(() => { if (!loading) save('oauthAccounts', oauthAccounts); }, [oauthAccounts, loading]);
  useEffect(() => { if (!loading) save('emailsCache', emails); }, [emails, loading]);
  useEffect(() => { if (!loading) save('sidebarCollapsed', sidebarCollapsed); }, [sidebarCollapsed, loading]);
  useEffect(() => { if (!loading) save('topics', topics); }, [topics, loading]);

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

  const connectAccount = async (provider: EmailProvider, clientId: string, clientSecret: string) => {
    const account = await connectProvider(PROVIDER_CFG[provider], clientId, clientSecret);
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
    } else if (route.kind === 'task') {
      const setter =
        route.list === 'music' ? setMusicItems
        : route.list === 'life' ? setLifeItems
        : route.list === 'cv' ? setCvItems
        : setOtherItems;
      setter(prev => [...prev, route.item]);
    } else if (route.kind === 'budget') {
      setBudget(b => ({ ...b, transactions: [...b.transactions, route.transaction] }));
    }
    setVoicePartial('');
    // Clear the status after a moment
    window.setTimeout(() => setVoiceStatus(null), 2200);
  }, []);

  // Ctrl/Cmd+K opens global search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'k' || e.key.toLowerCase() === 'f')) {
        e.preventDefault();
        setSearchOpen(o => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const t = themes[appearance.mood];

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
    return Object.entries(calendarCache.feeds)
      .filter(([id]) => ids.has(id))
      .flatMap(([, entry]) => entry.events);
  }, [calendarFeeds, calendarCache]);

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

  // Unified nav: Home → visible topics → other visible sections → Settings
  const hiddenTopicIds = appearance.hiddenTopicIds ?? [];
  const navItems: NavTab[] = useMemo(() => {
    const visibleSections = allSections.filter(
      s => s.id === 'settings' || !appearance.hiddenSections.includes(s.id),
    );
    const visibleTopics = [...topics]
      .filter(top => !hiddenTopicIds.includes(top.id))
      .sort((a, b) => a.order - b.order)
      .map(top => ({ id: top.id, label: top.name || '(unnamed)', icon: iconForTopic(top.icon), accent: top.color }));

    const home = visibleSections.find(s => s.id === 'home');
    const middle = visibleSections.filter(s => s.id !== 'home' && s.id !== 'settings');
    const settingsEntry = visibleSections.find(s => s.id === 'settings');

    return [
      ...(home ? [{ id: home.id, label: home.label, icon: home.icon }] : []),
      ...visibleTopics,
      ...middle.map(s => ({ id: s.id, label: s.label, icon: s.icon })),
      ...(settingsEntry ? [{ id: settingsEntry.id, label: settingsEntry.label, icon: settingsEntry.icon }] : []),
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appearance.hiddenSections, hiddenTopicIds, topics]);

  // If the item you're viewing gets hidden, fall back to home.
  useEffect(() => {
    if (activeSection === 'settings' || activeSection === 'home') return;
    const stillVisible = navItems.some(n => n.id === activeSection);
    if (!stillVisible) setActiveSection('home');
  }, [navItems, activeSection]);

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
        width: sidebarCollapsed ? '60px' : '232px',
        flexShrink: 0,
        background: t.bgAlt,
        borderRight: `1px solid ${t.border}`,
        padding: '1rem 0.55rem 0.85rem',
        flexDirection: 'column',
        position: 'sticky',
        top: tbOffset, left: 0,
        zIndex: 1,
        height: `calc(100vh - ${tbOffset}px)`,
        overflowY: 'auto', overflowX: 'hidden',
        transition: 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        {/* Brand row — LB monogram is the toggle (clicking it always
            collapses/expands). The wordmark + dedicated chevron fade in
            and out via opacity but stay mounted so the layout doesn't
            shift. */}
        <div style={{
          display: 'flex', alignItems: 'center',
          gap: '0.6rem',
          padding: '0.3rem 0.05rem 1.2rem',
          minWidth: 0,
        }}>
          <button
            onClick={() => setSidebarCollapsed(c => !c)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{
              width: '30px', height: '30px', borderRadius: '7px',
              background: t.text, color: t.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.02em',
              flexShrink: 0,
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              transition: 'transform 0.18s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            LB
          </button>

          {/* Right side — wordmark + chevron. Cross-fades via opacity so
              nothing pops. pointer-events also toggles so the chevron
              isn't accidentally clickable while invisible. */}
          <div style={{
            flex: 1, minWidth: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: '0.4rem',
            opacity: sidebarCollapsed ? 0 : 1,
            pointerEvents: sidebarCollapsed ? 'none' : 'auto',
            transition: 'opacity 0.18s ease',
          }}>
            <span style={{
              fontSize: '1.02rem', fontWeight: 600, color: t.text,
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              flex: 1, minWidth: 0,
            }}>Life Bozz</span>
            <button
              onClick={() => setSidebarCollapsed(true)}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              tabIndex={sidebarCollapsed ? -1 : 0}
              style={{
                background: 'transparent', border: 'none',
                color: t.textDim, cursor: 'pointer',
                padding: '0.3rem', display: 'flex', flexShrink: 0,
                borderRadius: '6px',
                transition: 'background 0.12s, color 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = t.panel; e.currentTarget.style.color = t.textMuted; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = t.textDim; }}
            >
              <PanelLeft size={17} strokeWidth={1.6} />
            </button>
          </div>
        </div>

        {/* Nav — padding + gap stay constant, only the label text fades.
            The flex layout means as the sidebar shrinks, the label visually
            slides toward the right edge and clips against overflow:hidden
            on the aside, which feels continuous with the width transition. */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.05rem', flex: 1 }}>
          {navItems.map(s => {
            const Icon = s.icon;
            const isActive = activeSection === s.id;
            const accent = s.accent ?? (sectionAccents as Record<string, string>)[s.id] ?? t.textMuted;
            const inboxBadgeVisible = s.id === 'inbox' && inbox.length > 0;
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                title={sidebarCollapsed ? s.label : undefined}
                style={{
                  display: 'flex', alignItems: 'center',
                  gap: '0.65rem',
                  background: isActive ? t.panel : 'transparent',
                  border: 'none',
                  color: isActive ? t.text : t.textMuted,
                  padding: '0.45rem 0.65rem',
                  cursor: 'pointer', borderRadius: '6px',
                  fontSize: '0.84rem', fontWeight: 400, letterSpacing: '0',
                  fontFamily: 'inherit', textAlign: 'left',
                  transition: 'background 0.12s, color 0.12s',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <Icon
                  size={16} strokeWidth={1.5}
                  color={isActive ? accent : t.textMuted}
                  style={{ flexShrink: 0 }}
                />
                <span style={{
                  flex: 1, minWidth: 0,
                  whiteSpace: 'nowrap', overflow: 'hidden',
                  opacity: sidebarCollapsed ? 0 : 1,
                  transition: 'opacity 0.16s ease',
                }}>
                  {s.label}
                </span>
                {inboxBadgeVisible && (
                  <span style={{
                    background: sectionAccents.inbox, color: t.bg,
                    fontSize: '0.62rem', fontWeight: 500, borderRadius: '999px',
                    padding: '0.05rem 0.4rem', lineHeight: 1.5,
                    flexShrink: 0,
                    opacity: sidebarCollapsed ? 0 : 1,
                    transition: 'opacity 0.16s ease',
                  }}>
                    {inbox.length}
                  </span>
                )}
                {inboxBadgeVisible && (
                  <span style={{
                    position: 'absolute', top: 5, right: 7,
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: sectionAccents.inbox,
                    opacity: sidebarCollapsed ? 1 : 0,
                    transition: 'opacity 0.16s ease',
                    pointerEvents: 'none',
                  }} />
                )}
              </button>
            );
          })}
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
          fontSize: '0.72rem', color: t.textMuted, fontStyle: 'italic',
          maxHeight: voicePartial && !sidebarCollapsed ? '3.2em' : '0',
          opacity: voicePartial && !sidebarCollapsed ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.18s ease, opacity 0.18s ease, padding 0.18s ease',
        }}>
          {voicePartial}
        </div>

        {/* Bottom row: mic always visible, date fades when collapsed.
            Layout direction stays row in both states; the mic just shrinks
            to icon-only via its iconOnly prop. */}
        <div style={{
          display: 'flex', flexDirection: 'row',
          alignItems: 'center', justifyContent: 'space-between',
          gap: '0.5rem',
          padding: '0.7rem 0.15rem 0.1rem',
          borderTop: `1px solid ${t.border}`,
          marginTop: '0.4rem',
          minWidth: 0,
        }}>
          <VoiceButton
            t={t}
            onTranscript={handleVoiceTranscript}
            onPartial={setVoicePartial}
            iconOnly={sidebarCollapsed}
            label={!sidebarCollapsed}
            iconSize={15}
          />
          <span style={{
            fontSize: '0.7rem', color: t.textDim,
            letterSpacing: '0.02em', textAlign: 'right',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'clip',
            opacity: sidebarCollapsed ? 0 : 1,
            transition: 'opacity 0.16s ease',
            pointerEvents: sidebarCollapsed ? 'none' : 'auto',
            flex: 1, minWidth: 0,
          }}>
            {today.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          maxWidth: '1200px', margin: '0 auto',
          padding: isMobile ? '1.25rem 1rem 1.5rem' : '2.5rem 2.75rem',
          // Respect iOS safe-area insets when running as PWA.
          paddingTop: `max(${isMobile ? '1.25rem' : '2.5rem'}, env(safe-area-inset-top))`,
          // On mobile, leave room below for the bottom tab bar + safe area.
          paddingBottom: isMobile
            ? `max(${BOTTOM_TAB_HEIGHT + 16}px, calc(${BOTTOM_TAB_HEIGHT}px + env(safe-area-inset-bottom) + 16px))`
            : `max(2.5rem, env(safe-area-inset-bottom))`,
        }}>

        {reviews.some(r => r.reviewedAt == null) && activeSection !== 'review' && (
          <button
            onClick={() => {
              // If Review has been hidden via Settings → Navigation, the
              // safety effect below will bounce us off it the moment we
              // try to set it active. Unhide first, then navigate.
              if (appearance.hiddenSections.includes('review')) {
                patchAppearance({
                  hiddenSections: appearance.hiddenSections.filter((s): s is SectionId => s !== 'review'),
                });
              }
              setActiveSection('review');
            }}
            style={{
              width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
              background: t.bgAlt, border: `1px solid ${t.borderStrong}`,
              borderRadius: '10px', padding: '0.65rem 1rem', marginBottom: '1.25rem',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
            }}
          >
            <span style={{ fontSize: '0.85rem', color: t.text }}>
              your week is ready to review
            </span>
            <span style={{ fontSize: '0.72rem', color: t.textMuted, letterSpacing: '0.05em' }}>
              open →
            </span>
          </button>
        )}

        <main>
          {activeSection === 'home' && (
            <HomeView
              items={homeItems}
              setItems={setHomeItems}
              ctx={{ t, musicItems, lifeItems, cvItems, otherItems, applications, budget, emails, setActiveSection, addTask: addTaskToList }}
            />
          )}
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
              onAssign={(text, dest, deadline) => {
                if (dest === 'applications') {
                  setApplications(prev => [
                    ...prev,
                    { id: Date.now(), name: text, status: 'need to apply' },
                  ]);
                } else {
                  addTaskToList(dest, text, deadline);
                }
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
                />
              );
            }
            return null;
          })()}
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
              calendarFeeds={calendarFeeds}
              onFeedsChange={setCalendarFeeds}
              onRefreshFeeds={refreshFeeds}
              feedsSyncing={feedsSyncing}
              lastSync={calendarCache.lastSync}
              currency={budget.currency}
              onCurrencyChange={(c) => setBudget(b => ({ ...b, currency: c }))}
              reviewSettings={reviewSettings}
              onReviewSettingsChange={setReviewSettings}
              oauthAccounts={oauthAccounts}
              emailSyncErrors={emailSyncErrors}
              onConnectAccount={connectAccount}
              onDisconnectAccount={disconnect}
              topics={topics}
              onTopicsChange={setTopics}
            />
          )}
        </main>
        </div>
      </div>

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
          inboxCount={inbox.length}
          t={t}
          tbOffset={tbOffset}
        />
      )}
    </div>
  );
}
