/**
 * Invoicing Phase 2 — Service-to-Invoice continuity helpers.
 *
 * Aggregates a tenant-scoped, human-readable summary of the service activity
 * an invoice originated from: linked work orders, scheduled / completed
 * dates, technician + customer location, and a tally of certificates
 * available on those work orders.
 *
 * Phase 1 (`20260719120000_service_lifecycle_phase1.sql`) already added the
 * canonical `invoice_work_order_links` join table; this helper reuses it
 * and falls back to the legacy `org_invoices.work_order_id` column when the
 * junction has no rows yet.
 *
 * No raw UUIDs are returned — only human display strings.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { getEquipmentDisplayPrimary } from "@/lib/equipment/display"
import { getWorkOrderDisplay } from "@/lib/work-orders/display"

export type InvoiceSourceWorkOrder = {
  id: string
  /** WO-#### display number (UUID hidden). */
  display: string
  title: string
  statusLabel: string
  typeLabel: string
  scheduledOn: string | null
  completedAt: string | null
  technicianName: string | null
  equipmentName: string
  /** Service location pulled from equipment.location_label when available. */
  serviceLocation: string | null
  billingState: string | null
}

export type InvoiceSourceSummary = {
  workOrders: InvoiceSourceWorkOrder[]
  certificateTotal: number
  certificateReleasedCount: number
  /** First non-empty service location across linked work orders (display only). */
  primaryServiceLocation: string | null
  earliestScheduledOn: string | null
  latestCompletedAt: string | null
}

const WO_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
  completed_pending_signature: "Completed Pending Signature",
  invoiced: "Invoiced",
}

const WO_TYPE_LABELS: Record<string, string> = {
  Repair: "Repair",
  PM: "PM",
  Inspection: "Inspection",
  Install: "Install",
  Emergency: "Emergency",
}

function statusLabel(raw: string): string {
  return (
    WO_STATUS_LABELS[raw] ??
    raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  )
}

function typeLabel(raw: string): string {
  return WO_TYPE_LABELS[raw] ?? raw
}

/**
 * Best-effort fetch with schema-drift fallback when older work_orders schemas
 * lack `assigned_technician_id` / `work_order_number` / `billing_state`.
 */
async function selectWorkOrders(
  supabase: SupabaseClient,
  organizationId: string,
  workOrderIds: string[],
): Promise<
  Array<{
    id: string
    work_order_number: number | null
    title: string
    status: string
    type: string
    scheduled_on: string | null
    completed_at: string | null
    equipment_id: string | null
    assigned_user_id: string | null
    assigned_technician_id: string | null
    billing_state: string | null
  }>
> {
  if (workOrderIds.length === 0) return []
  const attempts = [
    "id, work_order_number, title, status, type, scheduled_on, completed_at, equipment_id, assigned_user_id, assigned_technician_id, billing_state",
    "id, work_order_number, title, status, type, scheduled_on, completed_at, equipment_id, assigned_user_id, assigned_technician_id",
    "id, title, status, type, scheduled_on, completed_at, equipment_id, assigned_user_id",
  ]
  for (const sel of attempts) {
    const res = await supabase
      .from("work_orders")
      .select(sel)
      .eq("organization_id", organizationId)
      .in("id", workOrderIds)
    if (!res.error) {
      return ((res.data ?? []) as unknown as Array<Record<string, unknown>>).map((r) => ({
        id: String(r.id ?? ""),
        work_order_number: (r.work_order_number as number | null) ?? null,
        title: String(r.title ?? ""),
        status: String(r.status ?? ""),
        type: String(r.type ?? ""),
        scheduled_on: (r.scheduled_on as string | null) ?? null,
        completed_at: (r.completed_at as string | null) ?? null,
        equipment_id: (r.equipment_id as string | null) ?? null,
        assigned_user_id: (r.assigned_user_id as string | null) ?? null,
        assigned_technician_id: (r.assigned_technician_id as string | null) ?? null,
        billing_state: (r.billing_state as string | null) ?? null,
      }))
    }
  }
  return []
}

/**
 * Builds the source summary for one invoice. Tenant-scoped via the
 * `organization_id` filter on every read.
 *
 * @param invoiceArgs `legacyWorkOrderId` is the value of
 *   `org_invoices.work_order_id`; passed in to support invoices created
 *   before the junction table existed.
 */
