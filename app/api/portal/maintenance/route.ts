import { NextResponse } from "next/server"
import { mapMaintenancePlanStatus } from "@/lib/portal/display-mappers"
import { requirePortalSession } from "@/lib/portal/require-portal-session"
import { daysUntilDue, summarizeMaintenanceForecast } from "@/lib/maintenance-plans/forecast"

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
    .is("archived_at", null)
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

  const items = (rows ?? []).map((p) => {
    const nextDue = (p.next_due_date as string | null) ?? null
    const offset = nextDue ? daysUntilDue(nextDue) : null
    return {
      id: p.id as string,
      name: p.name as string,
      statusLabel: mapMaintenancePlanStatus(p.status as string),
      priority: p.priority as string,
      nextDueDate: nextDue,
      intervalLabel: `${p.interval_value} ${p.interval_unit}`,
      equipmentName: em.get(p.equipment_id as string) ?? "Equipment",
      daysUntilNext: offset,
    }
  })

  const forecast = summarizeMaintenanceForecast(
    (rows ?? []).map((r) => ({
      id: r.id as string,
      status: String(r.status ?? ""),
      next_due_date: (r.next_due_date as string | null) ?? null,
      is_archived: false,
      customer_id: custId,
      equipment_id: (r.equipment_id as string | null) ?? null,
      equipment_name: em.get(r.equipment_id as string) ?? "Equipment",
    })),
  )

  return NextResponse.json({
    items,
    forecast: {
      forecastableCount: forecast.forecastableCount,
      overdue: forecast.exclusive.overdue,
      cumulative: forecast.cumulative,
      exclusive: forecast.exclusive,
    },
  })
}
