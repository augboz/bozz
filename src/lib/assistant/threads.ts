// Per-page assistant threads. Each page (and Home) keeps its own conversation:
// the model transcript the next turn continues from, and the cards the panel
// shows. Saved on this device only (the key is not in SYNCED_KEYS), so a
// restart picks up where the chat left off and nothing about it is uploaded.
import { getItem, setItem } from '../storage';
import type { ChatMessage } from './providers/types';

export const HOME_THREAD = 'home';
const KEY = 'assistantThreads';
const VERSION = 1;

/** Keep at most this many transcript messages per page... */
const MAX_HISTORY_MESSAGES = 24;
/** ...and at most this much text, since tool results carry page descriptions. */
const MAX_HISTORY_CHARS = 24_000;
/** Cards kept per page. Older ones scroll out of the saved thread. */
const MAX_ITEMS = 60;

export interface Thread<Item = unknown> {
  history: ChatMessage[];
  items: Item[];
  updatedAt: number;
}

export type Threads<Item = unknown> = Record<string, Thread<Item>>;

export function threadKey(pageId: string | null): string {
  return pageId ?? HOME_THREAD;
}

function messageSize(m: ChatMessage): number {
  if (m.role === 'tool') return m.results.reduce((n, r) => n + r.content.length, 0);
  return m.text.length + (m.role === 'assistant' ? JSON.stringify(m.toolCalls).length : 0);
}

/**
 * Drops the oldest turns once the transcript is too long. Always cuts at a
 * user message so an assistant tool call never loses its tool result, which
 * every provider rejects.
 */
export function trimHistory(history: ChatMessage[]): ChatMessage[] {
  let out = history;
  const tooBig = () => out.length > MAX_HISTORY_MESSAGES || out.reduce((n, m) => n + messageSize(m), 0) > MAX_HISTORY_CHARS;
  while (tooBig()) {
    // Find the second user message; everything before it is the oldest turn.
    let seen = 0; let cut = -1;
    for (let i = 0; i < out.length; i++) {
      if (out[i].role === 'user') { seen++; if (seen === 2) { cut = i; break; } }
    }
    if (cut <= 0) break; // one turn left; keep it even if large
    out = out.slice(cut);
  }
  return out;
}

export async function loadThreads<Item>(reviveItem: (raw: unknown) => Item | null): Promise<Threads<Item>> {
  try {
    const raw = await getItem(KEY);
    if (!raw?.value) return {};
    const parsed = JSON.parse(raw.value) as { version?: number; threads?: Record<string, Partial<Thread>> };
    if (parsed.version !== VERSION || !parsed.threads) return {};
    const out: Threads<Item> = {};
    for (const [key, th] of Object.entries(parsed.threads)) {
      const items = (Array.isArray(th.items) ? th.items : []).map(reviveItem).filter((x): x is Item => x !== null);
      const history = Array.isArray(th.history) ? trimHistory(th.history) : [];
      if (!items.length && !history.length) continue;
      out[key] = { history, items, updatedAt: typeof th.updatedAt === 'number' ? th.updatedAt : 0 };
    }
    return out;
  } catch { return {}; }
}

export async function saveThreads<Item>(threads: Threads<Item>): Promise<void> {
  const compact: Threads<Item> = {};
  for (const [key, th] of Object.entries(threads)) {
    if (!th.items.length && !th.history.length) continue;
    compact[key] = { history: trimHistory(th.history), items: th.items.slice(-MAX_ITEMS), updatedAt: th.updatedAt };
  }
  await setItem(KEY, JSON.stringify({ version: VERSION, threads: compact }));
}
