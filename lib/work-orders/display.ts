/** Branded display: `WO-` + 7 digits (e.g. WO-1045821). Falls back to `fallbackId` (e.g. UUID) when unset. */
export function formatWorkOrderDisplay(
  workOrderNumber: number | null | undefined,
  fallbackId?: string,
): string {
  if (workOrderNumber != null && Number.isFinite(workOrderNumber)) {
    return `WO-${String(workOrderNumber).padStart(7, "0")}`
  }
  const id = fallbackId?.trim()
  if (id) return id
  return "—"
}

/** Numeric part from user search: `WO-1045821`, `wo1045821`, `1045821`. */
export function parseWorkOrderNumberQuery(raw: string): number | null {
  const t = raw.trim().replace(/^wo-?/i, "")
  if (!/^\d+$/.test(t)) return null
  const n = parseInt(t, 10)
  return Number.isFinite(n) ? n : null
}

export function effectiveWorkOrderNumber(wo: {
  id: string
  workOrderNumber?: number | null
}): number | null {
  if (wo.workOrderNumber != null && Number.isFinite(wo.workOrderNumber)) {
    return wo.workOrderNumber
  }
  const m = /^WO-(\d+)$/i.exec(wo.id.trim())
  if (m) return parseInt(m[1], 10)
  return null
}

export function getWorkOrderDisplay(wo: { id: string; workOrderNumber?: number | null }): string {
  const n = effectiveWorkOrderNumber(wo)
  if (n != null) return formatWorkOrderDisplay(n)
  return wo.id
}

export function workOrderMatchesSearch(
  queryRaw: string,
  wo: {
    id: string
    workOrderNumber?: number | null
    customerName?: string
    equipmentName?: string
    equipmentId?: string
    technicianName?: string
    description?: string
  },
): boolean {
  const q = queryRaw.trim().toLowerCase()
  if (!q) return true
  if (wo.id.toLowerCase().includes(q)) return true
  const eqId = wo.equipmentId?.toLowerCase() ?? ""
  if (eqId && (eqId.includes(q) || eqId.replace(/-/g, "").includes(q.replace(/-/g, "")))) return true
  if (wo.customerName?.toLowerCase().includes(q)) return true
  if (wo.equipmentName?.toLowerCase().includes(q)) return true
  if (wo.technicianName?.toLowerCase().includes(q)) return true
  if (wo.description?.toLowerCase().includes(q)) return true
  const display = getWorkOrderDisplay(wo).toLowerCase()
  if (display.includes(q)) return true
  const parsed = parseWorkOrderNumberQuery(queryRaw)
  if (parsed != null) {
    const eff = effectiveWorkOrderNumber(wo)
    if (eff === parsed) return true
  }
  return false
}
