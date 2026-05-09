/**
 * Phase 32 — Multi-location customer dashboard metrics (pure aggregation).
 * Caller supplies org-scoped rows; no cross-org leakage. Technician scoping
 * is applied by filtering input rows before calling {@link buildMultiLocationDashboard}.
 */

export type MlEquipmentRow = {
  id: string
  customer_location_id: string | null
  last_service_at: string | null
  next_due_at: string | null
  next_calibration_due_at: string | null
}

export type MlWorkOrderRow = {
  id: string
  status: string
  customer_location_id: string | null
  equipment_id: string | null
  completed_at: string | null
  scheduled_on: string | null
}

export type MlMaintenancePlanRow = {
  equipment_id: string | null
  next_due_date: string | null
  status: string
}

export type MlServiceRequestRow = {
  id: string
  customer_location_id: string | null
  equipment_id: string | null
  status: string
  urgency: string
  issue_summary: string
  created_at: string
  converted_work_order_id: string | null
}

export type MlInvoiceRow = {
  amount_cents: number
  status: string
  equipment_id: string | null
}

export type CustomerLocationRef = {
  id: string
  name: string
  addressLine: string
  isDefault: boolean
}

export type MultiLocationSummary = {
  totalLocations: number
  activeLocations: number
  equipmentCount: number
  unassignedEquipmentCount: number
  openWorkOrders: number
  openServiceRequests: number
  urgentServiceRequests: number
  needsInfoServiceRequests: number
  convertedServiceRequests: number
  upcomingServiceOrMaintenanceCount: number
  unpaidInvoiceCents: number | null
}

