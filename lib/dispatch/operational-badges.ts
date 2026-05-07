/**
 * Derives compact operational badges for dispatch / scheduling surfaces.
 * Avoids N+1 per card: pass batch enrichment context from the page loader.
 */

import type {
  WorkOrder,
  WorkOrderPriority,
  WorkOrderStatus,
  WorkOrderType,
} from "@/lib/mock-data"
import type { WoInvoiceAggregate } from "@/lib/dispatch/work-order-invoice-agg"

export type OperationalBadge = {
  key: string
  label: string
  /** Visual weight — maps to Badge variant + classes in UI */
  tone: "neutral" | "info" | "success" | "warning" | "danger" | "muted"
}

export type DispatchOpsInput = {
  id: string
  status: string
  type: string
  priority: string
  /** DB billing_state (nullable = legacy) */
  billingState: string | null
  maintenancePlanId: string | null
  calibrationTemplateId: string | null
  warrantyReviewRequired: boolean
  billableToCustomer: boolean
  assignedUserId: string | null
  createdAt: string
  totalPartsCents: number
  /** YYYY-MM-DD or ISO; drives completed-but-not-invoiced aging */
  completedAt: string | null
  /** Scheduled date YYYY-MM-DD for past-schedule cue */
  scheduledOnYmd: string | null
}

export type DispatchOpsContext = {
  /** YYYY-MM-DD from equipment.next_due_at */
  equipmentNextServiceDueYmd: string | null
  /** YYYY-MM-DD from equipment.next_calibration_due_at */
  equipmentNextCalibrationYmd: string | null
  /** True if at least one calibration_records row exists for this work order */
  hasCalibrationRecord: boolean
  /** Distinct equipment assets on the job (join table + primary); min 1 */
  equipmentCount: number
  /** Primary equipment category for risk hint */
  equipmentCategory: string | null
  /** Linked invoice aging (batch); null treated as no unpaid signals */
  invoiceAgg: WoInvoiceAggregate | null
  linkedInvoiceCount: number
  organizationCertificateReleaseMode: string | null
  customerCertificateReleaseMode: string | null
  /** Precomputed in enrichment: calibration template + release_on_payment + unpaid linked invoices */
  certPaymentBlocked: boolean
}

export const todayYmdUtc = () => new Date().toISOString().slice(0, 10)

function ymdBeforeToday(ymd: string | null | undefined): boolean {
  if (!ymd?.trim()) return false
  return ymd < todayYmdUtc()
}

function ymdEqualsToday(ymd: string | null | undefined): boolean {
  if (!ymd?.trim()) return false
  return ymd.trim().slice(0, 10) === todayYmdUtc()
}

/** Due date falls within the next `days` calendar days from today (inclusive). */
function ymdWithinDaysForward(ymd: string | null, days: number): boolean {
  if (!ymd?.trim()) return false
  const due = new Date(ymd + "T12:00:00Z").getTime()
  const start = new Date()
  start.setUTCHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + days)
  end.setUTCHours(23, 59, 59, 999)
  return due >= start.getTime() && due <= end.getTime()
}

function daysSinceYmdOrIso(raw: string | null): number | null {
  if (!raw?.trim()) return null
  const ymd = raw.trim().slice(0, 10)
  if (ymd.length < 10) return null
  const today = todayYmdUtc()
  if (ymd > today) return 0
  const a = new Date(ymd + "T12:00:00Z").getTime()
  const b = new Date(today + "T12:00:00Z").getTime()
  return Math.round((b - a) / 86400000)
}

function billingBlocksInvoiceCue(wo: DispatchOpsInput): boolean {
  return wo.warrantyReviewRequired || wo.billingState === "not_billable" || wo.billableToCustomer === false
}

function isCompletedLike(status: string): boolean {
  return ["completed", "completed_pending_signature", "invoiced"].includes(status)
}

function schedBeforeToday(ymd: string | null): boolean {
  if (!ymd?.trim()) return false
  return ymd.trim().slice(0, 10) < todayYmdUtc()
}

/**
 * Produces compact badges; caller may truncate for card density.
 */
