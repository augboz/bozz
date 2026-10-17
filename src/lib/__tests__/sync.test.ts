import { describe, it, expect, vi } from 'vitest';

// sync.ts imports the Supabase client and the Tauri store at module load.
// Neither exists here; the functions under test are pure.
vi.mock('../supabase', () => ({ supabase: {}, isSessionUsable: () => true }));
vi.mock('../storage', () => ({
  getItem: vi.fn(), setItem: vi.fn(), deleteItem: vi.fn(), listKeysByPrefix: vi.fn(), isStoreHealthy: vi.fn(),
}));

import {
  deepUnionMerge, countRecords, thinPushReason, stripTopicLocalOnly, keepLocalPageBg, isNetworkError,
} from '../sync';

const topic = (id: string, items: number[] = [], extra: Record<string, unknown> = {}) =>
  ({ id, name: id, items: items.map(i => ({ id: i, text: `t${i}` })), ...extra });

describe('deepUnionMerge', () => {
  it('keeps records that exist only on the other side (the 2026-08-10 fix)', () => {
    const out = deepUnionMerge([topic('a')], [topic('b')]) as Array<{ id: string }>;
    expect(out.map(t => t.id)).toEqual(['a', 'b']);
  });

  it("takes this device's version of a record present on both sides", () => {
    const local = [{ id: 'a', name: 'Local name', color: '#111' }];
    const remote = [{ id: 'a', name: 'Remote name', color: '#222', icon: 'book' }];
    const out = deepUnionMerge(local, remote) as Array<Record<string, unknown>>;
    expect(out[0].name).toBe('Local name');
    expect(out[0].color).toBe('#111');
    // Keys only the remote has are still brought in.
    expect(out[0].icon).toBe('book');
  });

  it('unions nested item lists inside a topic by id', () => {
    const out = deepUnionMerge([topic('a', [1, 2])], [topic('a', [2, 3])]) as Array<{ items: Array<{ id: number }> }>;
    expect(out[0].items.map(i => i.id)).toEqual([1, 2, 3]);
  });

  it('lets this device win id-less arrays unless it has nothing', () => {
    expect(deepUnionMerge(['x'], ['y', 'z'])).toEqual(['x']);
    expect(deepUnionMerge([], ['y', 'z'])).toEqual(['y', 'z']);
  });

  it('lets this device win scalar conflicts and fills in missing sides', () => {
    expect(deepUnionMerge('mine', 'theirs')).toBe('mine');
    expect(deepUnionMerge(undefined, 'theirs')).toBe('theirs');
    expect(deepUnionMerge('mine', null)).toBe('mine');
  });

  it('does not mutate its inputs', () => {
    const local = [topic('a', [1])];
    const remote = [topic('a', [2]), topic('b')];
    const localCopy = JSON.parse(JSON.stringify(local));
    const remoteCopy = JSON.parse(JSON.stringify(remote));
    deepUnionMerge(local, remote);
    expect(local).toEqual(localCopy);
    expect(remote).toEqual(remoteCopy);
  });
});

describe('countRecords', () => {
  it('counts guarded collections, topic items and home widgets', () => {
    const n = countRecords({
      topics: [topic('a', [1, 2]), topic('b')],
      habits: [{ id: 'h' }],
      homeLayout: { items: [{ i: 'w1' }, { i: 'w2' }] },
      recentSearches: ['ignored', 'ignored'],
    });
    expect(n).toBe(2 + 2 + 1 + 2);
  });

  it('ignores non-array values', () => {
    expect(countRecords({ topics: 'corrupt', habits: null })).toBe(0);
  });
});

describe('thinPushReason', () => {
  const full = { topics: [topic('a', [1, 2, 3]), topic('b', [4, 5])], habits: [{ id: 'h' }] }; // 8 records

  it('blocks an empty device from overwriting a populated cloud copy', () => {
    expect(thinPushReason({}, full)).toMatch(/no records while the cloud copy has 8/);
  });

  it("blocks a device with at most half the cloud's records", () => {
    expect(thinPushReason({ topics: [topic('a', [1, 2, 3])] }, full)).toMatch(/4 records, the cloud copy has 8/);
  });

  it('allows a device with more than half of the records', () => {
    expect(thinPushReason({ topics: [topic('a', [1, 2, 3]), topic('b')] }, full)).toBeNull();
  });

  it('never blocks when the cloud copy is empty or tiny', () => {
    expect(thinPushReason({}, {})).toBeNull();
    // Below the 5-record floor a thin push is allowed: a brand-new account.
    expect(thinPushReason({ topics: [topic('a')] }, { topics: [topic('x', [1, 2])] })).toBeNull();
  });
});

describe('page backgrounds stay on one device', () => {
  it('stripTopicLocalOnly removes pageBg from every topic before upload', () => {
    const out = stripTopicLocalOnly({
      topics: [topic('a', [], { pageBg: { url: 'data:...', dim: 0.4 } }), topic('b')],
      habits: [],
    });
    const topics = out.topics as Array<Record<string, unknown>>;
    expect(topics.every(t => !('pageBg' in t))).toBe(true);
    expect(out.habits).toEqual([]);
  });

  it('stripTopicLocalOnly leaves a snapshot without topics alone', () => {
    const snap = { habits: [] };
    expect(stripTopicLocalOnly(snap)).toBe(snap);
  });

  it("keepLocalPageBg restores this device's background onto pulled topics", () => {
    const bg = { url: 'data:local', dim: 0.5 };
    const out = keepLocalPageBg(
      [topic('a', [], { pageBg: { url: 'data:remote' } }), topic('b')],
      [topic('a', [], { pageBg: bg })],
    ) as Array<Record<string, unknown>>;
    expect(out[0].pageBg).toBe(bg);
    expect('pageBg' in out[1]).toBe(false);
  });
});

describe('isNetworkError', () => {
  it('recognises status-less fetch failures, including "FetchError: undefined"', () => {
    expect(isNetworkError({ name: 'FetchError', message: 'undefined' })).toBe(true);
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isNetworkError({ message: 'request timed out' })).toBe(true);
  });

  it('does not treat HTTP responses or unrelated errors as network failures', () => {
    expect(isNetworkError({ message: 'FetchError', status: 500 })).toBe(false);
    expect(isNetworkError({ message: 'duplicate key value' })).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });
});
