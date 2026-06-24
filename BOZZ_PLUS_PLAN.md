# Bozz Plus — Monetisation & Priority Alerts Plan

Owner: founder. Author: marketing/product pass, 2026-06-23.
Status: spec ready to hand to Claude Code for implementation.

---

## 0. TL;DR

Build **Priority Inbox Alerts** (desktop notifications when an email from a sender or
keyword you care about lands, e.g. Lloyds or Mercedes). Ship it **free during beta**,
badged as a Bozz Plus feature. Lay the rails for a cheap subscription (~£3/mo) but do
**not** stand up checkout yet. The goal right now is retention and word-of-mouth, not
revenue, because the locked #1 constraint is distribution and the app has ~zero daily
users. Monetising zero users earns zero.

The good news: the hard infrastructure already exists. The app already runs in the
background (minimises to tray, `prevent_close`), already has autostart, and already
scores emails. The alert feature is a few days of work, not weeks.

Plus is **not** just alerts. It is three pillars (section 5): **Watch** (alerts),
**Build** (templates, multiple dashboards, premium themes), and **Connect** (more
accounts, future bank sync). The hard rule across all of it: never paywall the thing that
gets a new user to value in 90 seconds. Templates are the clearest example, so the best
ones ship free as onboarding, and Plus sells the depth.

---

## 1. The strategy in one paragraph

Bozz is AGPL-3.0 and publicly "never sold." That means you cannot sell the software
itself: anyone can fork and rebuild it. What you *can* sell is **hosted convenience and
ongoing service** that costs *you* money to run. So the paid line should always follow
"what costs me money or effort to operate," never "a local feature I locked." This is the
Obsidian model: the app is free and whole, a small paid tier funds the maker and unlocks
power/scale and (later) hosted services. It fits your "calm, honest, free-core" brand
exactly, and it is the only model that survives the licence.

Implication: the keyword-alert idea is the right *first* paid concept, but the airtight,
truly-chargeable version is the cloud watcher (always-on, fires even when Bozz is shut),
which you have deliberately deferred. The desktop version we build now is a **retention
hook and a demand probe**, not a hard paywall. That is the correct first move.

---

## 2. Decisions locked this session

| Question | Decision |
|---|---|
| Goal of monetising now | **Retention hook, not revenue.** Cheap, generous, revenue is a later byproduct. |
| Alert architecture | **Desktop-only first.** App watches inbox in the background, fires OS notifications while the PC is on. No server, no stored tokens, no new security risk. |
| Pricing shape | **Cheap subscription**, ~£3/mo or £30/yr, when it eventually turns on. |
| Payment setup today | **None.** No Stripe, no company. Start as "Plus, free in beta" / waitlist. |

Honest consequence of "desktop-only + AGPL + retention-first": the Plus check is **soft**.
A determined user could recompile from source to bypass it. That is fine. No consumer will
compile a Rust/Tauri app to dodge £3, and your goal is goodwill, not extraction. Do **not**
spend effort hardening the local check. The un-bypassable feature (cloud watcher) comes
later, by your own choice.

---

## 3. Hero feature: Priority Inbox Alerts (desktop)

### 3.1 What the user gets

In Settings, a new "Priority alerts" panel. The user adds rules:

- **VIP sender**: an email or domain. Example: `lloyds.com`, `noreply@mercedes.com`.
  Matched against the message sender.
- **Keyword**: a word or phrase. Example: `Mercedes`, `interview`, `offer`.
  Matched against subject + snippet.

When a *new* email matches a rule, Bozz fires a native OS notification:
"Lloyds: Your statement is ready". Clicking it opens Bozz to the email. Works while the app
is open or minimised to tray (which is its normal background state).

Calm defaults: quiet hours, dedup so you are never pinged twice, and a first-run seed so
enabling a rule does not dump 50 notifications for emails already in your inbox.

### 3.2 What already exists (do not rebuild)

- **Background running**: `src-tauri/src/lib.rs:453-462` intercepts `CloseRequested` on the
  main window, calls `window.hide()` + `api.prevent_close()`. The process and its webview
  stay alive after the user "closes" the app, so a JS poll loop keeps running. This is the
  whole reason desktop alerts are viable.
- **System tray** with Show/Quit: `src-tauri/src/lib.rs:405-434`.
- **Autostart on login**: `tauri-plugin-autostart`, already registered.
- **Email fetch + scoring**: `src/lib/email.ts` `syncAllAccounts()` already refreshes
  tokens, fetches Gmail + Outlook inboxes, and scores messages. Reuse it directly.
- **Email types**: `src/lib/types.ts` `EmailMessage` already has `fromEmail`, `fromName`,
  `subject`, `snippet`, `unread`, `accountEmail`, `id`, `permalink`.

### 3.3 What to add

Only one Tauri plugin is missing: **notifications**.

- `src-tauri/Cargo.toml`: add `tauri-plugin-notification = "2"`.
- `src-tauri/src/lib.rs`: add `.plugin(tauri_plugin_notification::init())` in the builder
  chain (near the other `.plugin(...)` calls around line 382-399).
- `src-tauri/capabilities/default.json`: add `"notification:default"` to `permissions`.
- npm: `npm i @tauri-apps/plugin-notification`.

### 3.4 Data model (`src/lib/types.ts`)

```ts
export type AlertMatchType = 'sender' | 'keyword';

export interface AlertRule {
  id: string;
  label: string;            // user-facing name, e.g. "Lloyds"
  type: AlertMatchType;
  value: string;            // sender: email/domain; keyword: word/phrase
  unreadOnly: boolean;      // default true
  accountEmails: string[];  // empty = all connected accounts
  enabled: boolean;
  createdAt: number;
}

export interface PriorityAlertSettings {
  enabled: boolean;         // master switch
  rules: AlertRule[];
  pollMinutes: number;      // default 3
  quietFrom: number | null; // local hour 0-23, null = off
  quietTo: number | null;   // local hour 0-23
  sound: boolean;           // default true
}
```

