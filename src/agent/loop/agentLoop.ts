import { MAX_AGENT_LOOP_STEPS } from '../../config/constants';
import { chatCompletion, type CompletionMessage } from '../../services/ai/openaiClient';
import { getRelevantMemoryContext } from '../../services/memory/memoryService';
import type {
  AgentLoopDecision,
  AgentLoopResult,
  AgentObservation,
} from '../../types/agent';
import type { AISettings } from '../../types/settings';
import type { ToolName, ToolParams, ToolResult } from '../../types/tools';
import { executeStep } from '../executor/toolExecutor';
import { buildLoopSystemPrompt, buildObservationsMessage, parseLoopDecision } from './loopPlanner';

/**
 * Agent Loop V2: plan → act → observe → replan → … → finish.
 *
 * Each iteration the model decides ONE next tool call or a final answer.
 * The tool runs through the SAME executeStep() as the static planner, so
 * risky tools still require user confirmation (fail closed). The tool result
 * is fed back as an observation, then the model decides again.
 *
 * Memory is loaded once up front (observations drive later iterations).
 * The output is always data (a JSON decision), never executed as code.
 */

export interface AgentLoopHandlers {
  /** A tool step is about to run (already decided, not yet executed). */
  onToolStart?: (step: {
    index: number;
    tool: ToolName;
    params: ToolParams;
    reason: string;
  }) => void;
  /** A tool step finished (result may be ok, failed or rejected). */
  onToolResult?: (step: { index: number; result: ToolResult }) => void;
  /** The loop produced the final answer for the user. */
  onFinal?: (answer: string) => void;
}

async function decideNextStep(
  settings: AISettings,
  systemPrompt: string,
  memoryContext: string,
  userTask: string,
  observations: AgentObservation[],
): Promise<AgentLoopDecision> {
  const messages: CompletionMessage[] = [
    { role: 'system', content: systemPrompt },
    ...(memoryContext.length > 0
      ? [{ role: 'system' as const, content: memoryContext }]
      : []),
    { role: 'user', content: `Task: ${userTask}` },
    { role: 'user', content: buildObservationsMessage(observations) },
  ];

  const first = await chatCompletion(settings, messages);
  try {
    return parseLoopDecision(first);
  } catch (parseError) {
    // One corrective retry: tell the model exactly what was wrong.
    const hint = parseError instanceof Error ? parseError.message : String(parseError);
    const retry = await chatCompletion(settings, [
      ...messages,
      { role: 'assistant', content: first },
      {
        role: 'user',
        content: `That was not a valid decision (${hint}). Reply with ONLY one JSON object: either {"type":"tool",...} or {"type":"final","answer":"..."}.`,
      },
    ]);
    return parseLoopDecision(retry);
  }
}

async function summarizeOnLimit(
  settings: AISettings,
  userTask: string,
  observations: AgentObservation[],
): Promise<string> {
  try {
    return await chatCompletion(settings, [
      {
        role: 'system',
        content:
          'You are summarizing an unfinished agent run honestly. The step limit was reached. ' +
          'Based only on the observations, tell the user what you found and what is still open. ' +
          'Plain text, no JSON.',
      },
      { role: 'user', content: `Task: ${userTask}` },
      { role: 'user', content: buildObservationsMessage(observations) },
    ]);
  } catch {
    return (
      `Ich habe das Schritt-Limit von ${MAX_AGENT_LOOP_STEPS} erreicht, bevor die Aufgabe ` +
      'vollständig gelöst war. Die bisherigen Beobachtungen stehen in der Schrittliste.'
    );
  }
}

export async function runAgentLoop(
  settings: AISettings,
  userTask: string,
  handlers: AgentLoopHandlers = {},
): Promise<AgentLoopResult> {
  const systemPrompt = buildLoopSystemPrompt();
  // Load memory once; later iterations are driven by observations.
  const memoryContext = await getRelevantMemoryContext(userTask);

  const observations: AgentObservation[] = [];
  let stepsRun = 0;

  while (stepsRun < MAX_AGENT_LOOP_STEPS) {
    const decision = await decideNextStep(
      settings,
      systemPrompt,
      memoryContext,
      userTask,
      observations,
    );

    if (decision.type === 'final') {
      handlers.onFinal?.(decision.answer);
      return { answer: decision.answer, stepsRun, observations, stoppedReason: 'final' };
    }

    const index = stepsRun;
    stepsRun += 1;
    handlers.onToolStart?.({ index, tool: decision.tool, params: decision.params, reason: decision.reason });

    // Same executor as the static planner: risky tools confirm, errors are caught.
    const result = await executeStep({
      tool: decision.tool,
      params: decision.params,
      reason: decision.reason,
    });
    handlers.onToolResult?.({ index, result });

    observations.push({
      tool: decision.tool,
      ok: result.ok,
      output: result.output,
      data: result.data,
    });
  }

  const answer = await summarizeOnLimit(settings, userTask, observations);
  handlers.onFinal?.(answer);
  return { answer, stepsRun, observations, stoppedReason: 'limit' };
}
