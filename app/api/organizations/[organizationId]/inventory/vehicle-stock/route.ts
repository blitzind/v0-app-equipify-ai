import { NextResponse } from "next/server"
import { requireOrgInventoryRead, requireOrgInventoryWrite } from "@/lib/inventory/require-org-inventory-access"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ message: "Invalid organization." }, { status: 400 })
  }

  const gate = await requireOrgInventoryRead(organizationId)
  if ("error" in gate) return gate.error

  const { data, error } = await gate.svc
    .from("technician_vehicle_stock")
    .select("id, technician_id, inventory_location_id, created_at")
    .eq("organization_id", organizationId)

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  const techIds = [...new Set((data ?? []).map((r) => r.technician_id as string))]
  const locIds = [...new Set((data ?? []).map((r) => r.inventory_location_id as string))]

  const [{ data: techs }, { data: locs }] = await Promise.all([
    techIds.length ?
      gate.svc.from("technicians").select("id, full_name").eq("organization_id", organizationId).in("id", techIds)
    : Promise.resolve({ data: [] as { id: string; full_name?: string }[] }),
    locIds.length ?
      gate.svc
        .from("inventory_locations")
        .select("id, name, location_type")
        .eq("organization_id", organizationId)
        .in("id", locIds)
    : Promise.resolve({ data: [] as { id: string; name?: string; location_type?: string }[] }),
  ])

  const tm = new Map((techs ?? []).map((t) => [t.id, t]))
  const lm = new Map((locs ?? []).map((l) => [l.id, l]))

  return NextResponse.json({
    assignments: (data ?? []).map((r) => ({
      id: r.id,
      technician_id: r.technician_id,
      technician_name: tm.get(r.technician_id as string)?.full_name ?? null,
      inventory_location_id: r.inventory_location_id,
      location_name: lm.get(r.inventory_location_id as string)?.name ?? null,
      location_type: lm.get(r.inventory_location_id as string)?.location_type ?? null,
      created_at: r.created_at,
    })),
  })
}

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ message: "Invalid organization." }, { status: 400 })
  }

  const gate = await requireOrgInventoryWrite(organizationId)
  if ("error" in gate) return gate.error

  let body: { technician_id?: string; inventory_location_id?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ message: "Invalid JSON." }, { status: 400 })
  }

  const technicianId = typeof body.technician_id === "string" ? body.technician_id.trim() : ""
  const inventoryLocationId =
    typeof body.inventory_location_id === "string" ? body.inventory_location_id.trim() : ""

  if (!UUID_RE.test(technicianId) || !UUID_RE.test(inventoryLocationId)) {
    return NextResponse.json({ message: "technician_id and inventory_location_id are required." }, { status: 400 })
  }

  const [{ data: tech }, { data: loc }] = await Promise.all([
    gate.svc.from("technicians").select("id").eq("organization_id", organizationId).eq("id", technicianId).maybeSingle(),
    gate.svc
      .from("inventory_locations")
      .select("id, location_type")
      .eq("organization_id", organizationId)
      .eq("id", inventoryLocationId)
      .maybeSingle(),
  ])

  if (!tech) return NextResponse.json({ message: "Technician not found." }, { status: 400 })
  if (!loc) return NextResponse.json({ message: "Location not found." }, { status: 400 })

  await gate.svc
    .from("technician_vehicle_stock")
    .delete()
    .eq("organization_id", organizationId)
    .eq("inventory_location_id", inventoryLocationId)

  await gate.svc.from("technician_vehicle_stock").delete().eq("organization_id", organizationId).eq("technician_id", technicianId)

  const { error } = await gate.svc.from("technician_vehicle_stock").insert({
    organization_id: organizationId,
    technician_id: technicianId,
    inventory_location_id: inventoryLocationId,
  })

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 409 })
  }

  return NextResponse.json({ ok: true })
}
