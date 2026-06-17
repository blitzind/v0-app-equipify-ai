/** Edge middleware auth operation budget — avoids indefinite hangs on Supabase/portal I/O. */

export const MIDDLEWARE_AUTH_OPERATION_TIMEOUT_MS = 8_000

/**
 * Resolves the operation value, or `null` when the deadline elapses.
 * Callers decide fail-open vs fail-closed semantics.
 */
export async function raceMiddlewareAuthOperation<T>(
  operation: Promise<T>,
  timeoutMs = MIDDLEWARE_AUTH_OPERATION_TIMEOUT_MS,
): Promise<T | null> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      operation,
      new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => resolve(null), timeoutMs)
      }),
    ])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}
