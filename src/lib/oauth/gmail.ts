import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import type { EmailMessage, OAuthAccount } from '../types';
import type { ProviderConfig } from './index';

const BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

async function googleFetch(accessToken: string, url: string, init?: RequestInit): Promise<Response> {
  return tauriFetch(url, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

async function identifyGmail(accessToken: string): Promise<string> {
  const r = await googleFetch(accessToken, 'https://www.googleapis.com/oauth2/v2/userinfo');
  if (!r.ok) throw new Error(`Gmail identify failed: ${r.status}`);
  const json = (await r.json()) as { email?: string };
  if (!json.email) throw new Error('Gmail identify returned no email');
  return json.email;
}

export const gmailConfig: ProviderConfig = {
  provider: 'gmail',
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  scopes: [
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/userinfo.email',
  ],
  usesClientSecret: true,
  // offline + consent guarantees we get a refresh_token even on re-auth.
  extraAuthParams: { access_type: 'offline', prompt: 'consent' },
  identify: identifyGmail,
};

interface GmailMessageMeta {
  id: string; threadId: string; snippet: string; labelIds?: string[];
  internalDate: string; payload: { headers: Array<{ name: string; value: string }> };
}

function header(headers: Array<{ name: string; value: string }>, name: string): string {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
}

function parseFromHeader(raw: string): { name: string; email: string } {
  // "Name <email@x>" or "email@x"
  const m = raw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].replace(/^"|"$/g, ''), email: m[2].toLowerCase() };
  return { name: '', email: raw.trim().toLowerCase() };
}

export async function fetchGmailInbox(account: OAuthAccount, accessToken: string): Promise<EmailMessage[]> {
  const listRes = await googleFetch(
    accessToken,
    `${BASE}/messages?q=in:inbox&maxResults=20`,
  );
  if (!listRes.ok) throw new Error(`Gmail list failed: ${listRes.status}`);
  const listJson = (await listRes.json()) as { messages?: Array<{ id: string }> };
  const ids = (listJson.messages ?? []).map(m => m.id);
  if (ids.length === 0) return [];

  const fetches = ids.map(async (id) => {
    const r = await googleFetch(accessToken,
      `${BASE}/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
    );
    if (!r.ok) return null;
    const m = (await r.json()) as GmailMessageMeta;
    // Some message types (e.g. drafts/chats) omit payload entirely.
    if (!m?.payload?.headers) return null;
    return m;
  });
  const metas = (await Promise.all(fetches)).filter((m): m is GmailMessageMeta => m !== null);

  return metas.map(m => {
    const from = parseFromHeader(header(m.payload.headers, 'From'));
    return {
      id: `gmail:${m.id}`,
      provider: 'gmail',
      accountEmail: account.email,
      fromName: from.name,
      fromEmail: from.email,
      subject: header(m.payload.headers, 'Subject'),
      snippet: m.snippet ?? '',
      date: Number(m.internalDate),
      unread: m.labelIds?.includes('UNREAD') ?? true,
      permalink: `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(account.email)}&fs=1#all/${m.id}`,
    };
  });
}

/** Returns recipient email addresses from up to 50 recent sent messages. */
export async function fetchGmailFrequentRecipients(accessToken: string): Promise<string[]> {
  const r = await googleFetch(accessToken, `${BASE}/messages?q=in:sent&maxResults=50`);
  if (!r.ok) return [];
  const json = (await r.json()) as { messages?: Array<{ id: string }> };
  const ids = (json.messages ?? []).map(m => m.id);
  const metas = await Promise.all(ids.map(async (id) => {
    const rr = await googleFetch(accessToken,
      `${BASE}/messages/${id}?format=metadata&metadataHeaders=To`,
    );
    if (!rr.ok) return null;
    const m = (await rr.json()) as GmailMessageMeta;
    return m?.payload?.headers ? m : null;
  }));
  const out: string[] = [];
  for (const m of metas) {
    if (!m) continue;
    const raw = header(m.payload.headers, 'To');
    for (const piece of raw.split(',')) {
      const parsed = parseFromHeader(piece);
      if (parsed.email) out.push(parsed.email);
    }
  }
  return out;
}

export async function markGmailRead(accessToken: string, rawId: string): Promise<void> {
  const id = rawId.replace(/^gmail:/, '');
  await googleFetch(accessToken, `${BASE}/messages/${id}/modify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
  });
}

export async function archiveGmail(accessToken: string, rawId: string): Promise<void> {
  const id = rawId.replace(/^gmail:/, '');
  await googleFetch(accessToken, `${BASE}/messages/${id}/modify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ removeLabelIds: ['INBOX'] }),
  });
}

export async function trashGmail(accessToken: string, rawId: string): Promise<void> {
  const id = rawId.replace(/^gmail:/, '');
  await googleFetch(accessToken, `${BASE}/messages/${id}/trash`, { method: 'POST' });
}