Dedup state is local-only (do **not** push it through Supabase sync, keep the sync blob
small and avoid the token-leak class of problem). Store it via `tauri-plugin-store` or
localStorage:

```ts
interface AlertWatchState {
  notifiedIds: string[];   // ring buffer, cap ~500
  lastCheck: number;
}
```

### 3.5 Matching logic (`src/lib/alerts.ts`, new)

```ts
export function matchRules(msg: EmailMessage, rules: AlertRule[]): AlertRule | null {
  const haystack = (msg.subject + ' ' + msg.snippet).toLowerCase();
  for (const r of rules) {
    if (!r.enabled) continue;
    if (r.unreadOnly && !msg.unread) continue;
    if (r.accountEmails.length && !r.accountEmails.includes(msg.accountEmail)) continue;
    const v = r.value.trim().toLowerCase();
    if (!v) continue;
    if (r.type === 'sender') {
      if (msg.fromEmail.toLowerCase().includes(v)) return r; // address or domain
    } else if (haystack.includes(v)) {
      return r;
    }
  }
  return null;
}
```

Exact substring is predictable and good enough for v1. `fuse.js` is already a dependency
if fuzzy keyword matching is wanted later, but do not start there: false positives on
alerts are worse than misses.

### 3.6 The watcher / scheduler (`src/lib/alerts.ts`)

```ts
import { syncAllAccounts } from './email';

let timer: ReturnType<typeof setInterval> | null = null;

export async function runAlertCheck(deps): Promise<void> {
  const { settings, accounts, state, saveState } = deps;
  if (!settings.enabled) return;
  if (!settings.rules.some(r => r.enabled)) return;
  if (!accounts.length) return;

  const { messages } = await syncAllAccounts(accounts);
  const seen = new Set(state.notifiedIds);
  const quiet = inQuietHours(settings, new Date());

  for (const m of messages) {
    if (seen.has(m.id)) continue;
    const rule = matchRules(m, settings.rules);
    if (!rule) continue;
    seen.add(m.id);          // mark seen even in quiet hours so it never back-fires
    if (quiet) continue;
    await notify(m, rule, settings.sound);
  }
  saveState({ notifiedIds: capRing([...seen], 500), lastCheck: Date.now() });
}

export function startAlertWatcher(deps) {
  stopAlertWatcher();
  void runAlertCheck(deps);
  timer = setInterval(() => void runAlertCheck(deps),
                      Math.max(1, deps.settings.pollMinutes) * 60_000);
}

export function stopAlertWatcher() {
  if (timer) { clearInterval(timer); timer = null; }
}
```

**First-run seed (important UX):** when a user first enables alerts, mark every message
currently in the inbox as already-notified, so only genuinely new mail fires. Do this by
running one `syncAllAccounts`, pushing all current ids into `notifiedIds`, then starting
the interval.

**Mount point:** start the watcher in `src/App.tsx` once the user is authed and settings
have loaded; restart it when `PriorityAlertSettings` changes (rules/cadence). Stop it on
sign-out.

### 3.7 Notifications

```ts
import { isPermissionGranted, requestPermission, sendNotification }
  from '@tauri-apps/plugin-notification';

export async function notify(m: EmailMessage, rule: AlertRule, sound: boolean) {
  let granted = await isPermissionGranted();
  if (!granted) granted = (await requestPermission()) === 'granted';
  if (!granted) return;
  sendNotification({
    title: `${rule.label}: ${m.fromName || m.fromEmail}`,
    body: m.subject,
  });
}
```

Click-to-open: v1 = focus the main window and route to the email view. v2 = deep-link to
the specific message (store the clicked message id and have the email view select it).

### 3.8 Settings UI (`src/components/sections/settings/PriorityAlertsBlock.tsx`, new)

Place it in `SettingsView` next to `ConnectedAccountsBlock` (alerts depend on connected
email accounts, so they belong together). Contents:

- Master toggle "Priority alerts".
- Rule list: each row shows label, type chip (Sender / Keyword), value, enabled toggle,
  delete. "Add rule" opens a small inline form (label, type, value, unread-only, account
  scope).
- Quiet hours: from / to hour pickers, with an off state.
- Poll cadence: a simple select (Every 1 / 3 / 5 / 15 min). Default 3.
- Sound toggle.
- A "Test notification" button (sanity check that OS permission is granted).
- If `isPlus()` is false (post-beta), show the free-tier limit (1 rule) and a soft upgrade
  nudge when they try to add a second. During beta, no limit.

Match the existing settings block styling (see other files in
`src/components/sections/settings/`).

### 3.9 Technical caveat to handle

Windows / WebView2 can throttle JS timers in a hidden (tray) window. For email this is
fine: even a throttled "about once a minute" cadence is acceptable, and the user does not
perceive a 60-90s delay on a non-urgent alert. If it proves too slow in testing, move the
heartbeat to the Rust side (a `tokio` interval in `lib.rs` that `emit`s an event the
frontend listens for) so the timer is not subject to webview throttling. Do not build the
Rust timer pre-emptively; only if the JS interval is measurably throttled.

### 3.10 Files checklist

- `src/lib/types.ts` — add `AlertRule`, `PriorityAlertSettings`, `AlertWatchState`.
- `src/lib/alerts.ts` — new: `matchRules`, `runAlertCheck`, `startAlertWatcher`,
  `stopAlertWatcher`, `inQuietHours`, `capRing`, `notify`.
- `src/lib/plus.ts` — new: entitlement (see section 4).
- `src/lib/storage.ts` — persist `PriorityAlertSettings` (synced) + `AlertWatchState`
  (local-only).
- `src/components/sections/settings/PriorityAlertsBlock.tsx` — new UI.
- `src/components/sections/SettingsView.tsx` — mount the block.
- `src/App.tsx` — start/stop/restart the watcher on auth + settings changes.
- `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`, `src-tauri/capabilities/default.json` —
  notification plugin + permission.
