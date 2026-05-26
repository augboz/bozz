import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import type { EmailMessage, OAuthAccount } from '../types';
import type { ProviderConfig } from './index';

const GRAPH = 'https://graph.microsoft.com/v1.0';

async function graphFetch(accessToken: string, url: string, init?: RequestInit): Promise<Response> {
  return tauriFetch(url, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

async function identifyOutlook(accessToken: string): Promise<string> {
  const r = await graphFetch(accessToken, `${GRAPH}/me?$select=mail,userPrincipalName`);
  if (!r.ok) throw new Error(`Outlook identify failed: ${r.status}`);
  const j = (await r.json()) as { mail?: string; userPrincipalName?: string };
  return (j.mail ?? j.userPrincipalName ?? '').toLowerCase();
}

export const outlookConfig: ProviderConfig = {
  provider: 'outlook',
  authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  scopes: ['Mail.ReadWrite', 'offline_access', 'openid', 'profile', 'email'],
  usesClientSecret: false,
  identify: identifyOutlook,
};

interface OutlookMessage {
  id: string;
  subject: string;
  bodyPreview: string;
  receivedDateTime: string;
  isRead: boolean;
  webLink: string;
  from?: { emailAddress?: { name?: string; address?: string } };
  toRecipients?: Array<{ emailAddress?: { name?: string; address?: string } }>;
}

export async function fetchOutlookInbox(account: OAuthAccount, accessToken: string): Promise<EmailMessage[]> {
  const url =
    `${GRAPH}/me/messages?$filter=isRead eq false&$top=50` +
    `&$select=id,subject,bodyPreview,receivedDateTime,from,isRead,webLink` +
    `&$orderby=receivedDateTime desc`;
  const r = await graphFetch(accessToken, url);
  if (!r.ok) throw new Error(`Outlook list failed: ${r.status}`);
  const json = (await r.json()) as { value: OutlookMessage[] };
  return json.value.map(m => {
    const fromAddr = m.from?.emailAddress?.address ?? '';
    return {
      id: `outlook:${m.id}`,
      provider: 'outlook',
      accountEmail: account.email,
      fromName: m.from?.emailAddress?.name ?? '',
      fromEmail: fromAddr.toLowerCase(),
      subject: m.subject ?? '',
      snippet: m.bodyPreview ?? '',
      date: new Date(m.receivedDateTime).getTime(),
      unread: !m.isRead,
      permalink: m.webLink,
    };
  });
}

export async function fetchOutlookFrequentRecipients(accessToken: string): Promise<string[]> {
  const url =
    `${GRAPH}/me/mailFolders('SentItems')/messages?$top=50&$select=toRecipients`;
  const r = await graphFetch(accessToken, url);
  if (!r.ok) return [];
  const json = (await r.json()) as { value: OutlookMessage[] };
  const out: string[] = [];
  for (const m of json.value) {
    for (const rcpt of m.toRecipients ?? []) {
      const a = rcpt.emailAddress?.address;
      if (a) out.push(a.toLowerCase());
    }
  }
  return out;
}

export async function markOutlookRead(accessToken: string, rawId: string): Promise<void> {
  const id = rawId.replace(/^outlook:/, '');
  await graphFetch(accessToken, `${GRAPH}/me/messages/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isRead: true }),
  });
}

export async function archiveOutlook(accessToken: string, rawId: string): Promise<void> {
  const id = rawId.replace(/^outlook:/, '');
  await graphFetch(accessToken, `${GRAPH}/me/messages/${id}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ destinationId: 'archive' }),
  });
}

export async function trashOutlook(accessToken: string, rawId: string): Promise<void> {
  const id = rawId.replace(/^outlook:/, '');
  await graphFetch(accessToken, `${GRAPH}/me/messages/${id}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ destinationId: 'deleteditems' }),
  });
}
