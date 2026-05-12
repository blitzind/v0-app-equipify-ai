import { parseBulkInvoiceCompletedWorkOrdersPreviewFromPreparedAction } from "@/lib/aiden/prepared-actions/bulk-invoice-completed-work-orders-preview-parse"
import type { CreateFollowUpTaskPreviewPayload } from "@/lib/aiden/actions/resolvers/create-follow-up-task-types"
import type { CreateMaintenancePlanFromEquipmentPreviewPayload } from "@/lib/aiden/actions/resolvers/create-maintenance-plan-from-equipment-types"
import type { CreatePartsReorderPreviewPayload } from "@/lib/aiden/actions/resolvers/create-parts-reorder-request-types"
import type { DraftCustomerMessagePreviewPayload } from "@/lib/aiden/actions/resolvers/draft-customer-message-types"
import type { ScheduleMaintenanceVisitPreviewPayload } from "@/lib/aiden/actions/resolvers/schedule-maintenance-visit-types"
import type { PrepareQuickBooksInvoiceSyncPreviewPayload as PrepareQuickBooksInvoiceSyncPreviewPayloadLib } from "@/lib/aiden/actions/resolvers/prepare-quickbooks-invoice-sync-types"
import type { SummarizeCustomerHistoryPreviewPayload } from "@/lib/aiden/actions/resolvers/summarize-customer-history-types"

export type { DraftCustomerMessagePreviewPayload } from "@/lib/aiden/actions/resolvers/draft-customer-message-types"
export type { CreateFollowUpTaskPreviewPayload } from "@/lib/aiden/actions/resolvers/create-follow-up-task-types"
export type { CreateMaintenancePlanFromEquipmentPreviewPayload } from "@/lib/aiden/actions/resolvers/create-maintenance-plan-from-equipment-types"
export type { CreatePartsReorderPreviewPayload } from "@/lib/aiden/actions/resolvers/create-parts-reorder-request-types"
export type { ScheduleMaintenanceVisitPreviewPayload } from "@/lib/aiden/actions/resolvers/schedule-maintenance-visit-types"
export type { SummarizeCustomerHistoryPreviewPayload } from "@/lib/aiden/actions/resolvers/summarize-customer-history-types"
export type { BulkInvoiceCompletedWorkOrdersPreview } from "@/lib/aiden/actions/resolvers/bulk-invoice-completed-work-orders-types"
export type PrepareQuickBooksInvoiceSyncPreviewPayload = PrepareQuickBooksInvoiceSyncPreviewPayloadLib
export type SerializedPreparedAction = {
  id: string
  organizationId: string
  requestedBy: string
  actionId: string
  status: string
  riskLevel: string
  inputPayload: Record<string, unknown>
  resolvedPayload: Record<string, unknown>
  previewPayload: Record<string, unknown>
  executionPayload: Record<string, unknown>
  sourceRecordType: string | null
  sourceRecordId: string | null
  targetRecordType: string | null
  targetRecordId: string | null
  confidenceScore: number | null
  requiresConfirmation: boolean
  confirmedBy: string | null
  confirmedAt: string | null
  executedBy: string | null
  executedAt: string | null
  canceledBy: string | null
  canceledAt: string | null
  errorMessage: string | null
  createdAt: string
  updatedAt: string
}

/** Mirrors `SerializedPreparedActionApproval` from the prepared-action GET API (client-safe). */
export type PreparedActionApprovalApi = {
  allowed: boolean
  blockedReasonCode?: string
  blockedMessage?: string
  effectivePolicyBand: string
  whyApprovalRequired: string[]
  whoCanApprove: string[]
  requiresStrictConfirmation: boolean
  confirmationPhraseRecommended: boolean
  platformAdminBypass: boolean
  metrics: {
    bulkIncludedCount: number | null
    financialAmountDollars: number | null
  }
}

export type PreparedActionAuditItem = {
  id: string
  eventType: string
  actionId: string | null
  actorUserId: string | null
  details: Record<string, unknown>
  createdAt: string
}

export type InvoicePreviewLineItem = {
  kind: string
  description: string
  quantity: number
  unitCents: number
  lineTotalCents: number
  /** `manual` for user-added lines; otherwise resolver provenance. */
  source?: string
}

