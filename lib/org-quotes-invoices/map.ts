import type { AdminInvoice, AdminQuote, InvoiceStatus, QuoteStatus } from "@/lib/mock-data"

export type OrgQuoteRow = {
  id: string
  organization_id: string
  customer_id: string
  seed_key: string
  quote_number: string
  title: string
  amount_cents: number
  status: string
  created_at: string
  created_by: string | null
  equipment_id: string | null
  work_order_id: string | null
  expires_at: string | null
  line_items: unknown
  notes: string | null
  internal_notes: string | null
  sent_at: string | null
  archived_at: string | null
}

export type OrgInvoiceRow = {
  id: string
  organization_id: string
  customer_id: string
  equipment_id: string | null
  seed_key: string
  invoice_number: string
  title: string
  amount_cents: number
  status: string
  issued_at: string
  paid_at: string | null
  created_at: string
  created_by: string | null
  work_order_id: string | null
  line_items: unknown
  notes: string | null
  internal_notes: string | null
  due_date: string | null
  quote_id: string | null
  archived_at: string | null
  sent_at: string | null
}

export type LineItemJson = { description: string; qty: number; unit: number }

function parseLineItems(raw: unknown): LineItemJson[] {
  if (!Array.isArray(raw)) return []
  const out: LineItemJson[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const o = item as Record<string, unknown>
    out.push({
      description: String(o.description ?? ""),
      qty: typeof o.qty === "number" ? o.qty : Number(o.qty) || 0,
      unit: typeof o.unit === "number" ? o.unit : Number(o.unit) || 0,
    })
  }
  return out
}

export function quoteStatusDbToUi(s: string): QuoteStatus {
  switch (s) {
    case "draft":
      return "Draft"
    case "sent":
      return "Sent"
    case "pending_approval":
      return "Pending Approval"
    case "approved":
      return "Approved"
    case "declined":
      return "Declined"
    case "expired":
      return "Expired"
    default:
      return "Draft"
  }
}

export function quoteStatusUiToDb(s: QuoteStatus): string {
  const m: Record<QuoteStatus, string> = {
    Draft: "draft",
    Sent: "sent",
    "Pending Approval": "pending_approval",
    Approved: "approved",
    Declined: "declined",
    Expired: "expired",
  }
  return m[s] ?? "draft"
}

export function invoiceStatusDbToUi(s: string): InvoiceStatus {
  switch (s) {
    case "draft":
      return "Draft"
    case "sent":
      return "Sent"
    case "unpaid":
      return "Unpaid"
    case "paid":
      return "Paid"
    case "overdue":
      return "Overdue"
    case "void":
      return "Void"
    default:
      return "Draft"
  }
}

export function invoiceStatusUiToDb(s: InvoiceStatus): string {
  const m: Record<InvoiceStatus, string> = {
    Draft: "draft",
    Sent: "sent",
    Unpaid: "unpaid",
    Paid: "paid",
    Overdue: "overdue",
    Void: "void",
  }
  return m[s] ?? "draft"
}

export function mapOrgQuoteToAdmin(
  row: OrgQuoteRow,
  names: {
    customerName: string
    equipmentName: string
    createdByLabel: string
    workOrderNumber?: number
  },
): AdminQuote {
  const lineItems = parseLineItems(row.line_items)
  const createdDate = row.created_at ? row.created_at.slice(0, 10) : ""
  const expiresDate = row.expires_at ?? ""
  const sentDate = row.sent_at ?? ""
  return {
    id: row.id,
    quoteNumber: row.quote_number,
    customerId: row.customer_id,
    customerName: names.customerName,
    equipmentId: row.equipment_id ?? "",
    equipmentName: names.equipmentName,
    createdDate,
    expiresDate,
    sentDate,
    amount: Math.round(row.amount_cents) / 100,
    status: quoteStatusDbToUi(row.status),
    description: row.title,
    createdBy: names.createdByLabel,
    workOrderId: row.work_order_id ?? "",
    workOrderNumber: names.workOrderNumber,
    lineItems,
    notes: row.notes ?? "",
    internalNotes: row.internal_notes?.trim() ? row.internal_notes : undefined,
  }
}

export function mapOrgInvoiceToAdmin(
  row: OrgInvoiceRow,
  names: {
    customerName: string
    equipmentName: string
    createdByLabel: string
  },
): AdminInvoice {
  const lineItems = parseLineItems(row.line_items)
  const issueDate = row.issued_at ? row.issued_at.slice(0, 10) : ""
  const dueDate = row.due_date ? row.due_date.slice(0, 10) : issueDate
  const paidDate = row.paid_at ? row.paid_at.slice(0, 10) : ""
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    customerId: row.customer_id,
    customerName: names.customerName,
    workOrderId: row.work_order_id ?? "",
    equipmentId: row.equipment_id ?? "",
    equipmentName: names.equipmentName,
    issueDate,
    dueDate,
    paidDate,
    amount: Math.round(row.amount_cents) / 100,
    status: invoiceStatusDbToUi(row.status),
    createdBy: names.createdByLabel,
    lineItems,
    notes: row.notes ?? "",
    quoteId: row.quote_id ?? undefined,
    internalNotes: row.internal_notes?.trim() ? row.internal_notes : undefined,
    sentAt: row.sent_at ?? undefined,
  }
}
