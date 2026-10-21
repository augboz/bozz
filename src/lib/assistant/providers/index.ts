import { anthropicProvider } from './anthropic';
import { openaiProvider } from './openai';
import { geminiProvider } from './gemini';
import { mockProvider } from './mock';
import type { Provider, ProviderId } from './types';

export const PROVIDERS: Record<ProviderId, Provider> = {
  anthropic: anthropicProvider,
  openai: openaiProvider,
  gemini: geminiProvider,
  mock: mockProvider,
};

/** Providers a user can pick. The mock is dev-only. */
export function selectableProviders(): Provider[] {
  const list: Provider[] = [anthropicProvider, openaiProvider, geminiProvider];
  if (import.meta.env.DEV) list.push(mockProvider);
  return list;
}

export type { Provider, ProviderId } from './types';
