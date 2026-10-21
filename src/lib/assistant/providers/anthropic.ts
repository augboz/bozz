// Anthropic Messages API, called directly with the user's own key.
// The request goes through the Tauri HTTP plugin on desktop and fetch on the
// web; both carry the app's Origin, so the direct-browser-access header is
// always sent.
import { platformFetch } from '../../http';
import { failFromResponse, type ChatMessage, type Provider, type ToolCall } from './types';

type Block =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

function toAnthropic(messages: ChatMessage[]): Array<{ role: 'user' | 'assistant'; content: Block[] }> {
  return messages.map(m => {
    if (m.role === 'user') return { role: 'user', content: [{ type: 'text', text: m.text }] };
    if (m.role === 'assistant') {
      const content: Block[] = [];
      if (m.text) content.push({ type: 'text', text: m.text });
      for (const c of m.toolCalls) content.push({ type: 'tool_use', id: c.id, name: c.name, input: c.input });
      return { role: 'assistant', content };
    }
    return { role: 'user', content: m.results.map(r => ({ type: 'tool_result', tool_use_id: r.callId, content: r.content, ...(r.isError ? { is_error: true } : {}) })) };
  });
}

export const anthropicProvider: Provider = {
  id: 'anthropic',
  label: 'Anthropic (Claude)',
  models: ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-5-5'],
  keyHint: 'sk-ant-…',
  keyUrl: 'https://platform.claude.com/settings/keys',
  async complete(req) {
    const res = await platformFetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: req.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': req.apiKey,
        'anthropic-version': '2023-06-01',
        // Required on desktop too: the Tauri HTTP plugin forwards the webview's
        // Origin, so Anthropic classifies the call as a browser request and
        // rejects it without this (v0.1.87 report). The key is the user's own.
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: req.model,
        max_tokens: 4000,
        system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
        tools: req.tools.map(t => ({ name: t.name, description: t.description, input_schema: t.inputSchema })),
        messages: toAnthropic(req.messages),
      }),
    });
    if (!res.ok) throw await failFromResponse(res, 'Anthropic');
    const data = await res.json() as { content: Block[]; usage?: { input_tokens: number; output_tokens: number }; stop_reason?: string };
    const text = data.content.filter((b): b is Extract<Block, { type: 'text' }> => b.type === 'text').map(b => b.text).join('\n').trim();
    const toolCalls: ToolCall[] = data.content.filter((b): b is Extract<Block, { type: 'tool_use' }> => b.type === 'tool_use').map(b => ({ id: b.id, name: b.name, input: b.input }));
    return { text, toolCalls, usage: data.usage ? { input: data.usage.input_tokens, output: data.usage.output_tokens } : undefined };
  },
};
