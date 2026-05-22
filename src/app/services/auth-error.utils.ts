/**
 * Returns true when a `/session/validate` failure should be treated as a
 * terminal auth failure that clears auth state and redirects to login.
 */
export function isTerminalSessionValidationFailure(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  return status === 401 || status === 422;
}
