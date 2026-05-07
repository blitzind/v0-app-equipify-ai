import "server-only"

/**
 * Leads + Follow-Up Phase 1 — server-side request helpers.
 *
 * Validators for prospect API routes. Pulled out of the individual route
 * files so list/create/update/follow-up handlers all enforce the same
 * shape and the route modules stay confined to HTTP exports (Next.js
 * complains if you `export` arbitrary symbols from `route.ts`).
 */

export function optionalString(value: unknown, maxLength = 4000): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed.slice(0, maxLength)
}

export function parseOptionalIso(value: unknown): string | null | "invalid" {
  if (value === undefined || value === null) return null
  if (typeof value !== "string") return "invalid"
  const trimmed = value.trim()
  if (!trimmed) return null
  const ts = Date.parse(trimmed)
  if (Number.isNaN(ts)) return "invalid"
  return new Date(ts).toISOString()
}

export function parseOptionalCents(value: unknown): number | null | "invalid" {
  if (value === undefined || value === null || value === "") return null
  if (typeof value !== "number" || !Number.isFinite(value)) return "invalid"
  if (value < 0) return "invalid"
  return Math.round(value)
}

export const PROSPECT_SELECT_COLUMNS =
  "id, organization_id, company_name, contact_name, contact_email, contact_phone, lead_source, status, next_follow_up_at, last_contacted_at, estimated_value_cents, notes, converted_customer_id, converted_at, archived_at, created_at, updated_at"
