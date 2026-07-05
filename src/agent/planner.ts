import { MAX_PLAN_STEPS } from '../config/constants';
import { chatCompletion } from '../services/ai/openaiClient';
import { getRelevantMemoryContext } from '../services/memory/memoryService';
import type { AgentPlan, PlanStep } from '../types/agent';
import type { AISettings } from '../types/settings';
import { extractJsonObject } from '../utils/json';
import { isToolName, TOOL_DEFINITIONS } from './tools';

/**
 * Planner: turns a user task into an AgentPlan (pure JSON, no execution).
 *
 * Security model: the model output is DATA, not code. It is parsed and
 * validated here; execution happens step by step in the Tool-Executor,
 * where risky steps additionally require user confirmation.
 */

function describeTools(): string {
  return TOOL_DEFINITIONS.map((tool) => {
    const params =
      Object.keys(tool.params).length > 0
        ? Object.entries(tool.params)
            .map(([key, doc]) => `      - ${key}: ${doc}`)
            .join('\n')
        : '      (no parameters)';
    return `  - ${tool.name} (${tool.category}${tool.risky ? ', RISKY – needs user confirmation' : ''})\n    ${tool.description}\n    params:\n${params}`;
  }).join('\n');
}

export function buildPlannerSystemPrompt(): string {
  return [
    'You are a planning agent inside a sandboxed Android app.',
    'You can NOT execute anything yourself. You only produce a JSON plan; a separate executor runs it step by step with user oversight.',
    '',
    'Hard rules:',
    '- You can only use the tools listed below. Never invent tools.',
    '- All file paths are relative to the app sandbox. Never use absolute paths, drive letters or "..".',
    '- You have NO access to the Android system, other apps, contacts or files outside the sandbox.',
    `- A plan has at most ${MAX_PLAN_STEPS} steps.`,
    '- Risky tools are shown to the user for confirmation before they run. Plan them only when necessary.',
    '- Use local user memory when it helps answer or plan. The memory belongs to the app, not to any model provider.',
    '- Use remember only for explicit "remember this" requests, stable user preferences, important durable project decisions, or recurring information useful later.',
    '- Never remember passwords, API keys, OAuth tokens, banking data, credit card data, or very sensitive private information unless the user explicitly asks and it is safe to store.',
    '',
    'Available tools:',
    describeTools(),
    '',
    'Respond with ONLY a JSON object, no prose, no markdown fences:',
    '{',
    '  "goal": "<one sentence: what the plan achieves>",',
    '  "steps": [',
    '    { "tool": "<tool name>", "params": { ... }, "reason": "<why this step, in the user\'s language>" }',
    '  ]',
    '}',
  ].join('\n');
}

export function parsePlan(modelResponse: string): AgentPlan {
  const raw = extractJsonObject(modelResponse);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Model response is not valid JSON.');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Plan must be a JSON object.');
  }
  const candidate = parsed as { goal?: unknown; steps?: unknown };

  if (typeof candidate.goal !== 'string' || candidate.goal.length === 0) {
    throw new Error('Plan is missing a "goal" string.');
  }
  if (!Array.isArray(candidate.steps)) {
    throw new Error('Plan is missing a "steps" array.');
  }
  if (candidate.steps.length === 0) {
    throw new Error('Plan contains no steps.');
  }
  if (candidate.steps.length > MAX_PLAN_STEPS) {
    throw new Error(`Plan exceeds the maximum of ${MAX_PLAN_STEPS} steps.`);
  }

  const steps: PlanStep[] = candidate.steps.map((step: unknown, index: number) => {
    if (typeof step !== 'object' || step === null) {
      throw new Error(`Step ${index + 1} is not an object.`);
    }
    const s = step as { tool?: unknown; params?: unknown; reason?: unknown };
    if (typeof s.tool !== 'string' || !isToolName(s.tool)) {
      throw new Error(`Step ${index + 1} uses an unknown tool: "${String(s.tool)}".`);
    }
    const params =
      typeof s.params === 'object' && s.params !== null && !Array.isArray(s.params)
        ? (s.params as Record<string, unknown>)
        : {};
    const reason = typeof s.reason === 'string' ? s.reason : '';
    return { tool: s.tool, params, reason };
  });

  return { goal: candidate.goal, steps };
}

export async function createPlan(settings: AISettings, userTask: string): Promise<AgentPlan> {
  const memoryContext = await getRelevantMemoryContext(userTask);
  const messages = [
    { role: 'system' as const, content: buildPlannerSystemPrompt() },
    ...(memoryContext.length > 0 ? [{ role: 'system' as const, content: memoryContext }] : []),
    { role: 'user' as const, content: userTask },
  ];
  const response = await chatCompletion(settings, messages);
  return parsePlan(response);
}
