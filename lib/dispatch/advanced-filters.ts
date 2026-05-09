import type { DispatchWo } from "@/components/dispatch/dispatch-board"

export type Phase34WorkKindFilter = "all" | "maintenance" | "repair" | "request"

export type Phase34DispatchFilters = {
  technicianId: string | "all"
  customerId: string | "all"
  customerLocationId: string | "all"
  /** Case-insensitive match against customer name, title, WO number string */
  customerText: string
  /** City, state, ZIP, site label, equipment location — case-insensitive */
  geoText: string
  /** Substring match on work order `type` */
  woTypeText: string
  priority: "all" | "critical" | "high" | "normal" | "low"
  workKind: Phase34WorkKindFilter
  unassignedOnly: boolean
  overdueScheduledOnly: boolean
  fromServiceRequestOnly: boolean
  /** When true, hide assigned jobs not on the active dispatch day (unassigned still shown) */
  selectedDayOnly: boolean
}

export function isPhase34DispatchFiltering(f: Phase34DispatchFilters): boolean {
  return (
    f.technicianId !== "all" ||
    f.customerId !== "all" ||
    f.customerLocationId !== "all" ||
    Boolean(f.customerText.trim()) ||
    Boolean(f.geoText.trim()) ||
    Boolean(f.woTypeText.trim()) ||
    f.priority !== "all" ||
    f.workKind !== "all" ||
    f.unassignedOnly ||
    f.overdueScheduledOnly ||
    f.fromServiceRequestOnly ||
    f.selectedDayOnly
  )
}

export const DEFAULT_PHASE34_DISPATCH_FILTERS: Phase34DispatchFilters = {
  technicianId: "all",
  customerId: "all",
  customerLocationId: "all",
  customerText: "",
  geoText: "",
  woTypeText: "",
  priority: "all",
  workKind: "all",
  unassignedOnly: false,
  overdueScheduledOnly: false,
  fromServiceRequestOnly: false,
  selectedDayOnly: false,
}

function includesInsensitive(hay: string, needle: string): boolean {
  if (!needle.trim()) return true
  return hay.toLowerCase().includes(needle.trim().toLowerCase())
}

export function applyPhase34DispatchFilters(
  rows: DispatchWo[],
  f: Phase34DispatchFilters,
  selectedYmd: string,
): DispatchWo[] {
  return rows.filter((w) => {
    if (f.unassignedOnly && w.assigned_user_id) return false
    if (f.technicianId !== "all" && w.assigned_user_id !== f.technicianId) return false
    if (f.customerId !== "all" && w.customer_id !== f.customerId) return false
    if (f.customerLocationId !== "all") {
      const lid = w.customerLocationId ?? null
      if (lid !== f.customerLocationId) return false
    }
    if (f.priority !== "all" && (w.priority ?? "normal") !== f.priority) return false
    if (f.workKind !== "all" && w.workKind !== f.workKind) return false
    if (f.overdueScheduledOnly && !w.opsFlags?.sched_past_due) return false
    if (f.fromServiceRequestOnly && !w.fromServiceRequest) return false

    if (f.selectedDayOnly && selectedYmd) {
      const unassigned = !w.assigned_user_id
      const onDay = w.scheduled_on === selectedYmd
      if (!unassigned && !onDay) return false
    }

    if (f.customerText.trim()) {
      const q = f.customerText.trim().toLowerCase()
      const num = w.work_order_number != null ? String(w.work_order_number) : ""
      const blob = [w.customerName, w.title, num, w.id].join(" ").toLowerCase()
      if (!blob.includes(q)) return false
    }

    if (f.geoText.trim()) {
      const q = f.geoText.trim().toLowerCase()
      const blob = [
        w.geoLine,
        w.siteLabel,
        w.serviceLocationLabel,
        w.addressLine1,
        w.city,
        w.state,
        w.postalCode,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      if (!blob.includes(q)) return false
    }

    if (f.woTypeText.trim() && !includesInsensitive(w.type ?? "", f.woTypeText)) return false

    return true
  })
}

export type DispatchPlanningMetrics = {
  jobsOnSelectedDayByTech: Map<string, number>
  overdueScheduledCount: number
  unassignedScheduledCount: number
  overloadedTechIds: Set<string>
}

/** Capacity / planning counts from the current (usually filtered) work order list. */
export function computeDispatchPlanningMetrics(
  rows: DispatchWo[],
  selectedYmd: string,
  overloadThreshold = 6,
): DispatchPlanningMetrics {
  const jobsOnSelectedDayByTech = new Map<string, number>()
  let overdueScheduledCount = 0
  let unassignedScheduledCount = 0
  const overloadedTechIds = new Set<string>()

  for (const w of rows) {
    if (w.opsFlags?.sched_past_due) overdueScheduledCount++
    if (
      !w.assigned_user_id &&
      w.scheduled_on &&
      ["open", "scheduled", "in_progress"].includes(w.status)
    ) {
      unassignedScheduledCount++
    }
    if (w.assigned_user_id && w.scheduled_on === selectedYmd) {
      const uid = w.assigned_user_id
      jobsOnSelectedDayByTech.set(uid, (jobsOnSelectedDayByTech.get(uid) ?? 0) + 1)
    }
  }

  for (const [uid, n] of jobsOnSelectedDayByTech) {
    if (n >= overloadThreshold) overloadedTechIds.add(uid)
  }

  return { jobsOnSelectedDayByTech, overdueScheduledCount, unassignedScheduledCount, overloadedTechIds }
}
