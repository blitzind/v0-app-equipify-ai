import { NextResponse } from "next/server"
import {
  applyStockPatch,
  ensureStockRow,
  insertLedger,
} from "@/lib/inventory/inventory-mutations"
import { requireOrgInventoryWrite } from "@/lib/inventory/require-org-inventory-access"
import { requireOrgPermission } from "@/lib/api/require-org-permission"

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

  // Phase 1 capability check (in addition to the existing membership-level
  // gate) — only roles with `canAdjustInventoryStock` can hit this endpoint.
  const capabilityGate = await requireOrgPermission(organizationId, "canAdjustInventoryStock")
  if ("error" in capabilityGate) return capabilityGate.error

  const gate = await requireOrgInventoryWrite(organizationId)
  if ("error" in gate) return gate.error

  let body: {
    catalog_item_id?: string
    location_id?: string
    direction?: string
    quantity?: number
    notes?: string | null
    reorder_point?: number | null
    reorder_quantity?: number | null
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ message: "Invalid JSON." }, { status: 400 })
  }

  const catalogItemId = typeof body.catalog_item_id === "string" ? body.catalog_item_id.trim() : ""
  const locationId = typeof body.location_id === "string" ? body.location_id.trim() : ""
  const qty = typeof body.quantity === "number" && Number.isFinite(body.quantity) ? body.quantity : NaN
  const dir = String(body.direction ?? "").toLowerCase()

  if (!UUID_RE.test(catalogItemId) || !UUID_RE.test(locationId)) {
    return NextResponse.json({ message: "catalog_item_id and location_id are required." }, { status: 400 })
  }
  if (!Number.isFinite(qty) || qty <= 0) {
    return NextResponse.json({ message: "quantity must be a positive number." }, { status: 400 })
  }
  if (dir !== "in" && dir !== "out") {
    return NextResponse.json({ message: 'direction must be "in" or "out".' }, { status: 400 })
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

  const row = await ensureStockRow(gate.svc, organizationId, catalogItemId, locationId)
  const delta = dir === "in" ? qty : -qty
  const nextOh = row.quantity_on_hand + delta
  if (nextOh < row.quantity_allocated) {
    return NextResponse.json(
      { message: "Adjustment would drop on-hand below allocated quantity." },
      { status: 409 },
    )
  }
  if (nextOh < 0) {
    return NextResponse.json({ message: "Insufficient quantity for adjustment out." }, { status: 409 })
  }

  await applyStockPatch(gate.svc, organizationId, row.id, {
    quantity_on_hand: nextOh,
    quantity_allocated: row.quantity_allocated,
  })

  const patch: Record<string, unknown> = {}
  if (body.reorder_point != null) patch.reorder_point = body.reorder_point
  if (body.reorder_quantity != null) patch.reorder_quantity = body.reorder_quantity
  if (Object.keys(patch).length > 0) {
    await gate.svc.from("inventory_stock").update(patch).eq("organization_id", organizationId).eq("id", row.id)
  }

  await insertLedger(gate.svc, {
    organization_id: organizationId,
    catalog_item_id: catalogItemId,
    location_id: locationId,
    transaction_type: "adjustment",
    quantity: qty,
    delta_on_hand: delta,
    delta_allocated: 0,
    notes: body.notes ?? null,
    metadata: { direction: dir },
    created_by: gate.userId,
  })

  return NextResponse.json({ ok: true })
}
