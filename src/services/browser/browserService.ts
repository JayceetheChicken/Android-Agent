import { ALLOWED_URL_PROTOCOLS, BROWSER_HOME_URL } from '../../config/constants';

/**
 * Bridge between the agent's browser tools and the WebView on the Browser screen.
 *
 * The agent never talks to the WebView directly. It enqueues commands here;
 * the Browser screen subscribes and applies them to its WebView. The screen
 * reports navigation state back so tools like read_page know where we are.
 *
 * DOM interaction (click_element, type_text, submit_form, screenshots) is
 * NOT implemented yet – see docs/TASKS.md.
 */

export type BrowserCommand = { type: 'open_url'; url: string } | { type: 'go_back' };

export interface BrowserState {
  currentUrl: string;
  currentTitle: string;
  canGoBack: boolean;
}

type Listener = (command: BrowserCommand) => void;

const state: BrowserState = {
  currentUrl: BROWSER_HOME_URL,
  currentTitle: '',
  canGoBack: false,
};

const listeners = new Set<Listener>();

export function validateUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error(`Invalid URL: "${rawUrl}"`);
  }
  if (!ALLOWED_URL_PROTOCOLS.includes(parsed.protocol as (typeof ALLOWED_URL_PROTOCOLS)[number])) {
    throw new Error(`Only ${ALLOWED_URL_PROTOCOLS.join(', ')} URLs are allowed.`);
  }
  return parsed.toString();
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(command: BrowserCommand): void {
  for (const listener of listeners) {
    listener(command);
  }
}

/** Called by the open_url tool (after user confirmation). */
export function requestOpenUrl(rawUrl: string): string {
  const url = validateUrl(rawUrl);
  emit({ type: 'open_url', url });
  return url;
}

/** Called by the go_back tool. */
export function requestGoBack(): void {
  emit({ type: 'go_back' });
}

/** Called by the Browser screen on navigation changes. */
export function reportNavigation(update: Partial<BrowserState>): void {
  Object.assign(state, update);
}

export function getState(): BrowserState {
  return { ...state };
}
