import { NextResponse } from "next/server"
import { insertLedger } from "@/lib/inventory/inventory-mutations"
import { requireOrgInventoryWrite } from "@/lib/inventory/require-org-inventory-access"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Phase 29 — Zero-delta ledger marker after a warehouse → truck transfer so managers
 * can explicitly record “restock complete” without changing stock again.
 */
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

  let body: {
    catalog_item_id?: string
    truck_location_id?: string
    quantity_completed?: number
    warehouse_location_id?: string | null
    transfer_correlation_id?: string | null
    notes?: string | null
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ message: "Invalid JSON." }, { status: 400 })
  }

  const catalogItemId = typeof body.catalog_item_id === "string" ? body.catalog_item_id.trim() : ""
  const truckLocationId = typeof body.truck_location_id === "string" ? body.truck_location_id.trim() : ""
  const qty =
    typeof body.quantity_completed === "number" && Number.isFinite(body.quantity_completed)
      ? body.quantity_completed
      : NaN

  if (!UUID_RE.test(catalogItemId) || !UUID_RE.test(truckLocationId)) {
    return NextResponse.json(
      { message: "catalog_item_id and truck_location_id are required." },
      { status: 400 },
    )
  }
  if (!Number.isFinite(qty) || qty <= 0) {
    return NextResponse.json({ message: "quantity_completed must be positive." }, { status: 400 })
  }

  const whId =
    typeof body.warehouse_location_id === "string" && UUID_RE.test(body.warehouse_location_id.trim()) ?
      body.warehouse_location_id.trim()
    : null
  const corr =
    typeof body.transfer_correlation_id === "string" && body.transfer_correlation_id.trim().length > 0
      ? body.transfer_correlation_id.trim().slice(0, 80)
      : null

  const [{ data: cat }, { data: truckLoc }] = await Promise.all([
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
      .eq("id", truckLocationId)
      .maybeSingle(),
  ])

  if (!cat) return NextResponse.json({ message: "Catalog item not found." }, { status: 404 })
  if (!truckLoc) return NextResponse.json({ message: "Truck location not found." }, { status: 404 })
  if ((truckLoc as { location_type?: string }).location_type !== "vehicle") {
    return NextResponse.json({ message: "truck_location_id must be a vehicle location." }, { status: 400 })
  }

  if (whId) {
    const { data: whLoc } = await gate.svc
      .from("inventory_locations")
      .select("id, location_type")
      .eq("organization_id", organizationId)
      .eq("id", whId)
      .maybeSingle()
    if (!whLoc) return NextResponse.json({ message: "Warehouse location not found." }, { status: 404 })
    const lt = (whLoc as { location_type?: string }).location_type
    if (lt !== "warehouse" && lt !== "staging") {
      return NextResponse.json(
        { message: "warehouse_location_id must be warehouse or staging." },
        { status: 400 },
      )
    }
  }

  const notes =
    typeof body.notes === "string" && body.notes.trim().length > 0
      ? body.notes.trim().slice(0, 500)
      : null

  await insertLedger(gate.svc, {
    organization_id: organizationId,
    catalog_item_id: catalogItemId,
    location_id: truckLocationId,
    transaction_type: "reorder_recorded",
    quantity: qty,
    delta_on_hand: 0,
    delta_allocated: 0,
    correlation_id: corr,
    notes,
    metadata: {
      truck_restock_complete: true,
      warehouse_location_id: whId,
      transfer_correlation_id: corr,
    },
    created_by: gate.userId,
  })

  return NextResponse.json({ ok: true })
}
