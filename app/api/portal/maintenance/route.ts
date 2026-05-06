import { NextResponse } from "next/server"
import { mapMaintenancePlanStatus } from "@/lib/portal/display-mappers"
import { requirePortalSession } from "@/lib/portal/require-portal-session"

export const runtime = "nodejs"

export async function GET() {
  const ctx = await requirePortalSession()
  if (ctx instanceof NextResponse) return ctx

  const { svc, portalUser } = ctx
  const orgId = portalUser.organization_id
  const custId = portalUser.customer_id

  const { data: rows, error } = await svc
    .from("maintenance_plans")
    .select("id, name, status, priority, next_due_date, interval_value, interval_unit, equipment_id")
    .eq("organization_id", orgId)
    .eq("customer_id", custId)
    .eq("is_archived", false)
    .order("next_due_date", { ascending: true, nullsFirst: false })

  if (error) {
    return NextResponse.json({ error: "Could not load maintenance plans." }, { status: 500 })
  }

  const eids = [...new Set((rows ?? []).map((r) => r.equipment_id).filter(Boolean))] as string[]
  let em = new Map<string, string>()
  if (eids.length > 0) {
    const { data: eqs } = await svc.from("equipment").select("id, name").eq("organization_id", orgId).in("id", eids)
    em = new Map((eqs ?? []).map((e) => [e.id as string, (e.name as string) ?? ""]))
  }

  return NextResponse.json({
    items: (rows ?? []).map((p) => ({
      id: p.id as string,
      name: p.name as string,
      statusLabel: mapMaintenancePlanStatus(p.status as string),
      priority: p.priority as string,
      nextDueDate: (p.next_due_date as string | null) ?? null,
      intervalLabel: `${p.interval_value} ${p.interval_unit}`,
      equipmentName: em.get(p.equipment_id as string) ?? "Equipment",
    })),
  })
}
