import type { Equipment } from "@/lib/mock-data"
import type { WarrantyEvaluationResult } from "@/lib/equipment-warranties/types"
import { utcTodayYmd, daysBetweenYmd } from "@/lib/equipment-warranties/eval"
import { daysUntilDue, isForecastEligiblePlan } from "@/lib/maintenance-plans/forecast"
import type { ReplacementReadinessLabel, ReplacementReadinessResult } from "@/lib/equipment-replacement/types"

const MS_DAY = 86_400_000

export const REPLACEMENT_DISCLAIMER =
  "Indicators use install date, warranty posture, preventive due dates, and recent work orders. They are not a guarantee of failure or remaining life."

export type ReplacementWorkOrderInput = {
  created_at: string
  completed_at: string | null
  status: string
}

export type ReplacementMaintenancePlanInput = {
  status: string
  next_due_date: string | null
}

export type EvaluateReplacementReadinessArgs = {
  asOf?: Date
  installDateYmd: string | null
  equipmentStatus: Equipment["status"]
  warranty: WarrantyEvaluationResult
  workOrders: ReplacementWorkOrderInput[]
  equipmentNextDueYmd: string | null
  maintenancePlans: ReplacementMaintenancePlanInput[]
}

function ymdFromIso(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null
  const head = iso.trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : null
}

function monthsSinceInstallYmd(installYmd: string, asOf: Date): number | null {
  const today = utcTodayYmd(asOf)
  const days = daysBetweenYmd(installYmd, today)
  if (days === null || days < 0) return null
  return Math.floor(days / 30)
}

function isOpenWoStatus(status: string): boolean {
  const s = (status ?? "").toLowerCase()
  return s === "open" || s === "scheduled" || s === "in_progress"
}

function woInRollingWindow(wo: ReplacementWorkOrderInput, startMs: number): boolean {
  const c = new Date(wo.created_at).getTime()
  if (!Number.isNaN(c) && c >= startMs) return true
  if (wo.completed_at?.trim()) {
    const d = new Date(wo.completed_at).getTime()
    if (!Number.isNaN(d) && d >= startMs) return true
  }
  return false
}

export function equipmentStatusDbToUi(db: string | null | undefined): Equipment["status"] {
  switch ((db ?? "").toLowerCase()) {
    case "needs_service":
      return "Needs Service"
    case "out_of_service":
      return "Out of Service"
    case "in_repair":
      return "In Repair"
    case "active":
    default:
      return "Active"
  }
}

export function formatReplacementReadinessLabel(label: ReplacementReadinessLabel): string {
  switch (label) {
    case "healthy":
      return "Healthy"
    case "monitor":
      return "Monitor"
    case "consider_replacement":
      return "Consider replacement"
    case "replacement_recommended":
      return "Replacement recommended"
    case "insufficient_data":
      return "Insufficient data"
    default:
      return label
  }
}

export function replacementReadinessBadgeClass(label: ReplacementReadinessLabel): string {
  switch (label) {
    case "healthy":
      return "border-[color:var(--status-success)]/40 bg-[color:var(--status-success)]/10 text-emerald-950 dark:text-emerald-100"
    case "monitor":
      return "border-[color:var(--status-warning)]/45 bg-[color:var(--status-warning)]/10 text-amber-950 dark:text-amber-100"
    case "consider_replacement":
      return "border-orange-400/50 bg-orange-500/10 text-orange-950 dark:text-orange-100"
    case "replacement_recommended":
      return "border-destructive/40 bg-destructive/10 text-destructive"
    case "insufficient_data":
      return "border-border bg-muted text-muted-foreground"
    default:
      return "border-border bg-card"
  }
}

/**
 * Deterministic scoring from operational fields only (no AI, no invoice totals).
 */
