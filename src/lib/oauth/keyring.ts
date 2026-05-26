import { getItem, setItem, deleteItem } from '../storage';

/**
 * Token storage backed by tauri-plugin-store (dashboard.json).
 * Keys are prefixed with __tok__ to avoid collisions with app data.
 *
 * We used to call the OS keychain (keyring crate) here, but keyring v3
 * on Windows silently fails to persist on some machines — set_password
 * returns Ok but get_password immediately returns NoEntry.  The Tauri
 * store is already proven to work for the rest of the app data, so we
 * use it for tokens too.
 */

const PREFIX = '__tok__';

export async function secretSet(key: string, value: string): Promise<void> {
  await setItem(PREFIX + key, value);
}

export async function secretGet(key: string): Promise<string | null> {
  const result = await getItem(PREFIX + key);
  return result?.value ?? null;
}

export async function secretDelete(key: string): Promise<void> {
  await deleteItem(PREFIX + key);
}

export type TokenKind =
  | 'access' | 'refresh' | 'clientid' | 'clientsecret' | 'sandbox'
  | 'secretid' | 'secretkey' | 'accessexpires';

export function tokenKey(provider: string, email: string, kind: TokenKind): string {
  return `${provider}.${email}.${kind}`;
}
