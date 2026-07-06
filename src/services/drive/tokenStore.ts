import * as SecureStore from 'expo-secure-store';

import type { GoogleOAuthTokens } from '../google/oauth';

/**
 * Google Drive OAuth tokens live ONLY here, in expo-secure-store. They are
 * read exclusively by the Drive provider and never exposed to agent outputs,
 * UI lists, logs or sandbox files.
 */

const TOKEN_KEY = 'drive_oauth_tokens';

export interface DriveTokens extends GoogleOAuthTokens {
  accountEmail: string | null;
  accountName: string | null;
  accountPermissionId: string | null;
}

export async function saveDriveTokens(tokens: DriveTokens): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(tokens));
}

export async function loadDriveTokens(): Promise<DriveTokens | null> {
  const raw = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<DriveTokens>;
    if (typeof parsed.accessToken !== 'string' || typeof parsed.expiresAt !== 'number') {
      return null;
    }
    return {
      accessToken: parsed.accessToken,
      refreshToken: typeof parsed.refreshToken === 'string' ? parsed.refreshToken : null,
      expiresAt: parsed.expiresAt,
      accountEmail: typeof parsed.accountEmail === 'string' ? parsed.accountEmail : null,
      accountName: typeof parsed.accountName === 'string' ? parsed.accountName : null,
      accountPermissionId:
        typeof parsed.accountPermissionId === 'string' ? parsed.accountPermissionId : null,
    };
  } catch {
    return null;
  }
}

export async function clearDriveTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function hasDriveTokens(): Promise<boolean> {
  return (await loadDriveTokens()) !== null;
}
