import type { EquipmentReliabilityLabel, EquipmentReliabilityResult } from "@/lib/equipment-reliability/types"

const MS_DAY = 86_400_000

export const RELIABILITY_DISCLAIMER =
  "Derived from work order types, titles, and visit timing only. This is not root-cause analysis or a prediction of future failures."

export type ReliabilityWorkOrderInput = {
  created_at: string
  completed_at: string | null
  status: string
  type: string
  title: string
}

function isExcludedStatus(status: string): boolean {
  const s = (status ?? "").toLowerCase()
  return s === "canceled" || s === "cancelled"
}

/** True if any activity timestamp falls inside [startMs, endMs]. */
function woTouchesWindow(w: ReliabilityWorkOrderInput, startMs: number, endMs: number): boolean {
  if (isExcludedStatus(w.status)) return false
  const times: number[] = []
  const c = new Date(w.created_at).getTime()
  if (!Number.isNaN(c)) times.push(c)
  if (w.completed_at?.trim()) {
    const d = new Date(w.completed_at).getTime()
    if (!Number.isNaN(d)) times.push(d)
  }
  if (times.length === 0) return false
  return times.some((t) => t >= startMs && t <= endMs)
}

export function isRepairLikeWoType(type: string): boolean {
  const x = (type ?? "").toLowerCase().trim().replace(/\s+/g, "_")
  if (!x) return true
  if (x === "pm" || x === "preventive" || x === "preventive_maintenance") return false
  if (x === "inspection" || x === "install" || x === "calibration") return false
  return true
}

export function normalizeIssueTitleKey(title: string): string {
  return (title ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160)
}

/**
 * Deterministic repeat-service / frequency signals from work order history.
 */
export function evaluateEquipmentReliability(
  workOrders: ReliabilityWorkOrderInput[],
  options?: { asOf?: Date },
): EquipmentReliabilityResult {
  const asOf = options?.asOf ?? new Date()
  const endMs = asOf.getTime()
  const d90 = endMs - 90 * MS_DAY
  const d180 = endMs - 180 * MS_DAY
  const d365 = endMs - 365 * MS_DAY

  const visits90 = workOrders.filter((w) => woTouchesWindow(w, d90, endMs))
  const visits180 = workOrders.filter((w) => woTouchesWindow(w, d180, endMs))
  const visits365 = workOrders.filter((w) => woTouchesWindow(w, d365, endMs))

  const repairs90 = visits90.filter((w) => isRepairLikeWoType(w.type))
  const repairs180 = visits180.filter((w) => isRepairLikeWoType(w.type))

  const clusterMinLen = 10
  const keyCounts = new Map<string, number>()
  for (const w of repairs180) {
    const key = normalizeIssueTitleKey(w.title)
    if (key.length < clusterMinLen) continue
    keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1)
  }
  let maxCluster = 0
  for (const n of keyCounts.values()) maxCluster = Math.max(maxCluster, n)

  const reasons: string[] = []
  let dataQuality: EquipmentReliabilityResult["dataQuality"] = "strong"
  if (visits365.length < 4) dataQuality = visits365.length < 2 ? "limited" : "moderate"

  if (visits365.length < 2) {
    return {
      label: "reliability_unknown",
      reasons: [
        "Fewer than two service events in the last 12 months — not enough history to judge reliability.",
      ],
      dataQuality: "limited",
    }
  }

  if (maxCluster >= 2) {
    reasons.push(
      `Multiple repair-type visits in six months share a similar work order title (${maxCluster} matches) — review for repeat failure or unclear fix.`,
    )
  }
  if (repairs90.length >= 3) {
    reasons.push(`${repairs90.length} repair-type visits in the last 90 days — unusually high churn.`)
  }
  if (visits90.length >= 6) {
    reasons.push(`${visits90.length} total visits in the last 90 days — elevated service frequency.`)
  } else if (visits90.length >= 3) {
    reasons.push(`${visits90.length} visits in the last 90 days — worth monitoring.`)
  }
  if (repairs180.length >= 2 && maxCluster < 2) {
    reasons.push(`${repairs180.length} repair-type visits in six months with different titles — intermittent issues possible.`)
  }

  if (reasons.length === 0) {
    reasons.push("Visit pattern is within typical bounds for the windows evaluated.")
  }

  let label: EquipmentReliabilityLabel
  if (maxCluster >= 2 || repairs90.length >= 3) {
    label = "repeat_failure_risk"
  } else if (visits90.length >= 6 || repairs180.length >= 5) {
    label = "frequent_service"
  } else if (visits90.length >= 3 || repairs180.length >= 2) {
    label = "watch"
  } else {
    label = "stable"
  }

  return {
    label,
    reasons: [...new Set(reasons)].slice(0, 5),
    dataQuality,
  }
}

export function formatEquipmentReliabilityLabel(label: EquipmentReliabilityLabel): string {
  switch (label) {
    case "stable":
      return "Stable"
    case "watch":
      return "Watch"
    case "frequent_service":
      return "Frequent service"
    case "repeat_failure_risk":
      return "Repeat failure risk"
    case "reliability_unknown":
      return "Reliability unknown"
    default:
      return label
  }
}

export function equipmentReliabilityBadgeClass(label: EquipmentReliabilityLabel): string {
  switch (label) {
    case "stable":
      return "border-[color:var(--status-success)]/40 bg-[color:var(--status-success)]/10 text-emerald-950 dark:text-emerald-100"
    case "watch":
      return "border-[color:var(--status-warning)]/45 bg-[color:var(--status-warning)]/10 text-amber-950 dark:text-amber-100"
    case "frequent_service":
      return "border-orange-400/50 bg-orange-500/10 text-orange-950 dark:text-orange-100"
    case "repeat_failure_risk":
      return "border-destructive/40 bg-destructive/10 text-destructive"
    case "reliability_unknown":
      return "border-border bg-muted text-muted-foreground"
    default:
      return "border-border bg-card"
  }
}

export function portalReliabilityPayload(result: EquipmentReliabilityResult, maxReasons = 4) {
  return {
    label: formatEquipmentReliabilityLabel(result.label),
    labelKey: result.label,
    reasons: result.reasons.slice(0, maxReasons),
    disclaimer: RELIABILITY_DISCLAIMER,
  }
}
