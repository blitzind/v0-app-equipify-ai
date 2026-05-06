import { NextResponse } from "next/server"
import { requirePortalSession } from "@/lib/portal/require-portal-session"

export const runtime = "nodejs"

export async function GET() {
  const ctx = await requirePortalSession()
  if (ctx instanceof NextResponse) return ctx

  const { svc, portalUser } = ctx
  const orgId = portalUser.organization_id
  const custId = portalUser.customer_id

  const { data: crs, error } = await svc
    .from("calibration_records")
    .select("id, created_at, work_order_id, equipment_id, template_id")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(300)

  if (error) {
    return NextResponse.json({ error: "Could not load certificates." }, { status: 500 })
  }

  const woIds = [...new Set((crs ?? []).map((c) => c.work_order_id).filter(Boolean))] as string[]
  if (woIds.length === 0) {
    return NextResponse.json({ items: [] })
  }

  const { data: wos } = await svc
    .from("work_orders")
    .select("id, customer_id")
    .eq("organization_id", orgId)
    .in("id", woIds)
    .eq("customer_id", custId)

  const allowedWo = new Set((wos ?? []).map((w) => w.id as string))
  const filtered = (crs ?? []).filter((c) => allowedWo.has(c.work_order_id as string))

  const equipIds = [...new Set(filtered.map((c) => c.equipment_id).filter(Boolean))] as string[]
  const tmplIds = [...new Set(filtered.map((c) => c.template_id).filter(Boolean))] as string[]

  let equipMap = new Map<string, string>()
  let tmplMap = new Map<string, string>()
  if (equipIds.length > 0) {
    const { data: eqs } = await svc.from("equipment").select("id, name").eq("organization_id", orgId).in("id", equipIds)
    equipMap = new Map((eqs ?? []).map((e) => [e.id as string, (e.name as string) ?? ""]))
  }
  if (tmplIds.length > 0) {
    const { data: ts } = await svc
      .from("calibration_templates")
      .select("id, name")
      .eq("organization_id", orgId)
      .in("id", tmplIds)
    tmplMap = new Map((ts ?? []).map((t) => [t.id as string, (t.name as string) ?? ""]))
  }

  return NextResponse.json({
    items: filtered.map((c) => ({
      id: c.id as string,
      createdAt: c.created_at as string,
      workOrderId: c.work_order_id as string,
      equipmentId: (c.equipment_id as string | null) ?? null,
      equipmentName: c.equipment_id ? (equipMap.get(c.equipment_id as string) ?? null) : null,
      templateName: tmplMap.get(c.template_id as string) ?? "Certificate",
      /** Future: signed PDF URL from storage */
      downloadUrl: null as string | null,
    })),
  })
}
