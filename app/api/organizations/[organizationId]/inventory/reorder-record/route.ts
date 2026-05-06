import { NextResponse } from "next/server"
import { insertLedger } from "@/lib/inventory/inventory-mutations"
import { requireOrgInventoryWrite } from "@/lib/inventory/require-org-inventory-access"

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

  const gate = await requireOrgInventoryWrite(organizationId)
  if ("error" in gate) return gate.error

  let body: {
    catalog_item_id?: string
    location_id?: string
    quantity?: number
    purchase_order_id?: string | null
    notes?: string | null
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ message: "Invalid JSON." }, { status: 400 })
  }

  const catalogItemId = typeof body.catalog_item_id === "string" ? body.catalog_item_id.trim() : ""
  const locationId = typeof body.location_id === "string" ? body.location_id.trim() : ""
  const qty = typeof body.quantity === "number" && Number.isFinite(body.quantity) ? body.quantity : NaN
  const poId =
    typeof body.purchase_order_id === "string" && UUID_RE.test(body.purchase_order_id.trim()) ?
      body.purchase_order_id.trim()
    : null

  if (!UUID_RE.test(catalogItemId) || !UUID_RE.test(locationId)) {
    return NextResponse.json({ message: "catalog_item_id and location_id are required." }, { status: 400 })
  }
  if (!Number.isFinite(qty) || qty <= 0) {
    return NextResponse.json({ message: "quantity must be positive." }, { status: 400 })
  }

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

  if (poId) {
    const { data: po } = await gate.svc
      .from("org_purchase_orders")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("id", poId)
      .maybeSingle()
    if (!po) return NextResponse.json({ message: "Purchase order not found." }, { status: 404 })
  }

  await insertLedger(gate.svc, {
    organization_id: organizationId,
    catalog_item_id: catalogItemId,
    location_id: locationId,
    transaction_type: "reorder_recorded",
    quantity: qty,
    delta_on_hand: 0,
    delta_allocated: 0,
    purchase_order_id: poId,
    notes: body.notes ?? null,
    metadata: { ordered_quantity: qty },
    created_by: gate.userId,
  })

  return NextResponse.json({ ok: true })
}
