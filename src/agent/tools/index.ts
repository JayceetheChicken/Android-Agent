import type { ToolHandler, ToolName } from '../../types/tools';
import { browserToolHandlers } from './browserTools';
import { emailToolHandlers } from './emailTools';
import { fileToolHandlers } from './fileTools';

export { TOOL_DEFINITIONS, getToolDefinition, isToolName } from './definitions';

export const toolHandlers: Record<ToolName, ToolHandler> = {
  ...fileToolHandlers,
  ...emailToolHandlers,
  ...browserToolHandlers,
};
