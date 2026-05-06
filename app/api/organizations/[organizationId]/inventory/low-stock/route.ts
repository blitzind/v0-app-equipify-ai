import { NextResponse } from "next/server"
import { requireOrgInventoryRead } from "@/lib/inventory/require-org-inventory-access"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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

  const { data: rows, error } = await gate.svc
    .from("inventory_stock")
    .select(
      "id, catalog_item_id, location_id, quantity_on_hand, quantity_allocated, reorder_point, reorder_quantity",
    )
    .eq("organization_id", organizationId)
    .not("reorder_point", "is", null)

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  const alerts = (rows ?? []).filter((r) => {
    const rp = r.reorder_point != null ? Number(r.reorder_point) : null
    if (rp == null || Number.isNaN(rp)) return false
    const oh = Number(r.quantity_on_hand)
    const al = Number(r.quantity_allocated)
    return oh - al <= rp
  })

  const catIds = [...new Set(alerts.map((r) => r.catalog_item_id as string))]
  const locIds = [...new Set(alerts.map((r) => r.location_id as string))]

  const [{ data: cats }, { data: locs }] = await Promise.all([
    catIds.length ?
      gate.svc.from("catalog_items").select("id, part_number, name").eq("organization_id", organizationId).in("id", catIds)
    : Promise.resolve({ data: [] as { id: string; part_number?: string; name?: string }[] }),
    locIds.length ?
      gate.svc.from("inventory_locations").select("id, name").eq("organization_id", organizationId).in("id", locIds)
    : Promise.resolve({ data: [] as { id: string; name?: string }[] }),
  ])

  const cm = new Map((cats ?? []).map((c) => [c.id, c]))
  const lm = new Map((locs ?? []).map((l) => [l.id, l]))

  return NextResponse.json({
    items: alerts.map((r) => {
      const oh = Number(r.quantity_on_hand)
      const al = Number(r.quantity_allocated)
      const cat = cm.get(r.catalog_item_id as string)
      const loc = lm.get(r.location_id as string)
      return {
        stock_id: r.id,
        catalog_item_id: r.catalog_item_id,
        location_id: r.location_id,
        quantity_available: oh - al,
        reorder_point: r.reorder_point,
        reorder_quantity: r.reorder_quantity,
        part_number: cat?.part_number ?? null,
        item_name: cat?.name ?? null,
        location_name: loc?.name ?? null,
      }
    }),
  })
}
