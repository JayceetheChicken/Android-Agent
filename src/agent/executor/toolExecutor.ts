import type { PlanStep } from '../../types/agent';
import type { ToolResult } from '../../types/tools';
import { getToolDefinition, toolHandlers } from '../tools';
import { requestConfirmation } from './confirmation';

/**
 * Tool-Executor: the ONLY place where plan steps become real actions.
 *
 * Guarantees:
 * 1. Unknown tools are rejected.
 * 2. Risky tools (definition.risky) always go through user confirmation first.
 * 3. Handler errors are caught and returned as failed ToolResults –
 *    a broken step never crashes the app.
 */
export async function executeStep(step: PlanStep): Promise<ToolResult> {
  const definition = getToolDefinition(step.tool);
  if (!definition) {
    return { ok: false, output: `Unknown tool: "${step.tool}". Step rejected.` };
  }

  // TODO(full-access-mode): a future, consciously enabled "Full Access" mode
  // may skip per-step confirmation for actions INSIDE connected services
  // (e.g. Gmail send/archive/label) – never for anything outside the app
  // sandbox. Until that mode exists, every risky tool confirms. Do not add
  // any other bypass. See docs/TASKS.md ("Full Access Mode").
  if (definition.risky) {
    const approved = await requestConfirmation({
      tool: definition.name,
      params: step.params,
      reason: step.reason,
      description: definition.description,
    });
    if (!approved) {
      return {
        ok: false,
        rejected: true,
        output: `User rejected risky action "${definition.name}".`,
      };
    }
  }

  try {
    return await toolHandlers[definition.name](step.params);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, output: `Tool "${definition.name}" failed: ${message}` };
  }
}
