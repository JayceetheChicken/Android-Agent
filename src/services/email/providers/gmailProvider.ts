import { base64ToUtf8, utf8ToBase64, utf8ToBase64Url } from '../../../utils/base64';
import type { EmailAccount, EmailDraft, EmailMessage, EmailProvider } from '../types';
import { refreshGmailTokens, revokeGmailAccess, signInWithGoogle } from '../auth/gmailOAuth';
import {
  clearGmailTokens,
  loadGmailTokens,
  saveGmailTokens,
  type GmailTokens,
} from '../tokenStore';

/**
 * Real Gmail provider (Gmail REST API v1, plain fetch, no SDK).
 *
 * Auth: OAuth 2.0 + PKCE via auth/gmailOAuth.ts. Tokens live ONLY in
 * tokenStore.ts (SecureStore) and never leave this module – the agent, the
 * LLM and the UI only ever see EmailMessage/EmailDraft data.
 *
 * Scope: gmail.modify (no https://mail.google.com/ – see docs/DECISIONS.md).
 */

const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';
const SEARCH_MAX_RESULTS = 15;

// ---------------------------------------------------------------- token use

async function getValidTokens(): Promise<GmailTokens> {
  let tokens = await loadGmailTokens();
  if (!tokens) {
    throw new Error('Gmail is not connected. Connect it on the E-Mail tab first.');
  }
  // Refresh 60s before actual expiry to avoid racing the deadline.
  if (Date.now() >= tokens.expiresAt - 60_000) {
    tokens = await refreshGmailTokens(tokens);
    await saveGmailTokens(tokens);
  }
  return tokens;
}

