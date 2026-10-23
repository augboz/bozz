// Google Gemini generateContent with function declarations, user's own key.
import { platformFetch } from '../../http';
import { failFromResponse, type ChatMessage, type Provider, type ToolCall } from './types';

type Part =
  | { text: string }
  | { functionCall: { name: string; args: unknown } }
  | { functionResponse: { name: string; response: unknown } };

/**
 * Gemini accepts an OpenAPI-style subset of JSON Schema: no $schema, no
 * additionalProperties, and `nullable: true` instead of anyOf with null.
 */
export function toGeminiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (!schema || typeof schema !== 'object') return schema;
  const s = schema as Record<string, unknown>;
  const anyOf = s.anyOf as Array<Record<string, unknown>> | undefined;
  if (anyOf) {
    const nonNull = anyOf.filter(x => x.type !== 'null');
    if (nonNull.length === 1 && anyOf.length === 2) {
      return { ...toGeminiSchema({ ...nonNull[0], description: s.description ?? nonNull[0].description }) as Record<string, unknown>, nullable: true };
    }
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s)) {
    if (k === '$schema' || k === 'additionalProperties' || k === 'title' || k === 'default') continue;
    if (k === 'const') { out.enum = [v]; continue; }
    if (k === 'anyOf' || k === 'oneOf') { out.anyOf = (v as unknown[]).map(toGeminiSchema); continue; }
    if (k === 'properties') { out.properties = Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([pk, pv]) => [pk, toGeminiSchema(pv)])); continue; }
    if (k === 'items') { out.items = toGeminiSchema(v); continue; }
    if (['minimum', 'maximum', 'minLength', 'maxLength', 'minItems', 'maxItems', 'pattern', 'exclusiveMinimum', 'exclusiveMaximum'].includes(k)) continue;
    out[k] = v;
  }
  return out;
}

function toGemini(messages: ChatMessage[], callNames: Map<string, string>): Array<{ role: 'user' | 'model'; parts: Part[] }> {
  return messages.map(m => {
    if (m.role === 'user') return { role: 'user', parts: [{ text: m.text }] };
    if (m.role === 'assistant') {
      const parts: Part[] = [];
      if (m.text) parts.push({ text: m.text });
      for (const c of m.toolCalls) { callNames.set(c.id, c.name); parts.push({ functionCall: { name: c.name, args: c.input } }); }
      return { role: 'model', parts };
    }
    return { role: 'user', parts: m.results.map(r => ({ functionResponse: { name: r.name, response: r.isError ? { error: r.content } : { result: r.content } } })) };
  });
}

export const geminiProvider: Provider = {
  id: 'gemini',
  label: 'Google Gemini',
  models: ['gemini-2.5-pro', 'gemini-2.5-flash'],
  keyHint: 'AIza…',
  keyUrl: 'https://aistudio.google.com/apikey',
  async complete(req) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(req.model)}:generateContent`;
    const res = await platformFetch(url, {
      method: 'POST',
      signal: req.signal,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': req.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.system }, { text: req.systemContext }] },
        contents: toGemini(req.messages, new Map()),
        tools: [{ functionDeclarations: req.tools.map(t => ({ name: t.name, description: t.description, parameters: toGeminiSchema(t.inputSchema) })) }],
      }),
    });
    if (!res.ok) throw await failFromResponse(res, 'Gemini');
    const data = await res.json() as { candidates?: Array<{ content?: { parts?: Part[] } }>; usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number } };
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const text = parts.filter((p): p is { text: string } => 'text' in p).map(p => p.text).join('\n').trim();
    const toolCalls: ToolCall[] = parts
      .filter((p): p is { functionCall: { name: string; args: unknown } } => 'functionCall' in p)
      .map((p, i) => ({ id: `gem-${Date.now().toString(36)}-${i}`, name: p.functionCall.name, input: p.functionCall.args ?? {} }));
    return { text, toolCalls, usage: data.usageMetadata ? { input: data.usageMetadata.promptTokenCount, output: data.usageMetadata.candidatesTokenCount } : undefined };
  },
};
