import type { PostgrestError } from "@supabase/supabase-js"

/** True when PostgREST/Postgres reports the work_order_number column is missing (migration not applied). */
export function missingWorkOrderNumberColumn(error: PostgrestError | null | undefined): boolean {
  if (!error) return false
  const m = (error.message ?? "").toLowerCase()
  if (!m.includes("work_order_number")) return false
  if (error.code === "42703") return true
  return m.includes("does not exist") || m.includes("could not find")
}

/** True when `assigned_technician_id` column is missing (migration not applied). */
export function missingAssignedTechnicianColumn(error: PostgrestError | null | undefined): boolean {
  if (!error) return false
  const m = (error.message ?? "").toLowerCase()
  if (!m.includes("assigned_technician_id")) return false
  if (error.code === "42703") return true
  return m.includes("does not exist") || m.includes("could not find")
}

const OPERATIONAL_BILLING_KEYS = [
  "billing_state",
  "billable_to_customer",
  "warranty_review_required",
  "warranty_vendor_id",
] as const

/** Service lifecycle / warranty columns not present until migrations are applied. */
/** `updated_at` on `work_orders` (used for offline sync conflict detection). */
export function missingWorkOrderUpdatedAtColumn(error: PostgrestError | null | undefined): boolean {
  if (!error) return false
  const m = (error.message ?? "").toLowerCase()
  if (!m.includes("updated_at")) return false
  if (error.code === "42703") return true
  return m.includes("does not exist") || m.includes("could not find")
}

export function missingOperationalBillingColumns(error: PostgrestError | null | undefined): boolean {
  if (!error) return false
  const m = (error.message ?? "").toLowerCase()
  if (!OPERATIONAL_BILLING_KEYS.some((k) => m.includes(k))) return false
  if (error.code === "42703") return true
  return m.includes("does not exist") || m.includes("could not find")
}

/**
 * True when the portal certificate release column is missing on
 * `calibration_records` (i.e. migration `20260506120000_portal_certificate_release_phase1.sql`
 * has not been applied yet on this database). Used to soft-fall back the
 * Completed Certificates query on local/dev DBs that haven't been migrated.
 */
export function missingPortalReleasedAtColumn(error: PostgrestError | null | undefined): boolean {
  if (!error) return false
  const m = (error.message ?? "").toLowerCase()
  if (!m.includes("portal_released_at")) return false
  if (error.code === "42703") return true
  return m.includes("does not exist") || m.includes("could not find")
}
