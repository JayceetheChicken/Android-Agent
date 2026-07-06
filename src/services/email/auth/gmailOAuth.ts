import { GMAIL_SCOPES } from '../../../config/googleOAuth';
import {
  refreshGoogleOAuthTokens,
  revokeGoogleOAuthAccess,
  signInWithGoogleScopes,
  type GoogleOAuthTokens,
} from '../../google/oauth';
import type { GmailTokens } from '../tokenStore';

/**
 * Gmail-specific adapter around the shared Google OAuth 2.0 + PKCE helper.
 *
 * - NO client secret anywhere.
 * - NO password handling: login happens on Google's own pages.
 * - Tokens still live only in services/email/tokenStore.ts.
 *
 * NOTE for testing: the custom scheme redirect (androidagent:/oauthredirect)
 * requires a development build (`npx expo run:android`). Inside Expo Go the
 * app has no own scheme, and Google rejects exp:// redirect URIs.
 */

function toGmailTokens(tokens: GoogleOAuthTokens): GmailTokens {
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
    accountEmail: null,
  };
}

/** Opens the Google login and exchanges the auth code for Gmail tokens (PKCE). */
export async function signInWithGoogle(): Promise<GmailTokens> {
  return toGmailTokens(await signInWithGoogleScopes(GMAIL_SCOPES));
}

/** Refreshes an expired Gmail access token using the stored refresh token. */
export async function refreshGmailTokens(tokens: GmailTokens): Promise<GmailTokens> {
  const refreshed = toGmailTokens(await refreshGoogleOAuthTokens(tokens, 'Gmail'));
  return {
    ...refreshed,
    refreshToken: refreshed.refreshToken ?? tokens.refreshToken,
    accountEmail: tokens.accountEmail,
  };
}

/** Best-effort token revocation at Google (called on disconnect). */
export async function revokeGmailAccess(tokens: GmailTokens): Promise<void> {
  await revokeGoogleOAuthAccess(tokens);
}
