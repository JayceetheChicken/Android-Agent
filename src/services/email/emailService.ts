import type { EmailAccount, EmailDraft, EmailMessage } from '../../types/email';
import { generateId } from '../../utils/json';

/**
 * MOCK email service.
 *
 * This is intentionally an in-memory mock so the agent architecture can be
 * built and tested without real credentials. The public API is designed so a
 * real Gmail/IMAP implementation can replace the internals later without
 * changing the agent tools (see docs/ARCHITECTURE.md, "Email integration").
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

export function getAccount(): EmailAccount | null {
  return account;
}

export async function connectMockAccount(address: string): Promise<EmailAccount> {
  account = {
    id: generateId(),
    provider: 'mock',
    address,
    connected: true,
  };
  return account;
}

export async function searchEmails(query: string): Promise<EmailMessage[]> {
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
}

export async function readEmail(id: string): Promise<EmailMessage> {
  const mail = inbox.find((m) => m.id === id);
  if (!mail) {
    throw new Error(`Email not found: "${id}"`);
  }
  mail.read = true;
  return mail;
}

export async function createDraft(
  to: string,
  subject: string,
  body: string,
  inReplyTo?: string,
): Promise<EmailDraft> {
  const draft: EmailDraft = { id: generateId(), to, subject, body, inReplyTo };
  drafts.push(draft);
  return draft;
}

export function getDrafts(): EmailDraft[] {
  return drafts;
}

export async function archiveEmail(id: string): Promise<void> {
  const mail = inbox.find((m) => m.id === id);
  if (!mail) {
    throw new Error(`Email not found: "${id}"`);
  }
  mail.archived = true;
}

export async function labelEmail(id: string, label: string): Promise<void> {
  const mail = inbox.find((m) => m.id === id);
  if (!mail) {
    throw new Error(`Email not found: "${id}"`);
  }
  if (!mail.labels.includes(label)) {
    mail.labels.push(label);
  }
}

/** Mock send: moves the draft to the "sent" list. No network traffic. */
export async function sendEmail(draftId: string): Promise<EmailMessage> {
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
}

export function getSent(): EmailMessage[] {
  return sent;
}