export function deriveOperationalBadges(wo: DispatchOpsInput, ctx: DispatchOpsContext): OperationalBadge[] {
  const out: OperationalBadge[] = []

  // Priority / job type (compact)
  if (wo.type === "emergency" || wo.priority === "critical") {
    out.push({ key: "urgent", label: "Urgent", tone: "danger" })
  } else if (wo.priority === "high") {
    out.push({ key: "high", label: "High", tone: "warning" })
  }

  if (wo.maintenancePlanId) {
    if (ymdBeforeToday(ctx.equipmentNextServiceDueYmd)) {
      out.push({ key: "pm-overdue", label: "PM overdue", tone: "danger" })
    } else if (ctx.equipmentNextServiceDueYmd && ymdWithinDaysForward(ctx.equipmentNextServiceDueYmd, 7)) {
      out.push({ key: "pm-soon", label: "PM 7d", tone: "warning" })
    } else {
      out.push({ key: "pm", label: "PM", tone: "info" })
    }
  }

  if (ymdBeforeToday(ctx.equipmentNextCalibrationYmd)) {
    out.push({ key: "cal-overdue", label: "Cal overdue", tone: "danger" })
  }

  // Billing (operational cues — not accounting)
  if (wo.warrantyReviewRequired) {
    out.push({ key: "warr-hold", label: "Warranty review", tone: "warning" })
  } else if (wo.billableToCustomer === false) {
    out.push({ key: "non-bill", label: "Non-billable", tone: "muted" })
  } else if (wo.billingState === "paid") {
    out.push({ key: "paid", label: "Paid", tone: "success" })
  } else if (wo.billingState === "invoiced") {
    out.push({ key: "invoiced", label: "Invoiced", tone: "info" })
  } else if (wo.billingState === "not_billable") {
    out.push({ key: "hold", label: "Billing hold", tone: "muted" })
  } else if (
    wo.billingState === "ready_for_billing" &&
    ["completed", "completed_pending_signature", "invoiced"].includes(wo.status)
  ) {
    out.push({ key: "rtb", label: "Ready to bill", tone: "warning" })
  } else if (wo.status === "completed" && wo.billableToCustomer !== false && wo.billingState == null) {
    out.push({ key: "rtb", label: "Ready to bill", tone: "warning" })
  }

  // Invoice aging (linked org_invoices)
  const agg = ctx.invoiceAgg
  if (agg?.hasOverdue) {
    switch (agg.worstBucket) {
      case "od_1_15":
        out.push({ key: "inv-od-1", label: "Invoice 1–15d overdue", tone: "danger" })
        break
      case "od_16_30":
        out.push({ key: "inv-od-2", label: "Invoice 16–30d overdue", tone: "danger" })
        break
      case "od_31_60":
        out.push({ key: "inv-od-3", label: "Invoice 31–60d overdue", tone: "danger" })
        break
      case "od_60_plus":
        out.push({ key: "inv-od-4", label: "Invoice 60d+ overdue", tone: "danger" })
        break
      default:
        out.push({ key: "inv-od", label: "Invoice overdue", tone: "danger" })
    }
  } else if (agg?.hasDueSoon && wo.billingState !== "paid") {
    out.push({ key: "inv-due-soon", label: "Invoice due soon", tone: "warning" })
  }

  // Completed work — no invoice linked yet (operational recovery)
  if (
    isCompletedLike(wo.status) &&
    wo.billableToCustomer !== false &&
    !billingBlocksInvoiceCue(wo) &&
    wo.billingState !== "invoiced" &&
    wo.billingState !== "paid" &&
    ctx.linkedInvoiceCount === 0
  ) {
    out.push({ key: "cni", label: "Invoice pending", tone: "warning" })
    const age = daysSinceYmdOrIso(wo.completedAt)
    if (age !== null && age >= 14) {
      out.push({ key: "cni-14", label: "Unbilled 14d+", tone: "danger" })
    }
  }

  // Certificate upload (calibration template selected, job finished, no record yet)
  if (
    wo.calibrationTemplateId &&
    ["completed", "invoiced", "completed_pending_signature"].includes(wo.status) &&
    !ctx.hasCalibrationRecord
  ) {
    out.push({ key: "cert", label: "Cert pending", tone: "warning" })
  }

  if (ctx.certPaymentBlocked) {
    out.push({ key: "cert-pay-hold", label: "Cert until paid", tone: "warning" })
  }

  if ((wo.totalPartsCents ?? 0) > 0 && ["open", "scheduled", "in_progress"].includes(wo.status)) {
    out.push({ key: "parts", label: "Waiting on parts", tone: "info" })
  }

  if (
    ["open", "scheduled", "in_progress"].includes(wo.status) &&
    schedBeforeToday(wo.scheduledOnYmd)
  ) {
    out.push({ key: "sched-past", label: "Overdue", tone: "danger" })
  } else if (
    ["open", "scheduled", "in_progress"].includes(wo.status) &&
    ymdEqualsToday(wo.scheduledOnYmd)
  ) {
    out.push({ key: "due-today", label: "Due today", tone: "info" })
  }

  // Unassigned aging
  if (!wo.assignedUserId && wo.createdAt) {
    const ageH = (Date.now() - new Date(wo.createdAt).getTime()) / 36e5
    if (ageH >= 48) {
      out.push({ key: "aging", label: "Unassigned 48h+", tone: "warning" })
    }
  }

  if (ctx.equipmentCount > 1) {
    out.push({ key: "multi", label: `${ctx.equipmentCount} assets`, tone: "neutral" })
  }

  const cat = (ctx.equipmentCategory ?? "").toLowerCase()
  if (
    cat &&
    (cat.includes("medical") ||
      cat.includes("calibration") ||
      cat.includes("gas") ||
      cat.includes("life safety"))
  ) {
    out.push({ key: "sens", label: "Compliance", tone: "info" })
  }

  const seen = new Set<string>()
  return out.filter((b) => {
    if (seen.has(b.key)) return false
    seen.add(b.key)
    return true
  })
}

