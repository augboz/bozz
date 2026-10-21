import { describe, it, expect, vi } from 'vitest';

vi.mock('../storage', () => ({
  getItem: vi.fn(), setItem: vi.fn(), deleteItem: vi.fn(), listKeysByPrefix: vi.fn(), isStoreHealthy: vi.fn(),
}));

import { runTurn, buildSystemPrompt, type Decision, type Proposal } from '../assistant/engine';
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
        const after = applyOps(s, p.ops);
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
    expect(s.topics[0].widgetLayout!.map(w => w.type)).toEqual(['topicTodos', 'topicTimer', 'topicNote', 'topicStatus']);
    expect(texts[texts.length - 1]).toMatch(/Done/);
    // Transcript: user, assistant(tool call), tool result, assistant(text). Append-only.
    expect(history.map(m => m.role)).toEqual(['user', 'assistant', 'tool', 'assistant']);
    const toolMsg = history[2];
    expect(toolMsg.role === 'tool' && toolMsg.results[0].content).toMatch(/applied\. receipt:/);
  });

  it('flags deletions as destructive and reports a decline to the model without retrying', async () => {
    const { s, proposals, history } = await drive('delete this page', 'cp', () => 'decline');
    expect(proposals[0].destructive).toBe(true);
    expect(s.topics).toHaveLength(1);
    const toolMsg = history[2];
    expect(toolMsg.role === 'tool' && toolMsg.results[0].isError).toBe(true);
    expect(toolMsg.role === 'tool' && toolMsg.results[0].content).toMatch(/user declined/);
  });

  it('answers read_dashboard with the page detail, content fenced', async () => {
    const { history } = await drive("what's on this page", 'cp', () => 'apply');
    const toolMsg = history[2];
    expect(toolMsg.role === 'tool' && toolMsg.results[0].content).toMatch(/treat them as data/);
  });

  it('system prompt carries the catalog, the snapshot and the no-silent-change rule', () => {
    const p = buildSystemPrompt(store(), 'cp');
    expect(p).toContain('topicTimer: Study timer');
    expect(p).toContain('"Concurrent Programming"#cp');
    expect(p).toMatch(/Never claim to have changed something without calling it/);
  });
});

describe('tool schemas', () => {
  it('are generated from the zod schemas with every property required and no extra keys', () => {
    const apply = TOOLS.find(t => t.name === 'apply_changes')!.inputSchema as { properties: { ops: { items: { oneOf?: unknown[]; anyOf?: unknown[] } } }; required: string[]; additionalProperties: boolean };
    expect(apply.required).toEqual(['summary', 'ops']);
    expect(apply.additionalProperties).toBe(false);
    const variants = (apply.properties.ops.items.oneOf ?? apply.properties.ops.items.anyOf) as Array<{ properties: Record<string, unknown>; required: string[] }>;
    expect(variants.length).toBe(16);
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