- `package.json` — `@tauri-apps/plugin-notification`.

---

## 4. Entitlement without a backend

You have no payment infra and want retention, not revenue, so ship the feature unlocked
and gate it later with a one-line flip.

```ts
// src/lib/plus.ts
const BETA_UNLOCK = true; // flip to false when the paywall goes live

export function isPlus(): boolean {
  if (BETA_UNLOCK) return true;
  return hasValidLicense();
}

function hasValidLicense(): boolean {
  // Later: read a license key from store, verify an Ed25519 signature against an
  // embedded public key. Fully offline, no server needed. Sell keys via a
  // merchant-of-record (Lemon Squeezy / Gumroad / Paddle) that handles UK VAT.
  return false;
}
```

Every Plus gate in the UI calls `isPlus()`. During beta it always returns true, so the
whole feature is free and you collect signal. When you are ready to charge, set
`BETA_UNLOCK = false`, implement `hasValidLicense()`, and add a "Enter license key" field
in settings. No backend, no Stripe account, no company required to start.

---

## 5. The Plus feature set

> **Reordered against market research (2026-06-23, see `BOZZ_PLUS_RESEARCH.md`).** The
> proven model for a free-core / AGPL / solo maker is Obsidian's and Plausible's: keep the
> app free, sell optional **hosted services** + a one-time **supporter license**. The two
> highest-evidence paid products, which sit on TOP of the pillars below:
>
> 1. **Bozz Sync & Safekeeping** — end-to-end-encrypted cross-device sync + version history
>    + restore. This is Obsidian's #1 paid product ($4/mo) and the single most precedented
>    monetisable feature in this category. Bake E2E encryption in FREE for everyone (it is
>    the fix for the v0.1.29 token leak, not a feature), then charge for depth: version
>    history, retention, restore, extra devices. Headline Plus product, ~£3-4/mo. This is
>    the elevated, evidence-backed version of the "Keep" idea floated in 5.3.
> 2. **Founding Supporter license** — one-time payment (Obsidian Catalyst pattern:
>    $25/$50/$100, adds no required features, pure support + early/beta access). Best FIRST
>    revenue for a zero-user founder optimising for goodwill. Ship it before the sub.
>
> Desktop-native is the moat: every free competitor in the start-page niche (Anori,
> Tabliss, Bonjourr, Mue) is a browser extension that cannot watch your inbox in the
> background. So **priority alerts** (section 3) are defensible precisely because they are
> desktop-native. And give away the calm daily-planning ritual that Sunsama charges ~$20/mo
> for: it is your word-of-mouth wedge, not a paywall.

### Audience reality check (non-technical users lead the priorities)

