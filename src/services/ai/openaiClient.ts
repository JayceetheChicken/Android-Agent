import type { AISettings } from '../../types/settings';

/**
 * Minimal client for any OpenAI-compatible API (POST {baseUrl}/chat/completions).
 * Works with OpenAI, OpenRouter, Ollama, LM Studio, vLLM, etc.
 */

export interface CompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
}

export async function chatCompletion(
  settings: AISettings,
  messages: CompletionMessage[],
): Promise<string> {
  if (!settings.apiKey) {
    throw new Error('No API key configured. Please set one in Settings.');
  }
  if (!settings.baseUrl) {
    throw new Error('No base URL configured. Please set one in Settings.');
  }

  const url = `${settings.baseUrl.replace(/\/+$/, '')}/chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      messages,
    }),
  });

  const raw = await response.text();
  let parsed: ChatCompletionResponse;
  try {
    parsed = JSON.parse(raw) as ChatCompletionResponse;
  } catch {
    throw new Error(`API returned invalid JSON (HTTP ${response.status}).`);
  }

  if (!response.ok) {
    const message = parsed.error?.message ?? raw.slice(0, 200);
    throw new Error(`API error (HTTP ${response.status}): ${message}`);
  }

  const content = parsed.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.length === 0) {
    throw new Error('API response contained no message content.');
  }
  return content;
}
