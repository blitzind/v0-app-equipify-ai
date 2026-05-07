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
export function missingOperationalBillingColumns(error: PostgrestError | null | undefined): boolean {
  if (!error) return false
  const m = (error.message ?? "").toLowerCase()
  if (!OPERATIONAL_BILLING_KEYS.some((k) => m.includes(k))) return false
  if (error.code === "42703") return true
  return m.includes("does not exist") || m.includes("could not find")
}
