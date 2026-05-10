/**
 * Documented merge tokens for communication templates (Phase 51).
 * Do not add internal-only fields (technician notes, diagnosis, etc.).
 */

export const FINANCIAL_MERGE_TOKEN_KEYS = new Set([
  "amount",
  "invoice_amount",
  "balance_due",
  "quote_total",
])

/** If these appear in template body/subject, show a customer-safety warning in preview. */
export const INTERNAL_RISK_TOKEN_KEYS = new Set([
  "technician_notes",
  "internal_notes",
  "diagnosis",
  "problem_reported",
  "repair_notes",
])

export type MergeTokenHelp = {
  token: string
  label: string
  financial?: boolean
}

export const CUSTOMER_SAFE_MERGE_TOKENS: MergeTokenHelp[] = [
  { token: "customer_name", label: "Customer contact name" },
  { token: "company_name", label: "Your workspace / company name" },
  { token: "work_order_number", label: "Work order number" },
  { token: "service_request_number", label: "Service request reference" },
  { token: "quote_number", label: "Quote number" },
  { token: "invoice_number", label: "Invoice number" },
  { token: "appointment_date", label: "Appointment or service date" },
  { token: "portal_link", label: "Portal link placeholder (configure before send)" },
  { token: "sender_name", label: "Staff sender display name" },
  { token: "equipment_name", label: "Equipment name" },
  { token: "quote_summary", label: "Short quote summary" },
  { token: "plan_name", label: "Maintenance plan name" },
  { token: "equipment_or_plan", label: "Equipment or plan label" },
  { token: "service_date", label: "Scheduled service date" },
  { token: "due_date", label: "Due date (invoice / payment)" },
]

export const FINANCIAL_MERGE_TOKENS: MergeTokenHelp[] = [
  { token: "amount", label: "Currency amount (generic)", financial: true },
  { token: "invoice_amount", label: "Invoice total", financial: true },
  { token: "balance_due", label: "Outstanding balance", financial: true },
  { token: "quote_total", label: "Quote total", financial: true },
]
