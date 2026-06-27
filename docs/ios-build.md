# Building Bozz for iOS (scoped companion → App Store)

A focused iPhone build of Bozz — your tasks + today's home view — that syncs
through the **same Supabase** the desktop app uses. It deliberately leaves out
the desktop-only machinery (tray, auto-updater, global shortcut, loopback-OAuth
integrations, IMAP). All `tauri ios` work happens **on a Mac with Xcode**.

> Bundle identifier is already `com.bozz.app` (see `src-tauri/tauri.conf.json`) —
> reuse it as the iOS App ID so desktop and mobile share one identity.

---

## 0. Start the two slow things first (do these immediately)

These have waits and block everything downstream:

1. **Apple Developer Program enrollment** — <https://developer.apple.com/programs/enroll/>.
   $99/yr. Identity verification can take 24–48h+. An **individual** account is
   fine; apps list under your name.
2. **Download Xcode** from the Mac App Store (~7–15 GB).

While those run, the code prep can happen in parallel (done in the repo, not on
the Mac).

Also: confirm the App Store **name "Bozz" is available** early — search the App
Store and, once enrolled, reserve it in App Store Connect (you can create the app
record before the build is ready).

---

## 1. One-time Mac setup

```bash
xcode-select --install                 # command-line tools
sudo xcodebuild -license accept
# Rust iOS targets:
rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios
# CocoaPods (Tauri iOS uses it):
brew install cocoapods                  # or: sudo gem install cocoapods
```

Open Xcode once so it finishes installing its components, then sign in with your
Apple ID under **Xcode → Settings → Accounts**.

---

## 2. Get the repo on the Mac

```bash
git clone https://github.com/augboz/bozz.git
cd bozz
npm ci
```

Create the same `.env` the desktop build uses (Supabase URL/key etc.) so the
frontend can reach Supabase.

---

## 3. Initialise the iOS project

```bash
npm run tauri ios init
```

This generates `src-tauri/gen/apple/` (an Xcode project). Commit it.

---

## 4. Run it in the simulator, then on your phone

```bash
npm run tauri ios dev            # boots the iOS Simulator
```

If it fails to compile, it's almost always a desktop-only dependency that still
needs gating behind `#[cfg(desktop)]` / `target_os` — see §6. Once the simulator
works, plug in your iPhone, select it as the run target in Xcode, and run
on-device (you'll be asked to trust your developer cert on the phone once).

---

## 5. Signing in Xcode

Open `src-tauri/gen/apple/bozz.xcodeproj` in Xcode:

- **Signing & Capabilities** → check **Automatically manage signing** → select
  your Team (appears after the account is enrolled).
- Confirm the **Bundle Identifier** is `com.bozz.app`.

---

## 6. What was gated out for mobile

The desktop app leans on features iOS doesn't allow. These are compiled out of
the iOS build (done in the repo before you build):

| Desktop feature | Why it's out on iOS |
| --- | --- |
| System tray, global shortcut | No tray / global hotkeys on iOS |
| `autostart`, `single-instance`, `window-state` | Desktop window/session concepts |
| `updater` | **Banned** on iOS — App Store handles updates |
| Loopback-OAuth + popup windows | iOS forbids local servers / 2nd windows |
| `imap` + `native-tls`, `keyring` | Not used by the scoped companion |

Sync + auth on iOS go through the Supabase JS client over HTTPS, which the
sandbox allows.

---

## 7. TestFlight (the "it's real on my iPhone" milestone)

```bash
npm run tauri ios build           # release archive
```

Then in Xcode: **Product → Archive → Distribute App → App Store Connect →
Upload**. After processing, add yourself as an internal tester in
**App Store Connect → TestFlight**, install the TestFlight app on your phone, and
you're running a real signed build. This usually works the same day enrollment
clears.

---

## 8. App Store submission

In **App Store Connect**, for the app record:

- **Privacy "nutrition labels"** — declare what data is handled (tasks sync via
  Supabase). Privacy policy URL: <https://bozz-app.vercel.app/privacy.html>.
- **Screenshots** — at least one iPhone size (6.7"). Take them from the
  simulator (`⌘S`).
- Description, category, support URL, then **Submit for Review**.

Review is typically 1–3 days. **Expect the first submission to bounce once** —
usually metadata/privacy/screenshots, occasionally "minimum functionality"
(Guideline 4.2) if a screen feels too thin. Fix and resubmit; it's normal.

---

## Gotchas

- `tauri ios dev`/`build` only run on macOS — Windows can't produce iOS builds.
- If CocoaPods errors on `pod install`, run it manually in
  `src-tauri/gen/apple/` and re-run the Tauri command.
- Keep the app genuinely useful on a phone (real tasks/home, not a stub) — that's
  what gets it past review and what makes the CV line worth having.
