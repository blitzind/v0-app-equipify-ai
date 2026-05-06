import { NextResponse } from "next/server"
import {
  mapEquipmentStatus,
  mapWorkOrderStatus,
  mapWorkOrderType,
} from "@/lib/portal/display-mappers"
import { requirePortalSession } from "@/lib/portal/require-portal-session"
import { getWorkOrderDisplay } from "@/lib/work-orders/display"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(
  _request: Request,
  context: { params: Promise<{ equipmentId: string }> },
) {
  const ctx = await requirePortalSession()
  if (ctx instanceof NextResponse) return ctx

  const { equipmentId } = await context.params
  if (!UUID_RE.test(equipmentId)) {
    return NextResponse.json({ error: "Invalid equipment id." }, { status: 400 })
  }

  const { svc, portalUser } = ctx

  const { data: eq, error } = await svc
    .from("equipment")
    .select(
      "id, name, equipment_code, manufacturer, category, serial_number, status, install_date, warranty_expires_at, last_service_at, next_due_at, location_label, notes",
    )
    .eq("organization_id", portalUser.organization_id)
    .eq("customer_id", portalUser.customer_id)
    .eq("id", equipmentId)
    .eq("is_archived", false)
    .maybeSingle()

  if (error || !eq) {
    return NextResponse.json({ error: "Equipment not found." }, { status: 404 })
  }

  const { data: wos } = await svc
    .from("work_orders")
    .select("id, work_order_number, title, status, type, scheduled_on, completed_at, total_labor_cents, total_parts_cents")
    .eq("organization_id", portalUser.organization_id)
    .eq("customer_id", portalUser.customer_id)
    .eq("equipment_id", equipmentId)
    .eq("is_archived", false)
    .order("created_at", { ascending: false })
    .limit(25)

  const history =
    wos?.map((w) => ({
      id: w.id as string,
      display: getWorkOrderDisplay({
        id: w.id as string,
        workOrderNumber: w.work_order_number as number | null,
      }),
      title: w.title as string,
      statusLabel: mapWorkOrderStatus(w.status as string),
      typeLabel: mapWorkOrderType(w.type as string),
      scheduledOn: (w.scheduled_on as string | null) ?? null,
      completedAt: (w.completed_at as string | null) ?? null,
      totalCents: ((w.total_labor_cents as number) ?? 0) + ((w.total_parts_cents as number) ?? 0),
    })) ?? []

  return NextResponse.json({
    equipment: {
      id: eq.id as string,
      name: eq.name as string,
      equipmentCode: (eq.equipment_code as string | null) ?? null,
      manufacturer: (eq.manufacturer as string | null) ?? null,
      category: (eq.category as string | null) ?? null,
      serialNumber: (eq.serial_number as string | null) ?? null,
      statusLabel: mapEquipmentStatus(eq.status as string),
      installDate: (eq.install_date as string | null) ?? null,
      warrantyExpiresAt: (eq.warranty_expires_at as string | null) ?? null,
      lastServiceAt: (eq.last_service_at as string | null) ?? null,
      nextDueAt: (eq.next_due_at as string | null) ?? null,
      locationLabel: (eq.location_label as string | null) ?? null,
      notes: (eq.notes as string | null) ?? null,
    },
    serviceHistory: history,
  })
}
