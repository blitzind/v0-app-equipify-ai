import { NextResponse } from "next/server"
import { executeInventoryTransfer } from "@/lib/inventory/execute-inventory-transfer"
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

  const { data: cat } = await gate.svc
    .from("catalog_items")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", catalogItemId)
    .maybeSingle()
  if (!cat) return NextResponse.json({ message: "Catalog item not found." }, { status: 404 })

  for (const lid of [fromId, toId]) {
    const { data: loc } = await gate.svc
      .from("inventory_locations")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("id", lid)
      .maybeSingle()
    if (!loc) return NextResponse.json({ message: `Location ${lid} not found.` }, { status: 404 })
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
