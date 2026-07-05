import type { EmailAccount, EmailDraft, EmailMessage, EmailProvider, EmailProviderId } from './types';
import { gmailProvider } from './providers/gmailProvider';
import { mockEmailProvider } from './providers/mockEmailProvider';
import { hasGmailTokens } from './tokenStore';

/**
 * Provider layer: the ONLY email entry point for agent tools and UI.
 *
 *   Agent tool / screen
 *     -> emailService.ts        (this file: picks the active provider)
 *       -> gmailProvider.ts     (real Gmail API, tokens stay inside)
 *       -> mockEmailProvider.ts (in-memory fallback/test provider)
 *
 * The agent never talks to a provider or the Gmail API directly and never
 * sees tokens. Switching providers is a one-line change here (and later a
 * settings toggle) – tool handlers and UI stay untouched.
 */

let activeProvider: EmailProvider = mockEmailProvider;

/** Call once at app start: restores Gmail as active provider if tokens exist. */
export async function initEmailService(): Promise<void> {
  if (await hasGmailTokens()) {
    activeProvider = gmailProvider;
  }
}

export function getActiveProviderId(): EmailProviderId {
  return activeProvider.id;
}

export interface EmailStatus {
  providerId: EmailProviderId;
  providerName: string;
  account: EmailAccount | null;
}

export async function getStatus(): Promise<EmailStatus> {
  return {
    providerId: activeProvider.id,
    providerName: activeProvider.displayName,
    account: await activeProvider.getAccount(),
  };
}

// ------------------------------------------------------------- connections

/** Opens the Google login (PKCE) and switches the active provider to Gmail. */
export async function connectGmail(): Promise<EmailAccount> {
  const account = await gmailProvider.connect();
  activeProvider = gmailProvider;
  return account;
}

/** Revokes Gmail access, clears tokens and falls back to the mock provider. */
export async function disconnectGmail(): Promise<void> {
  await gmailProvider.disconnect();
  activeProvider = mockEmailProvider;
}

/** Connects the in-memory mock account (no network, for testing). */
export async function connectMock(): Promise<EmailAccount> {
  const account = await mockEmailProvider.connect();
  activeProvider = mockEmailProvider;
  return account;
}

// ------------------------------------------------- provider pass-throughs

export function searchEmails(query: string): Promise<EmailMessage[]> {
  return activeProvider.searchEmails(query);
}

export function readEmail(id: string): Promise<EmailMessage> {
  return activeProvider.readEmail(id);
}

export function draftEmail(to: string, subject: string, body: string): Promise<EmailDraft> {
  return activeProvider.draftEmail(to, subject, body);
}

export function draftReply(id: string, body: string): Promise<EmailDraft> {
  return activeProvider.draftReply(id, body);
}

export function sendEmail(draftId: string): Promise<EmailMessage> {
  return activeProvider.sendEmail(draftId);
}

export function archiveEmail(id: string): Promise<void> {
  return activeProvider.archiveEmail(id);
}

export function labelEmail(id: string, label: string): Promise<void> {
  return activeProvider.labelEmail(id, label);
}
