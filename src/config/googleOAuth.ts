/**
 * Google OAuth 2.0 client configuration (PKCE flow, NO client secret).
 *
 * These are OAuth *client IDs*, not secrets – they are public identifiers.
 * Still, fill them locally and never commit real project-specific IDs if you
 * consider them private. NEVER put a client secret anywhere in this app;
 * the PKCE flow is designed to work without one.
 *
 * How to obtain the IDs: see README.md, section "Gmail einrichten".
 * Short version (Google Cloud Console, https://console.cloud.google.com):
 *   1. Create/select a project, enable the "Gmail API".
 *   2. Configure the OAuth consent screen (External, add yourself as test user).
 *   3. Credentials -> Create credentials -> OAuth client ID:
 *      - "Android"  -> package name + SHA-1  -> androidClientId
 *      - "iOS"      -> bundle identifier     -> iosClientId
 *      - "Web"      -> (optional, for web)   -> webClientId
 */
export const GOOGLE_OAUTH_CONFIG = {
  webClientId: '',
  androidClientId: '',
  iosClientId: '',
};

/**
 * Requested scopes. gmail.modify covers read, drafts, send, archive and
 * labels – everything the agent tools need – WITHOUT the overly broad
 * https://mail.google.com/ scope (full mailbox control incl. permanent
 * delete), which must not be used in the MVP.
 *
 * Narrower alternatives, if gmail.modify is ever too much:
 *   https://www.googleapis.com/auth/gmail.readonly (read only)
 *   https://www.googleapis.com/auth/gmail.send     (send only)
 */
export const GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.modify'];

/** Custom URI scheme registered in app.json ("scheme"). */
export const OAUTH_REDIRECT_SCHEME = 'androidagent';
