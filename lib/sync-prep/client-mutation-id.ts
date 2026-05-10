/**
 * Generate a client-owned id for idempotent retries / future queue deduplication.
 * Safe to call from the browser; does not persist anything.
 */
export function createClientMutationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `cm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`
}
