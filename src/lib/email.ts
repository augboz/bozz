import type { EmailMessage, EmailProvider, OAuthAccount } from './types';
import { refreshAccessToken } from './oauth';
import { secretGet, secretDelete, tokenKey } from './oauth/keyring';
import { gmailConfig, fetchGmailInbox, fetchGmailFrequentRecipients, markGmailRead, archiveGmail, trashGmail } from './oauth/gmail';
import { outlookConfig, fetchOutlookInbox, fetchOutlookFrequentRecipients, markOutlookRead, archiveOutlook, trashOutlook } from './oauth/outlook';

const CONFIG = { gmail: gmailConfig, outlook: outlookConfig };

/** Returns an access token, refreshing first if it has expired. */
export async function ensureAccessToken(
  account: OAuthAccount,
  updateAccount: (next: OAuthAccount) => void,
): Promise<string> {
  const cached = await secretGet(tokenKey(account.provider, account.email, 'access'));
  if (cached && account.expiresAt > Date.now()) return cached;

  const refresh = await secretGet(tokenKey(account.provider, account.email, 'refresh'));
  if (!refresh) throw new Error(`No refresh token for ${account.email}`);
  const cfg = CONFIG[account.provider];
  const { accessToken, expiresAt } = await refreshAccessToken(cfg, account, refresh);
  updateAccount({ ...account, expiresAt });
  return accessToken;
}

export async function disconnectAccount(account: OAuthAccount): Promise<void> {
  await secretDelete(tokenKey(account.provider, account.email, 'access'));
  await secretDelete(tokenKey(account.provider, account.email, 'refresh'));
}

function recencyScore(date: number, now: number): number {
  const ageDays = (now - date) / 86_400_000;
  return Math.max(0, 1 - ageDays / 7);
}

export function scoreMessages(
  messages: EmailMessage[],
  frequent: Set<string>,
  now: number,
): EmailMessage[] {
  return messages.map(m => ({
    ...m,
    score: (m.unread ? 2 : 0) + (frequent.has(m.fromEmail) ? 1 : 0) + recencyScore(m.date, now),
  }));
}

export interface SyncResult {
  messages: EmailMessage[];
  accounts: OAuthAccount[];      // updated with new expiresAt + lastSync
  errors: Array<{ account: string; error: string }>;
}

/** Refresh tokens, fetch inboxes + sent-derived "frequent contacts", merge + score. */
export async function syncAllAccounts(accounts: OAuthAccount[]): Promise<SyncResult> {
  const results = await Promise.all(accounts.map(async (account) => {
    const updates: { account: OAuthAccount; messages: EmailMessage[]; frequent: string[] } = {
      account, messages: [], frequent: [],
    };
    try {
      let nextAccount = account;
      const token = await ensureAccessToken(account, a => { nextAccount = a; });
      const [inbox, frequent] = account.provider === 'gmail'
        ? await Promise.all([fetchGmailInbox(nextAccount, token), fetchGmailFrequentRecipients(token)])
        : await Promise.all([fetchOutlookInbox(nextAccount, token), fetchOutlookFrequentRecipients(token)]);
      updates.account = { ...nextAccount, lastSync: Date.now() };
      updates.messages = inbox;
      updates.frequent = frequent;
      return { ok: true as const, ...updates };
    } catch (e) {
      return { ok: false as const, account, error: String(e), messages: [], frequent: [] };
    }
  }));

  const allMessages: EmailMessage[] = [];
  const frequentSet = new Set<string>();
  for (const r of results) {
    for (const m of r.messages) allMessages.push(m);
    for (const f of r.frequent) frequentSet.add(f);
  }
  const scored = scoreMessages(allMessages, frequentSet, Date.now())
    .sort((a, b) => b.date - a.date);

  return {
    messages: scored,
    accounts: results.map(r => r.account),
    errors: results.flatMap(r => r.ok ? [] : [{ account: r.account.email, error: r.error }]),
  };
}

export async function markRead(
  account: OAuthAccount,
  message: EmailMessage,
  updateAccount: (a: OAuthAccount) => void,
): Promise<void> {
  const token = await ensureAccessToken(account, updateAccount);
  if (account.provider === 'gmail') await markGmailRead(token, message.id);
  else await markOutlookRead(token, message.id);
}

export async function archive(
  account: OAuthAccount,
  message: EmailMessage,
  updateAccount: (a: OAuthAccount) => void,
): Promise<void> {
  const token = await ensureAccessToken(account, updateAccount);
  if (account.provider === 'gmail') await archiveGmail(token, message.id);
  else await archiveOutlook(token, message.id);
}

export async function deleteEmail(
  account: OAuthAccount,
  message: EmailMessage,
  updateAccount: (a: OAuthAccount) => void,
): Promise<void> {
  const token = await ensureAccessToken(account, updateAccount);
  if (account.provider === 'gmail') await trashGmail(token, message.id);
  else await trashOutlook(token, message.id);
}

/** Convenience: get the provider config for a provider id. */
export function providerConfig(p: EmailProvider) {
  return CONFIG[p];
}
