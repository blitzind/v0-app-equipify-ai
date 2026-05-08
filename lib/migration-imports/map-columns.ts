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
    set("external_code", ["external_code", "external id", "external_id", "account_number", "account number", "legacy_id", "customer_id"])
    set("contact_full_name", ["contact_name", "contact name", "primary_contact", "contact"])
    set("contact_email", ["contact_email", "email", "portal_email", "primary_email"])
    set("contact_phone", ["contact_phone", "phone", "main_phone", "primary_phone", "mobile"])
    set("billing_name", ["billing_name", "billing name", "bill_to", "bill to", "invoice_name"])
    set("billing_contact_name", ["billing_contact_name", "billing contact", "ap_contact", "accounts payable contact"])
    set("billing_contact_email", ["billing_contact_email", "billing_email", "ap_email", "accounts payable email"])
    set("billing_contact_phone", ["billing_contact_phone", "billing_phone", "ap_phone", "accounts payable phone"])
    set("billing_address_line_1", ["billing_address_line_1", "billing_address_line1", "billing address 1", "bill_to_address", "bill to address"])
    set("billing_address_line_2", ["billing_address_line_2", "billing_address_line2", "billing address 2", "bill_to_address_2"])
    set("billing_city", ["billing_city", "bill_to_city"])
    set("billing_state", ["billing_state", "bill_to_state", "billing_province"])
    set("billing_postal_code", ["billing_postal_code", "billing_zip", "billing zip", "bill_to_zip"])
    set("billing_country", ["billing_country", "bill_to_country"])
    set("location_name", ["location_name", "site_name", "service_location"])
    set("address_line1", ["address_line1", "address 1", "street", "billing_address", "billing address", "service_address", "service address"])
    set("address_line2", ["address_line2", "address 2", "suite", "unit"])
    set("city", ["city", "billing_city", "service_city"])
    set("state", ["state", "province", "region", "billing_state", "service_state"])
    set("postal_code", ["postal_code", "zip", "zip_code", "billing_zip", "service_zip"])
    set("country", ["country", "billing_country"])
    set("service_address_line1", ["service_address_line1", "service address 1", "ship_to_address", "site_address"])
    set("service_address_line2", ["service_address_line2", "service address 2", "ship_to_address_2"])
    set("service_city", ["service_city", "site_city", "ship_to_city"])
    set("service_state", ["service_state", "site_state", "ship_to_state"])
    set("service_postal_code", ["service_postal_code", "service_zip", "site_zip", "ship_to_zip"])
    set("service_country", ["service_country", "site_country", "ship_to_country"])
    set("notes", ["notes", "comments", "memo"])
    set("tax_id", ["tax_id", "tax id", "ein", "vat"])
    set("po_requirements", ["po_requirements", "po requirements", "purchase_order_required", "po required"])
    set("po_required", ["po_required", "po required", "purchase_order_required"])
    set("default_po_number", ["default_po_number", "default po", "po_number", "purchase_order_number"])
    set("invoice_instructions", ["invoice_instructions", "invoice instructions", "billing_instructions", "billing instructions"])
    set("billing_behavior", ["billing_behavior", "billing mode", "billing_type"])
    set("legacy_source_ids", ["legacy_source_ids", "legacy source ids", "source_ids", "source ids", "quickbooks_id", "fieldpulse_id", "jobber_id"])
    set("status", ["status"])
    set("tags", ["tags", "categories"])
    set("parent_external_code", ["parent_external_code", "parent_account", "parent_id"])
    set("parent_company_name", ["parent_company_name", "parent company", "parent_customer"])
    set("location_group", ["location_group", "site_group", "region_group"])
  }

  if (kind === "equipment") {
    set("name", ["equipment_name", "name", "asset_name"])
    set("equipment_code", ["equipment_code", "asset_code", "asset_id", "external_equipment_id"])
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
    set("work_order_number", ["work_order_number", "wo_number", "job_number"])
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
