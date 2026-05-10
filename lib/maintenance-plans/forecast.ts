import type { MaintenancePlan } from "@/lib/mock-data"
import { planStatusUiToDb } from "@/lib/maintenance-plans/db-map"

/** Minimal row shape for forecasting (DB or UI-derived). */
export type MaintenanceForecastPlanInput = {
  id: string
  /** DB status: active | paused | expired */
  status: string
  next_due_date: string | null
  is_archived?: boolean
  customer_id?: string
  customer_name?: string
  equipment_id?: string | null
  equipment_name?: string
}

export type DueWindowKey = "overdue" | "d0_7" | "d8_30" | "d31_60" | "d61_90" | "beyond_90" | "no_date"

export type MaintenanceForecastSummary = {
  /** Active, non-archived, with `next_due_date`. */
  forecastableCount: number
  /** Exclusive buckets (each plan counted once). */
  exclusive: Record<DueWindowKey, number>
  /** Cumulative “due on or before” horizon from today (includes overdue). */
  cumulative: { within7: number; within30: number; within60: number; within90: number }
  workloadWeeks: Array<{ weekStart: string; weekEnd: string; label: string; count: number }>
  workloadMonths: Array<{ monthKey: string; label: string; count: number }>
  byCustomer: Array<{ customerId: string; name: string; overdue: number; upcoming: number }>
  byEquipment: Array<{ equipmentId: string; name: string; overdue: number; upcoming: number }>
}

const MS_DAY = 86_400_000

export function utcTodayYmd(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

export function daysUntilDue(nextDueYmd: string, todayYmd?: string): number | null {
  const t = (todayYmd ?? utcTodayYmd()).trim()
  const d = nextDueYmd.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !/^\d{4}-\d{2}-\d{2}$/.test(t)) return null
  const a = new Date(`${d}T12:00:00.000Z`).getTime()
  const b = new Date(`${t}T12:00:00.000Z`).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return Math.round((a - b) / MS_DAY)
}

export function isForecastEligiblePlan(row: MaintenanceForecastPlanInput): boolean {
  if (row.is_archived) return false
  const s = String(row.status ?? "").toLowerCase()
  if (s !== "active") return false
  const nd = row.next_due_date?.trim()
  return Boolean(nd && /^\d{4}-\d{2}-\d{2}$/.test(nd))
}

export function maintenancePlanToForecastInput(p: MaintenancePlan): MaintenanceForecastPlanInput {
  const statusUi = p?.status ?? "Active"
  const nextRaw = typeof p?.nextDueDate === "string" ? p.nextDueDate.trim() : ""
  return {
    id: p?.id ?? "",
    status: planStatusUiToDb(statusUi),
    next_due_date: nextRaw || null,
    is_archived: p?.isArchived === true,
    customer_id: p?.customerId ?? "",
    customer_name: p?.customerName ?? "",
    equipment_id: p?.equipmentId?.trim() ? p.equipmentId.trim() : null,
    equipment_name: p?.equipmentName ?? "",
  }
}

export type WorkOrderReadiness = {
  ready: boolean
  /** User-facing reasons when not ready (does not call billing/API gates). */
  blockers: string[]
}

/**
 * Indicators only — does not create work orders or call billing enforcement.
 * UI should still respect `enforceCanCreateRecord` / billing toasts on click.
 */
export function getMaintenanceWorkOrderReadiness(plan: MaintenancePlan): WorkOrderReadiness {
  const blockers: string[] = []
  if (plan.isArchived) blockers.push("Plan is archived.")
  if (plan.status !== "Active") blockers.push("Plan must be active.")
  if (!plan.equipmentId?.trim()) blockers.push("Attach equipment before generating a work order.")
  if (!plan.nextDueDate?.trim()) blockers.push("Set a next due date to schedule from this plan.")
  return { ready: blockers.length === 0, blockers }
}

function exclusiveBucket(offset: number | null): DueWindowKey {
  if (offset === null) return "no_date"
  if (offset < 0) return "overdue"
  if (offset <= 7) return "d0_7"
  if (offset <= 30) return "d8_30"
  if (offset <= 60) return "d31_60"
  if (offset <= 90) return "d61_90"
  return "beyond_90"
}

function mondayOfWeekContaining(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00.000Z`)
  if (Number.isNaN(d.getTime())) return ymd
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00.000Z`)
  if (Number.isNaN(d.getTime())) return ymd
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function monthKeyFromYmd(ymd: string): string {
  return ymd.slice(0, 7)
}

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number)
  if (!y || !m) return monthKey
  const d = new Date(Date.UTC(y, m - 1, 1))
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" })
}

function weekLabel(weekStart: string, weekEnd: string): string {
  const a = new Date(`${weekStart}T12:00:00.000Z`)
  const b = new Date(`${weekEnd}T12:00:00.000Z`)
  const o: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
  return `${a.toLocaleDateString("en-US", o)} – ${b.toLocaleDateString("en-US", o)}`
}

