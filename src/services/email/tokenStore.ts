import * as SecureStore from 'expo-secure-store';

/**
 * Gmail OAuth tokens live ONLY here, in expo-secure-store (encrypted
 * Android Keystore). They are read exclusively by the Gmail provider to
 * authorize API calls. They are never logged, never written to the file
 * sandbox and never exposed to the agent, the LLM or the UI.
 */

const TOKEN_KEY = 'gmail_oauth_tokens';

export interface GmailTokens {
  accessToken: string;
  refreshToken: string | null;
  /** Unix epoch in milliseconds at which the access token expires. */
  expiresAt: number;
  /** Email address of the connected account (from the Gmail profile). */
  accountEmail: string | null;
}

export async function saveGmailTokens(tokens: GmailTokens): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(tokens));
}

export async function loadGmailTokens(): Promise<GmailTokens | null> {
  const raw = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<GmailTokens>;
    if (typeof parsed.accessToken !== 'string' || typeof parsed.expiresAt !== 'number') {
      return null;
    }
    return {
      accessToken: parsed.accessToken,
      refreshToken: typeof parsed.refreshToken === 'string' ? parsed.refreshToken : null,
      expiresAt: parsed.expiresAt,
      accountEmail: typeof parsed.accountEmail === 'string' ? parsed.accountEmail : null,
    };
  } catch {
    return null;
  }
}

export async function clearGmailTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function hasGmailTokens(): Promise<boolean> {
  return (await loadGmailTokens()) !== null;
}
