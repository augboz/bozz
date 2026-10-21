// OpenAI Chat Completions with function calling, user's own key.
import { platformFetch } from '../../http';
import { failFromResponse, type ChatMessage, type Provider, type ToolCall } from './types';

type OAMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> }
  | { role: 'tool'; tool_call_id: string; content: string };

function toOpenAI(system: string, messages: ChatMessage[]): OAMessage[] {
  const out: OAMessage[] = [{ role: 'system', content: system }];
  for (const m of messages) {
    if (m.role === 'user') out.push({ role: 'user', content: m.text });
    else if (m.role === 'assistant') out.push({
      role: 'assistant', content: m.text || null,
      ...(m.toolCalls.length ? { tool_calls: m.toolCalls.map(c => ({ id: c.id, type: 'function' as const, function: { name: c.name, arguments: JSON.stringify(c.input) } })) } : {}),
    });
    else for (const r of m.results) out.push({ role: 'tool', tool_call_id: r.callId, content: r.isError ? `ERROR: ${r.content}` : r.content });
  }
  return out;
}

export const openaiProvider: Provider = {
  id: 'openai',
  label: 'OpenAI',
  models: ['gpt-5', 'gpt-5-mini', 'gpt-4.1'],
  keyHint: 'sk-…',
  keyUrl: 'https://platform.openai.com/api-keys',
  async complete(req) {
    const res = await platformFetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: req.signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${req.apiKey}` },
      body: JSON.stringify({
        model: req.model,
        messages: toOpenAI(req.system, req.messages),
        tools: req.tools.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.inputSchema } })),
        tool_choice: 'auto',
      }),
    });
    if (!res.ok) throw await failFromResponse(res, 'OpenAI');
    const data = await res.json() as {
      choices: Array<{ message: { content: string | null; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> } }>;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };
    const msg = data.choices[0]?.message;
    const toolCalls: ToolCall[] = (msg?.tool_calls ?? []).map(c => {
      let input: unknown = {};
      try { input = JSON.parse(c.function.arguments || '{}'); } catch { input = { __invalid_json: c.function.arguments }; }
      return { id: c.id, name: c.function.name, input };
    });
    return { text: (msg?.content ?? '').trim(), toolCalls, usage: data.usage ? { input: data.usage.prompt_tokens, output: data.usage.completion_tokens } : undefined };
  },
};
