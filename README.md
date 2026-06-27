# Bozz

**A customizable personal life dashboard — your tasks, calendar, email, and habits in one desktop app.**

Bozz is an open-source desktop app for **Windows and macOS** that brings your day into one place: a customizable widget home, topic-based task lists with stages, calendar and email integrations, habit tracking, and a weekly review. It syncs across your devices and is built to stay private.

> © 2026 Augustin Bozzetto. This is source-available **copyleft** software — see [License](#license).

## Download

Grab the latest installer from the [**Releases**](https://github.com/augboz/bozz/releases/latest) page:

- **Windows:** `Bozz-setup.exe`
- **macOS (Apple Silicon):** `Bozz-mac-arm.dmg`
- **macOS (Intel):** `Bozz-mac-intel.dmg`

The app updates itself automatically on launch.

### Code signing

The Windows installer is code-signed through the free **[SignPath Foundation](https://signpath.org)** open-source code-signing program, so it is verified by Microsoft SmartScreen / Defender.

On **macOS**, if Gatekeeper reports *"Bozz is damaged and can't be opened"*, the build you downloaded predates notarization. This is the download-quarantine flag, not a corrupt file. Drag Bozz into **Applications**, then clear the flag in Terminal:

```bash
xattr -dr com.apple.quarantine /Applications/Bozz.app
```

Open it normally afterwards. Notarized builds (signed with an Apple Developer ID) open with no warning at all — see [docs/macos-signing.md](docs/macos-signing.md) for the release-side setup.

## Built with

[Tauri 2](https://tauri.app) · [React](https://react.dev) · [TypeScript](https://www.typescriptlang.org) · [Vite](https://vite.dev) · [Supabase](https://supabase.com) (sync) · Vercel serverless functions (OAuth token exchange).

## Privacy

Bozz stores your data in your own Supabase project and keeps integration tokens in your OS keychain. It does not sell your data or run third-party trackers. Full policy: **[Privacy Policy](https://bozz-app.vercel.app/privacy.html)**.

## Security

Found a vulnerability? Please report it privately — see [SECURITY.md](SECURITY.md). Do **not** open a public issue for security problems.

## License

Bozz is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)** — see [LICENSE](LICENSE).

In short: you are free to use, study, and modify Bozz, but **if you distribute it or run a modified version as a network service, you must release your source code under the same AGPL-3.0 license.** This keeps Bozz and any derivative open-source. As the copyright holder, Augustin Bozzetto retains all rights and may also offer the software under separate terms.

*Note: a license protects this specific source code. It does not stop anyone from building a different app with similar ideas — that's true of all software.*
