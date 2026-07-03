export type EmailProvider = 'mock' | 'gmail' | 'imap';

export interface EmailAccount {
  id: string;
  provider: EmailProvider;
  address: string;
  connected: boolean;
}

export interface EmailMessage {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  date: string; // ISO 8601
  labels: string[];
  archived: boolean;
  read: boolean;
}

export interface EmailDraft {
  id: string;
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
}
