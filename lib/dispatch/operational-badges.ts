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
}

export const todayYmdUtc = () => new Date().toISOString().slice(0, 10)

function ymdBeforeToday(ymd: string | null | undefined): boolean {
  if (!ymd?.trim()) return false
  return ymd < todayYmdUtc()
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

/**
 * Produces 0–5 badges; caller may truncate for card density.
 */
export function deriveOperationalBadges(wo: DispatchOpsInput, ctx: DispatchOpsContext): OperationalBadge[] {
  const out: OperationalBadge[] = []
  const t = todayYmd()

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
  } else if (
    wo.status === "completed" &&
    wo.billableToCustomer !== false &&
    wo.billingState == null
  ) {
    out.push({ key: "rtb", label: "Ready to bill", tone: "warning" })
  }

  // Certificate
  if (
    wo.calibrationTemplateId &&
    ["completed", "invoiced", "completed_pending_signature"].includes(wo.status) &&
    !ctx.hasCalibrationRecord
  ) {
    out.push({ key: "cert", label: "Cert pending", tone: "warning" })
  }

  if ((wo.totalPartsCents ?? 0) > 0 && ["open", "scheduled", "in_progress"].includes(wo.status)) {
    out.push({ key: "parts", label: "Parts", tone: "info" })
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

  // Compliance-sensitive category (lightweight)
  const cat = (ctx.equipmentCategory ?? "").toLowerCase()
  if (cat && (cat.includes("medical") || cat.includes("calibration") || cat.includes("gas") || cat.includes("life safety"))) {
    out.push({ key: "sens", label: "Compliance", tone: "info" })
  }

  // Dedup by key, preserve order
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
  | "pm_risk"
  | "unassigned_aging"
  | "warranty_review"

/** Precomputed on the server/client batch pass for toolbar filters (no re-derive). */
export type OpsFlags = {
  billing_ready: boolean
  cert_pending: boolean
  pm_risk: boolean
  unassigned_aging: boolean
  warranty_review: boolean
}

export function dispatchBadgeSummary(
  wo: DispatchOpsInput,
  ctx: DispatchOpsContext,
): { matches: (f: DispatchFilterId) => boolean } {
  const badges = deriveOperationalBadges(wo, ctx)
  const keys = new Set(badges.map((b) => b.key))

  return {
    matches: (f: DispatchFilterId) => {
      if (f === "all") return true
      if (f === "billing_ready") return keys.has("rtb")
      if (f === "cert_pending") return keys.has("cert")
      if (f === "pm_risk") return keys.has("pm-overdue") || keys.has("pm-soon") || keys.has("cal-overdue")
      if (f === "unassigned_aging") return keys.has("aging")
      if (f === "warranty_review") return wo.warrantyReviewRequired
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
