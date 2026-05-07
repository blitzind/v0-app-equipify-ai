import { NextResponse } from "next/server"
import { mapWorkOrderStatus, mapWorkOrderType } from "@/lib/portal/display-mappers"
import { requirePortalSession } from "@/lib/portal/require-portal-session"
import { getWorkOrderDisplay } from "@/lib/work-orders/display"

export const runtime = "nodejs"

export async function GET() {
  const ctx = await requirePortalSession()
  if (ctx instanceof NextResponse) return ctx

  const { svc, portalUser } = ctx

  // Phase: Scheduling Field-Speed Polish — also expose scheduled_time so the
  // portal list can render a clear "When" column for upcoming visits.
  // Schema-drift safe: `scheduled_time` has shipped with work_orders since
  // the foundation migration, but we still tolerate a missing column.
  let { data: rows, error } = await svc
    .from("work_orders")
    .select(
      "id, work_order_number, title, status, type, priority, scheduled_on, scheduled_time, completed_at, assigned_user_id, equipment_id",
    )
    .eq("organization_id", portalUser.organization_id)
    .eq("customer_id", portalUser.customer_id)
    .eq("is_archived", false)
    .order("created_at", { ascending: false })
    .limit(200)

  if (error && /scheduled_time/i.test(error.message)) {
    const fallback = await svc
      .from("work_orders")
      .select(
        "id, work_order_number, title, status, type, priority, scheduled_on, completed_at, assigned_user_id, equipment_id",
      )
      .eq("organization_id", portalUser.organization_id)
      .eq("customer_id", portalUser.customer_id)
      .eq("is_archived", false)
      .order("created_at", { ascending: false })
      .limit(200)
    rows = fallback.data
    error = fallback.error
  }

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
    items: (rows ?? []).map((w) => {
      const wt = w as typeof w & { scheduled_time?: string | null }
      return {
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
        // `HH:MM:SS` from postgres `time without time zone`; truncate to HH:MM
        // for the portal which only displays start time.
        scheduledTime:
          typeof wt.scheduled_time === "string" && wt.scheduled_time.length >= 5
            ? wt.scheduled_time.slice(0, 5)
            : null,
        completedAt: (w.completed_at as string | null) ?? null,
        equipmentName: equipMap.get(w.equipment_id as string) ?? "Equipment",
        technicianName: w.assigned_user_id ? (techMap.get(w.assigned_user_id as string) ?? null) : null,
      }
    }),
  })
}
