import * as emailService from '../../services/email/emailService';
import type { EmailToolName, ToolHandler } from '../../types/tools';
import { optionalString, requireString } from './paramHelpers';

/**
 * Email tools currently talk to the MOCK email service.
 * The tool surface is final; only the service internals will change
 * when real Gmail/IMAP support lands (docs/ARCHITECTURE.md).
 */
export const emailToolHandlers: Record<EmailToolName, ToolHandler> = {
  connect_email_account: async (params) => {
    const address = requireString(params, 'address');
    const account = await emailService.connectMockAccount(address);
    return {
      ok: true,
      output: `MOCK: Connected email account "${account.address}" (provider: ${account.provider}).`,
      data: account,
    };
  },

  search_emails: async (params) => {
    const query = optionalString(params, 'query');
    const results = await emailService.searchEmails(query);
    const lines = results.map(
      (m) => `${m.id} | ${m.date.slice(0, 10)} | ${m.from} | ${m.subject}${m.read ? '' : ' (unread)'}`,
    );
    return {
      ok: true,
      output: lines.length > 0 ? lines.join('\n') : 'No emails found.',
      data: results,
    };
  },

  read_email: async (params) => {
    const id = requireString(params, 'id');
    const mail = await emailService.readEmail(id);
    return {
      ok: true,
      output: `From: ${mail.from}\nDate: ${mail.date}\nSubject: ${mail.subject}\n\n${mail.body}`,
      data: mail,
    };
  },

  draft_email: async (params) => {
    const to = requireString(params, 'to');
    const subject = requireString(params, 'subject');
    const body = requireString(params, 'body');
    const draft = await emailService.createDraft(to, subject, body);
    return {
      ok: true,
      output: `Draft created (id: ${draft.id}) to ${draft.to}: "${draft.subject}". Nothing was sent.`,
      data: draft,
    };
  },

  draft_reply: async (params) => {
    const id = requireString(params, 'id');
    const body = requireString(params, 'body');
    const original = await emailService.readEmail(id);
    const draft = await emailService.createDraft(
      original.from,
      `Re: ${original.subject}`,
      body,
      original.id,
    );
    return {
      ok: true,
      output: `Reply draft created (id: ${draft.id}) to ${draft.to}: "${draft.subject}". Nothing was sent.`,
      data: draft,
    };
  },

  archive_email: async (params) => {
    const id = requireString(params, 'id');
    await emailService.archiveEmail(id);
    return { ok: true, output: `Archived email "${id}".` };
  },

  label_email: async (params) => {
    const id = requireString(params, 'id');
    const label = requireString(params, 'label');
    await emailService.labelEmail(id, label);
    return { ok: true, output: `Added label "${label}" to email "${id}".` };
  },

  send_email: async (params) => {
    const draftId = requireString(params, 'draft_id');
    const message = await emailService.sendEmail(draftId);
    return {
      ok: true,
      output: `MOCK: Sent email to ${message.to}: "${message.subject}" (no real email left the device).`,
      data: message,
    };
  },
};
