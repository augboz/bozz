# macOS code signing & notarization

This is the one-time setup that stops macOS from showing
**"Bozz is damaged and can't be opened. You should move it to the Trash."**

That error is Gatekeeper rejecting an app that isn't signed with an Apple
Developer ID and notarized. Until that's done, the build is only ad-hoc-signed,
and the download-quarantine flag makes Gatekeeper treat it as damaged on Apple
Silicon. The release workflow ([`.github/workflows/release.yml`](../.github/workflows/release.yml))
is already wired to sign + notarize **as soon as the six secrets below exist** —
until then it ad-hoc-signs exactly as before, so nothing breaks.

## What you need

- An **[Apple Developer Program](https://developer.apple.com/programs/)**
  membership (**$99/year**). This is unavoidable — only Apple can issue the
  Developer ID certificate that notarization requires.
- About 20 minutes, mostly on a Mac (to create/export the certificate).

## Step 1 — Create a "Developer ID Application" certificate

1. On a Mac, open **Keychain Access → Certificate Assistant → Request a
   Certificate From a Certificate Authority**. Enter your email, leave "CA
   Email" blank, choose **Saved to disk**, and save the `.certSigningRequest`.
2. Go to <https://developer.apple.com/account/resources/certificates/list> →
   **+** → **Developer ID Application** → upload the CSR → download the
   resulting `.cer`.
3. Double-click the `.cer` to import it into your **login** keychain.

## Step 2 — Export the certificate as a `.p12`

1. In Keychain Access, find **"Developer ID Application: Your Name (TEAMID)"**,
   expand it so the private key is included, right-click → **Export**.
2. Save as `.p12` and set a strong password — you'll need it as
   `APPLE_CERTIFICATE_PASSWORD`.
3. Base64-encode the file (this becomes `APPLE_CERTIFICATE`):

   ```bash
   base64 -i Certificates.p12 | pbcopy   # now in your clipboard
   ```

## Step 3 — Create an app-specific password for notarization

1. Go to <https://account.apple.com> → **Sign-In and Security → App-Specific
   Passwords → +**. Name it e.g. `bozz-notarize`.
2. Copy the generated password — this is `APPLE_PASSWORD` (it is **not** your
   normal Apple ID password).

## Step 4 — Find your Team ID and signing identity

- **Team ID** (`APPLE_TEAM_ID`): the 10-character code at
  <https://developer.apple.com/account> → **Membership details**
  (also the `TEAMID` shown in parentheses in the certificate name).
- **Signing identity** (`APPLE_SIGNING_IDENTITY`): the full certificate name,
  e.g. `Developer ID Application: Your Name (ABCDE12345)`. Verify with:

  ```bash
  security find-identity -v -p codesigning
  ```

## Step 5 — Add the six GitHub secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**.
Add all six (names must match exactly):

| Secret | Value |
| --- | --- |
| `APPLE_CERTIFICATE` | base64 of the `.p12` from Step 2 |
| `APPLE_CERTIFICATE_PASSWORD` | the `.p12` export password |
| `APPLE_SIGNING_IDENTITY` | `Developer ID Application: Your Name (TEAMID)` |
| `APPLE_ID` | your Apple ID email |
| `APPLE_PASSWORD` | the app-specific password from Step 3 |
| `APPLE_TEAM_ID` | your 10-character Team ID |

## Step 6 — Cut a release and verify

Push a new `v*` tag. The Mac job will sign with the hardened runtime
(entitlements in [`src-tauri/entitlements.plist`](../src-tauri/entitlements.plist)),
notarize via `notarytool`, and staple the ticket. To confirm a downloaded DMG
is good:

```bash
spctl -a -vvv -t install /Applications/Bozz.app
#   → "accepted  source=Notarized Developer ID"
xcrun stapler validate /Applications/Bozz.app
#   → "The validate action worked!"
```

Once a notarized release ships, the app opens with **no warning at all**, and
you can drop the `xattr` workaround note from the website download section.

## Notes

- Notarization adds a few minutes to each Mac build (Apple queues the request).
- If a notarized build is ever rejected, the workflow log includes a submission
  ID; run `xcrun notarytool log <id> --apple-id … --team-id … --password …` to
  see why (usually a missing hardened-runtime flag or an unsigned nested
  binary).
- The `TAURI_SIGNING_PRIVATE_KEY` secret is **unrelated** — that signs the
  auto-updater payloads (minisign), not the Apple/Gatekeeper signature.
