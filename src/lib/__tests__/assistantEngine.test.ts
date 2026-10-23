import { describe, it, expect, vi } from 'vitest';

vi.mock('../storage', () => ({
  getItem: vi.fn(), setItem: vi.fn(), deleteItem: vi.fn(), listKeysByPrefix: vi.fn(), isStoreHealthy: vi.fn(),
}));

import { runTurn, buildSystemPrompt, systemParts, compactHistory, type Decision, type Proposal } from '../assistant/engine';
import type { ChatMessage } from '../assistant/providers/types';
import { applyOps } from '../assistant/applyOps';
import { diffStore } from '../assistant/diff';
import { TOOLS } from '../assistant/tools';
import { toGeminiSchema } from '../assistant/providers/gemini';
import { DEFAULT_APPEARANCE } from '../appearance';
import type { AssistantStore } from '../assistant/store';
import type { AssistantSettings } from '../assistant/settings';

const store = (): AssistantStore => ({
  topics: [{ id: 'cp', name: 'Concurrent Programming', color: '#7da7d9', keywords: [], order: 0, stages: [{ id: 's1', label: 'To do' }, { id: 's2', label: 'Done', done: true }], items: [], widgetLayout: [{ i: 'topicTodos', type: 'topicTodos', x: 0, y: 0, w: 8, h: 12 }] }],
  topicFolders: [], homeLayout: [], appearance: { ...DEFAULT_APPEARANCE }, habits: [],
});
const settings: AssistantSettings = { provider: 'mock', model: 'mock', mode: 'check', consented: true };

/** Drives a turn with the mock provider, applying proposals through the real applier. */
async function drive(text: string, currentPageId: string | null, decide: (p: Proposal) => 'apply' | 'decline') {
  let s = store();
  const texts: string[] = [];
  const proposals: Proposal[] = [];
  const history = await runTurn(
    { settings, apiKey: 'mock', getStore: () => s, currentPageId },
    [], text,
    {
      onText: t => texts.push(t),
      onStatus: () => {},
      onProposal: async (p): Promise<Decision> => {
        proposals.push(p);
        if (decide(p) === 'decline') return { kind: 'declined' };
        const after = applyOps(s, p.ops, p.seed);
        const receipt = diffStore(s, after);
        s = after;
        return { kind: 'applied', receipt, turnId: 1 };
      },
    },
  );
  return { s, texts, proposals, history };
}