export async function buildInvoiceSourceSummary(
  supabase: SupabaseClient,
  invoiceArgs: {
    organizationId: string
    invoiceId: string
    legacyWorkOrderId?: string | null
  },
): Promise<InvoiceSourceSummary> {
  const { organizationId, invoiceId, legacyWorkOrderId } = invoiceArgs

  // Junction table first; legacy column merged for old rows.
  const linkRes = await supabase
    .from("invoice_work_order_links")
    .select("work_order_id, sort_order")
    .eq("organization_id", organizationId)
    .eq("invoice_id", invoiceId)
    .order("sort_order", { ascending: true })

  const ids = new Set<string>()
  if (legacyWorkOrderId?.trim()) ids.add(legacyWorkOrderId.trim())
  if (!linkRes.error) {
    for (const row of (linkRes.data ?? []) as Array<{ work_order_id: string }>) {
      if (row.work_order_id) ids.add(row.work_order_id)
    }
  }

  if (ids.size === 0) {
    return {
      workOrders: [],
      certificateTotal: 0,
      certificateReleasedCount: 0,
      primaryServiceLocation: null,
      earliestScheduledOn: null,
      latestCompletedAt: null,
    }
  }

  const woRows = await selectWorkOrders(supabase, organizationId, [...ids])

  const eqIds = [...new Set(woRows.map((w) => w.equipment_id).filter(Boolean))] as string[]
  const userIds = [...new Set(woRows.map((w) => w.assigned_user_id).filter(Boolean))] as string[]
  const techIds = [...new Set(woRows.map((w) => w.assigned_technician_id).filter(Boolean))] as string[]

  const [eqRes, profRes, techRes, certTotalRes, certReleasedRes] = await Promise.all([
    eqIds.length
      ? supabase
          .from("equipment")
          .select("id, name, equipment_code, serial_number, category, location_label")
          .eq("organization_id", organizationId)
          .in("id", eqIds)
      : Promise.resolve({ data: [] as unknown[] }),
    userIds.length
      ? supabase.from("profiles").select("id, full_name, email").in("id", userIds)
      : Promise.resolve({ data: [] as unknown[] }),
    techIds.length
      ? supabase
          .from("technicians")
          .select("id, full_name")
          .eq("organization_id", organizationId)
          .in("id", techIds)
      : Promise.resolve({ data: [] as unknown[] }),
    supabase
      .from("calibration_records")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("work_order_id", [...ids]),
    supabase
      .from("calibration_records")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("work_order_id", [...ids])
      .not("portal_released_at", "is", null),
  ])

  const eqMap = new Map<string, { name: string; location: string | null; display: string }>()
  for (const row of (eqRes.data ?? []) as Array<{
    id: string
    name: string
    equipment_code: string | null
    serial_number: string | null
    category: string | null
    location_label: string | null
  }>) {
    eqMap.set(row.id, {
      name: row.name,
      location: row.location_label,
      display: getEquipmentDisplayPrimary({
        id: row.id,
        name: row.name,
        equipment_code: row.equipment_code,
        serial_number: row.serial_number,
        category: row.category,
      }),
    })
  }
  const profMap = new Map(
    ((profRes.data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>).map(
      (p) => [p.id, (p.full_name?.trim() || p.email?.trim() || null) as string | null],
    ),
  )
  const techMap = new Map(
    ((techRes.data ?? []) as Array<{ id: string; full_name: string | null }>).map((t) => [
      t.id,
      t.full_name?.trim() || null,
    ]),
  )

  const workOrders: InvoiceSourceWorkOrder[] = woRows.map((w) => {
    const eq = w.equipment_id ? eqMap.get(w.equipment_id) ?? null : null
    const techName = w.assigned_technician_id
      ? techMap.get(w.assigned_technician_id) ?? null
      : w.assigned_user_id
        ? profMap.get(w.assigned_user_id) ?? null
        : null
    return {
      id: w.id,
      display: getWorkOrderDisplay({ id: w.id, workOrderNumber: w.work_order_number }),
      title: w.title?.trim() || "Service visit",
      statusLabel: statusLabel(w.status),
      typeLabel: typeLabel(w.type),
      scheduledOn: w.scheduled_on,
      completedAt: w.completed_at,
      technicianName: techName,
      equipmentName: eq?.display ?? "Equipment",
      serviceLocation: eq?.location?.trim() || null,
      billingState: w.billing_state,
    }
  })

  const earliest =
    workOrders
      .map((w) => w.scheduledOn)
      .filter((d): d is string => Boolean(d))
      .sort()[0] ?? null
  const latest =
    workOrders
      .map((w) => w.completedAt)
      .filter((d): d is string => Boolean(d))
      .sort()
      .slice(-1)[0] ?? null
  const primaryLocation =
    workOrders.find((w) => w.serviceLocation && w.serviceLocation.trim())?.serviceLocation ?? null

  return {
    workOrders,
    certificateTotal: certTotalRes.error ? 0 : certTotalRes.count ?? 0,
    certificateReleasedCount: certReleasedRes.error ? 0 : certReleasedRes.count ?? 0,
    primaryServiceLocation: primaryLocation,
    earliestScheduledOn: earliest,
    latestCompletedAt: latest,
  }
}

/**
 * Format helper for invoice source dates (compact, locale-friendly).
 */
export function formatInvoiceSourceDate(d: string | null | undefined): string {
  if (!d) return "—"
  const t = new Date(d.length <= 10 ? `${d}T12:00:00` : d).getTime()
  if (Number.isNaN(t)) return "—"
  return new Date(t).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}