export function evaluateReplacementReadiness(args: EvaluateReplacementReadinessArgs): ReplacementReadinessResult {
  const asOf = args.asOf ?? new Date()
  const todayYmd = utcTodayYmd(asOf)
  const reasons: string[] = []
  let score = 0

  const installYmd = ymdFromIso(args.installDateYmd)
  const months = installYmd ? monthsSinceInstallYmd(installYmd, asOf) : null

  let agePoints = 0
  if (months != null) {
    if (months >= 180) {
      agePoints = 34
      reasons.push("Asset is roughly 15+ years from install date — typical capital planning horizon.")
    } else if (months >= 120) {
      agePoints = 26
      reasons.push("Asset is roughly 10+ years from install date.")
    } else if (months >= 84) {
      agePoints = 18
      reasons.push("Asset is roughly 7+ years from install date.")
    } else if (months >= 60) {
      agePoints = 10
      reasons.push("Asset is roughly 5+ years from install date.")
    }
  } else {
    agePoints = 6
    reasons.push("Install date missing — age-based risk is unclear.")
  }
  score += agePoints

  switch (args.warranty.label) {
    case "warranty_expired":
      score += 20
      reasons.push("Manufacturer or recorded warranty has ended.")
      break
    case "expiring_soon":
      score += 8
      reasons.push("Warranty ending soon — plan for uncovered repairs.")
      break
    case "no_warranty":
      score += 4
      reasons.push("No warranty coverage on file.")
      break
    case "under_warranty":
      score = Math.max(0, score - 6)
      break
    default:
      break
  }

  switch (args.equipmentStatus) {
    case "Out of Service":
      score += 32
      reasons.push("Equipment status is out of service.")
      break
    case "Needs Service":
      score += 12
      reasons.push("Equipment flagged as needs service.")
      break
    case "In Repair":
      score += 8
      reasons.push("Equipment is currently in repair.")
      break
    default:
      break
  }

  const twelveMoAgo = asOf.getTime() - 365 * MS_DAY
  const ninetyAgo = asOf.getTime() - 90 * MS_DAY
  const recentWos = args.workOrders.filter((w) => woInRollingWindow(w, twelveMoAgo))
  const openWos = args.workOrders.filter((w) => isOpenWoStatus(w.status))
  const recent90 = args.workOrders.filter((w) => woInRollingWindow(w, ninetyAgo))

  if (recentWos.length >= 6) {
    score += 26
    reasons.push("Very high visit count in the last 12 months.")
  } else if (recentWos.length >= 4) {
    score += 18
    reasons.push("Several work orders in the last 12 months.")
  } else if (recentWos.length >= 2) {
    score += 10
    reasons.push("Multiple work orders in the last 12 months.")
  }

  if (recent90.length >= 3) {
    score += 8
    reasons.push("Elevated service activity in the last 90 days.")
  }

  if (openWos.length >= 2) {
    score += 6
    reasons.push("Multiple open or in-progress work orders.")
  }

  const nextDue = args.equipmentNextDueYmd?.trim() ? args.equipmentNextDueYmd.trim().slice(0, 10) : null
  if (nextDue && /^\d{4}-\d{2}-\d{2}$/.test(nextDue)) {
    const d = daysUntilDue(nextDue, todayYmd)
    if (d !== null && d < 0) {
      score += 16
      reasons.push("Next scheduled service / PM date on the asset is overdue.")
    } else if (d !== null && d <= 7) {
      score += 4
      reasons.push("Preventive service due within a week.")
    }
  }

  let planOverdue = false
  for (const p of args.maintenancePlans) {
    const row = {
      id: "x",
      status: p.status,
      next_due_date: p.next_due_date,
      is_archived: false,
    }
    if (!isForecastEligiblePlan(row)) continue
    const nd = p.next_due_date!.trim()
    const d = daysUntilDue(nd, todayYmd)
    if (d !== null && d < 0) {
      planOverdue = true
      break
    }
  }
  if (planOverdue) {
    score += 12
    reasons.push("Active maintenance plan with overdue preventive date.")
  }

  const hasInstall = Boolean(installYmd)
  const hasPmSignal = Boolean(nextDue) || args.maintenancePlans.some((p) => p.next_due_date?.trim())
  const hasWoHistory = args.workOrders.length > 0
  const hasWarrantySignal = args.warranty.label !== "no_warranty" || args.warranty.source !== "none"

  let dataQuality: ReplacementReadinessResult["dataQuality"] = "strong"
  const signals = [hasInstall, hasPmSignal, hasWoHistory, hasWarrantySignal].filter(Boolean).length
  if (signals <= 1) dataQuality = "limited"
  else if (signals === 2) dataQuality = "moderate"

  const strongOutcomeSignals =
    args.equipmentStatus === "Out of Service" ||
    recentWos.length >= 4 ||
    args.warranty.label === "warranty_expired" ||
    planOverdue ||
    (nextDue && daysUntilDue(nextDue, todayYmd) !== null && daysUntilDue(nextDue, todayYmd)! < 0)

  if (dataQuality === "limited" && !strongOutcomeSignals) {
    const dedup = [...new Set(reasons)]
    const merged = [
      "Limited install, warranty, maintenance, or work-order history on file.",
      ...dedup.filter((r) => !r.toLowerCase().includes("limited install")),
    ]
    return {
      label: "insufficient_data",
      riskScore: Math.min(100, Math.round(score)),
      reasons: merged.slice(0, 5),
      dataQuality: "limited",
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)))

  let label: ReplacementReadinessLabel
  if (score >= 68) label = "replacement_recommended"
  else if (score >= 46) label = "consider_replacement"
  else if (score >= 26) label = "monitor"
  else label = "healthy"

  const uniq = [...new Set(reasons)]
  const topReasons = uniq.slice(0, 5)
  if (topReasons.length === 0) {
    topReasons.push("No notable replacement pressure from available operational signals.")
  }

  return {
    label,
    riskScore: score,
    reasons: topReasons,
    dataQuality,
  }
}

/** Portal-safe copy: same reasons (already non-financial); trim length. */
export function portalReplacementPayload(result: ReplacementReadinessResult, maxReasons = 4) {
  return {
    label: formatReplacementReadinessLabel(result.label),
    labelKey: result.label,
    reasons: result.reasons.slice(0, maxReasons),
    disclaimer: REPLACEMENT_DISCLAIMER,
  }
}