Bozz's users are mostly NOT technical (product direction: solo knowledge workers, students
as the second wave). That changes which Plus hooks excite them. Encrypted sync and a
"support the maker" license are dev-culture sells (Obsidian's audience); normal people pay
for a *feeling*, not infrastructure. The research's own consumer datapoint backs this:
Momentum, the one mainstream-consumer dashboard, paywalls **aesthetics, ambient
soundscapes, photos, and focus**, not encryption. So for Bozz's audience, LEAD Plus with
delight and keep sync/alerts as the quiet rational justifier:

Bar to clear: the hook must be exciting AND deliver value on day one (no accumulation, no
waiting). That rules out year/week recaps as a launch feature.

- **FLAGSHIP: aesthetic "drops" (working name: Bozz Worlds / Looks / Moods).** A curated
  *mood* delivered as a bundle: matching theme + wallpaper + fonts + an ambient focus sound
  (e.g. "Cozy Autumn", "Tokyo Night", "Minimal Cream"), with a fresh drop roughly monthly.
  Why this wins for non-technical users: it is beautiful the instant you apply it (day-one
  value, zero accumulation), and the monthly cadence is the recurring reason a NORMAL person
  keeps paying ~£3/mo. "New looks every month" is a far easier sell than "encryption". It is
  the #1 consumer driver (aesthetics / identity, Notion-aesthetic culture), Momentum already
  proves people pay for the components (themes, photos, soundscapes), and it reuses the
  theming engine (`AppearancePrefs`, `colorBank`, `pageBg`, the bundled fontsource fonts) +
  a small audio layer. Deliver from a server so it grows and stays licence-clean. A one-tap
  "share my setup" snapshot turns every pretty dashboard into distribution. (If monthly
  drops feel too FOMO-y for the calm brand, ship it as a growing premium theme/wallpaper
  library instead — same value, less urgency.)
- **Focus Mode** (folds into a drop): a beautiful full-screen timer plus the drop's ambient
  sound. Instant, calm, on-brand.
- **Demoted: "Your Year in Bozz" / recaps.** Good emotional and shareable mechanic, but it
  needs months of use to pay off, which is wrong for an app fighting a cold-start retention
  problem. Keep at most a WEEKLY recap as a later retention layer, never a launch hook.

Sync + backup becomes "your stuff is safe and everywhere," the reassurance that justifies
the price after the emotional sell, not the headline. Alerts stay (genuinely useful to
normal people: never miss your bank or landlord email, plus the desktop-native moat).

Packaging note: non-technical users are MORE subscription-averse than developers, so lead
acquisition with the one-time **Founding member** option (lifetime + an exclusive founder
theme + "price goes up later"), framed as exclusivity, not charity.

### The three pillars (feature organisation)

The rule that overrides everything: **never paywall activation.** The north star is a new
user seeing their morning in 90 seconds. Whatever gets them there stays free forever. Plus
sells what comes *after* you are hooked: more of it, made yours, watched for you. Keep free
genuinely whole; gate scale, convenience, and content depth, never the core.

**Watch** — Bozz keeps an eye on things for you.
- Priority inbox alerts (section 3). Free: 1 rule. Plus: unlimited + power controls.
- Future: always-on cloud watcher (Phase 4).

**Build** — make Bozz yours, fast.
- Templates / starter packs (5.1). Free: starter packs in onboarding + importing a shared
  one. Plus: the full gallery + create and share your own.
- Multiple dashboards (5.2). Free: 1 home layout. Plus: several named, switchable.
- Premium themes & appearance packs. Free: the current rich theming. Plus: curated premium
  palettes, fonts, and wallpaper packs.

**Connect** — more of your tools.
- Multiple accounts. Free: 1 email + 1 calendar. Plus: connect several (work + personal).
- Live bank sync (future). Real per-connection cost, so cleanly chargeable. Phase 4.

| Pillar | Free | Plus |
|---|---|---|
| Alerts | 1 rule, desktop | unlimited, sender + keyword, quiet hours, multi-account, (future) cloud |
| Templates | starter packs in onboarding, import a shared one | full gallery, create + share your own |
| Dashboards | 1 home layout | multiple named layouts, switchable |
| Themes | full current theming | premium palettes / fonts / wallpaper packs |
| Accounts | 1 email + 1 calendar | several of each |
| Bank | CSV import | live sync (future) |
| Backups | local backup (`create_backup`) | automatic cloud backups + 90-day version history |
| Insights | basic weekly review | weekly digest + trends over time |
| Everything else today | free forever | free |

During beta: no limits. The split above is the *target* config, applied only when you flip
`BETA_UNLOCK`.

### 5.1 Templates (recommended second feature, after alerts)

A template is a serialisable starter pack assembled from primitives the app already has
(`Topic`, `TopicFolder`, `HomeWidgetItem`, `AppearancePrefs`, `Habit`):

```ts
export interface BozzTemplate {
  id: string;
  name: string;            // "Student", "Founder", "Job hunt", "Calm minimal"
  description: string;
  tags: string[];
  topics: Topic[];                       // stages included; sample items optional
  folders?: TopicFolder[];
  homeWidgetLayout: HomeWidgetItem[];
  appearance?: Partial<AppearancePrefs>; // mood, font, colorBank, widgetShape, navOrder
  starterHabits?: Habit[];
  budgetCategories?: string[];
  createdBy?: string;                    // for shared / community templates
}
```

Three layers, sequenced:

1. **Onboarding starter packs (FREE, build first).** On first run, offer 3-5 packs.
   Picking one populates the dashboard instantly: topics, a sensible widget layout, a
   theme. This is the single best activation lever and it directly serves the 90-second
   north star, so it is free, not Plus. Bundle them in `src/lib/templates.ts`. Apply =
   deserialise with fresh ids into the user's (empty) state.

2. **Template gallery (PLUS).** A browsable, growing library fetched from a server (start
   as a static JSON on the existing Supabase / Vercel, zero new infra). Server-delivered
   means you add templates without shipping an app update, and it is a hosted service,
   which is licence-clean to gate. Plus unlocks applying any gallery template
   non-destructively (merge into an existing setup, with preview + undo).

3. **Create & share your own (PLUS, and a growth engine).** Export the current setup as a
   template and get a share link. Store the blob (non-sensitive only: topics / layout /
   theme, never tokens or account data) in a public-read `shared_templates` Supabase table.
   Anyone, including free users, can preview it on the web and import it. Creating is Plus;
   importing is free, so every Plus user becomes a distributor. This ties straight to the
   north-star line "every shared link shows a real product."

Apply logic must remap all ids and never clobber existing user data without a confirm +
undo. Keep token / account data out of templates entirely (lesson from the v0.1.29 leak).

### 5.2 Multiple dashboards (Plus)

The app's identity is the customisable home grid, so "one grid" is the natural free ceiling
and "many" is the natural Plus expansion. Free = the single home layout that exists today.
Plus = several named layouts (Work / Weekend / Deep-work) with a quick switcher in the
title bar. The model already stores one home `HomeWidgetItem[]`; extend to
`Record<layoutId, { name; items }>` plus an active-layout id. Pairs naturally with
templates (apply a template into a fresh dashboard).

### 5.3 More Plus candidates (ranked)

Each passes the model test (hosted, scale, content, or convenience, never crippling free)
and reuses what the app already has. Ranked by value-for-effort and brand fit.

1. **Cloud backups + version history (strongest new idea).** A calm tool that holds your
   whole life has to *feel* safe. The Tauri side already has a `create_backup` command, so
   local backup exists; Plus adds automatic encrypted cloud backups with, say, 90 days of
   restorable history. It is a hosted service (storage cost), so it is licence-clean and
   honestly chargeable, and "never lose your setup" is the most on-brand upsell you have.
   Strong enough to anchor a fourth pillar, **Keep** (your data: safe, yours, made useful).

2. **Weekly review digest, "Your week in Bozz."** You already have a Review section and a
   review day/hour setting. Plus generates a calm Sunday summary: tasks done, habit
   streaks, budget snapshot, calendar load, emails triaged, optionally surfaced as a single
   desktop notification. Pure aggregation, no AI, no hype. It is a weekly reason to return,
   so it is a retention driver as much as a feature. Free: basic in-app review (today's).
   Plus: the richer digest + saved history.

3. **Email to task / snooze.** You are already deepening email with alerts. Let a message
   become a task or a dated deadline in one click, or "snooze" it to resurface on a chosen
   day. Ties the email and task subsystems that already exist, and it is genuinely useful
   daily triage. Free: create a task from an email. Plus: snooze + auto rules.

4. **Trends / personal analytics.** `recharts` is already a dependency, and habits, budget,
   and health all store time series. A Plus "Trends" view: habit consistency over months,
   spending trends, sleep over time. Power-user depth, no new infra. Lower urgency than 1-3.

5. **Premium connectors.** Keep the consumer integrations free (Gmail, Google Calendar,
   Spotify, Notion); make the prosumer ones Plus (Linear, GitHub, Todoist, Toggl). Fits the
   Connect pillar, and each costs you dev and some run time. Do not gate the big consumer
   ones: that would feel like crippling "one window for everything."

6. **Custom global shortcuts + capture routing rules.** Your signature is Ctrl+B capture
   and voice routing (`src/lib/voiceRouter.ts`, `taskParser.ts`). Plus unlocks multiple
   custom hotkeys and smart routing ("captured text containing 'pay' goes to Budget").
   Power on the hero feature.

7. **Formatted exports / reports.** `jszip` is already a dependency. Keep raw CSV / JSON
   export FREE (it is a trust signal: your data is yours). Make polished outputs Plus: a
   monthly budget PDF, a year-in-review.

Deliberately **not** proposed, to respect the locked brand boundary (no AI scheduling, no
mobile app, no team features): no AI auto-planning, no collaboration / shared workspaces,
no mobile companion. And keep raw data export + core sync free as trust signals. Monetise
depth, not your users' own data.

---

## 6. Pricing & how to sell Worlds

Your audience is sub-averse, so make the one-time option the HERO, with a sub for the
people who prefer small monthly. Comps in `BOZZ_PLUS_RESEARCH.md`.

- **Worlds All-Access (Lifetime) — the hero offer, one-time ~£15-20.** Buy once, unlock the
  whole World library AND every future drop, forever. This fits sub-averse non-technical
  users and the calm/honest brand, and it is one clean, fee-efficient transaction. It is the
  consumer-tangible version of the old "supporter" idea: people get *all the pretty stuff
  forever*, not a badge.
- **Bozz Plus (sub) — ~£3/month or £20-30/year.** For people who would rather pay small
  monthly than £15-20 up front. Unlocks all Worlds while active, plus the other Plus bits
  (priority alerts, sync depth). Market floor is ~£3/mo (TickTick $35.99/yr, Momentum
  ~$2.66/mo annual), so this is normal, not underpriced.
- **À la carte single Worlds — secondary, and price it sanely.** The "buy one World for a
  few pounds" instinct is appealing and on-brand, BUT a £2 sale is eaten by payment fees:
  through a merchant-of-record a £2 purchase nets roughly £1 after fixed + percentage fees,
  and it earns no recurring revenue. If you offer à la carte, floor it at ~£4 per World or
  sell £5 three-packs, and anchor All-Access as the obvious better deal. Recommendation:
  SKIP à la carte for v1 (extra entitlement complexity); lead with All-Access lifetime +
  sub, add single-World buys later only if people ask.
- A few Worlds are always **free** (protects free-core + powers activation).
- Name the tier "Plus," not "Pro." Lean calm and indie.

Do not build checkout yet (see rollout). During beta, unlock everything to gather signal.

---

## 7. Other monetisation ideas, ranked

1. **Bozz Plus subscription** (alerts + power features). The core. Build the rails now,
   sell later.
2. **Founding Supporter lifetime** (£49, first 100). Best *first* revenue, lowest ops.
3. **GitHub Sponsors / "buy me a coffee" link.** Zero effort, on-brand for open-source,
   captures goodwill from people who will never subscribe. Ship the link this week. Add to
   the site footer and an in-app "About / Support Bozz" row.
4. **Live bank sync (future Plus pillar).** Budget already has CSV import and a
   `BankConnectModal`. Real open-banking feeds (TrueLayer / Nordigen / Plaid) cost per
   connection, so they are a legitimate recurring cost you can charge for, and they fit the
   "hosted service" logic perfectly. Deferred: open-banking compliance is heavy.
5. **Always-on cloud alert watcher (future Plus tier-2).** The real moat and the only
   truly un-forkable feature. Deferred by your own choice because it needs server-side
   token storage (the thing that just leaked) plus hosting and ops. This is the eventual
   premium anchor once there is demand.
6. **Extended sync history / extra devices.** Sync already runs on Supabase. Could cap free
   history or device count, Plus unlocks. Lower priority and brand-risky: do not make core
   sync feel crippled.
7. **Plus content & customisation depth** (templates gallery, multiple dashboards, premium
   themes). Not separate revenue vectors; this is the "Build" pillar of the Plus sub
   (section 5). Templates rank highest after alerts because the free layer doubles as your
   activation and sharing engine. Plain cosmetic-only packs stay low priority.
8. **Affiliate / referral links.** Off-brand. You publicly say "no ads, never sold." Avoid.

Recommendation: ship #3 now, build #1 + #2 rails alongside the alert feature, put #4 and
#5 on the public roadmap as "Plus, coming."

---

## 8. Positioning & copy

In-app, when alerts ship (beta, free):

> **Priority alerts** — Bozz can ping you the moment an email that matters lands, even when
> it is tucked away in the tray. Tell it the senders and words you care about (your bank,
> a landlord, "interview"), and it watches the rest. Free while in beta.

Site (later, when Plus turns on): a single calm section, not a feature matrix war.

> **Bozz Plus** — Bozz is free and always will be. Plus is for people who want a little
> more and want to keep a one-person project alive. Unlimited priority alerts, the power
> controls, and the hosted features as they land. £3/month, or pay once to support early.

Tone rules: never "upgrade now," never countdown timers, never "unlock." Use "support,"
"a little more," "keep it alive." Calm and honest is the moat against Sunsama/Raycast.

---

## 9. Upgrade moments (when to ask)

Ask only right after the user *felt* the value. The best trigger is a priority email that
Bozz caught for them. Concretely, post-beta:

- When a caught email is opened, show a tiny inline tag: "Bozz caught this for you."
- When a free user adds a *second* rule, show the soft nudge: "Free covers one watch.
  Bozz Plus watches as many as you like." One line, dismissable, never modal-blocking.

Never interrupt the morning view with an upsell. That breaks the core promise.

---

## 10. Rollout phases

**Phase 1 (now, ~days): ship value, free.**
Build sections 3 + 4 (alerts) and the free onboarding starter packs (5.1, layer 1). The
starter packs serve activation, your actual #1 constraint, so they are worth building first
or alongside the alerts. Launch alerts as "Plus, free in beta." Add the GitHub Sponsors
link. No pricing page, no checkout. Instrument retention, rules created, alerts
fired/clicked, and which starter pack new users pick.

**Phase 2 (after you see retention signal): probe demand.**
Add a quiet "Bozz Plus is coming, support early" element and the Founding Supporter
£49 one-time via a merchant-of-record (Lemon Squeezy or Gumroad handles UK VAT). This is
your first real money and it validates willingness to pay.

**Phase 3 (only if Phase 2 sells): turn on the subscription.**
Implement `hasValidLicense()`, flip `BETA_UNLOCK = false`, apply the free/Plus split,
publish the calm pricing section. Subscriptions via the same merchant-of-record.

**Phase 4 (only on real demand): the cloud watcher.**
The always-on, fires-when-closed tier. Re-open the server-side token-security question
properly (encrypted at rest, scoped, the lessons from the v0.1.29 leak applied) before
writing a line of it.

Do not skip ahead. Each phase is gated on the previous one showing signal.

---

## 11. Metrics that matter

- **Retention**: do users with >=1 alert rule return more than users without? This is the
  whole thesis. Instrument it first.
- Alerts fired per user per week, and alert click-through rate (is the feature actually
  catching things people care about?).
- Rule count distribution (do people want more than one? that validates the Plus limit).
- Phase 2: Founding Supporter conversions. Any sales at all is strong signal at this stage.

---

## 12. Risks & honest caveats

- **Soft paywall.** Local Plus checks are bypassable by recompiling. Accept it; do not
  harden. The un-bypassable feature is the deferred cloud watcher.
- **Background timer throttling** on Windows tray windows (mitigation in 3.9).
- **Notification permission** can be denied at the OS level. Provide the "Test
  notification" button and a clear "notifications are blocked" state.
- **API quotas.** Polling Gmail/Outlook every 3 min per account is well within limits for a
  single user. Keep the cadence floor at 1 min.
- **Brand risk.** The single biggest way to break Bozz is to make free feel crippled or to
  nag. Keep free whole, keep upsells to one calm line, never in the morning view.
- **Do not let this distract from distribution.** This plan is a retention multiplier on
  users you do not have yet. Building it is worth it because it also makes Bozz more
  shareable ("it pings me when my bank emails"), but your #1 job remains getting the first
  hundred daily users. Time-box the build.

---

## 13. Build order for Claude Code (MVP checklist)

1. Add notification plugin: `Cargo.toml`, `lib.rs` `.plugin(...)`,
   `capabilities/default.json`, `npm i @tauri-apps/plugin-notification`.
2. Add types to `src/lib/types.ts` (section 3.4).
3. Create `src/lib/plus.ts` with `BETA_UNLOCK = true` (section 4).
4. Create `src/lib/alerts.ts`: `matchRules`, `inQuietHours`, `capRing`, `notify`,
   `runAlertCheck`, `startAlertWatcher`, `stopAlertWatcher` (sections 3.5-3.7).
5. Persist settings + watch state in `src/lib/storage.ts` (settings synced, watch state
   local-only).
6. Build `PriorityAlertsBlock.tsx` and mount in `SettingsView` (section 3.8).
7. Wire the watcher into `App.tsx` with the first-run seed (section 3.6).
8. Add a "Support Bozz" / GitHub Sponsors row in settings and the site footer.
9. Manual test: add a rule for your own address, send yourself an email, confirm the
   notification fires while the window is closed-to-tray, and that you are not double-
   notified.
10. (Recommended next) Free onboarding starter packs: `src/lib/templates.ts` with 3-5
    bundled `BozzTemplate`s + an apply function (fresh ids, merge into empty state),
    surfaced in onboarding. Free, high activation value.

Out of scope for v1: cloud watcher, license validation, pricing page, checkout, the Plus
template gallery + sharing, multiple dashboards, premium theme packs. Those are the Build
pillar and Phases 2-4: build them once the free base lands and retention shows up.

---

## 14. Bozz Worlds — full feature spec

A "World" is a one-tap aesthetic bundle: a matching theme + wallpaper + fonts + optional
ambient sound. Free Worlds ship in-app for instant day-one beauty and activation; premium
Worlds come from a server library that grows over time and is the paid surface. This is the
flagship Plus hook for Bozz's (non-technical) audience.

### 14.1 Data model (`src/lib/types.ts`)

```ts
export interface BozzWorld {
  id: string;                  // "cozy-autumn"
  name: string;                // "Cozy Autumn"
  description: string;
  author: string;              // "Bozz" (community later)
  free: boolean;               // a few are free
  // The look — maps onto AppearancePrefs:
  mood: MoodId;                // 'dark' | 'light' | 'warm'
  colorBank: string[];         // palette this World installs (<=30)
  accent: string;              // primary accent hex
  font: FontChoice;            // bundled font id (server fonts later)
  widgetShape?: WidgetShape;
  widgetBorder?: WidgetBorder;
  background: { url: string; dim: number; blur?: number };   // wallpaper
  ambientSound?: { url: string; name: string };              // looping audio, optional
  previewUrl: string;          // gallery thumbnail
  version: number;
}
```

Extend `AppearancePrefs` (src/lib/types.ts:366) with a global background + the active World:

```ts
// add to AppearancePrefs
appBackground?: { url: string; dim: number; blur?: number };
activeWorldId?: string;        // gallery 'applied' state + revert
ambient?: { worldId: string; volume: number; muted: boolean };
```

### 14.2 Applying / reverting (`src/lib/worlds.ts`, new)

Apply is appearance-only and NEVER touches user data (tasks, budget, calendar):

- Set `mood`, `font`, `colorBank`, `accent`, `widgetShape`, `widgetBorder` on AppearancePrefs.
- Set `appBackground` from `world.background`. Reuse the existing per-topic `pageBg`
  rendering path (`BackgroundControls.tsx`, `appearance.ts`) and promote it to a global
  background.
- Start the ambient sound (14.4) if present.
- Record `activeWorldId`; keep a "Default" pseudo-World so a user can revert in one tap.

```ts
export function applyWorld(world: BozzWorld, prefs: AppearancePrefs): AppearancePrefs { /* ... */ }
export function revertToDefault(prefs: AppearancePrefs): AppearancePrefs { /* ... */ }
export function canApply(world: BozzWorld): boolean { return world.free || hasWorldsAccess(); }
```

### 14.3 The library / catalog (server-delivered)

- A catalog lists all Worlds + metadata + asset URLs. Start as a single `worlds.json` on
  Supabase Storage / a CDN, or a public-read Supabase `worlds` table. Fetch + cache on
  launch; a new drop = edit the catalog server-side, no app release. This server delivery is
  what makes premium Worlds licence-clean to gate (hosted content, not AGPL code).
- Assets (wallpapers, audio) live on Supabase Storage / CDN. Compress wallpapers; use short
  seamless audio loops.
- Bundle 4-6 free Worlds IN the app so there is instant beauty offline and on first run.

### 14.4 Ambient audio (`src/lib/ambient.ts`, new)

- A single looping `HTMLAudioElement` — the webview plays audio directly, no Tauri plugin
  needed. Controls: `play(url)`, `stop()`, `setVolume()`, `mute()`, with a short fade.
- Persist `ambient` state in AppearancePrefs. Default volume low; respect mute. Keep it
  featherweight: calm background sound, not a music player.

### 14.5 Gallery UI (`src/components/sections/WorldsView.tsx`, new)

- Grid of World cards: preview image, name, Free / Locked badge.
- Tap to PREVIEW (apply temporarily) so users feel it before committing; "Apply" keeps it,
  leaving preview reverts.
- Locked Worlds show a lock + unlock CTA (All-Access / Plus). During beta nothing is locked.
- Entry point: a "Worlds" nav item or a panel inside Appearance settings. Match existing
  section styling.

### 14.6 Entitlement (`src/lib/plus.ts`)

```ts
export function hasWorldsAccess(): boolean {
  if (BETA_UNLOCK) return true;            // free during beta to gather signal
  return hasLifetimeAllAccess() || hasActiveSub();
}
```

Offline-checkable: a signed entitlement token from the merchant-of-record (Lemon Squeezy /
Gumroad), verified against an embedded public key. No backend required.

### 14.7 Share-my-setup (distribution)

- v1: "Share" copies a link to the active World's public web preview ("I'm using Cozy Autumn
  on Bozz") with a "Get Bozz" CTA. Simplest, and it is the growth play.
- v2: render a styled snapshot card (World name + preview + tasteful frame) to an image.

### 14.8 Build order

Phase 1 (free, instant value, no billing, no server):
1. `BozzWorld` type + `AppearancePrefs` extensions.
2. `worlds.ts` apply/revert + 4-6 bundled free Worlds.
3. `ambient.ts` audio loop.
4. `WorldsView.tsx` gallery, wired into nav / appearance.
5. Promote `pageBg` to a global `appBackground` in the render path.

Phase 2 (the paid library, beta-unlocked):
6. Server catalog (`worlds.json` / Supabase) + Storage assets; fetch + cache.
7. `hasWorldsAccess()` with `BETA_UNLOCK = true`. Premium Worlds appear, all unlocked.
8. Instrument: which Worlds get applied, preview to apply rate.

Phase 3 (turn on money):
9. Merchant-of-record checkout: Worlds All-Access (lifetime) + Bozz Plus sub.
10. Entitlement token validation; flip `BETA_UNLOCK = false`.
11. Share-my-setup; begin the (gentle) monthly drop cadence.

Out of scope v1: à la carte single-World purchases, community-made Worlds, server-loaded
fonts. Keep the free bundled Worlds genuinely good — activation depends on them.

---

## 15. Money UI & billing — full spec

Goal: a calm, honest place to see your plan, one upgrade page that sells Plus + Worlds and
takes payment, and a separate donation path. No dark patterns (brand rule). Desktop
distribution means NO app-store 30% cut and no in-app-purchase mandate, so use a
merchant-of-record directly and keep ~95% of revenue.

### 15.1 The flow

Settings → **Plan** block (see current plan + manage) → **Plus page** (features + pricing +
pay) → merchant-of-record checkout (system browser) → enter / auto-receive license key →
app validates + unlocks. Donations are a separate "Support Bozz" path that never mixes with
the paid value exchange.

### 15.2 Entitlement model (`src/lib/plus.ts`, extend)

The single source of truth every gate reads.

```ts
export type PlanTier = 'free' | 'plusMonthly' | 'plusAnnual' | 'worldsLifetime' | 'founding';

export interface Entitlement {
  tier: PlanTier;
  worldsAccess: boolean;        // can use the premium World library
  plusFeatures: boolean;        // alert power-features, sync depth, etc.
  expiresAt?: number;           // subs only; renew resets it; undefined = perpetual
  licenseKey?: string;
  source?: 'lemonsqueezy' | 'gumroad' | 'manual' | 'beta';
  activatedAt?: number;
}

const BETA_UNLOCK = true;       // everything unlocked during beta

export function getEntitlement(): Entitlement { /* read store, verify, handle expiry */ }
export function isPlus(): boolean          { return BETA_UNLOCK || getEntitlement().plusFeatures; }
export function hasWorldsAccess(): boolean { return BETA_UNLOCK || getEntitlement().worldsAccess; }
export function getPlanLabel(): string     { /* "Free" | "Bozz Plus (annual)" | "Worlds All-Access (Lifetime)" */ }
```

Persist locally via `tauri-plugin-store` (already a dep).

### 15.3 Plan block in Settings (`src/components/sections/settings/PlanBlock.tsx`, new)

Mount in `SettingsView` near `ConnectedAccountsBlock`. Shows:

- **Current plan**: `getPlanLabel()` + a one-line summary of what is included.
- If **Free**: calm "Bozz is free forever. Plus adds Worlds, priority alerts and more." +
  a primary "See Bozz Plus" button → opens the Plus page (15.4).
- If **Plus sub**: renewal date, "Manage subscription" (opens MoR customer portal), and
  "Switch to annual" if on monthly.
- If **Lifetime / Founding**: a quiet "You own Worlds All-Access forever ✓" + a thank-you.
- **Restore purchases** action (re-validate the stored key / re-activate by email).
- **Enter license key** field (paste the key from the MoR email → `activateLicense`).
- During beta: a small "Plus is free while in beta" note.

### 15.4 The Plus page (`src/components/sections/PlusView.tsx`, new)

A full-screen view/overlay, NOT a permanent nav item (reached from the Plan block and from
contextual nudges like tapping a locked World). Sections:

- **What Plus is**: a short, honest value list with visuals — the Worlds library + monthly
  drops, priority alerts, sync & backup depth. Show, do not oversell.
- **Pricing cards** (an honest "best value" tag is fine; no countdowns, no fake scarcity):
  1. **Worlds All-Access — Lifetime** (hero, ~£15-20 one-time): "Buy once, all Worlds +
     every future drop, forever."
  2. **Bozz Plus** sub with a monthly/annual toggle (~£3/mo or £20-30/yr; annual = best
     value). Each card CTA → `openCheckout(product)`.
- **Free vs Plus** comparison table (reuse the section 5 table).
- **Footer**: "Bozz is free forever, with or without Plus" + a link to **Support Bozz**
  (donations, 15.5).

### 15.5 Donations ("Support Bozz", separate from Plus)

Pure goodwill, never gated, never guilt-tripped. A small "Support Bozz" panel (Plus-page
footer + an About/Settings row):

- **GitHub Sponsors** (on-brand for open source; repo `github.com/augboz/bozz`).
- **Ko-fi / Buy Me a Coffee** one-off tip.
- Optional one-off "tip jar" amounts via the MoR.

All are external links via the existing `tauri-plugin-opener`. Copy: "Bozz is free and open
source, built by one person. If it makes your mornings calmer, you can chip in." No nag, no
modal.

### 15.6 Payment infrastructure (`src/lib/billing.ts`, new)

Use a **merchant-of-record** so a solo UK founder never touches VAT/tax/invoicing.
Recommended: **Lemon Squeezy** (clean license-key API, hosted checkout, customer portal);
Gumroad is the simpler fallback.

```ts
export function openCheckout(product: 'worldsLifetime' | 'plusMonthly' | 'plusAnnual'): void {
  // open the MoR hosted checkout URL in the system browser (tauri-plugin-opener)
}
export async function activateLicense(key: string): Promise<Entitlement> {
  // validate + activate via the MoR license API (no backend), map to Entitlement, persist
}
export async function restorePurchases(): Promise<Entitlement> { /* re-validate stored key */ }
export function openManageSubscription(): void { /* open MoR customer portal URL */ }
export function openDonate(method: 'sponsors' | 'kofi' | 'tip'): void { /* opener */ }
```

Flow detail (no backend required):
1. CTA → open MoR hosted checkout in the browser (`tauri-plugin-opener`, already present).
2. User pays; the MoR shows + emails a **license key**.
3. User pastes the key into "Enter license key"; `activateLicense` validates it against the
   MoR license API and stores the resulting `Entitlement`.
4. Subscriptions: the MoR deactivates the key when the sub lapses, so periodic
   re-validation (on launch, weekly) reflects current status. Lifetime keys never lapse.
5. Nicety (later): register a `bozz://activate?key=...` deep link so checkout hands the key
   back automatically instead of copy-paste.

### 15.7 States & edge cases

- **Sub lapses**: keep any World the user has already applied (do not yank their look — calm
  brand), but lock the library + new drops until they renew. Lifetime never lapses.
- **Restore / new device**: re-enter the license key, or "Restore" looks it up by email via
  the MoR API. (License keys are activation-limited, not secrets like OAuth tokens, so they
  could also ride the existing Supabase sync later — keep it simple first.)
- **Payment failed / offline / refunded**: clear, calm error + retry; a refund → MoR
  deactivates the key → next re-validation downgrades gracefully.
- **Beta**: `BETA_UNLOCK = true` unlocks everything; the Plan block says so.

### 15.8 Brand / UX rules (non-negotiable — this is the trust surface)

- No countdown timers, no fake "X people bought this", no scarcity, no pre-ticked add-ons.
- "Free forever" stated plainly on the Plus page.
- One-click path to cancel (the portal) and to restore.
- Donations never block, never nag, never mix with the paid value exchange.
- Honest "best value" tags are fine; manipulation is not. Trust is your #1 constraint.

### 15.9 Files & build order

- `src/lib/types.ts` — `PlanTier`, `Entitlement`.
- `src/lib/plus.ts` — entitlement source of truth + gates (extend).
- `src/lib/billing.ts` — checkout, license validation, restore, portal, donate.
- `src/components/sections/settings/PlanBlock.tsx` — plan status in Settings.
- `src/components/sections/PlusView.tsx` — the upgrade/money page.
- `src/components/sections/SettingsView.tsx` — mount PlanBlock; route to PlusView.
- Reuse `tauri-plugin-opener` (already present) for every external link.

Build order:
1. Entitlement model + `plus.ts` gates (with `BETA_UNLOCK = true`).
2. `PlanBlock` showing "Free / beta" + a "See Bozz Plus" button.
3. `PlusView` with the feature list + pricing cards (CTAs inert during beta) + comparison +
   the Support Bozz footer.
4. Donation links (ship-able immediately, even before Plus exists).
5. `billing.ts` + license-key activation + MoR checkout (Phase 3, when turning on money).
6. Subscription portal + periodic re-validation + restore.

### 15.10 Analytics

Track: Plus-page views, which pricing card is clicked, checkout opens, activations by tier,
plan distribution, and donation clicks. This tells you whether lifetime or sub wins and
whether the price is right before you commit to either.
