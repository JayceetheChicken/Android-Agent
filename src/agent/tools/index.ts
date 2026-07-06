import type { ToolHandler, ToolName } from '../../types/tools';
import { browserToolHandlers } from './browserTools';
import { driveToolHandlers } from './driveTools';
import { emailToolHandlers } from './emailTools';
import { fileToolHandlers } from './fileTools';
import { memoryToolHandlers } from './memoryTools';

export {
  TOOL_DEFINITIONS,
  describeToolsForPrompt,
  getToolDefinition,
  isToolName,
} from './definitions';

export const toolHandlers: Record<ToolName, ToolHandler> = {
  ...fileToolHandlers,
  ...emailToolHandlers,
  ...browserToolHandlers,
  ...memoryToolHandlers,
  ...driveToolHandlers,
};
