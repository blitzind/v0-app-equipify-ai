import type {
  MaintenancePlan,
  MaintenancePlanService,
  NotificationRule,
  PlanInterval,
  PlanStatus,
  WorkOrderPriority,
  WorkOrderType,
} from "@/lib/mock-data"

/** Embedded in `services` JSONB to persist WO template fields not modeled as columns. */
export const WO_DEFAULTS_SERVICE_ID = "__equipify_wo_defaults"

export type MaintenancePlanRow = {
  id: string
  organization_id: string
  customer_id: string
  equipment_id: string | null
  assigned_user_id: string | null
  name: string
  status: "active" | "paused" | "expired"
  priority: "low" | "normal" | "high" | "critical"
  interval_value: number
  interval_unit: "day" | "week" | "month" | "year"
  last_service_date: string | null
  next_due_date: string | null
  auto_create_work_order: boolean
  notes: string | null
  services: unknown
  notification_rules: unknown
  is_archived: boolean
  created_at: string
  updated_at: string
  last_auto_wo_at?: string | null
}

export function planStatusUiToDb(s: PlanStatus): MaintenancePlanRow["status"] {
  const m: Record<PlanStatus, MaintenancePlanRow["status"]> = {
    Active: "active",
    Paused: "paused",
    Expired: "expired",
  }
  return m[s]
}

export function planStatusDbToUi(s: string): PlanStatus {
  const m: Record<string, PlanStatus> = {
    active: "Active",
    paused: "Paused",
    expired: "Expired",
  }
  return m[s] ?? "Active"
}

export function intervalToDb(
  interval: PlanInterval,
  customDays: number
): { interval_value: number; interval_unit: MaintenancePlanRow["interval_unit"] } {
  switch (interval) {
    case "Annual":
      return { interval_value: 1, interval_unit: "year" }
    case "Semi-Annual":
      return { interval_value: 6, interval_unit: "month" }
    case "Quarterly":
      return { interval_value: 3, interval_unit: "month" }
    case "Monthly":
      return { interval_value: 1, interval_unit: "month" }
    case "Custom":
      return {
        interval_value: Math.max(1, customDays || 90),
        interval_unit: "day",
      }
  }
}

export function intervalFromDb(
  interval_value: number,
  interval_unit: MaintenancePlanRow["interval_unit"]
): { interval: PlanInterval; customIntervalDays: number } {
  if (interval_unit === "year" && interval_value === 1) {
    return { interval: "Annual", customIntervalDays: 0 }
  }
  if (interval_unit === "month") {
    if (interval_value === 6) return { interval: "Semi-Annual", customIntervalDays: 0 }
    if (interval_value === 3) return { interval: "Quarterly", customIntervalDays: 0 }
    if (interval_value === 1) return { interval: "Monthly", customIntervalDays: 0 }
  }
  if (interval_unit === "day") {
    return { interval: "Custom", customIntervalDays: interval_value }
  }
  if (interval_unit === "week") {
    return { interval: "Custom", customIntervalDays: interval_value * 7 }
  }
  return { interval: "Custom", customIntervalDays: interval_value }
}

function parseServiceRow(raw: unknown): MaintenancePlanService | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  if (o.id === WO_DEFAULTS_SERVICE_ID) return null
  const id = String(o.id ?? "")
  return {
    id,
    name: String(o.name ?? ""),
    description: String(o.description ?? ""),
    estimatedHours: typeof o.estimatedHours === "number" ? o.estimatedHours : Number(o.estimatedHours) || 0,
    estimatedCost: typeof o.estimatedCost === "number" ? o.estimatedCost : Number(o.estimatedCost) || 0,
  }
}

function parseDefaultsRow(raw: unknown): {
  workOrderType: WorkOrderType
  workOrderPriority: WorkOrderPriority
  preferredServiceTime: string
} | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  if (o.id !== WO_DEFAULTS_SERVICE_ID) return null
  const wt = o.workOrderType as WorkOrderType | undefined
  const wp = o.workOrderPriority as WorkOrderPriority | undefined
  const types: WorkOrderType[] = ["Repair", "PM", "Inspection", "Install", "Emergency"]
  const prios: WorkOrderPriority[] = ["Low", "Normal", "High", "Critical"]
  const pst =
    typeof o.preferredServiceTime === "string" && /^\d{1,2}:\d{2}$/.test(o.preferredServiceTime.trim())
      ? o.preferredServiceTime.trim()
      : "08:00"
  return {
    workOrderType: wt && types.includes(wt) ? wt : "PM",
    workOrderPriority: wp && prios.includes(wp) ? wp : "Normal",
    preferredServiceTime: pst,
  }
}