export function badgeToneClasses(tone: OperationalBadge["tone"]): string {
  switch (tone) {
    case "danger":
      return "border-destructive/40 bg-destructive/10 text-destructive"
    case "warning":
      return "border-[color:var(--status-warning)]/40 bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)]"
    case "success":
      return "border-[color:var(--status-success)]/40 bg-[color:var(--status-success)]/10 text-[color:var(--status-success)]"
    case "info":
      return "border-[color:var(--status-info)]/40 bg-[color:var(--status-info)]/10 text-[color:var(--status-info)]"
    case "muted":
      return "border-border bg-muted/50 text-muted-foreground"
    default:
      return "border-border bg-card text-foreground"
  }
}

export type DispatchFilterId =
  | "all"
  | "billing_ready"
  | "cert_pending"
  | "cert_payment_hold"
  | "pm_risk"
  | "pm_overdue"
  | "cal_overdue"
  | "unassigned_aging"
  | "warranty_review"
  | "not_invoiced"
  | "overdue_invoice"
  | "invoice_due_soon"
  | "completed_not_invoiced_aging"
  | "emergency"
  | "high_priority"
  | "revenue_at_risk"
  | "sched_past_due"
  | "due_today"
  | "waiting_on_parts"
  | "invoice_pending"

/** Toolbar / dropdown options for dispatch + service schedule parity. */
export const DISPATCH_FOCUS_OPTIONS: { id: DispatchFilterId; label: string }[] = [
  { id: "all", label: "All jobs" },
  { id: "due_today", label: "Due today" },
  { id: "sched_past_due", label: "Overdue" },
  { id: "revenue_at_risk", label: "Revenue at risk" },
  { id: "billing_ready", label: "Ready to bill" },
  { id: "invoice_pending", label: "Invoice pending" },
  { id: "completed_not_invoiced_aging", label: "Unbilled 14d+" },
  { id: "overdue_invoice", label: "Overdue invoice" },
  { id: "invoice_due_soon", label: "Invoice due soon" },
  { id: "cert_pending", label: "Certificate pending" },
  { id: "cert_payment_hold", label: "Cert until paid" },
  { id: "waiting_on_parts", label: "Waiting on parts" },
  { id: "pm_risk", label: "PM & calibration risk" },
  { id: "pm_overdue", label: "PM overdue" },
  { id: "cal_overdue", label: "Calibration overdue" },
  { id: "unassigned_aging", label: "Unassigned aging" },
  { id: "warranty_review", label: "Warranty review" },
  { id: "emergency", label: "Emergency / urgent" },
  { id: "high_priority", label: "High priority" },
]

