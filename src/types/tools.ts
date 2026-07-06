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
  'browser_get_state',
  'go_back',
  'stop_loading',
  'screenshot_page',
  'download_file',
] as const;

export const MEMORY_TOOL_NAMES = ['remember', 'search_memory', 'list_memory', 'forget_memory'] as const;

export const DRIVE_TOOL_NAMES = [
  'connect_drive_account',
  'drive_get_status',
  'drive_list_files',
  'drive_search_files',
  'drive_download_to_sandbox',
  'drive_upload_from_sandbox',
  'drive_move_file',
  'drive_create_folder',
  'drive_trash_file',
  'drive_rename_file',
] as const;

export type FileToolName = (typeof FILE_TOOL_NAMES)[number];
export type EmailToolName = (typeof EMAIL_TOOL_NAMES)[number];
export type BrowserToolName = (typeof BROWSER_TOOL_NAMES)[number];
export type MemoryToolName = (typeof MEMORY_TOOL_NAMES)[number];
export type DriveToolName = (typeof DRIVE_TOOL_NAMES)[number];
export type ToolName =
  | FileToolName
  | EmailToolName
  | BrowserToolName
  | MemoryToolName
  | DriveToolName;

export type ToolCategory = 'files' | 'email' | 'browser' | 'memory' | 'drive';

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
