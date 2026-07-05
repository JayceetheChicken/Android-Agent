import * as emailService from '../../services/email/emailService';
import type { EmailToolName, ToolHandler } from '../../types/tools';
import { optionalString, requireString } from './paramHelpers';

/**
 * Email tools run against the ACTIVE provider behind emailService.ts:
 * real Gmail (OAuth/PKCE) when connected, otherwise the in-memory mock.
 * Tools never see tokens or the Gmail API directly.
 */

/** Marks outputs clearly while the mock provider is active. */
function tag(text: string): string {
  return emailService.getActiveProviderId() === 'mock' ? `MOCK: ${text}` : text;
}

export const emailToolHandlers: Record<EmailToolName, ToolHandler> = {
  connect_email_account: async (params) => {
    const provider = optionalString(params, 'provider') || 'gmail';
    if (provider === 'gmail') {
      const account = await emailService.connectGmail();
      return {
        ok: true,
        output: `Connected Gmail account "${account.address}" via Google login (OAuth/PKCE).`,
        data: account,
      };
    }
    if (provider === 'mock') {
      const account = await emailService.connectMock();
      return {
        ok: true,
        output: `MOCK: Connected mock account "${account.address}" (no real mailbox).`,
        data: account,
      };
    }
    return { ok: false, output: `Unknown email provider "${provider}". Use "gmail" or "mock".` };
  },

  search_emails: async (params) => {
    const query = optionalString(params, 'query');
    const results = await emailService.searchEmails(query);
    const lines = results.map(
      (m) =>
        `${m.id} | ${m.date.slice(0, 10)} | ${m.from} | ${m.subject}${m.read ? '' : ' (unread)'}`,
    );
    return {
      ok: true,
      output: tag(lines.length > 0 ? lines.join('\n') : 'No emails found.'),
      data: results,
    };
  },

  read_email: async (params) => {
    const id = requireString(params, 'id');
    const mail = await emailService.readEmail(id);
    return {
      ok: true,
      output: tag(`From: ${mail.from}\nDate: ${mail.date}\nSubject: ${mail.subject}\n\n${mail.body}`),
      data: mail,
    };
  },

  draft_email: async (params) => {
    const to = requireString(params, 'to');
    const subject = requireString(params, 'subject');
    const body = requireString(params, 'body');
    const draft = await emailService.draftEmail(to, subject, body);
    return {
      ok: true,
      output: tag(
        `Draft created (id: ${draft.id}) to ${draft.to}: "${draft.subject}". Nothing was sent.`,
      ),
      data: draft,
    };
  },

  draft_reply: async (params) => {
    const id = requireString(params, 'id');
    const body = requireString(params, 'body');
    const draft = await emailService.draftReply(id, body);
    return {
      ok: true,
      output: tag(
        `Reply draft created (id: ${draft.id}) to ${draft.to}: "${draft.subject}". Nothing was sent.`,
      ),
      data: draft,
    };
  },

  archive_email: async (params) => {
    const id = requireString(params, 'id');
    await emailService.archiveEmail(id);
    return { ok: true, output: tag(`Archived email "${id}".`) };
  },

  label_email: async (params) => {
    const id = requireString(params, 'id');
    const label = requireString(params, 'label');
    await emailService.labelEmail(id, label);
    return { ok: true, output: tag(`Added label "${label}" to email "${id}".`) };
  },

  send_email: async (params) => {
    const draftId = requireString(params, 'draft_id');
    const message = await emailService.sendEmail(draftId);
    return {
      ok: true,
      output: tag(`Sent email to ${message.to}: "${message.subject}".`),
      data: message,
    };
  },
};