/** Precomputed on the batch pass for toolbar filters (no re-derive). */
export type OpsFlags = {
  billing_ready: boolean
  cert_pending: boolean
  cert_payment_hold: boolean
  pm_risk: boolean
  pm_overdue: boolean
  cal_overdue: boolean
  unassigned_aging: boolean
  warranty_review: boolean
  not_invoiced: boolean
  overdue_invoice: boolean
  invoice_due_soon: boolean
  completed_not_invoiced_aging: boolean
  emergency: boolean
  high_priority: boolean
  revenue_at_risk: boolean
  sched_past_due: boolean
  due_today: boolean
  waiting_on_parts: boolean
  invoice_pending: boolean
}

export function computeOpsFlags(wo: DispatchOpsInput, ctx: DispatchOpsContext): OpsFlags {
  const badges = deriveOperationalBadges(wo, ctx)
  const keys = new Set(badges.map((b) => b.key))

  const billing_ready = keys.has("rtb")
  const cert_pending = keys.has("cert")
  const cert_payment_hold = keys.has("cert-pay-hold")
  const pm_overdue = keys.has("pm-overdue")
  const cal_overdue = keys.has("cal-overdue")
  const pm_risk = pm_overdue || keys.has("pm-soon") || cal_overdue
  const unassigned_aging = keys.has("aging")
  const overdue_invoice = Boolean(ctx.invoiceAgg?.hasOverdue)
  const invoice_due_soon = Boolean(ctx.invoiceAgg?.hasDueSoon && wo.billingState !== "paid")
  const not_invoiced = keys.has("cni")
  const completed_not_invoiced_aging = keys.has("cni-14")
  const emergency = wo.type === "emergency" || wo.priority === "critical"
  const high_priority = wo.priority === "high"
  const sched_past_due = keys.has("sched-past")
  const warranty_review = wo.warrantyReviewRequired
  const due_today = keys.has("due-today")
  const waiting_on_parts = keys.has("parts")
  const invoice_pending = not_invoiced

  const revenue_at_risk =
    overdue_invoice || cert_payment_hold || completed_not_invoiced_aging || not_invoiced

  return {
    billing_ready,
    cert_pending,
    cert_payment_hold,
    pm_risk,
    pm_overdue,
    cal_overdue,
    unassigned_aging,
    warranty_review,
    not_invoiced,
    overdue_invoice,
    invoice_due_soon,
    completed_not_invoiced_aging,
    emergency,
    high_priority,
    revenue_at_risk,
    sched_past_due,
    due_today,
    waiting_on_parts,
    invoice_pending,
  }
}

export function dispatchBadgeSummary(
  wo: DispatchOpsInput,
  ctx: DispatchOpsContext,
): { matches: (f: DispatchFilterId) => boolean } {
  const flags = computeOpsFlags(wo, ctx)
  return {
    matches: (f: DispatchFilterId) => {
      if (f === "all") return true
      if (f === "billing_ready") return flags.billing_ready
      if (f === "cert_pending") return flags.cert_pending
      if (f === "cert_payment_hold") return flags.cert_payment_hold
      if (f === "pm_risk") return flags.pm_risk
      if (f === "pm_overdue") return flags.pm_overdue
      if (f === "cal_overdue") return flags.cal_overdue
      if (f === "unassigned_aging") return flags.unassigned_aging
      if (f === "warranty_review") return flags.warranty_review
      if (f === "not_invoiced") return flags.not_invoiced
      if (f === "overdue_invoice") return flags.overdue_invoice
      if (f === "invoice_due_soon") return flags.invoice_due_soon
      if (f === "completed_not_invoiced_aging") return flags.completed_not_invoiced_aging
      if (f === "emergency") return flags.emergency
      if (f === "high_priority") return flags.high_priority
      if (f === "revenue_at_risk") return flags.revenue_at_risk
      if (f === "sched_past_due") return flags.sched_past_due
      if (f === "due_today") return flags.due_today
      if (f === "waiting_on_parts") return flags.waiting_on_parts
      if (f === "invoice_pending") return flags.invoice_pending
      return true
    },
  }
}