export type InvoicePreviewPayload = {
  customer?: {
    id?: string
    companyName?: string
    billingName?: string | null
  }
  workOrder?: {
    id?: string
    workOrderNumber?: number | null
    title?: string
    status?: string
    completedAt?: string | null
    billingState?: string | null
    /** Optional — populated when backend adds assignment to preview. */
    assignedTechnicianName?: string | null
  }
  lineItems?: InvoicePreviewLineItem[]
  subtotal?: number
  taxEstimate?: number | null
  total?: number
  notes?: string
  warnings?: string[]
  recommendedInvoiceTitle?: string
  sourceSummary?: string
  /** Quote-from-work-order (AIden) extras */
  diagnosis?: string | null
  recommendedRepairsSummary?: string | null
}

/** BlitzPay payment-link preview (subset of server disclosure). */
export type PaymentLinkMethodPreview = {
  type: string
  label: string
  convenienceFeeCents: number
  totalChargeCents: number
  disclosureCopy: string
  timelineCopy: string | null
}

export type PaymentLinkCheckoutPreviewUi = {
  invoiceBalanceCents: number
  paymentTowardInvoiceCents: number
  remainingBalanceAfterPaymentCents: number
  convenienceFeeCents: number
  totalChargeCents: number
  appliesToCustomer: boolean
  disclosureCopy: string
  connectChargesEnabled: boolean
  connectPayoutsEnabled: boolean
  connectStatus: string | null
  savePaymentMethodEligible: boolean
  availablePaymentMethods: PaymentLinkMethodPreview[]
}

export type PaymentLinkPreparedPreviewPayload = {
  invoiceId: string
  invoice: {
    id: string
    invoiceNumber: string
    title: string
    statusUi: string
    amountCents: number
  }
  customer: { id: string; companyName: string }
  amountDueCents: number | null
  checkoutPreview: PaymentLinkCheckoutPreviewUi | null
  readiness: "ready" | "blocked" | "degraded"
  warnings: string[]
  blitzpayErrorCode?: string
}

