export const FILE_TOOL_NAMES = [
  'list_files',
  'read_file',
  'write_file',
  'move_file',
  'rename_file',
  'create_folder',
  'delete_file',
] as const;

export const EMAIL_TOOL_NAMES = [
  'connect_email_account',
  'search_emails',
  'read_email',
  'draft_email',
  'draft_reply',
  'archive_email',
  'label_email',
  'send_email',
] as const;

export const BROWSER_TOOL_NAMES = [
  'open_url',
  'read_page',
  'click_element',
  'type_text',
  'submit_form',
  'scroll_page',
  'wait_for_page',
  'go_back',
  'screenshot_page',
  'download_file',
] as const;

export type FileToolName = (typeof FILE_TOOL_NAMES)[number];
export type EmailToolName = (typeof EMAIL_TOOL_NAMES)[number];
export type BrowserToolName = (typeof BROWSER_TOOL_NAMES)[number];
export type ToolName = FileToolName | EmailToolName | BrowserToolName;

export type ToolCategory = 'files' | 'email' | 'browser';

/** Parameters as produced by the LLM plan – always validated inside the tool handler. */
export type ToolParams = Record<string, unknown>;

export interface ToolResult {
  ok: boolean;
  /** Human-readable summary shown in the UI and fed back to the model. */
  output: string;
  /** Optional structured payload. */
  data?: unknown;
  /** True when the user rejected a risky action in the confirmation dialog. */
  rejected?: boolean;
}

export type ToolHandler = (params: ToolParams) => Promise<ToolResult>;

export interface ToolDefinition {
  name: ToolName;
  category: ToolCategory;
  description: string;
  /** Parameter name -> description (including expected type). Used for the planner prompt. */
  params: Record<string, string>;
  /** Risky tools always require explicit user confirmation before execution. */
  risky: boolean;
  /** True while the underlying service is still a mock (see docs/TASKS.md). */
  mock: boolean;
}
