// Per-device assistant settings: which provider and model, and whether
// changes are proposed first or applied live. Stored under its own key, which
// is not in SYNCED_KEYS, so it stays on this device.
import { getItem, setItem } from '../storage';
import type { ProviderId } from './providers/types';

export interface AssistantSettings {
  provider: ProviderId;
  model: string;
  /** 'check': every change is shown for approval; 'auto': applied straight away (deletions still ask). */
  mode: 'check' | 'auto';
  /** The user has seen the "what gets sent" notice and accepted it. */
  consented: boolean;
}

const KEY = 'assistantSettings';
export const DEFAULT_ASSISTANT_SETTINGS: AssistantSettings = { provider: 'anthropic', model: 'claude-sonnet-5-5', mode: 'check', consented: false };

export async function loadAssistantSettings(): Promise<AssistantSettings> {
  try {
    const raw = await getItem(KEY);
    if (!raw?.value) return DEFAULT_ASSISTANT_SETTINGS;
    const stored = JSON.parse(raw.value) as Omit<Partial<AssistantSettings>, 'mode'> & { mode?: string };
    // v0.1.86-88 called the modes propose/live.
    const mode: AssistantSettings['mode'] = stored.mode === 'auto' || stored.mode === 'live' ? 'auto' : 'check';
    return { ...DEFAULT_ASSISTANT_SETTINGS, ...stored, mode };
  } catch { return DEFAULT_ASSISTANT_SETTINGS; }
}

export async function saveAssistantSettings(s: AssistantSettings): Promise<void> {
  await setItem(KEY, JSON.stringify(s));
}
