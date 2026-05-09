import { NextResponse } from "next/server"
import { requireOrgInventoryRead } from "@/lib/inventory/require-org-inventory-access"
import {
  resolveTechnicianDbIdForUser,
  resolveVehicleLocationIdForTechnician,
} from "@/lib/inventory/technician-truck"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Current user's assigned van / truck inventory bin (for consume defaults & mobile UX). */
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

  const technicianDbId = await resolveTechnicianDbIdForUser(gate.svc, organizationId, gate.userId)
  if (!technicianDbId) {
    return NextResponse.json({
      technician_id: null,
      inventory_location_id: null,
      location_name: null,
      location_type: null,
    })
  }

  const inventoryLocationId = await resolveVehicleLocationIdForTechnician(
    gate.svc,
    organizationId,
    technicianDbId,
  )

  if (!inventoryLocationId) {
    return NextResponse.json({
      technician_id: technicianDbId,
      inventory_location_id: null,
      location_name: null,
      location_type: null,
    })
  }

  const { data: loc } = await gate.svc
    .from("inventory_locations")
    .select("id, name, location_type")
    .eq("organization_id", organizationId)
    .eq("id", inventoryLocationId)
    .maybeSingle()

  return NextResponse.json({
    technician_id: technicianDbId,
    inventory_location_id: inventoryLocationId,
    location_name: (loc as { name?: string } | null)?.name ?? null,
    location_type: (loc as { location_type?: string } | null)?.location_type ?? null,
  })
}
