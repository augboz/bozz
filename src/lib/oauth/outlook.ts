import { isTauri } from '../platform';
import type { EmailMessage, OAuthAccount } from '../types';
import type { ProviderConfig } from './index';

/**
 * Outlook / Microsoft 365 email — connected over IMAP with OAuth (XOAUTH2),
 * NOT the Graph API and NOT a password.
 *
 * Why this shape: Microsoft is retiring basic auth, so password IMAP is dead;
 * and the Graph API needs a Microsoft-registered app (Azure/Entra) that the
 * project can't get. IMAP-over-OAuth threads the needle: it reuses the public
 * OAuth client ID that open-source desktop mail clients (Thunderbird) register
 * with Microsoft for IMAP access, so no Azure registration is needed. The
 * trade-off is that Microsoft's consent screen shows that client's name — see
 * OUTLOOK_CLIENT_ID. Desktop-only: IMAP needs raw TLS sockets (Rust layer).
 *
 * If a Bozz-branded Azure app is ever registered (with IMAP.AccessAsUser.All),
 * set VITE_OUTLOOK_CLIENT_ID and it takes over automatically — same IMAP path,
 * branded consent.
 */

/** Outlook.com / Microsoft 365 IMAP endpoint (same host for both). */
const OUTLOOK_IMAP_HOST = 'outlook.office365.com';
const OUTLOOK_IMAP_PORT = 993;

/**
 * The OAuth client ID used for the Microsoft sign-in. Prefers a project-owned
 * one from the build env (VITE_OUTLOOK_CLIENT_ID) if set — then the consent
 * screen says "Bozz". Otherwise falls back to Mozilla Thunderbird's well-known
 * public desktop-client ID, which Microsoft registers for IMAP/POP/SMTP access
 * to consumer + org accounts. Reusing it means no Azure registration is needed,
 * at the cost of the consent screen reading "Mozilla Thunderbird".
 */
export const OUTLOOK_CLIENT_ID =
  (import.meta.env.VITE_OUTLOOK_CLIENT_ID as string | undefined) ||
  '9e5f94bc-e8a4-4e73-b8be-63364c29d753';

/** True when we're falling back to Thunderbird's public ID (consent shows its name). */
export const OUTLOOK_USES_BORROWED_ID = !import.meta.env.VITE_OUTLOOK_CLIENT_ID;

export const outlookConfig: ProviderConfig = {
  provider: 'outlook',
  authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  // IMAP access + a refresh token. NOT Graph scopes — the borrowed client ID is
  // only consented for mail-protocol access, so we authenticate to IMAP directly.
  scopes: ['https://outlook.office.com/IMAP.AccessAsUser.All', 'offline_access'],
  usesClientSecret: false,
  // The email address can't come from Graph /me here (no Graph scope); the
  // connect UI collects it and passes it to connectProvider as knownEmail, so
  // this identify() is never actually reached. Kept to satisfy the interface.
  identify: async () => {
    throw new Error('Outlook connect needs the email address up front (IMAP username).');
  },
};

interface ImapRow {
  id: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  dateMs: number;
  unread: boolean;
}

/**
 * Fetch the recent inbox over IMAP using the OAuth access token (XOAUTH2),
 * via the Rust `imap_fetch_xoauth2` command. Desktop-only.
 */
export async function fetchOutlookInbox(account: OAuthAccount, accessToken: string): Promise<EmailMessage[]> {
  if (!isTauri()) {
    throw new Error('Outlook email is available in the desktop app only (IMAP needs a native connection).');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  const rows = await invoke<ImapRow[]>('imap_fetch_xoauth2', {
    host: OUTLOOK_IMAP_HOST,
    port: OUTLOOK_IMAP_PORT,
    username: account.email,
    accessToken,
  });
  return rows.map(m => ({
    // Sequence numbers aren't stable across syncs, so scope the id to the
    // account + sync-relative seq; enough for de-dup within a render.
    id: `outlook:${account.email}:${m.id}`,
    provider: 'outlook',
    accountEmail: account.email,
    fromName: m.fromName,
    fromEmail: (m.fromEmail || '').toLowerCase(),
    subject: m.subject,
    // IMAP ENVELOPE has no body preview; leave blank (v1 shows sender/subject/date).
    snippet: '',
    date: m.dateMs,
    unread: m.unread,
    permalink: 'https://outlook.live.com/mail/0/inbox',
  }));
}

/**
 * Sent-derived frequent contacts aren't wired for the IMAP path yet (would need
 * a Sent-folder fetch in Rust). Return none — scoring just loses the "frequent"
 * bonus for Outlook, nothing breaks.
 */
export async function fetchOutlookFrequentRecipients(_accessToken: string): Promise<string[]> {
  return [];
}

// Read-only for v1: the OAuth token is IMAP-scoped and the write-side IMAP
// commands (STORE \Seen, MOVE) aren't built yet, so these are safe no-ops. They
// keep the shared email UI working without erroring when it calls them for an
// Outlook message. TODO: IMAP STORE/MOVE for parity with Gmail.
export async function markOutlookRead(_accessToken: string, _rawId: string): Promise<void> {
  /* no-op (read-only v1) */
}

export async function archiveOutlook(_accessToken: string, _rawId: string): Promise<void> {
  /* no-op (read-only v1) */
}

export async function trashOutlook(_accessToken: string, _rawId: string): Promise<void> {
  /* no-op (read-only v1) */
}
