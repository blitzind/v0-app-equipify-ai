/**
 * Deterministic prepared-workspace intent parsing (no LLM). Shapes are JSON-serializable hints for downstream resolvers.
 */

/** Resolved or requested work order selector from natural language. */
export type AidenWorkOrderReference = "latest" | "latest_completed" | string

export type AidenIntentSourceContext = {
  workOrderId?: string
  customerId?: string
  /** Equipment profile page (optional resolver hints). */
  equipmentId?: string
  /** Invoices list drawer / deep link (optional resolver hints). */
  invoiceId?: string
  /** Quotes list drawer / deep link. */
  quoteId?: string
  /** Optional https checkout URL from UI context (e.g. after preparing BlitzPay link). */
  paymentLinkUrl?: string
  /** Maintenance plan drawer / deep link (optional resolver hints). */
  maintenancePlanId?: string
  workOrderLabel?: string
  customerLabel?: string
}

export type ParseAidenIntentInputOptions = {
  /** UI / thread context for phrases like "this work order" or "this customer". */
  sourceContext?: AidenIntentSourceContext
}

export type AidenIntentParserStatus = "prepared" | "needs_clarification" | "unsupported"

/** Structured intent extracted from user text (never executes side effects). */
export type AidenParsedPreparedIntent = {
  status: AidenIntentParserStatus
  actionId: string
  customerReference?: string
  /** Free-text equipment hint (e.g. “pump” in “plan for Acme’s pump”). */
  equipmentReference?: string
  workOrderReference?: AidenWorkOrderReference
  /** When `actionId` is `bulk_invoice_completed_work_orders`, resolver date window (UTC). */
  bulkInvoiceDateRange?: {
    rangeStartIso: string
    rangeEndIso: string
    label: string
  }
  sourceContext?: AidenIntentSourceContext
  confidenceScore: number
  missingFields: string[]
}

/** Canonical missing-field keys for UI / API follow-ups. */
export const AIDEN_INTENT_MISSING_FIELD_KEYS = [
  "customerReference",
  "customerId",
  "workOrderReference",
  "workOrderId",
  "invoiceId",
  "quoteId",
  "maintenancePlanId",
  "paymentLinkUrl",
  "actionIntent",
  "equipmentId",
  "equipmentReference",
  "dateRange",
  /** LLM / merge tier: ask user to confirm intent when model confidence is in the medium band. */
  "intentConfidence",
] as const

export type AidenIntentMissingFieldKey = (typeof AIDEN_INTENT_MISSING_FIELD_KEYS)[number]
