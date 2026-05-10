import { NextResponse } from "next/server"
import { insertLedger } from "@/lib/inventory/inventory-mutations"
import { requireOrgInventoryWrite } from "@/lib/inventory/require-org-inventory-access"
import { requireOrgPermission } from "@/lib/api/require-org-permission"
import { hasOrgPermission } from "@/lib/permissions/model"
import { resolveVehicleLocationIdForUser } from "@/lib/inventory/technician-truck"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Inventory + Parts Operational Polish — Phase 1
 *
 * Lightweight "I need this part restocked" signal that techs and dispatchers
 * can fire from mobile/parts surfaces. We deliberately reuse the existing
 * `inventory_transactions` ledger and the established `reorder_recorded`
 * type so we don't grow a new table or duplicate transaction logic — the
 * record is a zero-delta event whose `metadata.restock_request = true` flag
 * lets dispatchers find pending requests later without altering on-hand or
 * allocation counts.
 *
 * Permission model: gate by `canConsumePartsOnWorkOrders`, which is granted
 * to owner/admin/manager/tech in the central permission map. Viewers cannot
 * file requests.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ message: "Invalid organization." }, { status: 400 })
  }

  const permissionGate = await requireOrgPermission(organizationId, "canConsumePartsOnWorkOrders")
  if ("error" in permissionGate) return permissionGate.error

  const gate = await requireOrgInventoryWrite(organizationId, {
    capability: "canConsumePartsOnWorkOrders",
    forbiddenMessage: "You don't have permission to request a restock.",
  })
  if ("error" in gate) return gate.error

  let body: {
    catalog_item_id?: string
    location_id?: string
    quantity?: number | null
    notes?: string | null
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ message: "Invalid JSON." }, { status: 400 })
  }

  const catalogItemId = typeof body.catalog_item_id === "string" ? body.catalog_item_id.trim() : ""
  const locationId = typeof body.location_id === "string" ? body.location_id.trim() : ""
  const requestedQty =
    typeof body.quantity === "number" && Number.isFinite(body.quantity) && body.quantity > 0
      ? body.quantity
      : null

  if (!UUID_RE.test(catalogItemId) || !UUID_RE.test(locationId)) {
    return NextResponse.json(
      { message: "catalog_item_id and location_id are required." },
      { status: 400 },
    )
  }

  const [{ data: cat }, { data: loc }] = await Promise.all([
    gate.svc
      .from("catalog_items")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("id", catalogItemId)
      .maybeSingle(),
    gate.svc
      .from("inventory_locations")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("id", locationId)
      .maybeSingle(),
  ])

  if (!cat) return NextResponse.json({ message: "Catalog item not found." }, { status: 404 })
  if (!loc) return NextResponse.json({ message: "Location not found." }, { status: 404 })

  if (!hasOrgPermission(permissionGate.permissions, "canManageInventory")) {
    const truckLoc = await resolveVehicleLocationIdForUser(gate.svc, organizationId, gate.userId)
    if (!truckLoc || locationId !== truckLoc) {
      return NextResponse.json(
        { message: "You can only request restock for your assigned vehicle stock location." },
        { status: 403 },
      )
    }
  }

  // `inventory_transactions.quantity` must be > 0 (DB check); use 1 when the request is open-ended.
  const ledgerQuantity =
    requestedQty != null && requestedQty > 0 ? requestedQty : 1

  const notes =
    typeof body.notes === "string" && body.notes.trim().length > 0
      ? body.notes.trim().slice(0, 500)
      : null

  await insertLedger(gate.svc, {
    organization_id: organizationId,
    catalog_item_id: catalogItemId,
    location_id: locationId,
    transaction_type: "reorder_recorded",
    quantity: ledgerQuantity,
    delta_on_hand: 0,
    delta_allocated: 0,
    notes,
    metadata: {
      restock_request: true,
      requested_quantity: requestedQty,
      quantity_was_unspecified: requestedQty == null,
    },
    created_by: gate.userId,
  })

  return NextResponse.json({ ok: true })
}
