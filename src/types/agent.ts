import type { ToolName, ToolParams, ToolResult } from './tools';

/** One step of an agent plan. The agent NEVER executes anything itself – it only proposes steps. */
export interface PlanStep {
  tool: ToolName;
  params: ToolParams;
  /** Short explanation why this step is needed (shown to the user). */
  reason: string;
}

export interface AgentPlan {
  goal: string;
  steps: PlanStep[];
}

export type StepStatus =
  | 'pending'
  | 'awaiting_confirmation'
  | 'running'
  | 'done'
  | 'failed'
  | 'rejected';

export interface StepExecution {
  step: PlanStep;
  status: StepStatus;
  result?: ToolResult;
}

/** Passed to the confirmation dialog before a risky tool runs. */
export interface ConfirmationRequest {
  tool: ToolName;
  params: ToolParams;
  reason: string;
  /** Human-readable description of what is about to happen. */
  description: string;
}
