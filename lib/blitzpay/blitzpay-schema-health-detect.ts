/**
 * Pure helpers for BlitzPay / PostgREST schema drift detection (no `server-only` — safe for scripts).
 */

export const BLITZPAY_SCHEMA_DRIFT_PUBLIC_MESSAGE =
  "BlitzPay needs a database update before this section can load."

/** Narrow heuristics for missing table/column vs application bugs — used by health probes and tests. */
export function looksLikePostgrestMissingSchemaError(message: string, code?: string): boolean {
  const m = message.toLowerCase()
  if (code === "42P01" || code === "PGRST205") return true
  if (m.includes("schema cache") && m.includes("could not find")) return true
  if (m.includes("does not exist") && (m.includes("relation") || m.includes("column"))) return true
  if (code === "42703") return true
  return false
}