export function parseServicesJsonb(servicesJson: unknown): {
  displayServices: MaintenancePlanService[]
  workOrderType: WorkOrderType
  workOrderPriority: WorkOrderPriority
  preferredServiceTime: string
} {
  let workOrderType: WorkOrderType = "PM"
  let workOrderPriority: WorkOrderPriority = "Normal"
  let preferredServiceTime = "08:00"
  const displayServices: MaintenancePlanService[] = []

  const arr = Array.isArray(servicesJson) ? servicesJson : []
  for (const item of arr) {
    const defs = parseDefaultsRow(item)
    if (defs) {
      workOrderType = defs.workOrderType
      workOrderPriority = defs.workOrderPriority
      preferredServiceTime = defs.preferredServiceTime
      continue
    }
    const svc = parseServiceRow(item)
    if (svc) displayServices.push(svc)
  }

  return { displayServices, workOrderType, workOrderPriority, preferredServiceTime }
}

/** JSONB payload for `maintenance_plans.services` (includes hidden WO defaults row). */
export function serializeServicesForDb(
  displayServices: MaintenancePlanService[],
  workOrderType: WorkOrderType,
  workOrderPriority: WorkOrderPriority,
  preferredServiceTime?: string
): unknown {
  const time =
    typeof preferredServiceTime === "string" && /^\d{1,2}:\d{2}$/.test(preferredServiceTime.trim())
      ? preferredServiceTime.trim()
      : "08:00"
  return [
    {
      id: WO_DEFAULTS_SERVICE_ID,
      name: "",
      description: "",
      estimatedHours: 0,
      estimatedCost: 0,
      workOrderType,
      workOrderPriority,
      preferredServiceTime: time,
    },
    ...displayServices.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      estimatedHours: s.estimatedHours,
      estimatedCost: s.estimatedCost,
    })),
  ]
}

export function parseNotificationRulesJsonb(raw: unknown): NotificationRule[] {
  if (!Array.isArray(raw)) return []
  const out: NotificationRule[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const r = item as Record<string, unknown>
    out.push({
      id: String(r.id ?? `nr-${Math.random().toString(36).slice(2, 11)}`),
      channel: r.channel as NotificationRule["channel"],
      triggerDays: r.triggerDays as NotificationRule["triggerDays"],
      weekdayTrigger: (r.weekdayTrigger as NotificationRule["weekdayTrigger"]) ?? null,
      enabled: Boolean(r.enabled),
      recipients: Array.isArray(r.recipients) ? (r.recipients as string[]) : [],
    })
  }
  return out
}

export function notificationRulesToJsonb(rules: NotificationRule[]): NotificationRule[] {
  return rules.map((r) => ({ ...r }))
}

export function rowToMaintenancePlan(
  row: MaintenancePlanRow,
  names: {
    customerName: string
    equipmentName: string
    equipmentCategory: string
    location: string
    technicianName: string
  }
): MaintenancePlan {
  const { interval, customIntervalDays } = intervalFromDb(row.interval_value, row.interval_unit)
  const { displayServices, workOrderType, workOrderPriority, preferredServiceTime } = parseServicesJsonb(
    row.services,
  )
  const notificationRules = parseNotificationRulesJsonb(row.notification_rules)

  const lastServiceDate = row.last_service_date ?? ""
  const nextDueDate = row.next_due_date ?? ""
  const startDate = row.created_at ? row.created_at.slice(0, 10) : ""

  return {
    id: row.id,
    name: row.name,
    customerId: row.customer_id,
    customerName: names.customerName,
    equipmentId: row.equipment_id ?? "",
    equipmentName: names.equipmentName,
    equipmentCategory: names.equipmentCategory,
    location: names.location,
    technicianId: row.assigned_user_id ?? "",
    technicianName: names.technicianName,
    interval,
    customIntervalDays,
    status: planStatusDbToUi(row.status),
    startDate,
    lastServiceDate,
    nextDueDate,
    services: displayServices,
    notificationRules,
    autoCreateWorkOrder: row.auto_create_work_order,
    workOrderType,
    workOrderPriority,
    preferredServiceTime,
    notes: row.notes ?? "",
    createdAt: row.created_at,
    totalServicesCompleted: 0,
  }
}

export function computeNextDueDate(
  lastServiceDate: string,
  interval: PlanInterval,
  customIntervalDays: number
): string {
  const base = new Date(lastServiceDate + "T12:00:00")
  if (Number.isNaN(base.getTime())) return lastServiceDate
  switch (interval) {
    case "Annual":
      base.setFullYear(base.getFullYear() + 1)
      break
    case "Semi-Annual":
      base.setMonth(base.getMonth() + 6)
      break
    case "Quarterly":
      base.setMonth(base.getMonth() + 3)
      break
    case "Monthly":
      base.setMonth(base.getMonth() + 1)
      break
    case "Custom":
      base.setDate(base.getDate() + (customIntervalDays || 90))
      break
  }
  return base.toISOString().slice(0, 10)
}
