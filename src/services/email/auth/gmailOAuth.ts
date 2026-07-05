import {
  AuthRequest,
  exchangeCodeAsync,
  makeRedirectUri,
  refreshAsync,
  ResponseType,
  revokeAsync,
} from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import {
  GMAIL_SCOPES,
  GOOGLE_OAUTH_CONFIG,
  OAUTH_REDIRECT_SCHEME,
} from '../../../config/googleOAuth';
import type { GmailTokens } from '../tokenStore';

/**
 * Google OAuth 2.0 with PKCE (RFC 7636) via expo-auth-session.
 *
 * - NO client secret anywhere: the authorization-code + PKCE flow for
 *   installed apps works with the public client ID alone.
 * - NO password handling: login happens on Google's own pages in the
 *   system browser (expo-web-browser); the app only receives an auth code.
 * - access_type=offline + prompt=consent make Google return a refresh
 *   token, so the user does not have to log in again every hour.
 *
 * NOTE for testing: the custom scheme redirect (androidagent:/oauthredirect)
 * requires a development build (`npx expo run:android`). Inside Expo Go the
 * app has no own scheme, and Google rejects exp:// redirect URIs.
 */

// Required so the auth session resolves when Google redirects back.
WebBrowser.maybeCompleteAuthSession();

const DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

function getClientId(): string {
  const clientId =
    Platform.select({
      android: GOOGLE_OAUTH_CONFIG.androidClientId,
      ios: GOOGLE_OAUTH_CONFIG.iosClientId,
      default: GOOGLE_OAUTH_CONFIG.webClientId,
    }) ?? '';
  if (clientId.length === 0) {
    throw new Error(
      'No Google client ID configured for this platform. ' +
        'Fill in src/config/googleOAuth.ts (see README, section "Gmail einrichten").',
    );
  }
  return clientId;
}

function getRedirectUri(): string {
  return makeRedirectUri({ scheme: OAUTH_REDIRECT_SCHEME, path: 'oauthredirect' });
}

function toTokens(response: {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}): GmailTokens {
  return {
    accessToken: response.accessToken,
    refreshToken: response.refreshToken ?? null,
    expiresAt: Date.now() + (response.expiresIn ?? 3600) * 1000,
    accountEmail: null,
  };
}

/** Opens the Google login and exchanges the auth code for tokens (PKCE). */
export async function signInWithGoogle(): Promise<GmailTokens> {
  const clientId = getClientId();
  const redirectUri = getRedirectUri();

  const request = new AuthRequest({
    clientId,
    redirectUri,
    scopes: GMAIL_SCOPES,
    responseType: ResponseType.Code,
    usePKCE: true,
    extraParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
  });

  const result = await request.promptAsync(DISCOVERY);

  if (result.type === 'cancel' || result.type === 'dismiss') {
    throw new Error('Google login was cancelled.');
  }
  if (result.type === 'error') {
    throw new Error(`Google login failed: ${result.error?.message ?? 'unknown error'}`);
  }
  if (result.type !== 'success') {
    throw new Error(`Google login did not complete (state: ${result.type}).`);
  }

  const code = result.params['code'];
  if (typeof code !== 'string' || code.length === 0) {
    throw new Error('Google login returned no authorization code.');
  }

  const tokenResponse = await exchangeCodeAsync(
    {
      clientId,
      code,
      redirectUri,
      extraParams: request.codeVerifier ? { code_verifier: request.codeVerifier } : {},
    },
    DISCOVERY,
  );

  if (!tokenResponse.accessToken) {
    throw new Error('Token exchange with Google failed (no access token returned).');
  }
  return toTokens(tokenResponse);
}

/** Refreshes an expired access token using the stored refresh token. */
export async function refreshGmailTokens(tokens: GmailTokens): Promise<GmailTokens> {
  if (!tokens.refreshToken) {
    throw new Error(
      'Gmail session expired and no refresh token is available. Please reconnect Gmail.',
    );
  }
  const response = await refreshAsync(
    { clientId: getClientId(), refreshToken: tokens.refreshToken },
    DISCOVERY,
  );
  if (!response.accessToken) {
    throw new Error('Refreshing the Gmail session failed. Please reconnect Gmail.');
  }
  const refreshed = toTokens(response);
  return {
    ...refreshed,
    // Google often omits the refresh token on refresh responses – keep the old one.
    refreshToken: refreshed.refreshToken ?? tokens.refreshToken,
    accountEmail: tokens.accountEmail,
  };
}

/** Best-effort token revocation at Google (called on disconnect). */
export async function revokeGmailAccess(tokens: GmailTokens): Promise<void> {
  try {
    await revokeAsync(
      { token: tokens.refreshToken ?? tokens.accessToken, clientId: getClientId() },
      DISCOVERY,
    );
  } catch {
    // Ignore: local token deletion still disconnects the app.
  }
}
