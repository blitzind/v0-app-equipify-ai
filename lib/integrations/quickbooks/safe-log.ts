import "server-only"

/** JWT-like fragments (never log verbatim). */
const JWT_LIKE = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g
const BEARER = /Bearer\s+[^\s"']+/gi

/**
 * Strip patterns that sometimes appear in mis-routed errors before persisting or returning to clients.
 * Does not remove Intuit fault summaries (safe, human-readable).
 */
export function sanitizeQuickBooksClientMessage(message: string, maxLen = 900): string {
  let s = message.slice(0, Math.min(message.length, maxLen * 3))
  s = s.replace(JWT_LIKE, "[redacted]")
  s = s.replace(BEARER, "Bearer [redacted]")
  s = s.replace(/refresh[_-]?token\s*[:=]\s*\S+/gi, "refresh_token=[redacted]")
  return s.slice(0, maxLen)
}

export type QuickBooksStructuredLogKind =
  | "sync_export_started"
  | "sync_export_completed"
  | "sync_import_started"
  | "sync_import_completed"
  | "sync_export_failed"
  | "sync_import_failed"
  | "token_refresh_failed"

/** Server logs only — no tokens, realm IDs, or response bodies. */
export function logQuickBooksIntegrationEvent(payload: {
  kind: QuickBooksStructuredLogKind
  organizationId: string
  syncLogId?: string
  syncKind?: string
  status?: string
  recordsAttempted?: number
  recordsSucceeded?: number
  code?: string
  message?: string
}): void {
  console.info(
    JSON.stringify({
      kind: "quickbooks_integration",
      at: new Date().toISOString(),
      ...payload,
      message: payload.message ? sanitizeQuickBooksClientMessage(payload.message, 500) : undefined,
    }),
  )
}
