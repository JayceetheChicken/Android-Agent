import type { EmailAccount, EmailDraft, EmailMessage } from '../../types/email';

export type { EmailAccount, EmailDraft, EmailMessage };

export type EmailProviderId = 'mock' | 'gmail';

/**
 * Contract every email backend must fulfil. The agent tools and the UI only
 * ever talk to emailService.ts, which delegates to the active provider.
 * Providers own their credentials internally (Gmail: SecureStore via
 * tokenStore.ts) – tokens are NEVER returned through this interface, so
 * neither the agent nor the LLM can ever see them.
 */
export interface EmailProvider {
  readonly id: EmailProviderId;
  readonly displayName: string;

  /** Interactive connect (Gmail: opens the Google login). Returns the account. */
  connect(): Promise<EmailAccount>;
  /** Revokes/clears credentials. */
  disconnect(): Promise<void>;
  isConnected(): Promise<boolean>;
  getAccount(): Promise<EmailAccount | null>;

  searchEmails(query: string): Promise<EmailMessage[]>;
  readEmail(id: string): Promise<EmailMessage>;
  draftEmail(to: string, subject: string, body: string): Promise<EmailDraft>;
  draftReply(id: string, body: string): Promise<EmailDraft>;
  /** Sends a previously created draft. */
  sendEmail(draftId: string): Promise<EmailMessage>;
  archiveEmail(id: string): Promise<void>;
  labelEmail(id: string, label: string): Promise<void>;
}
