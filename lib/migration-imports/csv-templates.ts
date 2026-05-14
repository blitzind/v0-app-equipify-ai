/**
 * Static UTF-8 CSV templates for FieldPulse / historical migration downloads.
 * Example rows only — no tenant data. Used by migration-imports template route.
 */

export const UTF8_BOM = "\uFEFF"

export type CsvTemplateDownloadKind =
  | "customer"
  | "equipment"
  | "work_order"
  | "appointment"
  | "invoice"
  | "quote"

export const CSV_TEMPLATE_FILENAMES: Record<CsvTemplateDownloadKind, string> = {
  customer: "equipify-customers-import-template.csv",
  equipment: "equipify-equipment-assets-import-template.csv",
  work_order: "equipify-work-orders-import-template.csv",
  appointment: "equipify-appointments-import-template.csv",
  invoice: "equipify-invoices-import-template.csv",
  quote: "equipify-quotes-import-template.csv",
}

function csvLine(cells: string[]): string {
  return cells
    .map((c) => {
      const s = c ?? ""
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    })
    .join(",")
}

/** Header + one example row (biomedical / equipment service examples). */
export function buildCsvTemplateContent(kind: CsvTemplateDownloadKind): string {
  switch (kind) {
    case "customer": {
      const headers = [
        "company_name",
        "display_name",
        "primary_contact_first_name",
        "primary_contact_last_name",
        "primary_contact_email",
        "primary_contact_phone",
        "billing_email",
        "billing_phone",
        "service_address_line_1",
        "service_address_line_2",
        "service_city",
        "service_state",
        "service_postal_code",
        "billing_address_line_1",
        "billing_address_line_2",
        "billing_city",
        "billing_state",
        "billing_postal_code",
        "customer_type",
        "payment_terms",
        "tax_exempt",
        "notes",
        "external_customer_id",
      ]
      const row = [
        "Precision Biomedical Imaging LLC",
        "Precision Biomedical — Main Campus",
        "Jordan",
        "Lee",
        "jordan.lee@precisionbio.example",
        "+1-555-010-4421",
        "ap@precisionbio.example",
        "+1-555-010-4400",
        "1200 Clinical Research Drive",
        "Suite 300",
        "Durham",
        "NC",
        "27710",
        "PO Box 1840",
        "",
        "Durham",
        "NC",
        "27710",
        "Commercial",
        "Net 30",
        "false",
        "MRI suite; FieldPulse customer ID preserved in external_customer_id.",
        "FP-CUST-88921",
      ]
      return [csvLine(headers), csvLine(row)].join("\n")
    }
    case "equipment": {
      const headers = [
        "customer_company_name",
        "location_name",
        "asset_name",
        "asset_tag",
        "serial_number",
        "manufacturer",
        "model",
        "category",
        "subcategory",
        "room_or_area",
        "install_date",
        "last_service_date",
        "next_service_due",
        "last_calibration_date",
        "next_calibration_due",
        "warranty_expiration",
        "notes",
        "external_equipment_id",
        "external_customer_id",
      ]
      const row = [
        "Precision Biomedical Imaging LLC",
        "Main Campus — Radiology",
        "Siemens MAGNETOM Vida 3T MRI",
        "MRI-3T-01",
        "SN-MAGVIDA-2019-88421",
        "Siemens Healthineers",
        "MAGNETOM Vida",
        "Diagnostic imaging",
        "MRI",
        "Radiology Suite B",
        "2019-03-15",
        "2025-01-08",
        "2025-07-08",
        "2024-12-10",
        "2025-12-10",
        "2027-03-15",
        "Annual PM + calibration; OEM coil inventory on site.",
        "FP-ASSET-44102",
        "FP-CUST-88921",
      ]
      return [csvLine(headers), csvLine(row)].join("\n")
    }
    case "work_order": {
      const headers = [
        "work_order_number",
        "customer_company_name",
        "location_name",
        "equipment_asset_tag",
        "equipment_serial_number",
        "service_summary",
        "problem_description",
        "job_type",
        "priority",
        "status",
        "assigned_technician",
        "scheduled_start",
        "scheduled_end",
        "completed_at",
        "labor_hours",
        "parts_total",
        "labor_total",
        "invoice_number",
        "notes",
        "external_work_order_id",
        "external_customer_id",
        "external_equipment_id",
      ]
      const row = [
        "18440",
        "Precision Biomedical Imaging LLC",
        "Main Campus — Radiology",
        "MRI-3T-01",
        "SN-MAGVIDA-2019-88421",
        "Quarterly PM and calibration verification",
        "Gradient coil warning after power event; verify specs before release.",
        "Preventive maintenance",
        "High",
        "Completed",
        "Alex Rivera",
        "2025-02-10T08:00:00",
        "2025-02-10T14:30:00",
        "2025-02-10T14:05:00",
        "5.5",
        "1240.00",
        "950.00",
        "INV-2025-0144",
        "FieldPulse job 99221; OEM case opened for coil inspection.",
        "FP-JOB-99221",
        "FP-CUST-88921",
        "FP-ASSET-44102",
      ]
      return [csvLine(headers), csvLine(row)].join("\n")
    }
    case "appointment": {
      const headers = [
        "appointment_id",
        "customer_company_name",
        "location_name",
        "work_order_number",
        "assigned_technician",
        "appointment_title",
        "appointment_type",
        "scheduled_start",
        "scheduled_end",
        "status",
        "notes",
        "external_appointment_id",
        "external_work_order_id",
        "external_customer_id",
      ]
      const row = [
        "APT-2025-03091",
        "Precision Biomedical Imaging LLC",
        "Main Campus — Radiology",
        "18440",
        "Alex Rivera",
        "MRI quarterly PM window",
        "On-site service",
        "2025-02-10T08:00:00",
        "2025-02-10T14:30:00",
        "Completed",
        "Access badge required; notify biomed lead 24h prior.",
        "FP-APT-33091",
        "FP-JOB-99221",
        "FP-CUST-88921",
      ]
      return [csvLine(headers), csvLine(row)].join("\n")
    }
    case "invoice": {
      const headers = [
        "invoice_number",
        "customer_company_name",
        "invoice_date",
        "due_date",
        "status",
        "subtotal",
        "tax",
        "discount",
        "total",
        "amount_paid",
        "balance_due",
        "payment_terms",
        "payment_method",
        "paid_at",
        "work_order_number",
        "line_item_name",
        "line_item_description",
        "line_item_quantity",
        "line_item_unit_price",
        "notes",
        "external_invoice_id",
        "external_customer_id",
        "external_work_order_id",
      ]
      const row = [
        "INV-2025-0144",
        "Precision Biomedical Imaging LLC",
        "2025-02-12",
        "2025-03-14",
        "Paid",
        "2100.00",
        "168.00",
        "0.00",
        "2268.00",
        "2268.00",
        "0.00",
        "Net 30",
        "ACH",
        "2025-02-18",
        "18440",
        "PM labor — MRI 3T",
        "Preventive maintenance labor block",
        "1",
        "950.00",
        "Historical FieldPulse invoice; not synced to QuickBooks.",
        "FP-INV-77120",
        "FP-CUST-88921",
        "FP-JOB-99221",
      ]
      return [csvLine(headers), csvLine(row)].join("\n")
    }
    case "quote": {
      const headers = [
        "quote_number",
        "customer_company_name",
        "quote_date",
        "expiration_date",
        "status",
        "subtotal",
        "tax",
        "discount",
        "total",
        "accepted_at",
        "declined_at",
        "work_order_number",
        "line_item_name",
        "line_item_description",
        "line_item_quantity",
        "line_item_unit_price",
        "notes",
        "external_quote_id",
        "external_customer_id",
        "external_work_order_id",
      ]
      const row = [
        "QT-2025-0098",
        "Precision Biomedical Imaging LLC",
        "2025-01-20",
        "2025-02-20",
        "Accepted",
        "18500.00",
        "1480.00",
        "500.00",
        "19480.00",
        "2025-02-01",
        "",
        "18440",
        "Gradient coil replacement kit",
        "OEM coil assembly + installation labor estimate",
        "1",
        "18500.00",
        "Capital quote from FieldPulse; map columns then upload for preview.",
        "FP-QUOTE-22001",
        "FP-CUST-88921",
        "FP-JOB-99221",
      ]
      return [csvLine(headers), csvLine(row)].join("\n")
    }
    default: {
      const _exhaustive: never = kind
      return _exhaustive
    }
  }
}
