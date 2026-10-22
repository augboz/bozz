import { describe, it, expect, vi, beforeEach } from 'vitest';

const mem = new Map<string, string>();
vi.mock('../storage', () => ({
  getItem: vi.fn(async (k: string) => (mem.has(k) ? { value: mem.get(k)! } : null)),
  setItem: vi.fn(async (k: string, v: string) => { mem.set(k, v); }),
  deleteItem: vi.fn(), listKeysByPrefix: vi.fn(), isStoreHealthy: vi.fn(),
}));

import { trimHistory, loadThreads, saveThreads, threadKey, HOME_THREAD } from '../assistant/threads';
import type { ChatMessage } from '../assistant/providers/types';

const turn = (n: number, big = 0): ChatMessage[] => [
  { role: 'user', text: `ask ${n}` },
  { role: 'assistant', text: '', toolCalls: [{ id: `c${n}`, name: 'read_dashboard', input: {} }] },
  { role: 'tool', results: [{ callId: `c${n}`, name: 'read_dashboard', content: 'x'.repeat(big), isError: false }] },
  { role: 'assistant', text: `done ${n}`, toolCalls: [] },
];

describe('assistant threads', () => {
  beforeEach(() => mem.clear());

  it('keys Home and pages separately', () => {
    expect(threadKey(null)).toBe(HOME_THREAD);
    expect(threadKey('cp')).toBe('cp');
  });

  it('trims old turns at user boundaries so tool calls keep their results', () => {
    const history = Array.from({ length: 15 }, (_, i) => turn(i)).flat(); // 60 messages
    const trimmed = trimHistory(history);
    expect(trimmed.length).toBeLessThanOrEqual(40);
    expect(trimmed[0].role).toBe('user');
    expect(trimmed[trimmed.length - 1]).toEqual({ role: 'assistant', text: 'done 14', toolCalls: [] });
    // Every tool call still has its result right after it.
    trimmed.forEach((m, i) => { if (m.role === 'assistant' && m.toolCalls.length) expect(trimmed[i + 1].role).toBe('tool'); });
  });

  it('trims by size too, but never below one turn', () => {
    const history = [...turn(1, 50_000), ...turn(2, 50_000)];
    const trimmed = trimHistory(history);
    expect(trimmed.map(m => (m.role === 'user' ? m.text : null)).filter(Boolean)).toEqual(['ask 2']);
    expect(trimHistory(turn(1, 90_000))).toHaveLength(4);
  });

  it('round-trips through storage, reviving items and dropping empty threads', async () => {
    type Item = { id: number; kind: string; status?: string };
    await saveThreads<Item>({
      home: { history: turn(1), items: [{ id: 1, kind: 'user' }, { id: 2, kind: 'proposal', status: 'pending' }], updatedAt: 1 },
      cp: { history: [], items: [], updatedAt: 1 },
    });
    const back = await loadThreads<Item>(raw => {
      const it = raw as Item;
      return it.status === 'pending' ? { ...it, status: 'declined' } : it;
    });
    expect(Object.keys(back)).toEqual(['home']);
    expect(back.home.history).toEqual(turn(1));
    expect(back.home.items[1].status).toBe('declined');
  });

  it('ignores an unknown version or garbage', async () => {
    mem.set('assistantThreads', '{"version":99,"threads":{"home":{}}}');
    expect(await loadThreads(x => x)).toEqual({});
    mem.set('assistantThreads', 'not json');
    expect(await loadThreads(x => x)).toEqual({});
  });
});
