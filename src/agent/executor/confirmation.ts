import type { ConfirmationRequest } from '../../types/agent';

/**
 * Confirmation bridge between the Tool-Executor and the UI.
 *
 * The executor never renders UI itself. Instead, the Agent screen registers a
 * handler (backed by ConfirmActionModal) and the executor awaits the user's
 * decision through it. If no handler is registered, risky tools FAIL CLOSED –
 * they are never executed silently.
 */
export type ConfirmationHandler = (request: ConfirmationRequest) => Promise<boolean>;

let handler: ConfirmationHandler | null = null;

export function setConfirmationHandler(next: ConfirmationHandler | null): void {
  handler = next;
}

export async function requestConfirmation(request: ConfirmationRequest): Promise<boolean> {
  if (!handler) {
    // Fail closed: without a UI handler, risky actions are always denied.
    return false;
  }
  return handler(request);
}
