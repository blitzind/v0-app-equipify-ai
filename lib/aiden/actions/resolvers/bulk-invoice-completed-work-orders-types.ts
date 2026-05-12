import type { CreateInvoiceFromWorkOrderPreviewPayload } from "@/lib/aiden/actions/resolvers/create-invoice-from-work-order-resolver"

export type BulkInvoiceWorkOrderAnomaly =
  | "missing_labor"
  | "missing_parts"
  | "missing_pricing"
  | "missing_billing_contact"
  | "missing_tax_settings"
  | "zero_total"
  | "duplicate_risk"
  | "existing_invoice_link"

export type BulkInvoiceCompletedWorkOrderPreviewItem = {
  workOrderId: string
  workOrderNumber: number | null
  customerId: string
  customerLabel: string
  completedAt: string | null
  anomalies: BulkInvoiceWorkOrderAnomaly[]
  invoicePreview: CreateInvoiceFromWorkOrderPreviewPayload
}

export type BulkInvoiceCompletedWorkOrdersPreview = {
  dateRange: { startIso: string; endIso: string; label: string }
  items: BulkInvoiceCompletedWorkOrderPreviewItem[]
  /** Explicit exclusions (subset of work order ids); merged with per-row `excluded`. */
  excludedWorkOrderIds: string[]
  batchWarnings: string[]
  summary: {
    candidateCount: number
    includedCount: number
    estimatedTotal: number
  }
}
