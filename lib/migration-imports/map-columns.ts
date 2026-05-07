import type { MigrationImportKind } from "./types"

const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_")

/** Pick first header whose normalized form matches any alias. */
export function pickHeader(headers: string[], aliases: string[]): string | undefined {
  const set = new Set(headers.map((h) => norm(h)))
  for (const a of aliases) {
    const na = norm(a)
    for (const h of headers) {
      if (norm(h) === na) return h
    }
  }
  for (const h of headers) {
    const hn = norm(h)
    if (aliases.some((a) => norm(a) === hn)) return h
  }
  return undefined
}

export function suggestColumnMapping(kind: MigrationImportKind, headers: string[]): Record<string, string> {
  const m: Record<string, string> = {}
  const set = (field: string, aliases: string[]) => {
    const h = pickHeader(headers, aliases)
    if (h) m[field] = h
  }

  if (kind === "customer") {
    set("company_name", ["company_name", "company name", "company", "customer", "account_name"])
    set("external_code", ["external_code", "external id", "account_number", "account number", "legacy_id"])
    set("contact_full_name", ["contact_name", "contact name", "primary_contact", "contact"])
    set("contact_email", ["contact_email", "email", "portal_email"])
    set("contact_phone", ["contact_phone", "phone", "main_phone"])
    set("location_name", ["location_name", "site_name", "service_location"])
    set("address_line1", ["address_line1", "address 1", "street", "billing_address"])
    set("address_line2", ["address_line2", "address 2"])
    set("city", ["city"])
    set("state", ["state", "province", "region"])
    set("postal_code", ["postal_code", "zip", "zip_code"])
    set("notes", ["notes", "comments", "memo"])
    set("status", ["status"])
    set("tags", ["tags", "categories"])
    set("parent_external_code", ["parent_external_code", "parent_account", "parent_id"])
  }

  if (kind === "equipment") {
    set("name", ["equipment_name", "name", "asset_name"])
    set("serial_number", ["serial_number", "serial", "s_n"])
    set("customer_external_code", ["customer_external_code", "customer_id", "account_number"])
    set("customer_company", ["customer_company", "company_name", "customer"])
    set("manufacturer", ["manufacturer", "make"])
    set("category", ["category", "equipment_category"])
    set("install_date", ["install_date", "installed_on"])
    set("warranty_expires_at", ["warranty_expires", "warranty_end"])
    set("next_due_at", ["next_service", "next_due", "pm_due"])
    set("location_label", ["location_label", "site"])
    set("notes", ["notes"])
    set("subcategory", ["subcategory", "sub_category"])
    set("calibration_interval_months", ["calibration_interval_months", "cal_interval_months"])
    set("next_calibration_due_at", ["next_calibration_due", "next_calibration"])
  }

  if (kind === "invoice") {
    set("invoice_number", ["invoice_number", "invoice #", "inv_no"])
    set("customer_external_code", ["customer_external_code", "account_number"])
    set("customer_company", ["customer_company", "company"])
    set("equipment_serial", ["equipment_serial", "serial"])
    set("title", ["title", "memo", "description"])
    set("amount", ["amount", "total", "amount_dollars"])
    set("issued_at", ["issued_at", "invoice_date", "date"])
    set("due_date", ["due_date"])
    set("paid_at", ["paid_at", "payment_date"])
    set("status", ["status"])
    set("notes", ["notes"])
  }

  if (kind === "work_order") {
    set("title", ["title", "job_title", "description"])
    set("customer_external_code", ["customer_external_code", "account_number"])
    set("customer_company", ["customer_company"])
    set("equipment_serial", ["equipment_serial", "serial"])
    set("status", ["status"])
    set("priority", ["priority"])
    set("type", ["type", "job_type"])
    set("scheduled_on", ["scheduled_on", "service_date"])
    set("completed_at", ["completed_at", "completed_date"])
    set("technician_name", ["technician", "tech_name"])
    set("notes", ["notes"])
    set("legacy_invoice_number", ["invoice_number", "legacy_invoice"])
  }

  return m
}

export function resolveMapped(
  row: Record<string, string>,
  mapping: Record<string, string>,
  field: string,
): string {
  const header = mapping[field]
  if (!header) return ""
  return (row[header] ?? "").trim()
}
