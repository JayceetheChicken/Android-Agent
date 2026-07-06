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

import { GOOGLE_OAUTH_CONFIG, OAUTH_REDIRECT_SCHEME } from '../../config/googleOAuth';

/**
 * Shared Google OAuth 2.0 + PKCE helper for installed-app flows.
 *
 * No client secret is used here. Tokens returned by this module must be stored
 * by the service-specific token stores (SecureStore), never in AsyncStorage,
 * logs, tool outputs or sandbox files.
 */

WebBrowser.maybeCompleteAuthSession();

const DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

export interface GoogleOAuthTokens {
  accessToken: string;
  refreshToken: string | null;
  /** Unix epoch in milliseconds at which the access token expires. */
  expiresAt: number;
}

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
        'Fill in src/config/googleOAuth.ts (see README, Google API setup).',
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
}): GoogleOAuthTokens {
  return {
    accessToken: response.accessToken,
    refreshToken: response.refreshToken ?? null,
    expiresAt: Date.now() + (response.expiresIn ?? 3600) * 1000,
  };
}

/** Opens Google login and exchanges the auth code for tokens using PKCE. */
export async function signInWithGoogleScopes(scopes: readonly string[]): Promise<GoogleOAuthTokens> {
  const clientId = getClientId();
  const redirectUri = getRedirectUri();

  const request = new AuthRequest({
    clientId,
    redirectUri,
    scopes: [...scopes],
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

/** Refreshes an expired Google access token using the stored refresh token. */
export async function refreshGoogleOAuthTokens(
  tokens: GoogleOAuthTokens,
  serviceName: string,
): Promise<GoogleOAuthTokens> {
  if (!tokens.refreshToken) {
    throw new Error(
      `${serviceName} session expired and no refresh token is available. Please reconnect ${serviceName}.`,
    );
  }
  const response = await refreshAsync(
    { clientId: getClientId(), refreshToken: tokens.refreshToken },
    DISCOVERY,
  );
  if (!response.accessToken) {
    throw new Error(`Refreshing the ${serviceName} session failed. Please reconnect ${serviceName}.`);
  }
  const refreshed = toTokens(response);
  return {
    ...refreshed,
    // Google often omits the refresh token on refresh responses; keep the old one.
    refreshToken: refreshed.refreshToken ?? tokens.refreshToken,
  };
}

/** Best-effort token revocation at Google, used when disconnecting a service. */
export async function revokeGoogleOAuthAccess(tokens: GoogleOAuthTokens): Promise<void> {
  try {
    await revokeAsync(
      { token: tokens.refreshToken ?? tokens.accessToken, clientId: getClientId() },
      DISCOVERY,
    );
  } catch {
    // Ignore: local token deletion still disconnects the app.
  }
}
