import type { SupabaseClient } from "@supabase/supabase-js"
import { mapCustomerWorkOrderStatus, mapWorkOrderType } from "@/lib/portal/display-mappers"
import { resolvePortalDocumentScope } from "@/lib/portal/portal-document-scope"
import { getWorkOrderDisplay } from "@/lib/work-orders/display"

function appointmentGroup(
  status: string,
  scheduledOn: string | null,
  completedAt: string | null,
): "upcoming" | "in_progress" | "completed" | "all" {
  if (status === "in_progress") return "in_progress"
  if (status === "completed" || status === "completed_pending_signature" || status === "invoiced" || completedAt)
    return "completed"
  if (scheduledOn) {
    const today = new Date().toISOString().slice(0, 10)
    if (scheduledOn >= today) return "upcoming"
  }
  return "all"
}

export type PortalWorkOrderListItem = {
  id: string
  display: string
  title: string
  statusLabel: string
  appointmentGroup: "upcoming" | "in_progress" | "completed" | "all"
  isAppointment: boolean
  typeLabel: string
  scheduledOn: string | null
  scheduledTime: string | null
  completedAt: string | null
  equipmentName: string
  locationLabel: string | null
  technicianName: string | null
}

/** Shared work order list for `/api/portal/work-orders` and staff preview (document scope). */
export async function fetchPortalWorkOrderListItems(
  svc: SupabaseClient,
  organizationId: string,
  customerId: string,
): Promise<PortalWorkOrderListItem[]> {
  const scope = await resolvePortalDocumentScope(svc, {
    organizationId,
    rootCustomerId: customerId,
  })

  let { data: rows, error } = await svc
    .from("work_orders")
    .select(
      "id, work_order_number, title, status, type, priority, scheduled_on, scheduled_time, completed_at, assigned_user_id, assigned_technician_id, equipment_id, customer_id",
    )
    .eq("organization_id", organizationId)
    .in("customer_id", scope.customerIds)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(200)

  if (error && /scheduled_time/i.test(error.message)) {
    const fallback = await svc
      .from("work_orders")
      .select(
        "id, work_order_number, title, status, type, priority, scheduled_on, completed_at, assigned_user_id, assigned_technician_id, equipment_id, customer_id",
      )
      .eq("organization_id", organizationId)
      .in("customer_id", scope.customerIds)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(200)
    rows = fallback.data
    error = fallback.error
  }

  if (error) {
    throw new Error(error.message)
  }

  const userTechIds = [...new Set((rows ?? []).map((w) => w.assigned_user_id).filter(Boolean))] as string[]
  const technicianRowIds = [...new Set((rows ?? []).map((w) => w.assigned_technician_id).filter(Boolean))] as string[]
  const equipIds = [...new Set((rows ?? []).map((w) => w.equipment_id).filter(Boolean))] as string[]
  let techMap = new Map<string, string>()
  let technicianRowMap = new Map<string, string>()
  let equipMap = new Map<string, { name: string; location: string | null }>()
  if (userTechIds.length > 0) {
    const { data: profs } = await svc.from("profiles").select("id, full_name").in("id", userTechIds)
    techMap = new Map((profs ?? []).map((p) => [p.id as string, (p.full_name as string) ?? ""]))
  }
  if (technicianRowIds.length > 0) {
    const { data: techs } = await svc
      .from("technicians")
      .select("id, full_name")
      .eq("organization_id", organizationId)
      .in("id", technicianRowIds)
    technicianRowMap = new Map((techs ?? []).map((t) => [t.id as string, (t.full_name as string) ?? ""]))
  }
  if (equipIds.length > 0) {
    const { data: eqs } = await svc
      .from("equipment")
      .select("id, name, location_label")
      .eq("organization_id", organizationId)
      .in("id", equipIds)
    equipMap = new Map(
      (eqs ?? []).map((e) => [
        e.id as string,
        { name: (e.name as string) ?? "Equipment", location: (e.location_label as string | null) ?? null },
      ]),
    )
  }

  return (rows ?? []).map((w) => {
    const wt = w as typeof w & { scheduled_time?: string | null }
    return {
      id: w.id as string,
      display: getWorkOrderDisplay({
        id: w.id as string,
        workOrderNumber: w.work_order_number as number | null,
      }),
      title: w.title as string,
      statusLabel: mapCustomerWorkOrderStatus(w.status as string, (w.scheduled_on as string | null) ?? null),
      appointmentGroup: appointmentGroup(
        w.status as string,
        (w.scheduled_on as string | null) ?? null,
        (w.completed_at as string | null) ?? null,
      ),
      isAppointment: Boolean(w.scheduled_on),
      typeLabel: mapWorkOrderType(w.type as string),
      scheduledOn: (w.scheduled_on as string | null) ?? null,
      scheduledTime:
        typeof wt.scheduled_time === "string" && wt.scheduled_time.length >= 5 ? wt.scheduled_time.slice(0, 5) : null,
      completedAt: (w.completed_at as string | null) ?? null,
      equipmentName: equipMap.get(w.equipment_id as string)?.name ?? "Equipment",
      locationLabel: equipMap.get(w.equipment_id as string)?.location ?? null,
      technicianName:
        w.assigned_technician_id && technicianRowMap.get(w.assigned_technician_id as string)
          ? technicianRowMap.get(w.assigned_technician_id as string) ?? null
          : w.assigned_user_id
            ? techMap.get(w.assigned_user_id as string) ?? null
            : null,
    }
  })
}