async function gmailFetch<T>(path: string, init?: RequestInit, allowRetry = true): Promise<T> {
  const tokens = await getValidTokens();

  let response: Response;
  try {
    response = await fetch(`${GMAIL_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new Error('Network error while calling the Gmail API. Check your internet connection.');
  }

  if (response.status === 401 && allowRetry) {
    // Access token rejected although not expired locally – force one refresh.
    const refreshed = await refreshGmailTokens(tokens);
    await saveGmailTokens(refreshed);
    return gmailFetch<T>(path, init, false);
  }

  if (!response.ok) {
    let apiMessage = '';
    try {
      const parsed = (await response.json()) as { error?: { message?: string } };
      apiMessage = parsed.error?.message ?? '';
    } catch {
      // keep generic message
    }
    if (response.status === 401) {
      throw new Error('Gmail session is no longer valid. Please reconnect Gmail.');
    }
    if (response.status === 403) {
      throw new Error(
        `Gmail API access denied (403). ${apiMessage} ` +
          'Check that the Gmail API is enabled and the gmail.modify scope was granted.',
      );
    }
    throw new Error(`Gmail API error (HTTP ${response.status}): ${apiMessage || 'unknown error'}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

// -------------------------------------------------------- message mapping

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailMessagePart {
  mimeType?: string;
  headers?: GmailHeader[];
  body?: { data?: string; size?: number };
  parts?: GmailMessagePart[];
}

interface GmailMessage {
  id: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailMessagePart;
}

interface GmailDraftResource {
  id: string;
  message?: GmailMessage;
}

function header(message: GmailMessage, name: string): string {
  const found = message.payload?.headers?.find(
    (h) => h.name.toLowerCase() === name.toLowerCase(),
  );
  return found?.value ?? '';
}

/** Depth-first search for a text/plain part (fallback: text/html). */
function extractBody(part: GmailMessagePart | undefined): string {
  if (!part) {
    return '';
  }
  const fromData = (p: GmailMessagePart): string =>
    p.body?.data ? base64ToUtf8(p.body.data) : '';

  const queue: GmailMessagePart[] = [part];
  let htmlFallback = '';
  while (queue.length > 0) {
    const current = queue.shift() as GmailMessagePart;
    if (current.mimeType === 'text/plain' && current.body?.data) {
      return fromData(current);
    }
    if (current.mimeType === 'text/html' && current.body?.data && htmlFallback.length === 0) {
      htmlFallback = fromData(current).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    if (current.parts) {
      queue.push(...current.parts);
    }
  }
  return htmlFallback;
}

function toEmailMessage(message: GmailMessage, body?: string): EmailMessage {
  const labels = message.labelIds ?? [];
  return {
    id: message.id,
    from: header(message, 'From'),
    to: header(message, 'To'),
    subject: header(message, 'Subject'),
    body: body ?? message.snippet ?? '',
    date: message.internalDate
      ? new Date(Number(message.internalDate)).toISOString()
      : header(message, 'Date'),
    labels,
    archived: !labels.includes('INBOX'),
    read: !labels.includes('UNREAD'),
  };
}

// ------------------------------------------------------------ MIME builder

/** RFC 2047 encoded-word for non-ASCII header values (e.g. subjects with umlauts). */
function encodeHeaderValue(value: string): string {
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${utf8ToBase64(value)}?=`;
}

function buildRawEmail(
  to: string,
  subject: string,
  body: string,
  extraHeaders: Record<string, string> = {},
): string {
  const lines = [
    `To: ${to}`,
    `Subject: ${encodeHeaderValue(subject)}`,
    ...Object.entries(extraHeaders).map(([name, value]) => `${name}: ${value}`),
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    utf8ToBase64(body),
  ];
  return utf8ToBase64Url(lines.join('\r\n'));
}

// ----------------------------------------------------------------- provider

export const gmailProvider: EmailProvider = {
  id: 'gmail',
  displayName: 'Gmail',

  async connect(): Promise<EmailAccount> {
    const tokens = await signInWithGoogle();
    await saveGmailTokens(tokens);
    // Resolve the account address via the Gmail profile (no extra scopes needed).
    const profile = await gmailFetch<{ emailAddress?: string }>('/profile');
    const accountEmail = profile.emailAddress ?? null;
    await saveGmailTokens({ ...(await getValidTokens()), accountEmail });
    return {
      id: 'gmail-account',
      provider: 'gmail',
      address: accountEmail ?? 'Gmail-Konto',
      connected: true,
    };
  },

  async disconnect(): Promise<void> {
    const tokens = await loadGmailTokens();
    if (tokens) {
      await revokeGmailAccess(tokens);
    }
    await clearGmailTokens();
  },

  async isConnected(): Promise<boolean> {
    return (await loadGmailTokens()) !== null;
  },

  async getAccount(): Promise<EmailAccount | null> {
    const tokens = await loadGmailTokens();
    if (!tokens) {
      return null;
    }
    return {
      id: 'gmail-account',
      provider: 'gmail',
      address: tokens.accountEmail ?? 'Gmail-Konto',
      connected: true,
    };
  },

  async searchEmails(query: string): Promise<EmailMessage[]> {
    const params = new URLSearchParams({ maxResults: String(SEARCH_MAX_RESULTS) });
    const q = query.trim();
    params.set('q', q.length > 0 ? q : 'in:inbox');
    const list = await gmailFetch<{ messages?: Array<{ id: string }> }>(
      `/messages?${params.toString()}`,
    );
    const ids = (list.messages ?? []).map((m) => m.id);
    const details = await Promise.all(
      ids.map((id) =>
        gmailFetch<GmailMessage>(
          `/messages/${id}?format=metadata` +
            '&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date',
        ),
      ),
    );
    return details.map((m) => toEmailMessage(m));
  },

  async readEmail(id: string): Promise<EmailMessage> {
    const message = await gmailFetch<GmailMessage>(`/messages/${id}?format=full`);
    return toEmailMessage(message, extractBody(message.payload));
  },

  async draftEmail(to: string, subject: string, body: string): Promise<EmailDraft> {
    const draft = await gmailFetch<GmailDraftResource>('/drafts', {
      method: 'POST',
      body: JSON.stringify({ message: { raw: buildRawEmail(to, subject, body) } }),
    });
    return { id: draft.id, to, subject, body };
  },

  async draftReply(id: string, body: string): Promise<EmailDraft> {
    const original = await gmailFetch<GmailMessage>(
      `/messages/${id}?format=metadata` +
        '&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Message-ID',
    );
    const to = header(original, 'From');
    const originalSubject = header(original, 'Subject');
    const subject = originalSubject.toLowerCase().startsWith('re:')
      ? originalSubject
      : `Re: ${originalSubject}`;
    const messageId = header(original, 'Message-ID');
    const extraHeaders: Record<string, string> =
      messageId.length > 0 ? { 'In-Reply-To': messageId, References: messageId } : {};

    const draft = await gmailFetch<GmailDraftResource>('/drafts', {
      method: 'POST',
      body: JSON.stringify({
        message: {
          raw: buildRawEmail(to, subject, body, extraHeaders),
          threadId: original.threadId,
        },
      }),
    });
    return { id: draft.id, to, subject, body, inReplyTo: id };
  },

  async sendEmail(draftId: string): Promise<EmailMessage> {
    const sent = await gmailFetch<GmailMessage>('/drafts/send', {
      method: 'POST',
      body: JSON.stringify({ id: draftId }),
    });
    // Fetch metadata of the sent message so the result shows recipient/subject.
    const details = await gmailFetch<GmailMessage>(
      `/messages/${sent.id}?format=metadata` +
        '&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date',
    );
    return toEmailMessage(details);
  },

  async archiveEmail(id: string): Promise<void> {
    await gmailFetch(`/messages/${id}/modify`, {
      method: 'POST',
      body: JSON.stringify({ removeLabelIds: ['INBOX'] }),
    });
  },

  async labelEmail(id: string, label: string): Promise<void> {
    const labelId = await resolveLabelId(label);
    await gmailFetch(`/messages/${id}/modify`, {
      method: 'POST',
      body: JSON.stringify({ addLabelIds: [labelId] }),
    });
  },
};

/** Finds a user label by name (case-insensitive) or creates it. */
async function resolveLabelId(name: string): Promise<string> {
  const response = await gmailFetch<{ labels?: Array<{ id: string; name: string }> }>('/labels');
  const existing = response.labels?.find((l) => l.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    return existing.id;
  }
  const created = await gmailFetch<{ id: string }>('/labels', {
    method: 'POST',
    body: JSON.stringify({
      name,
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show',
    }),
  });
  return created.id;
}