const STATUS_UI_TO_DB: Record<WorkOrderStatus, string> = {
  Open: "open",
  Scheduled: "scheduled",
  "In Progress": "in_progress",
  Completed: "completed",
  "Completed Pending Signature": "completed_pending_signature",
  Invoiced: "invoiced",
}

const PRIORITY_UI_TO_DB: Record<WorkOrderPriority, string> = {
  Low: "low",
  Normal: "normal",
  High: "high",
  Critical: "critical",
}

const TYPE_UI_TO_DB: Record<WorkOrderType, string> = {
  Repair: "repair",
  PM: "pm",
  Inspection: "inspection",
  Install: "install",
  Emergency: "emergency",
}

/** Map drawer/detail `WorkOrder` into dispatch badge inputs (Supabase-shaped enums). */
export function workOrderToDispatchOpsInput(wo: WorkOrder): DispatchOpsInput {
  const unassigned =
    wo.technicianId === "unassigned" || wo.technicianName.trim().toLowerCase() === "unassigned"
  const techRaw = unassigned ? null : wo.technicianId
  const sched = wo.scheduledDate?.trim() ? wo.scheduledDate.trim().slice(0, 10) : null
  const completed = wo.completedDate?.trim() ? wo.completedDate.trim().slice(0, 10) : null
  return {
    id: wo.id,
    status: STATUS_UI_TO_DB[wo.status] ?? "open",
    type: TYPE_UI_TO_DB[wo.type] ?? "repair",
    priority: PRIORITY_UI_TO_DB[wo.priority] ?? "normal",
    billingState: wo.billingState ?? null,
    maintenancePlanId: wo.maintenancePlanId ?? null,
    calibrationTemplateId: wo.calibrationTemplateId ?? null,
    warrantyReviewRequired: Boolean(wo.warrantyReviewRequired),
    billableToCustomer: wo.billableToCustomer !== false,
    assignedUserId: techRaw,
    createdAt: wo.createdAt ?? "",
    totalPartsCents: Math.round((wo.totalPartsCost ?? 0) * 100),
    completedAt: completed,
    scheduledOnYmd: sched,
  }
}

function minYmd(a: string | null | undefined, b: string | null | undefined): string | null {
  const aa = a?.trim()
  const bb = b?.trim()
  if (!aa) return bb ?? null
  if (!bb) return aa
  return aa < bb ? aa : bb
}

export function buildDispatchOpsContextFromEquipmentAssets(
  assets: Array<{
    category: string | null
    nextServiceDueYmd?: string | null
    nextCalibrationDueYmd?: string | null
    calibrationRecordId: string | null
  }>,
): DispatchOpsContext {
  let equipmentNextServiceDueYmd: string | null = null
  let equipmentNextCalibrationYmd: string | null = null
  let category: string | null = null
  let hasCalibrationRecord = false

  for (const a of assets) {
    equipmentNextServiceDueYmd = minYmd(equipmentNextServiceDueYmd, a.nextServiceDueYmd ?? null)
    equipmentNextCalibrationYmd = minYmd(equipmentNextCalibrationYmd, a.nextCalibrationDueYmd ?? null)
    if (a.calibrationRecordId) hasCalibrationRecord = true
    if (!category && a.category?.trim()) category = a.category.trim()
  }

  return {
    equipmentNextServiceDueYmd,
    equipmentNextCalibrationYmd,
    hasCalibrationRecord,
    equipmentCount: Math.max(assets.length, 1),
    equipmentCategory: category,
    invoiceAgg: null,
    linkedInvoiceCount: 0,
    organizationCertificateReleaseMode: null,
    customerCertificateReleaseMode: null,
    certPaymentBlocked: false,
  }
}

/** Badges for work order drawer when assets include PM/calibration dates from detail load. */
export function deriveOperationalBadgesForDrawer(
  wo: WorkOrder,
  assets: Array<{
    category: string | null
    nextServiceDueYmd?: string | null
    nextCalibrationDueYmd?: string | null
    calibrationRecordId: string | null
  }>,
): OperationalBadge[] {
  const input = workOrderToDispatchOpsInput(wo)
  const ctx = buildDispatchOpsContextFromEquipmentAssets(assets)
  return deriveOperationalBadges(input, ctx)
}
