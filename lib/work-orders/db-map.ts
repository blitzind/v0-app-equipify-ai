import type { WorkOrderPriority, WorkOrderType } from "@/lib/mock-data"

export function uiPriorityToDb(priority: WorkOrderPriority): string {
  const m: Record<WorkOrderPriority, string> = {
    Low: "low",
    Normal: "normal",
    High: "high",
    Critical: "critical",
  }
  return m[priority]
}

export function uiTypeToDb(type: WorkOrderType): string {
  const m: Record<WorkOrderType, string> = {
    Repair: "repair",
    PM: "pm",
    Inspection: "inspection",
    Install: "install",
    Emergency: "emergency",
  }
  return m[type]
}

/** Normalize HH:MM to HH:MM:SS for Postgres `time` columns. */
export function normalizeTimeForDb(time: string): string | null {
  if (!time || !time.trim()) return null
  const t = time.trim()
  if (t.length === 5 && t.includes(":")) return `${t}:00`
  return t
}
