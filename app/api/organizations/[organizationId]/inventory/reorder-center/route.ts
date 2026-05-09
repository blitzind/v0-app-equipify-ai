import { NextResponse } from "next/server"
import { requireOrgInventoryRead } from "@/lib/inventory/require-org-inventory-access"
import {
  resolveTechnicianDbIdForUser,
  resolveVehicleLocationIdForTechnician,
} from "@/lib/inventory/technician-truck"
import {
  classifyReorderRow,
  normalizeInventoryLocationKind,
  suggestedReorderLineQuantity,
  type ReorderUiStatus,
} from "@/lib/inventory/reorder-status"
import {
  getOrgPermissionsForRole,
  hasOrgPermission,
  normalizeOrgMemberRole,
} from "@/lib/permissions/model"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type ReorderCenterStockRow = {
  stock_id: string
  catalog_item_id: string
  location_id: string
  quantity_on_hand: number
  quantity_allocated: number
  quantity_available: number
  reorder_point: number | null
  reorder_quantity: number | null
  suggested_quantity: number
  item_name: string | null
  part_number: string | null
  sku: string | null
  unit: string | null
  location_name: string | null
  location_type: string | null
  location_code: string | null
  technician_label: string | null
  vendor_id: string | null
  vendor_name: string | null
  ui_status: ReorderUiStatus
  tone: "ok" | "low" | "out"
}

