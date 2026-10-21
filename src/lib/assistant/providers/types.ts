// Provider-neutral chat shapes. Each provider translates these to its own
// wire format and back, so the rest of the assistant never sees vendor JSON.

export type ProviderId = 'anthropic' | 'openai' | 'gemini' | 'mock';

export interface ToolDef {
  name: string;
  description: string;
  /** JSON Schema (draft 2020-12) for the input object. */
  inputSchema: Record<string, unknown>;
}

export interface ToolCall { id: string; name: string; input: unknown }

export type ChatMessage =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; toolCalls: ToolCall[] }
  | { role: 'tool'; results: Array<{ callId: string; name: string; content: string; isError: boolean }> };

export interface CompleteRequest {
  system: string;
  messages: ChatMessage[];
  tools: ToolDef[];
  model: string;
  apiKey: string;
  signal?: AbortSignal;
}

export interface CompleteResult {
  text: string;
  toolCalls: ToolCall[];
  usage?: { input: number; output: number };
}

export interface Provider {
  id: ProviderId;
  label: string;
  /** Suggested models, first is the default. The user can type any other id. */
  models: string[];
  keyHint: string;
  keyUrl: string;
  complete(req: CompleteRequest): Promise<CompleteResult>;
}

export class ProviderError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'ProviderError';
  }
}

/** Turn an HTTP failure into a message the user can act on. */
export async function failFromResponse(res: Response, provider: string): Promise<ProviderError> {
  let detail = '';
  try {
    const body = await res.json() as { error?: { message?: string } | string; message?: string };
    detail = typeof body.error === 'string' ? body.error : body.error?.message ?? body.message ?? '';
  } catch { /* no json body */ }
  if (res.status === 401 || res.status === 403) return new ProviderError(`${provider} rejected the API key${detail ? `: ${detail}` : ''}. Check it in Settings > Assistant.`, res.status);
  if (res.status === 429) return new ProviderError(`${provider} rate limit or out of credits${detail ? `: ${detail}` : ''}.`, res.status);
  if (res.status === 404) return new ProviderError(`${provider} does not know that model${detail ? `: ${detail}` : ''}. Pick another in Settings > Assistant.`, res.status);
  return new ProviderError(`${provider} error ${res.status}${detail ? `: ${detail}` : ''}`, res.status);
}
