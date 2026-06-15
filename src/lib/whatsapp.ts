/**
 * WhatsApp integration via the bundled multi-user bridge (whatsapp-bridge/).
 *
 * Desktop (Tauri): bridge runs on localhost:3210 — start it with:
 *   cd whatsapp-bridge && npm install && npm start
 *
 * Web / deployed: set VITE_WA_BACKEND_URL in .env.local pointing to
 *   a deployed instance of the same bridge (Railway, Render, Fly.io, etc.)
 *   Optionally set VITE_WA_BACKEND_KEY to secure it.
 *
 * API shape expected from the bridge:
 *   POST   /sessions/:userId          → WASessionStatus
 *   GET    /sessions/:userId/status   → WASessionStatus
 *   GET    /sessions/:userId/chats    → WAChat[]
 *   DELETE /sessions/:userId          → {}
 */

import { isTauri } from './platform';

const LOCAL_BRIDGE = 'http://localhost:3210';

function bridgeBase(): string {
  if (isTauri()) return LOCAL_BRIDGE;
  return (import.meta.env.VITE_WA_BACKEND_URL as string | undefined)?.replace(/\/$/, '') ?? '';
}

function bridgeKey(): string {
  return (import.meta.env.VITE_WA_BACKEND_KEY as string | undefined) ?? '';
}

export interface WAAccount {
  userId: string;
  phone?: string;
  name?: string;
}

export interface WAChat {
  id: string;
  name: string;
  lastMessage: string;
  lastSender: string;
  timestamp: number;
  isGroup: boolean;
  fromMe: boolean;
  unread: number;
}

export interface WASessionStatus {
  connected: boolean;
  phone?: string;
  name?: string;
  qr?: string;
}

async function bridgeFetch<T>(method: string, path: string): Promise<T> {
  const base = bridgeBase();
  if (!base) throw new Error('WhatsApp bridge not running');
  const r = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(bridgeKey() ? { Authorization: `Bearer ${bridgeKey()}` } : {}),
    },
  });
  if (!r.ok) throw new Error(`Bridge ${r.status}`);
  return r.json() as Promise<T>;
}

export function isWAConfigured(): boolean {
  return isTauri() || Boolean((import.meta.env.VITE_WA_BACKEND_URL as string | undefined));
}

export async function startWASession(userId: string): Promise<WASessionStatus> {
  return bridgeFetch<WASessionStatus>('POST', `/sessions/${userId}`);
}

export async function getWASessionStatus(userId: string): Promise<WASessionStatus> {
  return bridgeFetch<WASessionStatus>('GET', `/sessions/${userId}/status`);
}

export async function getWAChats(userId: string): Promise<WAChat[]> {
  return bridgeFetch<WAChat[]>('GET', `/sessions/${userId}/chats`);
}

export async function deleteWASession(userId: string): Promise<void> {
  await bridgeFetch('DELETE', `/sessions/${userId}`);
}
