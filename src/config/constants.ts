/** Name of the sandbox directory inside the app's private document directory. */
export const SANDBOX_DIR_NAME = 'sandbox';

/** Defaults for the OpenAI-compatible API. Never put real keys here! */
export const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
export const DEFAULT_MODEL = 'gpt-4o-mini';

/** Storage keys. */
export const STORAGE_KEYS = {
  /** SecureStore (encrypted) */
  apiKey: 'ai_api_key',
  /** AsyncStorage */
  baseUrl: 'ai_base_url',
  model: 'ai_model',
  userMemory: 'user_memory',
} as const;

/** Hard limit so a single plan can never run away. */
export const MAX_PLAN_STEPS = 10;

/** The mini browser only opens these protocols. */
export const ALLOWED_URL_PROTOCOLS = ['https:'] as const;

export const BROWSER_HOME_URL = 'https://example.com';
