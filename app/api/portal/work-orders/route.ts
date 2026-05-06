import { NextResponse } from "next/server"
import { mapWorkOrderStatus, mapWorkOrderType } from "@/lib/portal/display-mappers"
import { requirePortalSession } from "@/lib/portal/require-portal-session"
import { getWorkOrderDisplay } from "@/lib/work-orders/display"

export const runtime = "nodejs"

export async function GET() {
  const ctx = await requirePortalSession()
  if (ctx instanceof NextResponse) return ctx

  const { svc, portalUser } = ctx

  const { data: rows, error } = await svc
    .from("work_orders")
    .select(
      "id, work_order_number, title, status, type, priority, scheduled_on, completed_at, assigned_user_id, equipment_id",
    )
    .eq("organization_id", portalUser.organization_id)
    .eq("customer_id", portalUser.customer_id)
    .eq("is_archived", false)
    .order("created_at", { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: "Could not load work orders." }, { status: 500 })
  }

  const techIds = [...new Set((rows ?? []).map((w) => w.assigned_user_id).filter(Boolean))] as string[]
  const equipIds = [...new Set((rows ?? []).map((w) => w.equipment_id).filter(Boolean))] as string[]
  let techMap = new Map<string, string>()
  let equipMap = new Map<string, string>()
  if (techIds.length > 0) {
    const { data: profs } = await svc.from("profiles").select("id, full_name").in("id", techIds)
    techMap = new Map((profs ?? []).map((p) => [p.id as string, (p.full_name as string) ?? ""]))
  }
  if (equipIds.length > 0) {
    const { data: eqs } = await svc
      .from("equipment")
      .select("id, name")
      .eq("organization_id", portalUser.organization_id)
      .in("id", equipIds)
    equipMap = new Map((eqs ?? []).map((e) => [e.id as string, (e.name as string) ?? ""]))
  }

  return NextResponse.json({
    items: (rows ?? []).map((w) => ({
      id: w.id as string,
      display: getWorkOrderDisplay({
        id: w.id as string,
        workOrderNumber: w.work_order_number as number | null,
      }),
      title: w.title as string,
      statusLabel: mapWorkOrderStatus(w.status as string),
      typeLabel: mapWorkOrderType(w.type as string),
      priority: w.priority as string,
      scheduledOn: (w.scheduled_on as string | null) ?? null,
      completedAt: (w.completed_at as string | null) ?? null,
      equipmentName: equipMap.get(w.equipment_id as string) ?? "Equipment",
      technicianName: w.assigned_user_id ? (techMap.get(w.assigned_user_id as string) ?? null) : null,
    })),
  })
}
