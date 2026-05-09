import type { DispatchWo } from "@/components/dispatch/dispatch-board"
import { timeToSlotIndex } from "@/lib/dispatch/board-utils"

/**
 * Map-ready stop row for future routing (lat/lng reserved; null until geocoding exists).
 */
export type DispatchRouteStop = {
  workOrderId: string
  workOrderNumber: number | null
  customerId: string
  customerName: string
  locationLabel: string | null
  addressLine1: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  technicianUserId: string | null
  technicianLabel: string | null
  scheduledOn: string | null
  scheduledTime: string | null
  priority: string | null
  status: string
  workKind: DispatchWo["workKind"]
  fromServiceRequest: boolean
  latitude: number | null
  longitude: number | null
}

export function workOrderToRouteStop(wo: DispatchWo): DispatchRouteStop {
  const locationLabel =
    wo.siteLabel?.trim() ||
    [wo.addressLine1, wo.city, wo.state].filter(Boolean).join(", ").trim() ||
    wo.serviceLocationLabel?.trim() ||
    null

  return {
    workOrderId: wo.id,
    workOrderNumber: wo.work_order_number ?? null,
    customerId: wo.customer_id,
    customerName: wo.customerName,
    locationLabel,
    addressLine1: wo.addressLine1 ?? null,
    city: wo.city ?? null,
    state: wo.state ?? null,
    postalCode: wo.postalCode ?? null,
    technicianUserId: wo.assigned_user_id,
    technicianLabel: wo.technicianLabel ?? null,
    scheduledOn: wo.scheduled_on,
    scheduledTime: wo.scheduled_time,
    priority: wo.priority ?? null,
    status: wo.status,
    workKind: wo.workKind,
    fromServiceRequest: wo.fromServiceRequest,
    latitude: wo.latitude ?? null,
    longitude: wo.longitude ?? null,
  }
}

export function workOrdersToRouteStops(wos: DispatchWo[]): DispatchRouteStop[] {
  return wos.map(workOrderToRouteStop)
}

export function sortStopsBySchedule(stops: DispatchRouteStop[]): DispatchRouteStop[] {
  const copy = [...stops]
  copy.sort((a, b) => {
    const ta = timeToSlotIndex(a.scheduledTime)
    const tb = timeToSlotIndex(b.scheduledTime)
    if (ta !== tb) return ta - tb
    return a.workOrderId.localeCompare(b.workOrderId)
  })
  return copy
}

/** Apply a manual ordering (ordered ids first; any extra stops append by time). */
export function orderStopsByManualList(
  stops: DispatchRouteStop[],
  orderedIds: string[],
): DispatchRouteStop[] {
  if (orderedIds.length === 0) return sortStopsBySchedule(stops)
  const byId = new Map(stops.map((s) => [s.workOrderId, s] as const))
  const out: DispatchRouteStop[] = []
  for (const id of orderedIds) {
    const s = byId.get(id)
    if (s) out.push(s)
  }
  const ordered = new Set(orderedIds)
  const rest = stops.filter((s) => !ordered.has(s.workOrderId))
  out.push(...sortStopsBySchedule(rest))
  return out
}
