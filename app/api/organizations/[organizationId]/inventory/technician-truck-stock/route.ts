import { NextResponse } from "next/server"
import { requireOrgInventoryRead } from "@/lib/inventory/require-org-inventory-access"
import { requireOrgPermission } from "@/lib/api/require-org-permission"
import {
  resolveTechnicianDbIdForUser,
  resolveVehicleLocationIdForTechnician,
} from "@/lib/inventory/technician-truck"
import { isLowStock } from "@/lib/inventory/format"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function stockStatus(row: {
  quantity_on_hand: number
  quantity_available: number
  reorder_point: number | null
}): "out" | "low" | "ok" {
  if (Number(row.quantity_on_hand) <= 0) return "out"
  if (
    isLowStock({
      quantity_available: Number(row.quantity_available),
      reorder_point: row.reorder_point,
    })
  )
    return "low"
  return "ok"
}

/**
 * Truck / van stock lines for a technician (profile user id). Managers may query any member;
 * technicians may only query themselves.
 */
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
  const forUserIdRaw = sp.get("for_user_id")?.trim()
  const forUserId =
    forUserIdRaw && UUID_RE.test(forUserIdRaw) ? forUserIdRaw : gate.userId

  if (forUserId !== gate.userId) {
    const mgr = await requireOrgPermission(organizationId, "canManageInventory")
    if ("error" in mgr) {
      return NextResponse.json({ message: "Forbidden." }, { status: 403 })
    }
  }

  const technicianDbId = await resolveTechnicianDbIdForUser(gate.svc, organizationId, forUserId)
  if (!technicianDbId) {
    return NextResponse.json({
      technician_id: null,
      inventory_location_id: null,
      location_name: null,
      stock: [] as unknown[],
    })
  }

  const inventoryLocationId = await resolveVehicleLocationIdForTechnician(
    gate.svc,
    organizationId,
    technicianDbId,
  )

  if (!inventoryLocationId) {
    return NextResponse.json({
      technician_id: technicianDbId,
      inventory_location_id: null,
      location_name: null,
      stock: [],
    })
  }

  const { data: loc } = await gate.svc
    .from("inventory_locations")
    .select("id, name, location_type")
    .eq("organization_id", organizationId)
    .eq("id", inventoryLocationId)
    .maybeSingle()

  const { data: stockRows, error: stockErr } = await gate.svc
    .from("inventory_stock")
    .select(
      "id, catalog_item_id, location_id, quantity_on_hand, quantity_allocated, reorder_point, reorder_quantity",
    )
    .eq("organization_id", organizationId)
    .eq("location_id", inventoryLocationId)
    .order("updated_at", { ascending: false })
    .limit(500)

  if (stockErr) {
    return NextResponse.json({ message: stockErr.message }, { status: 500 })
  }

  const rows = stockRows ?? []
  const catIds = [...new Set(rows.map((r) => r.catalog_item_id as string).filter(Boolean))]

  const { data: cats } =
    catIds.length ?
      await gate.svc
        .from("catalog_items")
        .select("id, part_number, name, unit")
        .eq("organization_id", organizationId)
        .in("id", catIds)
    : { data: [] as Record<string, unknown>[] }

  const catMap = new Map((cats ?? []).map((c) => [c.id as string, c]))

  const items = rows.map((raw) => {
    const row = raw as Record<string, unknown>
    const cat = catMap.get(row.catalog_item_id as string)
    const onHand = Number(row.quantity_on_hand)
    const alloc = Number(row.quantity_allocated)
    const avail = onHand - alloc
    const reorderPoint = row.reorder_point as number | null
    const stockRow = {
      id: row.id as string,
      catalog_item_id: row.catalog_item_id as string,
      location_id: row.location_id as string,
      quantity_on_hand: onHand,
      quantity_allocated: alloc,
      quantity_available: avail,
      reorder_point: reorderPoint,
      reorder_quantity: row.reorder_quantity as number | null,
      part_number: (cat?.part_number as string | undefined) ?? null,
      item_name: (cat?.name as string | undefined) ?? null,
      unit: (cat?.unit as string | undefined) ?? null,
    }
    return {
      ...stockRow,
      stock_status: stockStatus(stockRow),
      /** Phase 29 prep — true when at/below reorder point (includes out-of-stock when reorder_point set). */
      needs_restock: Boolean(
        reorderPoint != null && Number(avail) <= Number(reorderPoint),
      ),
    }
  })

  return NextResponse.json({
    technician_id: technicianDbId,
    inventory_location_id: inventoryLocationId,
    location_name: (loc as { name?: string } | null)?.name ?? null,
    location_type: (loc as { location_type?: string } | null)?.location_type ?? null,
    stock: items,
  })
}
