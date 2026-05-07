const WO_STATUSES = new Set(["open", "scheduled", "in_progress", "completed", "invoiced"])
const WO_PRIORITY = new Set(["low", "normal", "high", "critical"])
const WO_TYPES = new Set(["repair", "pm", "inspection", "install", "emergency"])

export function csvWorkOrderStatusToDb(raw: string): string {
  const s = raw.trim().toLowerCase().replace(/\s+/g, "_")
  if (!s) return "completed"
  if (WO_STATUSES.has(s)) return s
  if (s === "done" || s === "closed") return "completed"
  if (s === "progress") return "in_progress"
  return "completed"
}

export function csvWorkOrderPriorityToDb(raw: string): string {
  const s = raw.trim().toLowerCase()
  if (!s) return "normal"
  if (WO_PRIORITY.has(s)) return s
  return "normal"
}

export function csvWorkOrderTypeToDb(raw: string): string {
  const s = raw.trim().toLowerCase()
  if (!s) return "repair"
  if (s === "preventive" || s === "maintenance") return "pm"
  if (WO_TYPES.has(s)) return s
  return "repair"
}
