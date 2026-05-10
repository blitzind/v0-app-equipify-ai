import type { PostgrestError } from "@supabase/supabase-js"

const HIERARCHY_KEYS = [
  "parent_customer_id",
  "billing_location_id",
  "billing_address_same_as_service",
  "billing_name",
  "billing_attention",
  "billing_contact_name",
  "billing_email",
  "billing_contact_phone",
  "billing_address_line1",
  "billing_address_line2",
  "billing_city",
  "billing_state",
  "billing_postal_code",
  "billing_country",
  "billing_notes",
  "billing_behavior",
  "po_required",
  "po_number_required_before_service",
  "po_number_required_before_invoice",
  "default_po_number",
  "invoice_delivery_preference",
  "invoice_instructions",
  "default_payment_terms_key",
  "default_payment_terms_days",
  "default_payment_terms_label",
  "tax_exempt",
  "tax_exemption_id",
  "tax_exemption_notes",
  "default_tax_basis",
  "default_tax_category",
] as const

/**
 * True when the customer hierarchy / billing-address columns introduced in
 * `20260721120000_customer_hierarchy_phase1.sql` are missing. Used by client
 * code to fall back to the legacy customer select on local/dev DBs that have
 * not been migrated yet.
 */
export function missingCustomerHierarchyColumns(
  error: PostgrestError | null | undefined,
): boolean {
  if (!error) return false
  const m = (error.message ?? "").toLowerCase()
  if (!HIERARCHY_KEYS.some((k) => m.includes(k))) return false
  if (error.code === "42703") return true
  return m.includes("does not exist") || m.includes("could not find")
}

/**
 * True when the read-only `customer_hierarchy_summary` view does not exist on
 * the database (migration not applied). Lets callers degrade gracefully and
 * compute counts client-side from already-loaded rows.
 */
export function missingCustomerHierarchyView(
  error: PostgrestError | null | undefined,
): boolean {
  if (!error) return false
  const m = (error.message ?? "").toLowerCase()
  if (!m.includes("customer_hierarchy_summary")) return false
  if (error.code === "42P01") return true // undefined_table
  return m.includes("does not exist") || m.includes("could not find")
}
