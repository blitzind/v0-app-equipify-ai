import type { DispatchWo } from "@/components/dispatch/dispatch-board"
import { timeToSlotIndex } from "@/lib/dispatch/board-utils"
import {
  assessDispatchAddressQuality,
  buildDispatchStopAddressLabel,
  dispatchAddressPartsFromWorkOrder,
  type DispatchAddressQuality,
  type MapReadyStopExportEntry,
  type TechnicianRouteJsonExport,
} from "@/lib/dispatch/dispatch-address"

/**
 * Map-ready stop row for future routing (lat/lng reserved; null until geocoding exists).
 */
export type DispatchRouteStop = {
  workOrderId: string
  workOrderNumber: number | null
  customerId: string
  customerName: string
  locationLabel: string | null
  /** Customer site title line when `customer_location_id` is set (same as `DispatchWo.siteLabel`). */
  siteLabel: string | null
  /** Equipment / fallback service location line. */
  serviceLocationLabel: string | null
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
  addressQuality: DispatchAddressQuality
  addressQualityLabel: string
}

function siteNameFromLocationLabel(locationLabel: string | null): string | null {
  if (!locationLabel?.trim()) return null
  const s = locationLabel.trim()
  const idx = s.indexOf("·")
  if (idx <= 0) return null
  return s.slice(0, idx).trim() || null
}

export function workOrderToRouteStop(wo: DispatchWo): DispatchRouteStop {
  const site = wo.siteLabel?.trim() || null
  const equip = wo.serviceLocationLabel?.trim() || null
  const locationLabel =
    wo.siteLabel?.trim() ||
    [wo.addressLine1, wo.city, wo.state].filter(Boolean).join(", ").trim() ||
    wo.serviceLocationLabel?.trim() ||
    null

  const addrParts = dispatchAddressPartsFromWorkOrder(wo)
  const addressAssessment = assessDispatchAddressQuality(addrParts)

  return {
    workOrderId: wo.id,
    workOrderNumber: wo.work_order_number ?? null,
    customerId: wo.customer_id,
    customerName: wo.customerName,
    locationLabel,
    siteLabel: site,
    serviceLocationLabel: equip,
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
    addressQuality: addressAssessment.quality,
    addressQualityLabel: addressAssessment.label,
  }
}

/** Clipboard / integration export with map-ready address metadata (Phase 36). */
export function routeStopToMapExportEntry(stop: DispatchRouteStop, sequence: number): MapReadyStopExportEntry {
  const parts = {
    addressLine1: stop.addressLine1,
    city: stop.city,
    state: stop.state,
    postalCode: stop.postalCode,
    siteLabel: stop.siteLabel,
    serviceLocationLabel: stop.serviceLocationLabel,
  }
  return {
    sequence,
    workOrderId: stop.workOrderId,
    workOrderNumber: stop.workOrderNumber,
    customerId: stop.customerId,
    customerName: stop.customerName,
    scheduledOn: stop.scheduledOn,
    scheduledTime: stop.scheduledTime,
    status: stop.status,
    addressQuality: stop.addressQuality,
    addressQualityLabel: stop.addressQualityLabel,
    addressSearchLine: buildDispatchStopAddressLabel(parts),
    structured: {
      siteName: siteNameFromLocationLabel(stop.siteLabel ?? stop.locationLabel),
      streetLine: stop.addressLine1,
      city: stop.city,
      region: stop.state,
      postalCode: stop.postalCode,
      countryCode: null,
      latitude: stop.latitude,
      longitude: stop.longitude,
    },
    geocoding: { status: "not_geocoded" },
  }
}

export function buildTechnicianRouteJsonExport(args: {
  selectedYmd: string
  technician: { id: string; label: string }
  orderedStops: DispatchRouteStop[]
}): TechnicianRouteJsonExport {
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    scheduleDate: args.selectedYmd,
    technician: args.technician,
    stops: args.orderedStops.map((s, i) => routeStopToMapExportEntry(s, i + 1)),
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
