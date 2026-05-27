import type { WorkOrderType } from "@/lib/mock-data"

/** UI label for work order / service type. DB value stays `pm` via {@link uiTypeToDb}. */
export function workOrderTypeUiLabel(type: WorkOrderType | string): string {
  if (type === "PM" || type === "pm") return "Calibration"
  const s = String(type)
  if (s.length === 0) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export const WORK_ORDER_TYPE_PICKER_OPTIONS: WorkOrderType[] = [
  "Repair",
  "PM",
  "Inspection",
  "Install",
  "Emergency",
]