export function humanizePreparedActionId(actionId: string): string {
  if (actionId === "create_invoice_from_work_order") return "Create invoice from work order"
  if (actionId === "create_quote_from_work_order") return "Create quote from work order"
  if (actionId === "prepare_invoice_payment_link") return "Prepare invoice payment link"
  if (actionId === "prepare_quickbooks_invoice_sync") return "Prepare QuickBooks Sync"
  if (actionId === "draft_customer_message") return "Draft customer message"
  if (actionId === "summarize_customer_history") return "Summarize customer history"
  if (actionId === "create_follow_up_task") return "Create follow-up task"
  if (actionId === "schedule_maintenance_visit") return "Schedule maintenance visit"
  if (actionId === "create_maintenance_plan_from_equipment") return "Create maintenance plan from equipment"
  if (actionId === "create_parts_reorder_request") return "Create parts reorder request"
  if (actionId === "bulk_invoice_completed_work_orders") return "Bulk invoice completed work orders"
  return actionId
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

export function parseBulkInvoiceCompletedWorkOrdersPreviewFromPayload(
  previewPayload: Record<string, unknown>,
): BulkInvoiceCompletedWorkOrdersPreview | null {
  const r = parseBulkInvoiceCompletedWorkOrdersPreviewFromPreparedAction(previewPayload)
  return r.ok ? r.preview : null
}

export function parseInvoicePreviewFromPayload(previewPayload: Record<string, unknown>): InvoicePreviewPayload | null {
  const preview = previewPayload.preview
  if (!preview || typeof preview !== "object" || Array.isArray(preview)) return null
  return preview as InvoicePreviewPayload
}

/** Maps AIden quote-from-WO API preview to the shared invoice-style preview shape for the UI. */
export function parseQuoteFromWorkOrderPreviewFromPayload(
  previewPayload: Record<string, unknown>,
): InvoicePreviewPayload | null {
  const preview = previewPayload.preview
  if (!preview || typeof preview !== "object" || Array.isArray(preview)) return null
  const p = preview as Record<string, unknown>
  if (p.taxEstimate !== null && p.taxEstimate !== undefined) return null
  if (typeof p.recommendedQuoteTitle !== "string") return null
  const base = preview as InvoicePreviewPayload
  return {
    ...base,
    recommendedInvoiceTitle: p.recommendedQuoteTitle as string,
    diagnosis: p.diagnosis === null || typeof p.diagnosis === "string" ? (p.diagnosis as string | null) : null,
    recommendedRepairsSummary:
      p.recommendedRepairsSummary === null || typeof p.recommendedRepairsSummary === "string" ?
        (p.recommendedRepairsSummary as string | null)
      : null,
  }
}

export function parsePaymentLinkPreviewFromPayload(
  previewPayload: Record<string, unknown>,
): PaymentLinkPreparedPreviewPayload | null {
  const preview = previewPayload.preview
  if (!preview || typeof preview !== "object" || Array.isArray(preview)) return null
  const p = preview as PaymentLinkPreparedPreviewPayload
  if (!p.invoiceId || !p.invoice || !p.customer) return null
  return p
}

export function parseDraftCustomerMessagePreviewFromPayload(
  previewPayload: Record<string, unknown>,
): DraftCustomerMessagePreviewPayload | null {
  const preview = previewPayload.preview
  if (!preview || typeof preview !== "object" || Array.isArray(preview)) return null
  const p = preview as DraftCustomerMessagePreviewPayload
  if (!p.customer?.id || typeof p.subject !== "string" || typeof p.body !== "string") return null
  return p
}

export function parsePrepareQuickBooksInvoiceSyncPreviewFromPayload(
  previewPayload: Record<string, unknown>,
): PrepareQuickBooksInvoiceSyncPreviewPayload | null {
  const preview = previewPayload.preview
  if (!preview || typeof preview !== "object" || Array.isArray(preview)) return null
  const p = preview as PrepareQuickBooksInvoiceSyncPreviewPayload
  if (!p.invoiceId || !p.invoice || !p.customer || !p.qbConnection) return null
  if (p.readiness !== "ready" && p.readiness !== "degraded" && p.readiness !== "blocked") return null
  return p
}

export function parseSummarizeCustomerHistoryPreviewFromPayload(
  previewPayload: Record<string, unknown>,
): SummarizeCustomerHistoryPreviewPayload | null {
  const preview = previewPayload.preview
  if (!preview || typeof preview !== "object" || Array.isArray(preview)) return null
  const p = preview as Record<string, unknown>
  const customer = p.customer
  if (!customer || typeof customer !== "object" || Array.isArray(customer)) return null
  const c = customer as Record<string, unknown>
  if (typeof c.id !== "string" || typeof c.companyName !== "string") return null
  if (typeof p.customerOverview !== "string") return null
  if (typeof p.recentWorkPerformed !== "string") return null
  if (typeof p.openIssues !== "string") return null
  if (typeof p.upcomingMaintenance !== "string") return null
  if (typeof p.financialsRedacted !== "boolean") return null
  if (!Array.isArray(p.recommendedNextActions)) return null
  return preview as SummarizeCustomerHistoryPreviewPayload
}

export function parseCreateFollowUpTaskPreviewFromPayload(
  previewPayload: Record<string, unknown>,
): CreateFollowUpTaskPreviewPayload | null {
  const preview = previewPayload.preview
  if (!preview || typeof preview !== "object" || Array.isArray(preview)) return null
  const p = preview as Record<string, unknown>
  if (typeof p.title !== "string" || typeof p.notes !== "string") return null
  if (typeof p.dueDate !== "string" || typeof p.scheduledForIso !== "string") return null
  const rel = p.relatedRecord
  if (!rel || typeof rel !== "object" || Array.isArray(rel)) return null
  const r = rel as Record<string, unknown>
  if (typeof r.entityType !== "string" || typeof r.entityId !== "string" || typeof r.label !== "string") return null
  return preview as CreateFollowUpTaskPreviewPayload
}

const SCHEDULE_WO_TYPES = new Set(["Repair", "PM", "Inspection", "Install", "Emergency"])
const SCHEDULE_WO_PRIOS = new Set(["Low", "Normal", "High", "Critical"])

export function parseScheduleMaintenanceVisitPreviewFromPayload(
  previewPayload: Record<string, unknown>,
): ScheduleMaintenanceVisitPreviewPayload | null {
  const preview = previewPayload.preview
  if (!preview || typeof preview !== "object" || Array.isArray(preview)) return null
  const p = preview as Record<string, unknown>
  const cust = p.customer
  if (!cust || typeof cust !== "object" || Array.isArray(cust)) return null
  const c = cust as Record<string, unknown>
  if (typeof c.id !== "string" || typeof c.companyName !== "string") return null
  if (typeof p.locationSummary !== "string" || typeof p.serviceReason !== "string") return null
  if (typeof p.suggestedDate !== "string" || typeof p.suggestedTime !== "string") return null
  if (typeof p.dateSuggested !== "boolean") return null
  if (typeof p.notes !== "string") return null
  const st = p.serviceTypeUi
  const pr = p.priorityUi
  if (typeof st !== "string" || !SCHEDULE_WO_TYPES.has(st)) return null
  if (typeof pr !== "string" || !SCHEDULE_WO_PRIOS.has(pr)) return null
  if (p.equipment !== null && p.equipment !== undefined) {
    const eq = p.equipment as Record<string, unknown>
    if (typeof eq.id !== "string" || typeof eq.name !== "string") return null
  }
  return preview as ScheduleMaintenanceVisitPreviewPayload
}

const MAINT_PLAN_INTERVALS = new Set(["Annual", "Semi-Annual", "Quarterly", "Monthly", "Custom"])
const MAINT_PLAN_WO_TYPES = new Set(["Repair", "PM", "Inspection", "Install", "Emergency"])
const MAINT_PLAN_WO_PRIOS = new Set(["Low", "Normal", "High", "Critical"])

export function parseCreateMaintenancePlanFromEquipmentPreviewFromPayload(
  previewPayload: Record<string, unknown>,
): CreateMaintenancePlanFromEquipmentPreviewPayload | null {
  const preview = previewPayload.preview
  if (!preview || typeof preview !== "object" || Array.isArray(preview)) return null
  const p = preview as Record<string, unknown>
  const cust = p.customer
  if (!cust || typeof cust !== "object" || Array.isArray(cust)) return null
  const c = cust as Record<string, unknown>
  if (typeof c.id !== "string" || typeof c.companyName !== "string") return null
  const eq = p.equipment
  if (!eq || typeof eq !== "object" || Array.isArray(eq)) return null
  const e = eq as Record<string, unknown>
  if (typeof e.id !== "string" || typeof e.name !== "string") return null
  if (typeof p.planName !== "string" || typeof p.intervalUi !== "string" || !MAINT_PLAN_INTERVALS.has(p.intervalUi))
    return null
  if (typeof p.customIntervalDays !== "number" || !Number.isFinite(p.customIntervalDays)) return null
  if (typeof p.nextDueDate !== "string" || typeof p.serviceScope !== "string") return null
  if (typeof p.workOrderTypeUi !== "string" || !MAINT_PLAN_WO_TYPES.has(p.workOrderTypeUi)) return null
  if (typeof p.workOrderPriorityUi !== "string" || !MAINT_PLAN_WO_PRIOS.has(p.workOrderPriorityUi)) return null
  if (typeof p.preferredServiceTime !== "string" || typeof p.autoCreateWorkOrder !== "boolean") return null
  if (typeof p.notes !== "string") return null
  if (p.lastServiceDate !== null && typeof p.lastServiceDate !== "string") return null
  return preview as CreateMaintenancePlanFromEquipmentPreviewPayload
}

const PARTS_REORDER_MODES = new Set(["draft_purchase_order", "restock_requests"])
const PARTS_REORDER_SOURCES = new Set(["work_order", "equipment", "low_stock_org"])

export function parseCreatePartsReorderRequestPreviewFromPayload(
  previewPayload: Record<string, unknown>,
): CreatePartsReorderPreviewPayload | null {
  const preview = previewPayload.preview
  if (!preview || typeof preview !== "object" || Array.isArray(preview)) return null
  const p = preview as Record<string, unknown>
  if (typeof p.source !== "string" || !PARTS_REORDER_SOURCES.has(p.source)) return null
  if (typeof p.executionMode !== "string" || !PARTS_REORDER_MODES.has(p.executionMode)) return null
  if (typeof p.draftPurchaseOrderEligible !== "boolean") return null
  if (typeof p.internalNotes !== "string") return null
  if (!Array.isArray(p.lines) || p.lines.length === 0) return null
  for (const line of p.lines) {
    if (!line || typeof line !== "object" || Array.isArray(line)) return null
    const l = line as Record<string, unknown>
    if (typeof l.lineKey !== "string" || typeof l.catalogItemId !== "string") return null
    if (typeof l.partName !== "string" || typeof l.suggestedQuantity !== "number") return null
    if (typeof l.inventoryLocationId !== "string" || typeof l.inventoryLocationLabel !== "string") return null
    if (typeof l.reason !== "string") return null
  }
  if (!Array.isArray(p.availableVendors)) return null
  return preview as CreatePartsReorderPreviewPayload
}