export function summarizeMaintenanceForecast(
  rows: MaintenanceForecastPlanInput[] | null | undefined,
  options?: { todayYmd?: string; weeksAhead?: number; monthsAhead?: number },
): MaintenanceForecastSummary {
  const safeRows = Array.isArray(rows) ? rows : []
  const today = options?.todayYmd ?? utcTodayYmd()
  const weeksAhead = options?.weeksAhead ?? 8
  const monthsAhead = options?.monthsAhead ?? 6

  const eligible = safeRows.filter((r) => Boolean(r?.id?.trim()) && isForecastEligiblePlan(r))

  const exclusive: Record<DueWindowKey, number> = {
    overdue: 0,
    d0_7: 0,
    d8_30: 0,
    d31_60: 0,
    d61_90: 0,
    beyond_90: 0,
    no_date: 0,
  }

  let within7 = 0
  let within30 = 0
  let within60 = 0
  let within90 = 0

  const weekMap = new Map<string, number>()
  const monthMap = new Map<string, number>()

  const mondayThisWeek = mondayOfWeekContaining(today)
  for (let w = 0; w < weeksAhead; w++) {
    const start = addDaysYmd(mondayThisWeek, w * 7)
    weekMap.set(start, 0)
  }

  const tm = monthKeyFromYmd(today)
  const [ty, tmo] = tm.split("-").map(Number)
  for (let m = 0; m < monthsAhead; m++) {
    const d = new Date(Date.UTC(ty, tmo - 1 + m, 1))
    const key = d.toISOString().slice(0, 7)
    monthMap.set(key, 0)
  }

  type Agg = { overdue: number; upcoming: number }
  const cust = new Map<string, Agg & { name: string }>()
  const eq = new Map<string, Agg & { name: string }>()

  for (const row of eligible) {
    const nd = row.next_due_date!.trim()
    const offset = daysUntilDue(nd, today)
    const bucket = exclusiveBucket(offset)
    exclusive[bucket]++

    if (offset !== null) {
      if (offset < 0) {
        within7++
        within30++
        within60++
        within90++
      } else {
        if (offset <= 7) within7++
        if (offset <= 30) within30++
        if (offset <= 60) within60++
        if (offset <= 90) within90++
      }
    }

    const wk = mondayOfWeekContaining(nd)
    if (weekMap.has(wk)) {
      weekMap.set(wk, (weekMap.get(wk) ?? 0) + 1)
    }

    const mk = monthKeyFromYmd(nd)
    if (monthMap.has(mk)) {
      monthMap.set(mk, (monthMap.get(mk) ?? 0) + 1)
    }

    const cid = row.customer_id ?? ""
    const cname = row.customer_name?.trim() || "Customer"
    if (cid) {
      const cur = cust.get(cid) ?? { name: cname, overdue: 0, upcoming: 0 }
      cur.name = cname
      if (offset !== null && offset < 0) cur.overdue++
      else if (offset !== null && offset <= 90) cur.upcoming++
      cust.set(cid, cur)
    }

    const eid = row.equipment_id?.trim() ?? ""
    const ename = row.equipment_name?.trim() || "Equipment"
    if (eid) {
      const cur = eq.get(eid) ?? { name: ename, overdue: 0, upcoming: 0 }
      cur.name = ename
      if (offset !== null && offset < 0) cur.overdue++
      else if (offset !== null && offset <= 90) cur.upcoming++
      eq.set(eid, cur)
    }
  }

  const workloadWeeks = [...weekMap.entries()].map(([weekStart, count]) => {
    const weekEnd = addDaysYmd(weekStart, 6)
    return { weekStart, weekEnd, label: weekLabel(weekStart, weekEnd), count }
  })

  const workloadMonths = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, count]) => ({ monthKey, label: monthLabel(monthKey), count }))

  const byCustomer = [...cust.entries()]
    .map(([customerId, v]) => ({
      customerId,
      name: v.name,
      overdue: v.overdue,
      upcoming: v.upcoming,
    }))
    .filter((r) => r.overdue > 0 || r.upcoming > 0)
    .sort((a, b) => b.overdue - a.overdue || b.upcoming - a.upcoming)

  const byEquipment = [...eq.entries()]
    .map(([equipmentId, v]) => ({
      equipmentId,
      name: v.name,
      overdue: v.overdue,
      upcoming: v.upcoming,
    }))
    .filter((r) => r.overdue > 0 || r.upcoming > 0)
    .sort((a, b) => b.overdue - a.overdue || b.upcoming - a.upcoming)

  return {
    forecastableCount: eligible.length,
    exclusive,
    cumulative: { within7, within30, within60, within90 },
    workloadWeeks,
    workloadMonths,
    byCustomer,
    byEquipment,
  }
}