export type MultiLocationCardModel = {
  locationId: string
  name: string
  addressLine: string
  isDefault: boolean
  equipmentCount: number
  openWorkOrders: number
  lastServiceDate: string | null
  nextDueDate: string | null
  openServiceRequests: number
  newOrUrgentServiceRequests: number
  awaitingInfoServiceRequests: number
  convertedServiceRequests: number
  linkedWorkOrdersFromConvertedSr: number
  invoiceBalanceCents: number | null
  previewServiceRequests: Array<{
    id: string
    summary: string
    status: string
    urgency: string
  }>
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

function dateOnly(iso: string | null | undefined): string | null {
  if (!iso) return null
  const s = iso.trim()
  if (s.length >= 10) return s.slice(0, 10)
  return null
}

function minDate(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return a <= b ? a : b
}

function maxDate(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return a >= b ? a : b
}

function woResolvedLocationId(
  wo: MlWorkOrderRow,
  equipmentById: Map<string, MlEquipmentRow>,
): string | null {
  if (wo.customer_location_id) return wo.customer_location_id
  if (wo.equipment_id) return equipmentById.get(wo.equipment_id)?.customer_location_id ?? null
  return null
}

function srResolvedLocationId(
  sr: MlServiceRequestRow,
  equipmentById: Map<string, MlEquipmentRow>,
): string | null {
  if (sr.customer_location_id) return sr.customer_location_id
  if (sr.equipment_id) return equipmentById.get(sr.equipment_id)?.customer_location_id ?? null
  return null
}

function isOpenWo(status: string): boolean {
  return status !== "completed" && status !== "invoiced"
}

function isActivePlanStatus(status: string): boolean {
  return status === "active"
}

/**
 * Aggregate multi-location dashboard metrics for one customer account.
 */
export function buildMultiLocationDashboard(args: {
  locations: CustomerLocationRef[]
  equipment: MlEquipmentRow[]
  workOrders: MlWorkOrderRow[]
  maintenancePlans: MlMaintenancePlanRow[]
  serviceRequests: MlServiceRequestRow[]
  /** When null, invoice fields stay null (non-financial viewers). */
  invoices: MlInvoiceRow[] | null
  /** Horizon in days for “upcoming” service / maintenance (from today UTC). */
  upcomingHorizonDays?: number
}): { summary: MultiLocationSummary; locationCards: MultiLocationCardModel[] } {
  const horizon = args.upcomingHorizonDays ?? 60
  const today = todayUtc()
  const horizonEnd = new Date()
  horizonEnd.setUTCDate(horizonEnd.getUTCDate() + horizon)
  const horizonStr = horizonEnd.toISOString().slice(0, 10)

  const equipmentById = new Map(args.equipment.map((e) => [e.id, e]))

  const locIds = new Set(args.locations.map((l) => l.id))
  const byLoc = new Map<
    string,
    {
      equipmentIds: Set<string>
      openWo: number
      lastService: string | null
      nextDue: string | null
      openSr: number
      srNewUrgent: number
      srNeedsInfo: number
      srConverted: number
      srLinkedWo: number
      invoiceCents: number
      srPreview: MultiLocationCardModel["previewServiceRequests"]
    }
  >()

  for (const l of args.locations) {
    byLoc.set(l.id, {
      equipmentIds: new Set(),
      openWo: 0,
      lastService: null,
      nextDue: null,
      openSr: 0,
      srNewUrgent: 0,
      srNeedsInfo: 0,
      srConverted: 0,
      srLinkedWo: 0,
      invoiceCents: 0,
      srPreview: [],
    })
  }

  let unassignedEquipment = 0
  for (const eq of args.equipment) {
    const lid = eq.customer_location_id
    if (!lid || !byLoc.has(lid)) {
      unassignedEquipment += 1
      continue
    }
    byLoc.get(lid)!.equipmentIds.add(eq.id)
    const nd = dateOnly(eq.next_due_at)
    const nc = dateOnly(eq.next_calibration_due_at)
    const bucket = byLoc.get(lid)!
    if (nd) bucket.nextDue = minDate(bucket.nextDue, nd)
    if (nc) bucket.nextDue = minDate(bucket.nextDue, nc)
    const ls = dateOnly(eq.last_service_at)
    if (ls) bucket.lastService = maxDate(bucket.lastService, ls)
  }

  for (const wo of args.workOrders) {
    const lid = woResolvedLocationId(wo, equipmentById)
    if (!lid || !byLoc.has(lid)) continue
    const b = byLoc.get(lid)!
    if (isOpenWo(wo.status)) b.openWo += 1
    const comp = dateOnly(wo.completed_at)
    if (comp && (wo.status === "completed" || wo.status === "invoiced")) {
      b.lastService = maxDate(b.lastService, comp)
    }
    const sched = dateOnly(wo.scheduled_on)
    if (sched && isOpenWo(wo.status) && sched >= today && sched <= horizonStr) {
      b.nextDue = minDate(b.nextDue, sched)
    }
  }

  for (const p of args.maintenancePlans) {
    if (!isActivePlanStatus(p.status) || !p.equipment_id) continue
    const eq = equipmentById.get(p.equipment_id)
    const lid = eq?.customer_location_id ?? null
    if (!lid || !byLoc.has(lid)) continue
    const due = dateOnly(p.next_due_date)
    if (!due) continue
    const b = byLoc.get(lid)!
    if (due >= today && due <= horizonStr) {
      b.nextDue = minDate(b.nextDue, due)
    } else if (due >= today) {
      b.nextDue = minDate(b.nextDue, due)
    }
  }

  const openSrStatuses = new Set(["new", "reviewing", "approved", "needs_info"])
  for (const sr of args.serviceRequests) {
    const lid = srResolvedLocationId(sr, equipmentById)
    if (!lid || !byLoc.has(lid)) continue
    const b = byLoc.get(lid)!
    if (openSrStatuses.has(sr.status)) {
      b.openSr += 1
      if (sr.status === "needs_info") b.srNeedsInfo += 1
      if (
        (sr.status === "new" || sr.status === "reviewing" || sr.status === "approved") &&
        (sr.urgency === "high" || sr.urgency === "critical")
      ) {
        b.srNewUrgent += 1
      }
    }
    if (sr.status === "converted") {
      b.srConverted += 1
      if (sr.converted_work_order_id) b.srLinkedWo += 1
    }
    if (b.srPreview.length < 3 && openSrStatuses.has(sr.status)) {
      b.srPreview.push({
        id: sr.id,
        summary: sr.issue_summary,
        status: sr.status,
        urgency: sr.urgency,
      })
    }
  }

  if (args.invoices) {
    for (const inv of args.invoices) {
      if (inv.status === "paid" || inv.status === "draft" || inv.status === "void") continue
      const eqId = inv.equipment_id
      const lid =
        eqId ? equipmentById.get(eqId)?.customer_location_id ?? null : null
      if (lid && byLoc.has(lid)) {
        byLoc.get(lid)!.invoiceCents += inv.amount_cents ?? 0
      }
    }
  }

  let openWoTotal = 0
  let upcomingCount = 0
  const countedUpcoming = new Set<string>()

  for (const wo of args.workOrders) {
    if (isOpenWo(wo.status)) openWoTotal += 1
    const lid = woResolvedLocationId(wo, equipmentById)
    const sched = dateOnly(wo.scheduled_on)
    if (sched && isOpenWo(wo.status) && sched >= today && sched <= horizonStr) {
      const key = `wo:${wo.id}`
      if (!countedUpcoming.has(key)) {
        countedUpcoming.add(key)
        upcomingCount += 1
      }
    }
  }

  for (const eq of args.equipment) {
    const nd = dateOnly(eq.next_due_at)
    const nc = dateOnly(eq.next_calibration_due_at)
    for (const d of [nd, nc]) {
      if (d && d >= today && d <= horizonStr) {
        const key = `eq:${eq.id}:${d}`
        if (!countedUpcoming.has(key)) {
          countedUpcoming.add(key)
          upcomingCount += 1
        }
      }
    }
  }

  for (const p of args.maintenancePlans) {
    if (!isActivePlanStatus(p.status)) continue
    const due = dateOnly(p.next_due_date)
    if (due && due >= today && due <= horizonStr && p.equipment_id) {
      const key = `plan:${p.equipment_id}:${due}`
      if (!countedUpcoming.has(key)) {
        countedUpcoming.add(key)
        upcomingCount += 1
      }
    }
  }

  let openSrTotal = 0
  let urgentSrTotal = 0
  let needsInfoTotal = 0
  let convertedSrTotal = 0
  for (const sr of args.serviceRequests) {
    if (openSrStatuses.has(sr.status)) {
      openSrTotal += 1
      if (sr.status === "needs_info") needsInfoTotal += 1
      if (
        (sr.status === "new" || sr.status === "reviewing" || sr.status === "approved") &&
        (sr.urgency === "high" || sr.urgency === "critical")
      ) {
        urgentSrTotal += 1
      }
    }
    if (sr.status === "converted") convertedSrTotal += 1
  }

  let unpaidCents: number | null = null
  if (args.invoices) {
    unpaidCents = args.invoices
      .filter((i) => i.status !== "paid" && i.status !== "draft" && i.status !== "void")
      .reduce((s, i) => s + (i.amount_cents ?? 0), 0)
  }

  const locationCards: MultiLocationCardModel[] = args.locations.map((loc) => {
    const b = byLoc.get(loc.id)!
    return {
      locationId: loc.id,
      name: loc.name,
      addressLine: loc.addressLine,
      isDefault: loc.isDefault,
      equipmentCount: b.equipmentIds.size,
      openWorkOrders: b.openWo,
      lastServiceDate: b.lastService,
      nextDueDate: b.nextDue,
      openServiceRequests: b.openSr,
      newOrUrgentServiceRequests: b.srNewUrgent,
      awaitingInfoServiceRequests: b.srNeedsInfo,
      convertedServiceRequests: b.srConverted,
      linkedWorkOrdersFromConvertedSr: b.srLinkedWo,
      invoiceBalanceCents: args.invoices ? b.invoiceCents : null,
      previewServiceRequests: b.srPreview,
    }
  })

  const summary: MultiLocationSummary = {
    totalLocations: args.locations.length,
    activeLocations: args.locations.length,
    equipmentCount: args.equipment.length,
    unassignedEquipmentCount: unassignedEquipment,
    openWorkOrders: openWoTotal,
    openServiceRequests: openSrTotal,
    urgentServiceRequests: urgentSrTotal,
    needsInfoServiceRequests: needsInfoTotal,
    convertedServiceRequests: convertedSrTotal,
    upcomingServiceOrMaintenanceCount: upcomingCount,
    unpaidInvoiceCents: unpaidCents,
  }

  return { summary, locationCards }
}
