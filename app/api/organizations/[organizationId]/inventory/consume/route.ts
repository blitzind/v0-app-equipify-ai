import { NextResponse } from "next/server"
import {
  applyStockPatch,
  ensureStockRow,
  insertLedger,
} from "@/lib/inventory/inventory-mutations"
import { requireOrgInventoryWrite } from "@/lib/inventory/require-org-inventory-access"
import { requireOrgPermission } from "@/lib/api/require-org-permission"
import { hasOrgPermission } from "@/lib/permissions/model"
import { canAccessAssignedWorkResource } from "@/lib/permissions/technician-scope"
import { resolveVehicleLocationIdForUser } from "@/lib/inventory/technician-truck"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ message: "Invalid organization." }, { status: 400 })
  }

  // Phase 1 (Inventory): consumption is a field-team workflow.
  // `canConsumePartsOnWorkOrders` is granted to owner/admin/manager/tech in
  // the central capability map (only viewer is excluded), so requiring that
  // capability here unlocks the technician mobile flow without weakening any
  // gate the manager-only roles already passed under the legacy
  // `canManageInventory` check. Service-role client comes from the same gate.
  const gate = await requireOrgInventoryWrite(organizationId, {
    capability: "canConsumePartsOnWorkOrders",
    forbiddenMessage: "You don't have permission to consume parts on work orders.",
  })
  if ("error" in gate) return gate.error
  const permissionGate = await requireOrgPermission(organizationId, "canConsumePartsOnWorkOrders")
  if ("error" in permissionGate) return permissionGate.error

  let body: {
    work_order_id?: string
    catalog_item_id?: string
    location_id?: string
    quantity?: number
    notes?: string | null
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ message: "Invalid JSON." }, { status: 400 })
  }

  const workOrderId = typeof body.work_order_id === "string" ? body.work_order_id.trim() : ""
  const catalogItemId = typeof body.catalog_item_id === "string" ? body.catalog_item_id.trim() : ""
  const locationId = typeof body.location_id === "string" ? body.location_id.trim() : ""
  const qty = typeof body.quantity === "number" && Number.isFinite(body.quantity) ? body.quantity : NaN

  if (!UUID_RE.test(workOrderId) || !UUID_RE.test(catalogItemId) || !UUID_RE.test(locationId)) {
    return NextResponse.json({ message: "work_order_id, catalog_item_id, and location_id are required." }, { status: 400 })
  }
  if (!Number.isFinite(qty) || qty <= 0) {
    return NextResponse.json({ message: "quantity must be positive." }, { status: 400 })
  }

  const { data: wo } = await gate.svc
    .from("work_orders")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", workOrderId)
    .maybeSingle()
  if (!wo) return NextResponse.json({ message: "Work order not found." }, { status: 404 })
  const allowedWorkOrder = await canAccessAssignedWorkResource(gate.svc, {
    organizationId,
    userId: gate.userId,
    permissions: permissionGate.permissions,
    resource: { workOrderId },
  })
  if (!allowedWorkOrder) return NextResponse.json({ message: "Work order not found." }, { status: 404 })

  const { data: cat } = await gate.svc
    .from("catalog_items")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", catalogItemId)
    .maybeSingle()
  if (!cat) return NextResponse.json({ message: "Catalog item not found." }, { status: 404 })

  const { data: loc } = await gate.svc
    .from("inventory_locations")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", locationId)
    .maybeSingle()
  if (!loc) return NextResponse.json({ message: "Location not found." }, { status: 404 })

  // Field techs without full inventory management may only consume from their assigned van bin.
  if (!hasOrgPermission(permissionGate.permissions, "canManageInventory")) {
    const truckLoc = await resolveVehicleLocationIdForUser(gate.svc, organizationId, gate.userId)
    if (!truckLoc) {
      return NextResponse.json(
        {
          message:
            "No vehicle stock location is assigned to your technician profile. Ask a manager to assign a van bin before consuming parts.",
        },
        { status: 400 },
      )
    }
    if (locationId !== truckLoc) {
      return NextResponse.json(
        {
          message:
            "Your role can only consume parts from your assigned truck stock location.",
        },
        { status: 403 },
      )
    }
  }

  const row = await ensureStockRow(gate.svc, organizationId, catalogItemId, locationId)
  if (row.quantity_on_hand < qty) {
    return NextResponse.json({ message: "Insufficient on-hand quantity." }, { status: 409 })
  }

  const releasedAlloc = Math.min(row.quantity_allocated, qty)
  const nextOh = row.quantity_on_hand - qty
  const nextAlloc = row.quantity_allocated - releasedAlloc

  await applyStockPatch(gate.svc, organizationId, row.id, {
    quantity_on_hand: nextOh,
    quantity_allocated: nextAlloc,
  })

  await insertLedger(gate.svc, {
    organization_id: organizationId,
    catalog_item_id: catalogItemId,
    location_id: locationId,
    transaction_type: "consume",
    quantity: qty,
    delta_on_hand: -qty,
    delta_allocated: -releasedAlloc,
    work_order_id: workOrderId,
    notes: body.notes ?? null,
    metadata: { released_allocation: releasedAlloc },
    created_by: gate.userId,
  })

  return NextResponse.json({ ok: true })
}
