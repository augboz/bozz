# Security Policy

## Reporting a vulnerability

If you discover a security vulnerability in Bozz, please report it **privately** — do not open a public GitHub issue.

- Use **GitHub's private vulnerability reporting**: go to the repository's **Security → Report a vulnerability** tab, or
- Email the maintainer at **ab5324@ic.ac.uk** with the details.

Please include:
- a description of the issue and its impact,
- steps to reproduce (or a proof of concept),
- the app version / platform.

You'll get an acknowledgement as soon as possible, and we'll work with you on a fix and coordinated disclosure. Please give us reasonable time to address the issue before any public disclosure.

## Supported versions

Only the **latest released version** of Bozz receives security fixes. The app auto-updates, so keeping it open keeps you current.

## Scope & notes

- **Secrets:** OAuth *client secrets* and API keys live only in server-side environment variables (Vercel) and are never shipped in the app. Integration tokens are stored in the OS keychain on your device. The Supabase **anon** key and OAuth **client IDs** are public by design and are not vulnerabilities.
- **Data:** Your data is stored in your own Supabase project. See the [Privacy Policy](https://bozz-app.vercel.app/privacy.html).
- Please do not run automated scanners or denial-of-service tests against the hosted endpoints.
