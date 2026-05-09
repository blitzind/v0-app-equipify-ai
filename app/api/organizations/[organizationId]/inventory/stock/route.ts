import { NextResponse } from "next/server"
import { requireOrgInventoryRead } from "@/lib/inventory/require-org-inventory-access"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ message: "Invalid organization." }, { status: 400 })
  }

  const gate = await requireOrgInventoryRead(organizationId)
  if ("error" in gate) return gate.error

  const sp = new URL(request.url).searchParams
  const locationId = sp.get("location_id")?.trim()
  const catalogItemId = sp.get("catalog_item_id")?.trim()

  let q = gate.svc
    .from("inventory_stock")
    .select(
      "id, catalog_item_id, location_id, quantity_on_hand, quantity_allocated, reorder_point, reorder_quantity, updated_at",
    )
    .eq("organization_id", organizationId)

  if (locationId && UUID_RE.test(locationId)) q = q.eq("location_id", locationId)
  if (catalogItemId && UUID_RE.test(catalogItemId)) q = q.eq("catalog_item_id", catalogItemId)

  const { data, error } = await q.order("updated_at", { ascending: false }).limit(2000)

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  const rows = data ?? []
  const catIds = [...new Set(rows.map((r) => r.catalog_item_id as string).filter(Boolean))]
  const locIds = [...new Set(rows.map((r) => r.location_id as string).filter(Boolean))]

  const [{ data: cats }, { data: locs }] = await Promise.all([
    catIds.length ?
      gate.svc
        .from("catalog_items")
        .select("id, part_number, sku, name, unit")
        .eq("organization_id", organizationId)
        .in("id", catIds)
    : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    locIds.length ?
      gate.svc
        .from("inventory_locations")
        .select("id, name, location_type, code")
        .eq("organization_id", organizationId)
        .in("id", locIds)
    : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ])

  const catMap = new Map((cats ?? []).map((c) => [c.id as string, c]))
  const locMap = new Map((locs ?? []).map((l) => [l.id as string, l]))

  const { data: inboundTx } = await gate.svc
    .from("inventory_transactions")
    .select("catalog_item_id, location_id, created_at")
    .eq("organization_id", organizationId)
    .in("transaction_type", ["transfer_in", "receive"])
    .order("created_at", { ascending: false })
    .limit(6000)

  const lastInbound = new Map<string, string>()
  for (const t of inboundTx ?? []) {
    const tr = t as { catalog_item_id?: string; location_id?: string; created_at?: string }
    const k = `${tr.catalog_item_id}::${tr.location_id}`
    if (!lastInbound.has(k) && tr.created_at) lastInbound.set(k, tr.created_at)
  }

  const items = rows.map((raw) => {
    const row = raw as Record<string, unknown>
    const cat = catMap.get(row.catalog_item_id as string)
    const loc = locMap.get(row.location_id as string)
    const onHand = Number(row.quantity_on_hand)
    const alloc = Number(row.quantity_allocated)
    const avail = onHand - alloc
    const rk = `${row.catalog_item_id as string}::${row.location_id as string}`
    return {
      id: row.id,
      catalog_item_id: row.catalog_item_id,
      location_id: row.location_id,
      quantity_on_hand: onHand,
      quantity_allocated: alloc,
      quantity_available: avail,
      reorder_point: row.reorder_point,
      reorder_quantity: row.reorder_quantity,
      updated_at: row.updated_at,
      last_restocked_at: lastInbound.get(rk) ?? null,
      part_number: (cat?.part_number as string | undefined) ?? null,
      sku: (cat?.sku as string | undefined) ?? null,
      item_name: (cat?.name as string | undefined) ?? null,
      unit: (cat?.unit as string | undefined) ?? null,
      location_name: (loc?.name as string | undefined) ?? null,
      location_type: (loc?.location_type as string | undefined) ?? null,
      location_code: (loc?.code as string | undefined) ?? null,
    }
  })

  return NextResponse.json({ stock: items })
}
