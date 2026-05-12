import "server-only"

function clampInt(n: number, lo: number, hi: number): number {
  const x = Math.round(Number(n))
  if (!Number.isFinite(x)) return lo
  return Math.min(hi, Math.max(lo, x))
}

/** Deterministic ordering for sync processing (id tie-break). */
export function orderMobileIntentIdsForSync(ids: ReadonlyArray<string>): string[] {
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b))
}

/**
 * Conflict when client claims an older snapshot than server `updated_at`.
 * Pass serverUpdatedAtIso from DB and clientKnownUpdatedAtIso from client metadata (optional).
 */
export function detectMobileIntentSyncConflict(serverUpdatedAtIso: string, clientKnownUpdatedAtIso: string | null): boolean {
  if (!clientKnownUpdatedAtIso?.trim()) return false
  const a = Date.parse(serverUpdatedAtIso)
  const b = Date.parse(clientKnownUpdatedAtIso)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false
  return a > b
}

export function mobileSyncFailureRate0to100(processed: number, failed: number): number {
  const p = Math.max(0, Math.round(processed))
  const f = Math.max(0, Math.round(failed))
  const t = p + f
  if (t === 0) return 0
  return clampInt(Math.round((f * 100) / t), 0, 100)
}
