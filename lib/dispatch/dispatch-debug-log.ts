/**
 * Client-safe dev logs for dispatch / assignee loading (no secrets).
 * Enable with `NEXT_PUBLIC_DEBUG_NAV=true` or `NEXT_PUBLIC_DEBUG_DISPATCH=true`.
 */
export function isEquipifyDispatchDebug(): boolean {
  return (
    process.env.NEXT_PUBLIC_DEBUG_DISPATCH === "true" ||
    process.env.NEXT_PUBLIC_DEBUG_NAV === "true"
  )
}

export function equipifyDispatchDebugLog(
  event: string,
  payload: Record<string, string | number | boolean | null | undefined>,
): void {
  if (!isEquipifyDispatchDebug()) return
  if (typeof console === "undefined" || typeof console.info !== "function") return
  console.info(`[equipify:dispatch] ${event}`, payload)
}

export function sanitizeUserFacingLoadError(raw: unknown): string {
  const msg = raw instanceof Error ? raw.message : typeof raw === "string" ? raw : ""
  const trimmed = msg.replace(/\s+/g, " ").trim().slice(0, 280)
  if (!trimmed) return "Dispatch could not load. Try again or contact support."
  const low = trimmed.toLowerCase()
  if (low.includes("jwt") || low.includes("invalid refresh")) {
    return "Session expired. Refresh the page and sign in again."
  }
  return trimmed
}
