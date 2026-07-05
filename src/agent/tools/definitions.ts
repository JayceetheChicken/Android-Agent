import type { ToolDefinition, ToolName } from '../../types/tools';

/**
 * Single source of truth for all agent tools.
 * - `risky: true`  => the Tool-Executor ALWAYS asks the user before running it.
 * - `mock: true`   => the underlying service is still a mock (safe to call).
 * The planner prompt is generated from this registry, so model, executor and
 * UI can never disagree about which tools exist.
 */
export const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  // ---- Files (real, sandboxed to <documentDirectory>/sandbox/) ----
  {
    name: 'list_files',
    category: 'files',
    description: 'List files and folders in a sandbox folder.',
    params: { path: 'string – folder path relative to sandbox root, "" for root' },
    risky: false,
    mock: false,
  },
  {
    name: 'read_file',
    category: 'files',
    description: 'Read a text file from the sandbox.',
    params: { path: 'string – file path relative to sandbox root' },
    risky: false,
    mock: false,
  },
  {
    name: 'write_file',
    category: 'files',
    description: 'Write (create or overwrite) a text file in the sandbox.',
    params: {
      path: 'string – file path relative to sandbox root',
      content: 'string – full text content of the file',
    },
    risky: false,
    mock: false,
  },
  {
    name: 'move_file',
    category: 'files',
    description: 'Move a file or folder to a new path inside the sandbox.',
    params: {
      from: 'string – current path relative to sandbox root',
      to: 'string – target path relative to sandbox root',
    },
    risky: false,
    mock: false,
  },
  {
    name: 'rename_file',
    category: 'files',
    description: 'Rename a file or folder (same location, new name).',
    params: {
      path: 'string – current path relative to sandbox root',
      new_name: 'string – new name without path separators',
    },
    risky: false,
    mock: false,
  },
  {
    name: 'create_folder',
    category: 'files',
    description: 'Create a new folder in the sandbox.',
    params: { path: 'string – folder path relative to sandbox root' },
    risky: false,
    mock: false,
  },
  {
    name: 'delete_file',
    category: 'files',
    description: 'Delete a file or folder in the sandbox. Requires user confirmation.',
    params: { path: 'string – path relative to sandbox root' },
    risky: true,
    mock: false,
  },

  // ---- Email (runs against the active provider: Gmail via OAuth or mock) ----
  {
    name: 'connect_email_account',
    category: 'email',
    description:
      'Connect an email account. "gmail" opens the Google login (OAuth). Requires user confirmation.',
    params: { provider: 'string – "gmail" (real account via Google login) or "mock" (test inbox)' },
    risky: true,
    mock: false,
  },
  {
    name: 'search_emails',
    category: 'email',
    description: 'Search emails by subject, sender, body or label. Empty query lists the inbox.',
    params: { query: 'string – search text, may be empty' },
    risky: false,
    mock: false,
  },
  {
    name: 'read_email',
    category: 'email',
    description: 'Read the full content of one email.',
    params: { id: 'string – email id from search_emails' },
    risky: false,
    mock: false,
  },
  {
    name: 'draft_email',
    category: 'email',
    description: 'Create a new email draft. Does NOT send anything.',
    params: {
      to: 'string – recipient address',
      subject: 'string – subject line',
      body: 'string – email body',
    },
    risky: false,
    mock: false,
  },
  {
    name: 'draft_reply',
    category: 'email',
    description: 'Create a reply draft for an existing email. Does NOT send anything.',
    params: {
      id: 'string – id of the email to reply to',
      body: 'string – reply body',
    },
    risky: false,
    mock: false,
  },
  {
    name: 'archive_email',
    category: 'email',
    description: 'Archive an email.',
    params: { id: 'string – email id' },
    risky: false,
    mock: false,
  },
  {
    name: 'label_email',
    category: 'email',
    description: 'Add a label to an email.',
    params: {
      id: 'string – email id',
      label: 'string – label name',
    },
    risky: false,
    mock: false,
  },
  {
    name: 'send_email',
    category: 'email',
    description: 'Send a previously created draft. Requires user confirmation.',
    params: { draft_id: 'string – id of the draft to send' },
    risky: true,
    mock: false,
  },

  // ---- Browser (WebView bridge; DOM interaction not implemented yet) ----
  {
    name: 'open_url',
    category: 'browser',
    description:
      'Open an https URL in the in-app mini browser. Requires user confirmation (external website).',
    params: { url: 'string – full https URL' },
    risky: true,
    mock: false,
  },
  {
    name: 'read_page',
    category: 'browser',
    description: 'Read basic info (URL, title) about the currently open page.',
    params: {},
    risky: false,
    mock: true,
  },
  {
    name: 'click_element',
    category: 'browser',
    description: 'Click an element on the current page. NOT IMPLEMENTED YET.',
    params: { selector: 'string – CSS selector or visible text' },
    risky: false,
    mock: true,
  },
  {
    name: 'type_text',
    category: 'browser',
    description: 'Type text into an input field on the current page. NOT IMPLEMENTED YET.',
    params: {
      selector: 'string – CSS selector of the input',
      text: 'string – text to type',
    },
    risky: false,
    mock: true,
  },
  {
    name: 'submit_form',
    category: 'browser',
    description:
      'Submit a form on the current page. Requires user confirmation. NOT IMPLEMENTED YET.',
    params: { selector: 'string – CSS selector of the form' },
    risky: true,
    mock: true,
  },
  {
    name: 'go_back',
    category: 'browser',
    description: 'Navigate back in the mini browser history.',
    params: {},
    risky: false,
    mock: false,
  },
  {
    name: 'screenshot_page',
    category: 'browser',
    description: 'Take a screenshot of the current page. NOT IMPLEMENTED YET.',
    params: {},
    risky: false,
    mock: true,
  },
  {
    name: 'download_file',
    category: 'browser',
    description:
      'Download a file from a URL into the sandbox. Requires user confirmation. NOT IMPLEMENTED YET.',
    params: {
      url: 'string – https URL of the file',
      path: 'string – target path relative to sandbox root',
    },
    risky: true,
    mock: true,
  },
] as const;

const definitionsByName = new Map<ToolName, ToolDefinition>(
  TOOL_DEFINITIONS.map((d) => [d.name, d]),
);

export function getToolDefinition(name: string): ToolDefinition | undefined {
  return definitionsByName.get(name as ToolName);
}

export function isToolName(name: string): name is ToolName {
  return definitionsByName.has(name as ToolName);
}
