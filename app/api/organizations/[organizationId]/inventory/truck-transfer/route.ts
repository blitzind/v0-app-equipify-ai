import { NextResponse } from "next/server"
import { executeInventoryTransfer } from "@/lib/inventory/execute-inventory-transfer"
import { requireOrgInventoryWrite } from "@/lib/inventory/require-org-inventory-access"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { hasOrgPermission } from "@/lib/permissions/model"
import { resolveVehicleLocationIdForUser } from "@/lib/inventory/technician-truck"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Warehouse-side bins techs may return stock into without inventory manager role. */
const RETURN_LOCATION_TYPES = new Set(["warehouse", "staging"])

/**
 * Transfer inventory from a technician van bin to a warehouse/staging location.
 * Managers use the generic `/inventory/transfer` route; this endpoint additionally
 * allows technicians with `canConsumePartsOnWorkOrders` to move stock **from their
 * assigned truck only** back to an approved main location (no accounting postings).
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ message: "Invalid organization." }, { status: 400 })
  }

  let body: {
    catalog_item_id?: string
    from_location_id?: string
    to_location_id?: string
    quantity?: number
    notes?: string | null
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ message: "Invalid JSON." }, { status: 400 })
  }

  const catalogItemId = typeof body.catalog_item_id === "string" ? body.catalog_item_id.trim() : ""
  const fromId = typeof body.from_location_id === "string" ? body.from_location_id.trim() : ""
  const toId = typeof body.to_location_id === "string" ? body.to_location_id.trim() : ""
  const qty = typeof body.quantity === "number" && Number.isFinite(body.quantity) ? body.quantity : NaN

  if (!UUID_RE.test(catalogItemId) || !UUID_RE.test(fromId) || !UUID_RE.test(toId)) {
    return NextResponse.json({ message: "catalog_item_id, from_location_id, and to_location_id are required." }, { status: 400 })
  }
  if (fromId === toId) {
    return NextResponse.json({ message: "Locations must differ." }, { status: 400 })
  }
  if (!Number.isFinite(qty) || qty <= 0) {
    return NextResponse.json({ message: "quantity must be positive." }, { status: 400 })
  }

  const permissionGate = await requireAnyOrgPermission(organizationId, [
    "canManageInventory",
    "canConsumePartsOnWorkOrders",
  ])
  if ("error" in permissionGate) return permissionGate.error

  const manageInventory = hasOrgPermission(permissionGate.permissions, "canManageInventory")
  const mayConsume = hasOrgPermission(permissionGate.permissions, "canConsumePartsOnWorkOrders")

  const gate = await requireOrgInventoryWrite(organizationId, {
    capability: manageInventory ? "canManageInventory" : "canConsumePartsOnWorkOrders",
    forbiddenMessage: "You don't have permission to move inventory for this organization.",
  })
  if ("error" in gate) return gate.error

  const [{ data: cat }, { data: fromLoc }, { data: toLoc }] = await Promise.all([
    gate.svc
      .from("catalog_items")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("id", catalogItemId)
      .maybeSingle(),
    gate.svc
      .from("inventory_locations")
      .select("id, location_type")
      .eq("organization_id", organizationId)
      .eq("id", fromId)
      .maybeSingle(),
    gate.svc
      .from("inventory_locations")
      .select("id, location_type")
      .eq("organization_id", organizationId)
      .eq("id", toId)
      .maybeSingle(),
  ])

  if (!cat) return NextResponse.json({ message: "Catalog item not found." }, { status: 404 })
  if (!fromLoc || !toLoc) return NextResponse.json({ message: "Location not found." }, { status: 404 })

  const toType = String((toLoc as { location_type?: string }).location_type ?? "")
  if (!manageInventory && !RETURN_LOCATION_TYPES.has(toType)) {
    return NextResponse.json(
      { message: "Returns must go to a warehouse or staging location." },
      { status: 400 },
    )
  }

  if (!manageInventory) {
    if (!mayConsume) {
      return NextResponse.json({ message: "Forbidden." }, { status: 403 })
    }
    const truckLoc = await resolveVehicleLocationIdForUser(gate.svc, organizationId, gate.userId)
    if (!truckLoc || truckLoc !== fromId) {
      return NextResponse.json(
        { message: "You can only transfer stock out of your assigned vehicle bin." },
        { status: 403 },
      )
    }
  }

  try {
    const { correlation_id } = await executeInventoryTransfer({
      svc: gate.svc,
      organizationId,
      catalogItemId,
      fromLocationId: fromId,
      toLocationId: toId,
      quantity: qty,
      notes: body.notes ?? null,
      createdByUserId: gate.userId,
    })
    return NextResponse.json({ ok: true, correlation_id })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Transfer failed."
    const status = msg.includes("Insufficient") ? 409 : 400
    return NextResponse.json({ message: msg }, { status })
  }
}
