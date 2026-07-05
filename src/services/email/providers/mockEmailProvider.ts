import { generateId } from '../../../utils/json';
import type {
  EmailAccount,
  EmailDraft,
  EmailMessage,
  EmailProvider,
} from '../types';

/**
 * MOCK email provider (in-memory, no network).
 *
 * Kept on purpose as fallback/test provider: the agent architecture can be
 * exercised end-to-end without real credentials, and it documents the
 * expected provider behaviour for future implementations (Outlook, IMAP…).
 */

let account: EmailAccount | null = null;

const inbox: EmailMessage[] = [
  {
    id: 'mail-1',
    from: 'anna@example.com',
    to: 'me@sandbox.local',
    subject: 'Meeting am Freitag',
    body: 'Hallo! Passt dir Freitag 14:00 Uhr für unser Meeting? Viele Grüße, Anna',
    date: '2026-07-01T09:15:00.000Z',
    labels: ['work'],
    archived: false,
    read: false,
  },
  {
    id: 'mail-2',
    from: 'newsletter@techdigest.example',
    to: 'me@sandbox.local',
    subject: 'Tech Digest – Woche 27',
    body: 'Die wichtigsten Tech-News der Woche: KI-Agenten, React Native 0.86, ...',
    date: '2026-06-30T06:00:00.000Z',
    labels: ['newsletter'],
    archived: false,
    read: true,
  },
  {
    id: 'mail-3',
    from: 'support@cloudservice.example',
    to: 'me@sandbox.local',
    subject: 'Ihre Rechnung für Juni',
    body: 'Ihre Rechnung über 9,99 € für Juni 2026 ist verfügbar.',
    date: '2026-06-28T12:30:00.000Z',
    labels: ['billing'],
    archived: true,
    read: true,
  },
];

const drafts: EmailDraft[] = [];
const sent: EmailMessage[] = [];

function findMail(id: string): EmailMessage {
  const mail = inbox.find((m) => m.id === id);
  if (!mail) {
    throw new Error(`Email not found: "${id}"`);
  }
  return mail;
}

export const mockEmailProvider: EmailProvider = {
  id: 'mock',
  displayName: 'Mock-Postfach',

  async connect(): Promise<EmailAccount> {
    account = {
      id: generateId(),
      provider: 'mock',
      address: 'me@sandbox.local',
      connected: true,
    };
    return account;
  },

  async disconnect(): Promise<void> {
    account = null;
  },

  async isConnected(): Promise<boolean> {
    return account !== null;
  },

  async getAccount(): Promise<EmailAccount | null> {
    return account;
  },

  async searchEmails(query: string): Promise<EmailMessage[]> {
    const q = query.trim().toLowerCase();
    if (q.length === 0) {
      return inbox.filter((m) => !m.archived);
    }
    return inbox.filter(
      (m) =>
        m.subject.toLowerCase().includes(q) ||
        m.body.toLowerCase().includes(q) ||
        m.from.toLowerCase().includes(q) ||
        m.labels.some((l) => l.toLowerCase().includes(q)),
    );
  },

  async readEmail(id: string): Promise<EmailMessage> {
    const mail = findMail(id);
    mail.read = true;
    return mail;
  },

  async draftEmail(to: string, subject: string, body: string): Promise<EmailDraft> {
    const draft: EmailDraft = { id: generateId(), to, subject, body };
    drafts.push(draft);
    return draft;
  },

  async draftReply(id: string, body: string): Promise<EmailDraft> {
    const original = findMail(id);
    const draft: EmailDraft = {
      id: generateId(),
      to: original.from,
      subject: `Re: ${original.subject}`,
      body,
      inReplyTo: original.id,
    };
    drafts.push(draft);
    return draft;
  },

  async sendEmail(draftId: string): Promise<EmailMessage> {
    if (!account) {
      throw new Error('No email account connected.');
    }
    const index = drafts.findIndex((d) => d.id === draftId);
    if (index === -1) {
      throw new Error(`Draft not found: "${draftId}"`);
    }
    const [draft] = drafts.splice(index, 1);
    const message: EmailMessage = {
      id: generateId(),
      from: account.address,
      to: draft.to,
      subject: draft.subject,
      body: draft.body,
      date: new Date().toISOString(),
      labels: ['sent'],
      archived: false,
      read: true,
    };
    sent.push(message);
    return message;
  },

  async archiveEmail(id: string): Promise<void> {
    findMail(id).archived = true;
  },

  async labelEmail(id: string, label: string): Promise<void> {
    const mail = findMail(id);
    if (!mail.labels.includes(label)) {
      mail.labels.push(label);
    }
  },
};

/** Test helpers (not part of the EmailProvider contract). */
export function getMockDrafts(): EmailDraft[] {
  return drafts;
}
export function getMockSent(): EmailMessage[] {
  return sent;
}
