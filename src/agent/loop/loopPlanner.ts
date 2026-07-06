import { MAX_AGENT_LOOP_STEPS } from '../../config/constants';
import type { AgentLoopDecision, AgentObservation } from '../../types/agent';
import { extractJsonObject } from '../../utils/json';
import { describeToolsForPrompt, isToolName } from '../tools';

/**
 * Prompt + parser for the Agent Loop (plan -> act -> observe -> replan).
 *
 * Unlike the static planner, the model decides exactly ONE next step at a
 * time and gets the tool result back as an observation before deciding again.
 * The output is still DATA (a single JSON decision), never executed code.
 */

export function buildLoopSystemPrompt(): string {
  return [
    'You are an autonomous agent inside a sandboxed Android app. You act step by step:',
    'you choose ONE tool to run, then you receive its result as an observation, then you',
    'choose the next tool or give a final answer. You never execute anything yourself.',
    '',
    'Hard safety rules (never break these):',
    '- Only use the tools listed below. Never invent tools or parameters.',
    '- You control ONLY the in-app WebView browser, the app sandbox and connected services',
    '  through the listed tools (for example Google Drive). No Android system control or other apps.',
    '- Never type or store passwords, API keys, tokens, banking or credit card data.',
    '- Never automatically submit forms for logins, purchases, payments, contracts,',
    '  cancellations, job applications or any legally binding action. submit_form is RISKY',
    '  and always needs the user to confirm; plan it only when truly required.',
    '- Do not bypass captchas, login walls or paywalls, and do not scrape behind them.',
    '- Do not use the browser for illegal or harmful purposes.',
    '- Plan RISKY tools only when necessary; the user confirms them before they run.',
    '- If you are unsure or lack access, stop and give a final answer explaining what is',
    '  missing instead of guessing.',
    '',
    'Browser research usually follows this pattern:',
    '  open_url -> wait_for_page -> browser_get_state -> read_page -> then, depending on the content:',
    '  click_element / type_text / submit_form / scroll_page / go_back -> wait_for_page -> browser_get_state -> read_page.',
    'wait_for_page and browser_get_state use native WebView state and do not inject JavaScript.',
    'read_page returns the visible text, headings, links, buttons and input fields.',
    'If read_page times out or fails, do not repeat it endlessly. Use browser_get_state,',
    'optionally wait_for_page once more with a longer wait, optionally stop_loading if the',
    'page keeps loading, then try read_page once. If it still fails, explain honestly that',
    'the page is open but DOM reading is not available and summarize the native state.',
    'Do not claim the site blocks DOM access unless lastError or lastHttpError supports that.',
    'If a web_search tool is listed, prefer it for current news/search tasks. If no such',
    'tool exists, use the in-app browser only; DuckDuckGo Lite URLs are a reasonable fallback.',
    '',
    'Available tools:',
    describeToolsForPrompt(),
    '',
    `You have at most ${MAX_AGENT_LOOP_STEPS} tool steps. Be efficient.`,
    '',
    'Respond with ONLY one JSON object. No markdown fences, no text around it.',
    'To run a tool:',
    '{ "type": "tool", "tool": "<tool name>", "params": { ... }, "reason": "<short reason in the user\'s language>" }',
    'To finish with the answer for the user:',
    '{ "type": "final", "answer": "<final answer in the user\'s language>" }',
  ].join('\n');
}

/** Compact observation history fed back to the model each iteration. */
export function buildObservationsMessage(observations: AgentObservation[]): string {
  if (observations.length === 0) {
    return 'No observations yet. Decide the first step.';
  }
  const MAX_OUTPUT = 1800;
  const blocks = observations.map((obs, index) => {
    let output = obs.output ?? '';
    if (output.length > MAX_OUTPUT) {
      output = `${output.slice(0, MAX_OUTPUT)} ...[truncated]`;
    }
    return [
      `Observation ${index + 1}:`,
      `Tool: ${obs.tool}`,
      `Result: ${obs.ok ? 'ok' : 'error'}`,
      `Output:\n${output}`,
    ].join('\n');
  });
  return [
    'Observations so far (oldest first):',
    '',
    blocks.join('\n\n'),
    '',
    'Decide the next tool step, or give the final answer if the task is done.',
  ].join('\n');
}

export function parseLoopDecision(modelResponse: string): AgentLoopDecision {
  const raw = extractJsonObject(modelResponse);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Model response is not valid JSON.');
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Decision must be a JSON object.');
  }
  const candidate = parsed as {
    type?: unknown;
    tool?: unknown;
    params?: unknown;
    reason?: unknown;
    answer?: unknown;
  };

  if (candidate.type === 'final') {
    if (typeof candidate.answer !== 'string' || candidate.answer.trim().length === 0) {
      throw new Error('Final decision is missing a non-empty "answer".');
    }
    return { type: 'final', answer: candidate.answer };
  }

  if (candidate.type === 'tool') {
    if (typeof candidate.tool !== 'string' || !isToolName(candidate.tool)) {
      throw new Error(`Decision uses an unknown tool: "${String(candidate.tool)}".`);
    }
    const params =
      typeof candidate.params === 'object' &&
      candidate.params !== null &&
      !Array.isArray(candidate.params)
        ? (candidate.params as Record<string, unknown>)
        : {};
    const reason = typeof candidate.reason === 'string' ? candidate.reason : '';
    return { type: 'tool', tool: candidate.tool, params, reason };
  }

  throw new Error('Decision "type" must be "tool" or "final".');
}