function costToUnitCents(cost: unknown): number {
  if (cost == null) return 0
  const n = Number(cost)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.round(n * 100))
}

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

  const {
    data: { user },
  } = await gate.supabase.auth.getUser()
  const platformAdmin = Boolean(user?.email && isPlatformAdminEmail(user.email))

  const { data: mem } = await gate.supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", gate.userId)
    .eq("status", "active")
    .maybeSingle()

  const role = normalizeOrgMemberRole((mem as { role?: string } | null)?.role)
  const perms = role ? getOrgPermissionsForRole(role) : null
  const canManageInventory =
    platformAdmin || Boolean(perms && hasOrgPermission(perms, "canManageInventory"))
  const canConsumeParts =
    platformAdmin || Boolean(perms && hasOrgPermission(perms, "canConsumePartsOnWorkOrders"))

  let myVehicleLocationId: string | null = null
  if (!canManageInventory && canConsumeParts) {
    const techDbId = await resolveTechnicianDbIdForUser(gate.svc, organizationId, gate.userId)
    if (techDbId) {
      myVehicleLocationId = await resolveVehicleLocationIdForTechnician(
        gate.svc,
        organizationId,
        techDbId,
      )
    }
  }

  const { data: stockRows, error: stockErr } = await gate.svc
    .from("inventory_stock")
    .select(
      "id, catalog_item_id, location_id, quantity_on_hand, quantity_allocated, reorder_point, reorder_quantity",
    )
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })
    .limit(2500)

  if (stockErr) {
    return NextResponse.json({ message: stockErr.message }, { status: 500 })
  }

  const rows = stockRows ?? []
  const catIds = [...new Set(rows.map((r) => r.catalog_item_id as string).filter(Boolean))]
  const locIds = [...new Set(rows.map((r) => r.location_id as string).filter(Boolean))]

  const [{ data: cats }, { data: locs }, { data: vendors }] = await Promise.all([
    catIds.length ?
      gate.svc
        .from("catalog_items")
        .select("id, part_number, sku, name, unit, vendor_id, cost")
        .eq("organization_id", organizationId)
        .in("id", catIds)
    : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    locIds.length ?
      gate.svc
        .from("inventory_locations")
        .select("id, name, location_type, code, technician_id")
        .eq("organization_id", organizationId)
        .in("id", locIds)
    : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    gate.svc.from("org_vendors").select("id, name").eq("organization_id", organizationId),
  ])

  const catMap = new Map((cats ?? []).map((c) => [c.id as string, c]))
  const locMap = new Map((locs ?? []).map((l) => [l.id as string, l]))
  const vendorMap = new Map((vendors ?? []).map((v) => [v.id as string, v]))

  const techIds = [
    ...new Set(
      (locs ?? [])
        .map((l) => (l as { technician_id?: string }).technician_id)
        .filter((x): x is string => typeof x === "string" && UUID_RE.test(x)),
    ),
  ]

  const { data: techRows } =
    techIds.length ?
      await gate.svc.from("technicians").select("id, full_name").eq("organization_id", organizationId).in("id", techIds)
    : { data: [] as { id: string; full_name: string | null }[] }

  const techNameById = new Map((techRows ?? []).map((t) => [t.id, t.full_name]))

  const enriched: ReorderCenterStockRow[] = []

  for (const raw of rows) {
    const row = raw as Record<string, unknown>
    const cat = catMap.get(row.catalog_item_id as string)
    const loc = locMap.get(row.location_id as string)
    const onHand = Number(row.quantity_on_hand)
    const alloc = Number(row.quantity_allocated)
    const avail = onHand - alloc
    const rp = row.reorder_point == null ? null : Number(row.reorder_point)
    const rq = row.reorder_quantity == null ? null : Number(row.reorder_quantity)

    const classification = classifyReorderRow({
      quantity_on_hand: onHand,
      quantity_available: avail,
      reorder_point: rp,
      location_type: (loc?.location_type as string | undefined) ?? null,
    })

    const vid = (cat?.vendor_id as string | undefined) ?? null
    const vendorName = vid ? (vendorMap.get(vid)?.name as string | undefined) ?? null : null
    const techId = (loc as { technician_id?: string } | null)?.technician_id
    const technicianLabel =
      typeof techId === "string" && techNameById.has(techId)
        ? (techNameById.get(techId) ?? "").trim() || null
        : null

    enriched.push({
      stock_id: row.id as string,
      catalog_item_id: row.catalog_item_id as string,
      location_id: row.location_id as string,
      quantity_on_hand: onHand,
      quantity_allocated: alloc,
      quantity_available: avail,
      reorder_point: rp,
      reorder_quantity: rq,
      suggested_quantity: suggestedReorderLineQuantity({
        quantity_available: avail,
        reorder_point: rp,
        reorder_quantity: rq,
      }),
      item_name: (cat?.name as string | undefined) ?? null,
      part_number: (cat?.part_number as string | undefined) ?? null,
      sku: (cat?.sku as string | undefined) ?? null,
      unit: (cat?.unit as string | undefined) ?? null,
      location_name: (loc?.name as string | undefined) ?? null,
      location_type: (loc?.location_type as string | undefined) ?? null,
      location_code: (loc?.code as string | undefined) ?? null,
      technician_label: technicianLabel,
      vendor_id: vid,
      vendor_name: vendorName,
      ui_status: classification.ui_status,
      tone: classification.tone,
    })
  }

  const locKind = (lid: string) =>
    normalizeInventoryLocationKind(locMap.get(lid)?.location_type as string | undefined)

  const isTechScoped = !canManageInventory && canConsumeParts
  const isViewerReadonly = !canManageInventory && !canConsumeParts

  let techTruckRows: ReorderCenterStockRow[] = []
  if (isTechScoped) {
    techTruckRows =
      myVehicleLocationId ?
        enriched.filter((r) => r.location_id === myVehicleLocationId)
      : []
  }

  /** Rows used for summary counts — managers/viewers see org-wide; technicians see assigned truck only. */
  const summaryScope =
    canManageInventory || isViewerReadonly ? enriched : techTruckRows

  const warehouseStaging = (r: ReorderCenterStockRow) => {
    const k = locKind(r.location_id)
    return k === "warehouse" || k === "staging"
  }
  const isVehicle = (r: ReorderCenterStockRow) => locKind(r.location_id) === "vehicle"

  const warehouseRowsSource = canManageInventory || isViewerReadonly ? enriched : []

  const truckRowsSource = canManageInventory || isViewerReadonly ? enriched : techTruckRows

  const warehouseLowOrOut = warehouseRowsSource.filter(
    (r) =>
      warehouseStaging(r) &&
      (r.ui_status === "reorder_recommended" || r.tone === "low" || r.tone === "out"),
  )
  const warehouseOut = warehouseRowsSource.filter((r) => warehouseStaging(r) && r.tone === "out")
  const truckRestock = truckRowsSource.filter(
    (r) => isVehicle(r) && r.ui_status === "restock_truck_recommended",
  )

  const missingReorderPoints = (
    canManageInventory ? enriched : isViewerReadonly ? enriched : techTruckRows
  ).filter((r) => {
    const k = locKind(r.location_id)
    if (k !== "warehouse" && k !== "staging" && k !== "vehicle") return false
    return r.reorder_point == null && r.quantity_on_hand > 0
  })

  const belowReorderPointCount = summaryScope.filter(
    (r) =>
      r.reorder_point != null &&
      r.quantity_available <= Number(r.reorder_point) &&
      (warehouseStaging(r) || isVehicle(r)),
  ).length

  const trucksNeedingRestock = new Set(
    truckRestock.map((r) => r.location_id).filter(Boolean),
  ).size

  const urgentWarehouseOut = warehouseOut.length

  const poSourceRows = canManageInventory ?
    enriched.filter(
      (r) =>
        warehouseStaging(r) &&
        r.ui_status === "reorder_recommended" &&
        r.vendor_id &&
        r.reorder_point != null,
    )
  : []

  const poByVendor = new Map<
    string,
    {
      vendor_id: string
      vendor_name: string
      lines: Array<{
        stock_id: string
        catalog_item_id: string
        location_id: string
        item_name: string | null
        part_number: string | null
        quantity_available: number
        reorder_point: number | null
        suggested_quantity: number
        unit_cost_cents: number
      }>
    }
  >()

  for (const r of poSourceRows) {
    const vid = r.vendor_id as string
    const cat = catMap.get(r.catalog_item_id)
    const unitCostCents = costToUnitCents(cat?.cost)
    const name = (vendorMap.get(vid)?.name as string | undefined)?.trim() || "Vendor"
    let bucket = poByVendor.get(vid)
    if (!bucket) {
      bucket = { vendor_id: vid, vendor_name: name, lines: [] }
      poByVendor.set(vid, bucket)
    }
    bucket.lines.push({
      stock_id: r.stock_id,
      catalog_item_id: r.catalog_item_id,
      location_id: r.location_id,
      item_name: r.item_name,
      part_number: r.part_number,
      quantity_available: r.quantity_available,
      reorder_point: r.reorder_point,
      suggested_quantity: r.suggested_quantity,
      unit_cost_cents: unitCostCents,
    })
  }

  const vendor_po_suggestions = [...poByVendor.values()].filter((g) => g.lines.length > 0)

  const { data: reqLed } = await gate.svc
    .from("inventory_transactions")
    .select(
      "id, catalog_item_id, location_id, quantity, notes, metadata, created_at, created_by",
    )
    .eq("organization_id", organizationId)
    .eq("transaction_type", "reorder_recorded")
    .contains("metadata", { restock_request: true })
    .order("created_at", { ascending: false })
    .limit(60)

  let restock_requests = (reqLed ?? []).map((t) => {
    const meta = (t as { metadata?: Record<string, unknown> }).metadata ?? {}
    return {
      id: (t as { id: string }).id,
      catalog_item_id: (t as { catalog_item_id: string }).catalog_item_id,
      location_id: (t as { location_id: string }).location_id,
      quantity: Number((t as { quantity?: number }).quantity ?? 0),
      notes: (t as { notes?: string | null }).notes ?? null,
      created_at: (t as { created_at: string }).created_at,
      created_by: (t as { created_by?: string | null }).created_by ?? null,
      requested_quantity:
        typeof meta.requested_quantity === "number" ? meta.requested_quantity : null,
    }
  })
  if (!canManageInventory && !canConsumeParts) {
    restock_requests = []
  } else if (!canManageInventory && canConsumeParts) {
    restock_requests = restock_requests.filter((row) => {
      if (myVehicleLocationId && row.location_id === myVehicleLocationId) return true
      if (row.created_by === gate.userId) return true
      return false
    })
  }

  const reqCatIds = [...new Set(restock_requests.map((r) => r.catalog_item_id).filter(Boolean))]
  const reqLocIds = [...new Set(restock_requests.map((r) => r.location_id).filter(Boolean))]
  const [{ data: reqCats }, { data: reqLocs }] = await Promise.all([
    reqCatIds.length ?
      gate.svc
        .from("catalog_items")
        .select("id, name, part_number")
        .eq("organization_id", organizationId)
        .in("id", reqCatIds)
    : Promise.resolve({ data: [] as { id: string; name: string | null; part_number: string | null }[] }),
    reqLocIds.length ?
      gate.svc
        .from("inventory_locations")
        .select("id, name")
        .eq("organization_id", organizationId)
        .in("id", reqLocIds)
    : Promise.resolve({ data: [] as { id: string; name: string | null }[] }),
  ])
  const reqCatMap = new Map((reqCats ?? []).map((c) => [c.id, c]))
  const reqLocMap = new Map((reqLocs ?? []).map((l) => [l.id, l]))
  restock_requests = restock_requests.map((row) => ({
    ...row,
    item_name: (reqCatMap.get(row.catalog_item_id)?.name as string | undefined) ?? null,
    part_number: (reqCatMap.get(row.catalog_item_id)?.part_number as string | undefined) ?? null,
    location_name: (reqLocMap.get(row.location_id)?.name as string | undefined) ?? null,
  }))

  const { data: whLocs } = canManageInventory ?
    await gate.svc
      .from("inventory_locations")
      .select("id, name, location_type, code")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .in("location_type", ["warehouse", "staging"])
      .order("name", { ascending: true })
  : { data: [] as { id: string; name: string; location_type: string; code: string | null }[] }

  const warehouse_pick_locations = (whLocs ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    location_type: l.location_type,
    code: l.code,
  }))

  return NextResponse.json({
    capabilities: {
      can_manage_reorder: canManageInventory,
      can_request_restock: canConsumeParts,
      can_draft_po: canManageInventory,
      can_transfer_truck: canManageInventory,
      can_mark_truck_restock_complete: canManageInventory,
    },
    summary: {
      items_below_reorder_point: belowReorderPointCount,
      warehouse_low_or_out_rows: warehouseLowOrOut.length,
      warehouse_out_rows: urgentWarehouseOut,
      trucks_needing_restock: trucksNeedingRestock,
      vendor_po_groups: vendor_po_suggestions.length,
      urgent_out_warehouse: urgentWarehouseOut,
      pending_restock_requests: restock_requests.length,
    },
    warehouse_low_or_out:
      canManageInventory || isViewerReadonly ? warehouseLowOrOut : [],
    warehouse_out: canManageInventory || isViewerReadonly ? warehouseOut : [],
    truck_restock: truckRestock,
    missing_reorder_points: missingReorderPoints,
    vendor_po_suggestions,
    restock_requests,
    warehouse_pick_locations,
    my_vehicle_location_id: myVehicleLocationId,
  })
}
