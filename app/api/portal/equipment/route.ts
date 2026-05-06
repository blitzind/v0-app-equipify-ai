import { NextResponse } from "next/server"
import { mapEquipmentStatus } from "@/lib/portal/display-mappers"
import { requirePortalSession } from "@/lib/portal/require-portal-session"

export const runtime = "nodejs"

export async function GET() {
  const ctx = await requirePortalSession()
  if (ctx instanceof NextResponse) return ctx

  const { svc, portalUser } = ctx
  const { data, error } = await svc
    .from("equipment")
    .select(
      "id, name, equipment_code, manufacturer, category, serial_number, status, install_date, warranty_expires_at, last_service_at, next_due_at, location_label",
    )
    .eq("organization_id", portalUser.organization_id)
    .eq("customer_id", portalUser.customer_id)
    .eq("is_archived", false)
    .order("name", { ascending: true })

  if (error) {
    return NextResponse.json({ error: "Could not load equipment." }, { status: 500 })
  }

  return NextResponse.json({
    items: (data ?? []).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      equipmentCode: (r.equipment_code as string | null) ?? null,
      manufacturer: (r.manufacturer as string | null) ?? null,
      category: (r.category as string | null) ?? null,
      serialNumber: (r.serial_number as string | null) ?? null,
      statusLabel: mapEquipmentStatus(r.status as string),
      installDate: (r.install_date as string | null) ?? null,
      warrantyExpiresAt: (r.warranty_expires_at as string | null) ?? null,
      lastServiceAt: (r.last_service_at as string | null) ?? null,
      nextDueAt: (r.next_due_at as string | null) ?? null,
      locationLabel: (r.location_label as string | null) ?? null,
    })),
  })
}
