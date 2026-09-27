export const INVITE_RETURN_TO_KEY = 'rotless_invite_return_to';

export function rememberInviteReturnTo(path: string): void {
  try {
    sessionStorage.setItem(INVITE_RETURN_TO_KEY, path);
  } catch {
    // Ignore storage errors
  }
}

export function readInviteReturnTo(): string | null {
  try {
    return sessionStorage.getItem(INVITE_RETURN_TO_KEY);
  } catch {
    return null;
  }
}

export function clearInviteReturnTo(): void {
  try {
    sessionStorage.removeItem(INVITE_RETURN_TO_KEY);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Resolves where to send the user after auth: an explicit navigation state
 * wins, otherwise fall back to a remembered invite link.
 */
export function resolveReturnTo(stateReturnTo?: string): string | null {
  return stateReturnTo || readInviteReturnTo();
}