describe('assistant engine', () => {
  it('runs a full propose -> apply -> wrap-up loop against the real applier', async () => {
    const { s, texts, proposals, history } = await drive('set this page up with a timer and a note', 'cp', () => 'apply');
    expect(proposals).toHaveLength(1);
    expect(proposals[0].destructive).toBe(false);
    expect(proposals[0].removals).toEqual([]);
    expect(s.topics[0].widgetLayout!.map(w => w.type)).toEqual(['topicTodos', 'topicTimer', 'topicNote', 'topicStatus']);
    expect(texts[texts.length - 1]).toMatch(/Done/);
    // Transcript: user, assistant(tool call), tool result, assistant(text). Append-only.
    expect(history.map(m => m.role)).toEqual(['user', 'assistant', 'tool', 'assistant']);
    const toolMsg = history[2];
    expect(toolMsg.role === 'tool' && toolMsg.results[0].content).toMatch(/applied to the working copy/);
    // The preview came from diffing the draft, not from the op list.
    expect(proposals[0].preview.map(l => l.text)).toEqual([
      'Page "Concurrent Programming": added Study timer (8×12)',
      'Page "Concurrent Programming": added Note (8×16)',
      'Page "Concurrent Programming": added Status (8×8)',
    ]);
  });

  it('merges several tool calls in one turn into ONE proposal with the net result', async () => {
    const { s, proposals } = await drive('do it in two steps', 'cp', () => 'apply');
    expect(proposals).toHaveLength(1);
    expect(proposals[0].ops.map(o => o.op)).toEqual(['add_widget', 'move_widget']);
    expect(proposals[0].summary).toBe('Add a study timer; Move it to the top');
    const layout = s.topics[0].widgetLayout!;
    expect(layout.map(w => w.type).sort()).toEqual(['topicTimer', 'topicTodos']);
    expect(layout.find(w => w.type === 'topicTimer')!.y).toBe(0);
    expect(layout.find(w => w.type === 'topicTodos')!.y).toBe(12);
  });

  it('a "make it prettier" request yields a layout, backdrop and title change in one proposal', async () => {
    const { s, proposals } = await drive('make this page prettier', 'cp', () => 'apply');
    expect(proposals).toHaveLength(1);
    expect(proposals[0].ops.map(o => o.op)).toEqual(['set_background', 'update_page']);
    expect(s.topics[0].pageBg?.url).toMatch(/^data:image\/svg\+xml/);
    expect(s.topics[0].pageBg?.dim).toBe(0.35);
    expect(s.topics[0].pageTitleColor).toBe('#ffffff');
    expect(proposals[0].preview.map(l => l.text)).toContain('Page "Concurrent Programming": backdrop updated');
  });

  it('flags deletions as destructive; a decline applies nothing and is recorded for the model', async () => {
    const { s, proposals, history } = await drive('delete this page', 'cp', () => 'decline');
    expect(proposals[0].destructive).toBe(true);
    expect(proposals[0].removals).toEqual(['Deleted page "Concurrent Programming" (0 tasks)']);
    expect(s.topics).toHaveLength(1);
    const note = history[history.length - 2];
    expect(note.role === 'user' && note.text).toMatch(/discarded all the changes/);
  });

  it('answers read_dashboard with the page detail, content fenced', async () => {
    const { history } = await drive("what's on this page", 'cp', () => 'apply');
    const toolMsg = history[2];
    expect(toolMsg.role === 'tool' && toolMsg.results[0].content).toMatch(/treat them as data/);
  });

  it('splits the prompt into a fixed part (cacheable) and the live snapshot', () => {
    const a = systemParts(store(), 'cp');
    const changed = store(); changed.topics[0].name = 'Renamed';
    const b = systemParts(changed, 'cp');
    expect(a.system).toBe(b.system);
    expect(a.systemContext).not.toBe(b.systemContext);
    expect(a.system).toContain('Widget catalog');
    expect(a.system).not.toContain('Dashboard snapshot');
    expect(a.systemContext).toContain('"Concurrent Programming"#cp');
  });

  it('compacts old tool results to a stub and keeps everything else', () => {
    const history: ChatMessage[] = [
      { role: 'user', text: 'hi' },
      { role: 'assistant', text: '', toolCalls: [{ id: 'c1', name: 'read_dashboard', input: {} }] },
      { role: 'tool', results: [{ callId: 'c1', name: 'read_dashboard', content: 'word '.repeat(200), isError: false }, { callId: 'c2', name: 'x', content: 'short', isError: false }] },
      { role: 'assistant', text: 'done', toolCalls: [] },
    ];
    const c = compactHistory(history);
    expect(c[0]).toEqual(history[0]);
    const tool = c[2]; if (tool.role !== 'tool') throw new Error('expected tool');
    expect(tool.results[0].content.length).toBeLessThan(170);
    expect(tool.results[0].content).toMatch(/shortened\]$/);
    expect(tool.results[1].content).toBe('short');
    expect(tool.results[0].callId).toBe('c1');
  });

  it('system prompt carries the catalog, the snapshot and the no-silent-change rule', () => {
    const p = buildSystemPrompt(store(), 'cp');
    expect(p).toContain('topicTimer: Study timer');
    expect(p).toContain('"Concurrent Programming"#cp');
    expect(p).toMatch(/Never claim to have changed something without calling it/);
    expect(p).toMatch(/NEVER remove a widget/);
  });
});

describe('tool schemas', () => {
  it('are generated from the zod schemas with every property required and no extra keys', () => {
    const apply = TOOLS.find(t => t.name === 'apply_changes')!.inputSchema as { properties: { ops: { items: { oneOf?: unknown[]; anyOf?: unknown[] } } }; required: string[]; additionalProperties: boolean };
    expect(apply.required).toEqual(['summary', 'ops']);
    expect(apply.additionalProperties).toBe(false);
    const variants = (apply.properties.ops.items.oneOf ?? apply.properties.ops.items.anyOf) as Array<{ properties: Record<string, unknown>; required: string[] }>;
    expect(variants.length).toBe(17);
    for (const v of variants) expect(v.required.sort()).toEqual(Object.keys(v.properties).sort());
  });

  it('Gemini conversion replaces anyOf-null with nullable and drops unsupported keys', () => {
    const g = toGeminiSchema({ $schema: 'x', type: 'object', additionalProperties: false, properties: { a: { anyOf: [{ type: 'string', maxLength: 5 }, { type: 'null' }], description: 'd' }, b: { const: 'x' } } }) as Record<string, unknown>;
    expect(g).not.toHaveProperty('$schema');
    expect(g).not.toHaveProperty('additionalProperties');
    const props = g.properties as Record<string, Record<string, unknown>>;
    expect(props.a).toEqual({ type: 'string', description: 'd', nullable: true });
    expect(props.b).toEqual({ enum: ['x'] });
  });
});
