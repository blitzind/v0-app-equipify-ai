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
    set("source_record_id", ["fieldpulse_id", "fieldpulse customer id", "customer id", "record id", "source id"])
    set("company_name", [
      "company_name",
      "company name",
      "company",
      "customer",
      "account_name",
      "customer name",
      "client name",
      "display_name",
      "display name",
    ])
    set("external_code", [
      "external_code",
      "external id",
      "external_id",
      "account_number",
      "account number",
      "legacy_id",
      "customer_id",
      "fieldpulse_id",
      "fieldpulse customer id",
      "external_customer_id",
    ])
    set("contact_full_name", [
      "contact_name",
      "contact name",
      "primary_contact",
      "contact",
      "contact person",
      "primary_contact_full_name",
      "primary contact",
    ])
    set("contact_email", [
      "contact_email",
      "email",
      "portal_email",
      "primary_email",
      "email address",
      "primary_contact_email",
    ])
    set("contact_phone", [
      "contact_phone",
      "phone",
      "main_phone",
      "primary_phone",
      "mobile",
      "phone number",
      "primary_contact_phone",
    ])
    set("billing_name", ["billing_name", "billing name", "bill_to", "bill to", "invoice_name"])
    set("billing_contact_name", ["billing_contact_name", "billing contact", "ap_contact", "accounts payable contact"])
    set("billing_contact_email", ["billing_contact_email", "billing_email", "ap_email", "accounts payable email"])
    set("billing_contact_phone", ["billing_contact_phone", "billing_phone", "ap_phone", "accounts payable phone"])
    set("billing_address_line_1", [
      "billing_address_line_1",
      "billing_address_line1",
      "billing address 1",
      "bill_to_address",
      "bill to address",
    ])
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
    set("service_address_line1", [
      "service_address_line1",
      "service address 1",
      "ship_to_address",
      "site_address",
      "service_address_line_1",
    ])
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
    set("default_payment_terms_key", ["default_payment_terms_key", "payment_terms", "payment terms", "terms", "invoice_terms", "default_terms"])
    set("default_payment_terms_days", ["default_payment_terms_days", "payment_terms_days", "terms_days", "net_days"])
    set("default_payment_terms_label", ["default_payment_terms_label", "payment_terms_label", "terms_label"])
    set("tax_exempt", ["tax_exempt", "tax exempt", "exempt", "resale_certificate", "exemption"])
    set("customer_type", ["customer_type", "account type", "customer type"])
    set("tax_exemption_id", ["tax_exemption_id", "tax exemption id", "exemption_id", "certificate_id"])
    set("tax_exemption_notes", ["tax_exemption_notes", "tax exemption notes", "tax_notes", "exemption_notes"])
    set("default_tax_basis", ["default_tax_basis", "tax_basis", "tax basis"])
    set("legacy_source_ids", ["legacy_source_ids", "legacy source ids", "source_ids", "source ids", "quickbooks_id", "fieldpulse_id", "jobber_id"])
    set("status", ["status"])
    set("tags", ["tags", "categories"])
    set("parent_external_code", ["parent_external_code", "parent_account", "parent_id"])
    set("parent_company_name", ["parent_company_name", "parent company", "parent_customer"])
    set("location_group", ["location_group", "site_group", "region_group"])
  }

  if (kind === "equipment") {
    set("source_record_id", ["fieldpulse_asset_id", "fieldpulse asset id", "asset id", "equipment id", "record id", "source id"])
    set("name", ["equipment_name", "name", "asset_name", "asset name", "unit name"])
    set("equipment_code", [
      "equipment_code",
      "asset_code",
      "asset_id",
      "external_equipment_id",
      "fieldpulse_asset_id",
      "fieldpulse asset id",
      "asset_tag",
    ])
    set("serial_number", ["serial_number", "serial", "s_n", "serial no", "serial number"])
    set("customer_external_code", [
      "customer_external_code",
      "customer_id",
      "fieldpulse_customer_id",
      "fieldpulse customer id",
      "account_number",
      "external_customer_id",
    ])
    set("customer_company", [
      "customer_company",
      "company_name",
      "customer",
      "customer name",
      "client",
      "customer_company_name",
    ])
    set("manufacturer", ["manufacturer", "make", "brand"])
    set("category", ["category", "equipment_category", "asset category", "equipment type"])
    set("install_date", ["install_date", "installed_on", "installation date"])
    set("warranty_expires_at", ["warranty_expires", "warranty_end", "warranty expiration", "warranty expires"])
    set("next_due_at", ["next_service", "next_due", "pm_due", "next service date", "next_service_due"])
    set("location_label", [
      "location_label",
      "site",
      "location",
      "service location",
      "location_name",
      "room_or_area",
    ])
    set("notes", ["notes", "asset notes"])
    set("subcategory", ["subcategory", "sub_category", "model"])
    set("calibration_interval_months", ["calibration_interval_months", "cal_interval_months"])
    set("next_calibration_due_at", [
      "next_calibration_due",
      "next_calibration",
      "calibration due",
      "next calibration date",
    ])
  }

  if (kind === "invoice") {
    set("source_record_id", [
      "fieldpulse_invoice_id",
      "fieldpulse invoice id",
      "invoice id",
      "record id",
      "source id",
      "external_invoice_id",
    ])
    set("invoice_number", ["invoice_number", "invoice #", "inv_no", "invoice no", "number"])
    set("customer_external_code", [
      "customer_external_code",
      "fieldpulse_customer_id",
      "fieldpulse customer id",
      "customer_id",
      "account_number",
      "external_customer_id",
    ])
    set("customer_company", [
      "customer_company",
      "company",
      "customer",
      "customer name",
      "client",
      "customer_company_name",
    ])
    set("equipment_serial", [
      "equipment_serial",
      "serial",
      "asset serial",
      "equipment_asset_tag",
      "equipment_serial_number",
    ])
    set("work_order_number", [
      "fieldpulse_job_id",
      "fieldpulse job id",
      "job_id",
      "work_order_number",
      "work order number",
      "external_work_order_id",
    ])
    set("title", [
      "title",
      "memo",
      "description",
      "summary",
      "line_item_name",
      "line_item_description",
    ])
    set("amount", [
      "amount",
      "total",
      "amount_dollars",
      "invoice total",
      "total amount",
      "subtotal",
    ])
    set("balance", ["balance", "amount_due", "amount due"])
    set("issued_at", ["issued_at", "invoice_date", "date", "invoice date"])
    set("due_date", ["due_date", "due date"])
    set("paid_at", ["paid_at", "payment_date", "paid date"])
    set("status", ["status", "invoice status"])
    set("notes", ["notes", "private notes", "customer memo"])
  }

  if (kind === "work_order") {
    set("source_record_id", [
      "fieldpulse_job_id",
      "fieldpulse appointment id",
      "fieldpulse job id",
      "job_id",
      "appointment_id",
      "record id",
      "source id",
      "external_appointment_id",
      "external_work_order_id",
    ])
    set("work_order_number", [
      "work_order_number",
      "wo_number",
      "job_number",
      "job id",
      "fieldpulse_job_id",
      "appointment_id",
    ])
    set("title", [
      "title",
      "job_title",
      "description",
      "summary",
      "appointment title",
      "service_summary",
      "appointment_title",
    ])
    set("customer_external_code", [
      "customer_external_code",
      "fieldpulse_customer_id",
      "fieldpulse customer id",
      "customer_id",
      "account_number",
      "external_customer_id",
    ])
    set("customer_company", [
      "customer_company",
      "customer",
      "customer name",
      "client",
      "customer_company_name",
    ])
    set("equipment_serial", [
      "equipment_serial",
      "serial",
      "asset serial",
      "equipment_asset_tag",
      "equipment_serial_number",
    ])
    set("status", ["status", "job status", "appointment status"])
    set("priority", ["priority"])
    set("type", ["type", "job_type", "service type", "appointment_type"])
    set("scheduled_on", [
      "scheduled_on",
      "service_date",
      "scheduled date",
      "appointment start",
      "start date",
      "start time",
      "scheduled_start",
    ])
    set("completed_at", ["completed_at", "completed_date", "completion date", "closed date"])
    set("technician_name", ["technician", "tech_name", "assigned technician", "assigned_technician"])
    set("notes", ["notes", "internal notes", "appointment notes", "problem_description"])
    set("legacy_invoice_number", ["invoice_number", "legacy_invoice", "fieldpulse_invoice_id"])
  }

  if (kind === "quote") {
    set("source_record_id", ["external_quote_id", "quote id", "record id", "source id"])
    set("quote_number", ["quote_number", "quote #", "estimate number", "estimate_number"])
    set("customer_external_code", ["external_customer_id", "customer_external_code", "fieldpulse_customer_id", "customer_id"])
    set("customer_company", ["customer_company_name", "customer_company", "company", "customer", "customer name"])
    set("work_order_number", ["external_work_order_id", "work_order_number", "job id"])
    set("quote_date", ["quote_date", "issued_at", "date"])
    set("expiration_date", ["expiration_date", "due_date", "valid_until"])
    set("accepted_at", ["accepted_at", "accepted date"])
    set("declined_at", ["declined_at", "declined date"])
    set("status", ["status"])
    set("subtotal", ["subtotal"])
    set("tax", ["tax"])
    set("discount", ["discount"])
    set("total", ["total", "amount"])
    set("line_item_name", ["line_item_name"])
    set("line_item_description", ["line_item_description"])
    set("line_item_quantity", ["line_item_quantity"])
    set("line_item_unit_price", ["line_item_unit_price"])
    set("notes", ["notes"])
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
