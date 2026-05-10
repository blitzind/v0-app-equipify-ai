import { NextResponse } from "next/server"
import {
  applyStockPatch,
  ensureStockRow,
  insertLedger,
} from "@/lib/inventory/inventory-mutations"
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

  const { data: locRow } = await gate.svc
    .from("inventory_locations")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", locationId)
    .maybeSingle()
  if (!locRow) return NextResponse.json({ message: "Location not found." }, { status: 404 })

  const { data: cat } = await gate.svc
    .from("catalog_items")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", catalogItemId)
    .maybeSingle()
  if (!cat) return NextResponse.json({ message: "Catalog item not found." }, { status: 404 })

  const row = await ensureStockRow(gate.svc, organizationId, catalogItemId, locationId)
  const available = row.quantity_on_hand - row.quantity_allocated
  if (available < qty) {
    return NextResponse.json({ message: "Insufficient available quantity to allocate." }, { status: 409 })
  }

  const nextAlloc = row.quantity_allocated + qty
  await applyStockPatch(gate.svc, organizationId, row.id, {
    quantity_on_hand: row.quantity_on_hand,
    quantity_allocated: nextAlloc,
  })

  await insertLedger(gate.svc, {
    organization_id: organizationId,
    catalog_item_id: catalogItemId,
    location_id: locationId,
    transaction_type: "allocate",
    quantity: qty,
    delta_on_hand: 0,
    delta_allocated: qty,
    work_order_id: workOrderId,
    notes: body.notes ?? null,
    created_by: gate.userId,
  })

  return NextResponse.json({ ok: true })
}
