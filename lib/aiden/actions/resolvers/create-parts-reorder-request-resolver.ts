import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  classifyReorderRow,
  normalizeInventoryLocationKind,
  suggestedReorderLineQuantity,
} from "@/lib/inventory/reorder-status"
import type {
  CreatePartsReorderExecutionMode,
  CreatePartsReorderPreviewLine,
  CreatePartsReorderPreviewPayload,
  CreatePartsReorderPreviewSource,
} from "@/lib/aiden/actions/resolvers/create-parts-reorder-request-types"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type CreatePartsReorderRequestResolverInput = {
  organizationId: string
  userId: string
  userMessage: string
  workOrderId?: string
  equipmentId?: string
}

export type CreatePartsReorderRequestResolverResult =
  | { status: "prepared"; preview: CreatePartsReorderPreviewPayload }
  | { status: "needs_clarification"; reason: string; customerCandidates: Array<{ id: string; label: string }> }
  | { status: "failed"; reason: string }

function normalizeMessage(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase()
}

function explicitLowStockPhrase(normalized: string): boolean {
  return /\b(low\s*stock|out\s*of\s*stock|reorder\s+center|warehouse\s+reorder)\b/.test(normalized)
}

function locationRank(locationType: string | null | undefined): number {
  const k = normalizeInventoryLocationKind(locationType)
  if (k === "warehouse") return 0
  if (k === "staging") return 1
  if (k === "vehicle") return 2
  return 3
}

function num(v: unknown): number {
  const n = typeof v === "string" ? Number.parseFloat(v) : Number(v)
  return Number.isFinite(n) ? n : 0
}

async function loadDefaultWarehouseLocationId(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("inventory_locations")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .in("location_type", ["warehouse", "staging"])
    .order("name", { ascending: true })
    .limit(1)
    .maybeSingle()
  const id = (data as { id?: string } | null)?.id
  return id && UUID_RE.test(id) ? id : null
}

async function loadVendors(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<Array<{ id: string; name: string }>> {
  const { data, error } = await supabase
    .from("org_vendors")
    .select("id, name")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true })
    .limit(500)
  if (error) return []
  return (data ?? [])
    .map((r) => ({ id: String((r as { id: string }).id), name: String((r as { name?: string }).name ?? "").trim() }))
    .filter((v) => UUID_RE.test(v.id) && v.name.length > 0)
}

type StockPick = {
  location_id: string
  quantity_on_hand: number
  quantity_allocated: number
  quantity_available: number
  reorder_point: number | null
  reorder_quantity: number | null
  location_name: string | null
  location_type: string | null
  location_code: string | null
}

function pickStockRowForCatalog(
  rows: StockPick[],
  preferredLocationId?: string | null,
): StockPick | null {
  if (rows.length === 0) return null
  if (preferredLocationId && UUID_RE.test(preferredLocationId)) {
    const hit = rows.find((r) => r.location_id === preferredLocationId)
    if (hit) return hit
  }
  const sorted = [...rows].sort((a, b) => {
    const ra = locationRank(a.location_type)
    const rb = locationRank(b.location_type)
    if (ra !== rb) return ra - rb
    return a.quantity_available - b.quantity_available
  })
  return sorted[0] ?? null
}

async function loadStockRowsForCatalogs(
  supabase: SupabaseClient,
  organizationId: string,
  catalogIds: string[],
): Promise<Map<string, StockPick[]>> {
  const map = new Map<string, StockPick[]>()
  if (catalogIds.length === 0) return map
  const { data: stockRows, error } = await supabase
    .from("inventory_stock")
    .select("id, catalog_item_id, location_id, quantity_on_hand, quantity_allocated, reorder_point, reorder_quantity")
    .eq("organization_id", organizationId)
    .in("catalog_item_id", catalogIds)
  if (error) return map
  const locIds = [...new Set((stockRows ?? []).map((r) => (r as { location_id: string }).location_id).filter(Boolean))]
  const { data: locs } =
    locIds.length ?
      await supabase
        .from("inventory_locations")
        .select("id, name, location_type, code")
        .eq("organization_id", organizationId)
        .in("id", locIds)
    : { data: [] as Record<string, unknown>[] }
  const locMap = new Map((locs ?? []).map((l) => [l.id as string, l as Record<string, unknown>]))
  for (const raw of stockRows ?? []) {
    const row = raw as Record<string, unknown>
    const cid = row.catalog_item_id as string
    const lid = row.location_id as string
    const loc = locMap.get(lid)
    const onHand = num(row.quantity_on_hand)
    const alloc = num(row.quantity_allocated)
    const avail = onHand - alloc
    const rp = row.reorder_point == null ? null : num(row.reorder_point)
    const rq = row.reorder_quantity == null ? null : num(row.reorder_quantity)
    const pick: StockPick = {
      location_id: lid,
      quantity_on_hand: onHand,
      quantity_allocated: alloc,
      quantity_available: avail,
      reorder_point: rp,
      reorder_quantity: rq,
      location_name: (loc?.name as string | undefined) ?? null,
      location_type: (loc?.location_type as string | undefined) ?? null,
      location_code: (loc?.code as string | undefined) ?? null,
    }
    const arr = map.get(cid) ?? []
    arr.push(pick)
    map.set(cid, arr)
  }
  return map
}

function formatLocationLabel(s: StockPick): string {
  const name = (s.location_name ?? "").trim() || "Location"
  const code = (s.location_code ?? "").trim()
  return code ? `${name} (${code})` : name
}

function buildLinesFromCatalogUsage(args: {
  usageByCatalog: Map<string, number>
  consumePreferredLocation: Map<string, string>
  catalogById: Map<string, Record<string, unknown>>
  stockByCatalog: Map<string, StockPick[]>
  defaultWarehouseId: string | null
  relatedWorkOrder: CreatePartsReorderPreviewPayload["relatedWorkOrder"]
  relatedEquipment: CreatePartsReorderPreviewPayload["relatedEquipment"]
  reasonPrefix: string
}): CreatePartsReorderPreviewLine[] | null {
  const {
    usageByCatalog,
    consumePreferredLocation,
    catalogById,
    stockByCatalog,
    defaultWarehouseId,
    relatedWorkOrder,
    relatedEquipment,
    reasonPrefix,
  } = args
  const lines: CreatePartsReorderPreviewLine[] = []
  for (const [catalogItemId, usageQty] of usageByCatalog) {
    const cat = catalogById.get(catalogItemId)
    if (!cat) continue
    const partName = String(cat.name ?? "").trim() || "Part"
    const sku = cat.sku == null ? null : typeof cat.sku === "string" ? cat.sku : null
    const partNumber = cat.part_number == null ? null : typeof cat.part_number === "string" ? cat.part_number : null
    const vendorId = cat.vendor_id == null ? null : typeof cat.vendor_id === "string" ? cat.vendor_id : null
    const vendorName = cat.vendor_name == null ? null : typeof cat.vendor_name === "string" ? cat.vendor_name : null

    const stockRows = stockByCatalog.get(catalogItemId) ?? []
    const prefLoc = consumePreferredLocation.get(catalogItemId) ?? null
    let pick = pickStockRowForCatalog(stockRows, prefLoc)
    if (!pick && defaultWarehouseId) {
      pick = {
        location_id: defaultWarehouseId,
        quantity_on_hand: 0,
        quantity_allocated: 0,
        quantity_available: 0,
        reorder_point: null,
        reorder_quantity: null,
        location_name: "Default warehouse",
        location_type: "warehouse",
        location_code: null,
      }
    }
    if (!pick) continue

    const cls = classifyReorderRow({
      quantity_on_hand: pick.quantity_on_hand,
      quantity_available: pick.quantity_available,
      reorder_point: pick.reorder_point,
      location_type: pick.location_type,
    })
    const fromReorderMath = suggestedReorderLineQuantity({
      quantity_available: pick.quantity_available,
      reorder_point: pick.reorder_point,
      reorder_quantity: pick.reorder_quantity,
    })
    const usageRounded = Math.max(1, Math.round(usageQty))
    const suggestedQuantity = Math.max(usageRounded, fromReorderMath)

    const woHint = relatedWorkOrder ? `WO #${relatedWorkOrder.number}` : ""
    const eqHint = relatedEquipment ? relatedEquipment.name : ""
    const anchor = [woHint, eqHint].filter(Boolean).join(" · ")
    let reason = `${reasonPrefix}${anchor ? ` (${anchor})` : ""}.`
    if (cls.ui_status === "reorder_recommended" || cls.tone === "low" || cls.tone === "out") {
      reason += ` Stock signal: ${cls.ui_status.replace(/_/g, " ")}.`
    }

    lines.push({
      lineKey: randomUUID(),
      catalogItemId,
      partName,
      sku,
      partNumber,
      currentStockAvailable: pick.quantity_available,
      suggestedQuantity,
      vendorId,
      vendorName,
      inventoryLocationId: pick.location_id,
      inventoryLocationLabel: formatLocationLabel(pick),
      reason,
    })
  }
  return lines.length ? lines : null
}

async function resolveFromWorkOrder(
  supabase: SupabaseClient,
  organizationId: string,
  workOrderId: string,
  vendors: Array<{ id: string; name: string }>,
): Promise<CreatePartsReorderRequestResolverResult> {
  const { data: wo, error: woErr } = await supabase
    .from("work_orders")
    .select("id, work_order_number, title, equipment_id, archived_at")
    .eq("organization_id", organizationId)
    .eq("id", workOrderId)
    .maybeSingle()
  if (woErr) return { status: "failed", reason: woErr.message }
  const w = wo as {
    id: string
    work_order_number: number
    title: string | null
    equipment_id: string | null
    archived_at: string | null
  } | null
  if (!w || w.archived_at) return { status: "failed", reason: "Work order was not found or is archived." }

  let equipment: CreatePartsReorderPreviewPayload["relatedEquipment"] = null
  if (w.equipment_id && UUID_RE.test(w.equipment_id)) {
    const { data: eq } = await supabase
      .from("equipment")
      .select("id, name")
      .eq("organization_id", organizationId)
      .eq("id", w.equipment_id)
      .maybeSingle()
    const er = eq as { id: string; name: string } | null
    if (er?.name) equipment = { id: er.id, name: er.name }
  }

  const relatedWorkOrder = { id: w.id, number: w.work_order_number, title: w.title }

  const usageByCatalog = new Map<string, number>()
  const consumePreferredLocation = new Map<string, string>()

  const { data: liRows, error: liErr } = await supabase
    .from("work_order_line_items")
    .select("catalog_item_id, quantity")
    .eq("organization_id", organizationId)
    .eq("work_order_id", workOrderId)
    .not("catalog_item_id", "is", null)
  if (liErr) return { status: "failed", reason: liErr.message }
  for (const row of liRows ?? []) {
    const r = row as { catalog_item_id: string | null; quantity: string | number | null }
    if (!r.catalog_item_id || !UUID_RE.test(r.catalog_item_id)) continue
    const q = num(r.quantity)
    if (q <= 0) continue
    usageByCatalog.set(r.catalog_item_id, (usageByCatalog.get(r.catalog_item_id) ?? 0) + q)
  }

  if (usageByCatalog.size === 0) {
    const { data: cons, error: cErr } = await supabase
      .from("inventory_transactions")
      .select("catalog_item_id, location_id, quantity")
      .eq("organization_id", organizationId)
      .eq("work_order_id", workOrderId)
      .eq("transaction_type", "consume")
      .order("created_at", { ascending: false })
      .limit(500)
    if (cErr) return { status: "failed", reason: cErr.message }
    for (const row of cons ?? []) {
      const r = row as { catalog_item_id: string | null; location_id: string | null; quantity: number | null }
      if (!r.catalog_item_id || !UUID_RE.test(r.catalog_item_id)) continue
      const q = num(r.quantity)
      if (q <= 0) continue
      usageByCatalog.set(r.catalog_item_id, (usageByCatalog.get(r.catalog_item_id) ?? 0) + q)
      if (r.location_id && UUID_RE.test(r.location_id) && !consumePreferredLocation.has(r.catalog_item_id)) {
        consumePreferredLocation.set(r.catalog_item_id, r.location_id)
      }
    }
  }

  if (usageByCatalog.size === 0) {
    return {
      status: "needs_clarification",
      reason:
        "This work order has no catalog-linked parts or recorded part consumption. Add catalog items to the parts list or record inventory consumption, then try again.",
      customerCandidates: [],
    }
  }

  const catalogIds = [...usageByCatalog.keys()]
  const { data: cats, error: catErr } = await supabase
    .from("catalog_items")
    .select("id, name, sku, part_number, vendor_id")
    .eq("organization_id", organizationId)
    .in("id", catalogIds)
  if (catErr) return { status: "failed", reason: catErr.message }

  const vendorNameById = new Map(vendors.map((v) => [v.id, v.name]))
  const catalogById = new Map<string, Record<string, unknown>>()
  for (const c of cats ?? []) {
    const row = c as Record<string, unknown>
    const vid = row.vendor_id == null ? null : String(row.vendor_id)
    const vn = vid && UUID_RE.test(vid) ? vendorNameById.get(vid) ?? null : null
    row.vendor_name = vn
    catalogById.set(String(row.id), row)
  }

  const stockByCatalog = await loadStockRowsForCatalogs(supabase, organizationId, catalogIds)
  const defaultWarehouseId = await loadDefaultWarehouseLocationId(supabase, organizationId)

  const lines = buildLinesFromCatalogUsage({
    usageByCatalog,
    consumePreferredLocation,
    catalogById,
    stockByCatalog,
    defaultWarehouseId,
    relatedWorkOrder,
    relatedEquipment: equipment,
    reasonPrefix: "Reorder based on work order usage",
  })
  if (!lines) {
    return {
      status: "failed",
      reason: "Could not resolve inventory locations for the parts on this work order. Configure warehouse locations first.",
    }
  }

  return finalizePreview({
    source: "work_order",
    lines,
    relatedWorkOrder,
    relatedEquipment: equipment,
    availableVendors: vendors,
    internalNotes:
      "Internal draft only — nothing is emailed to vendors. Confirming creates either a draft purchase order (single vendor) or inventory restock signals per line.",
  })
}

async function resolveFromEquipment(
  supabase: SupabaseClient,
  organizationId: string,
  equipmentId: string,
  vendors: Array<{ id: string; name: string }>,
): Promise<CreatePartsReorderRequestResolverResult> {
  const { data: eq, error: eqErr } = await supabase
    .from("equipment")
    .select("id, name, is_archived, archived_at")
    .eq("organization_id", organizationId)
    .eq("id", equipmentId)
    .maybeSingle()
  if (eqErr) return { status: "failed", reason: eqErr.message }
  const e = eq as { id: string; name: string; is_archived: boolean | null; archived_at: string | null } | null
  if (!e || e.archived_at || e.is_archived) return { status: "failed", reason: "Equipment was not found or is archived." }

  const { data: wos, error: woErr } = await supabase
    .from("work_orders")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("equipment_id", equipmentId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(20)
  if (woErr) return { status: "failed", reason: woErr.message }
  const woIds = (wos ?? []).map((w) => (w as { id: string }).id).filter((id) => UUID_RE.test(id))
  if (woIds.length === 0) {
    return {
      status: "needs_clarification",
      reason: "No recent work orders were found for this equipment. Open an active work order with parts, or ask from the work order page.",
      customerCandidates: [],
    }
  }

  const usageByCatalog = new Map<string, number>()
  const { data: liRows, error: liErr } = await supabase
    .from("work_order_line_items")
    .select("catalog_item_id, quantity")
    .eq("organization_id", organizationId)
    .in("work_order_id", woIds)
    .not("catalog_item_id", "is", null)
  if (liErr) return { status: "failed", reason: liErr.message }
  for (const row of liRows ?? []) {
    const r = row as { catalog_item_id: string | null; quantity: string | number | null }
    if (!r.catalog_item_id || !UUID_RE.test(r.catalog_item_id)) continue
    const q = num(r.quantity)
    if (q <= 0) continue
    usageByCatalog.set(r.catalog_item_id, (usageByCatalog.get(r.catalog_item_id) ?? 0) + q)
  }

  if (usageByCatalog.size === 0) {
    return {
      status: "needs_clarification",
      reason: "Recent jobs on this equipment have no catalog-linked parts. Add catalog items to work order parts lists, then try again.",
      customerCandidates: [],
    }
  }

  const catalogIds = [...usageByCatalog.keys()]
  const { data: cats, error: catErr } = await supabase
    .from("catalog_items")
    .select("id, name, sku, part_number, vendor_id")
    .eq("organization_id", organizationId)
    .in("id", catalogIds)
  if (catErr) return { status: "failed", reason: catErr.message }

  const vendorNameById = new Map(vendors.map((v) => [v.id, v.name]))
  const catalogById = new Map<string, Record<string, unknown>>()
  for (const c of cats ?? []) {
    const row = c as Record<string, unknown>
    const vid = row.vendor_id == null ? null : String(row.vendor_id)
    const vn = vid && UUID_RE.test(vid) ? vendorNameById.get(vid) ?? null : null
    row.vendor_name = vn
    catalogById.set(String(row.id), row)
  }

  const stockByCatalog = await loadStockRowsForCatalogs(supabase, organizationId, catalogIds)
  const defaultWarehouseId = await loadDefaultWarehouseLocationId(supabase, organizationId)

  const lines = buildLinesFromCatalogUsage({
    usageByCatalog,
    consumePreferredLocation: new Map(),
    catalogById,
    stockByCatalog,
    defaultWarehouseId,
    relatedWorkOrder: null,
    relatedEquipment: { id: e.id, name: e.name },
    reasonPrefix: "Reorder suggested from recent equipment work (aggregated catalog usage)",
  })
  if (!lines) {
    return {
      status: "failed",
      reason: "Could not resolve inventory locations for parts used on recent jobs for this equipment.",
    }
  }

  return finalizePreview({
    source: "equipment",
    lines,
    relatedWorkOrder: null,
    relatedEquipment: { id: e.id, name: e.name },
    availableVendors: vendors,
    internalNotes:
      "Suggested from recent work orders on this asset. Review quantities — confirming never sends purchase orders externally.",
  })
}

async function resolveFromLowStockOrg(
  supabase: SupabaseClient,
  organizationId: string,
  vendors: Array<{ id: string; name: string }>,
): Promise<CreatePartsReorderRequestResolverResult> {
  const { data: stockRows, error: stockErr } = await supabase
    .from("inventory_stock")
    .select("id, catalog_item_id, location_id, quantity_on_hand, quantity_allocated, reorder_point, reorder_quantity")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })
    .limit(2500)
  if (stockErr) return { status: "failed", reason: stockErr.message }
  const rows = stockRows ?? []
  const catIds = [...new Set(rows.map((r) => (r as { catalog_item_id: string }).catalog_item_id).filter(Boolean))]
  const locIds = [...new Set(rows.map((r) => (r as { location_id: string }).location_id).filter(Boolean))]
  const [{ data: cats }, { data: locs }] = await Promise.all([
    catIds.length ?
      supabase
        .from("catalog_items")
        .select("id, name, sku, part_number, vendor_id")
        .eq("organization_id", organizationId)
        .in("id", catIds)
    : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    locIds.length ?
      supabase
        .from("inventory_locations")
        .select("id, name, location_type, code")
        .eq("organization_id", organizationId)
        .in("id", locIds)
    : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ])
  const catMap = new Map((cats ?? []).map((c) => [String((c as { id: string }).id), c as Record<string, unknown>]))
  const locMap = new Map((locs ?? []).map((l) => [String((l as { id: string }).id), l as Record<string, unknown>]))
  const vendorNameById = new Map(vendors.map((v) => [v.id, v.name]))

  type Cand = {
    stock_id: string
    catalog_item_id: string
    location_id: string
    quantity_available: number
    reorder_point: number | null
    reorder_quantity: number | null
    suggested_quantity: number
    ui_status: string
    tone: string
  }
  const candidates: Cand[] = []

  for (const raw of rows) {
    const row = raw as Record<string, unknown>
    const cat = catMap.get(String(row.catalog_item_id))
    const loc = locMap.get(String(row.location_id))
    if (!cat || !loc) continue
    const onHand = num(row.quantity_on_hand)
    const alloc = num(row.quantity_allocated)
    const avail = onHand - alloc
    const rp = row.reorder_point == null ? null : num(row.reorder_point)
    const rq = row.reorder_quantity == null ? null : num(row.reorder_quantity)
    const locType = (loc.location_type as string | undefined) ?? null
    const classification = classifyReorderRow({
      quantity_on_hand: onHand,
      quantity_available: avail,
      reorder_point: rp,
      location_type: locType,
    })
    const k = normalizeInventoryLocationKind(locType)
    const wh = k === "warehouse" || k === "staging"
    const veh = k === "vehicle"
    const interesting =
      (wh && (classification.ui_status === "reorder_recommended" || classification.tone === "low" || classification.tone === "out")) ||
      (veh && classification.ui_status === "restock_truck_recommended")
    if (!interesting) continue

    const sq = suggestedReorderLineQuantity({
      quantity_available: avail,
      reorder_point: rp,
      reorder_quantity: rq,
    })
    candidates.push({
      stock_id: String(row.id),
      catalog_item_id: String(row.catalog_item_id),
      location_id: String(row.location_id),
      quantity_available: avail,
      reorder_point: rp,
      reorder_quantity: rq,
      suggested_quantity: sq,
      ui_status: classification.ui_status,
      tone: classification.tone,
    })
  }

  candidates.sort((a, b) => {
    if (a.tone === "out" && b.tone !== "out") return -1
    if (b.tone === "out" && a.tone !== "out") return 1
    return a.quantity_available - b.quantity_available
  })
  const top = candidates.slice(0, 25)
  if (top.length === 0) {
    return {
      status: "needs_clarification",
      reason: "No low-stock or truck-restock rows were found. Set reorder points on warehouse stock or open a work order with catalog parts.",
      customerCandidates: [],
    }
  }

  const lines: CreatePartsReorderPreviewLine[] = []
  for (const c of top) {
    const cat = catMap.get(c.catalog_item_id)
    const loc = locMap.get(c.location_id)
    if (!cat || !loc) continue
    const partName = String(cat.name ?? "").trim() || "Part"
    const sku = cat.sku == null ? null : typeof cat.sku === "string" ? cat.sku : null
    const partNumber = cat.part_number == null ? null : typeof cat.part_number === "string" ? cat.part_number : null
    const vendorId = cat.vendor_id == null ? null : typeof cat.vendor_id === "string" ? cat.vendor_id : null
    let vendorName: string | null = null
    if (vendorId && UUID_RE.test(vendorId)) vendorName = vendorNameById.get(vendorId) ?? null
    const locLabel =
      `${String(loc.name ?? "").trim() || "Location"}` +
      (loc.code ? ` (${String(loc.code)})` : "")
    lines.push({
      lineKey: randomUUID(),
      catalogItemId: c.catalog_item_id,
      partName,
      sku,
      partNumber,
      currentStockAvailable: c.quantity_available,
      suggestedQuantity: Math.max(1, c.suggested_quantity),
      vendorId,
      vendorName,
      inventoryLocationId: c.location_id,
      inventoryLocationLabel: locLabel,
      reason: `Low stock / reorder signal (${c.ui_status.replace(/_/g, " ")}) at this location.`,
    })
  }

  return finalizePreview({
    source: "low_stock_org",
    lines,
    relatedWorkOrder: null,
    relatedEquipment: null,
    availableVendors: vendors,
    internalNotes: "Org-wide low-stock snapshot (capped). Narrow to a work order or equipment for tighter context if needed.",
  })
}

function finalizePreview(args: {
  source: CreatePartsReorderPreviewSource
  lines: CreatePartsReorderPreviewLine[]
  relatedWorkOrder: CreatePartsReorderPreviewPayload["relatedWorkOrder"]
  relatedEquipment: CreatePartsReorderPreviewPayload["relatedEquipment"]
  availableVendors: Array<{ id: string; name: string }>
  internalNotes: string
}): { status: "prepared"; preview: CreatePartsReorderPreviewPayload } {
  const firstVid = args.lines[0]?.vendorId
  const draftPurchaseOrderEligible = Boolean(
    firstVid &&
      UUID_RE.test(firstVid) &&
      args.lines.every((l) => l.vendorId === firstVid),
  )
  const executionMode: CreatePartsReorderExecutionMode =
    draftPurchaseOrderEligible ? "draft_purchase_order" : "restock_requests"

  return {
    status: "prepared",
    preview: {
      source: args.source,
      executionMode,
      draftPurchaseOrderEligible,
      lines: args.lines,
      relatedWorkOrder: args.relatedWorkOrder,
      relatedEquipment: args.relatedEquipment,
      availableVendors: args.availableVendors,
      internalNotes: args.internalNotes,
    },
  }
}

export async function resolveCreatePartsReorderRequestPreview(
  supabase: SupabaseClient,
  input: CreatePartsReorderRequestResolverInput,
): Promise<CreatePartsReorderRequestResolverResult> {
  const organizationId = input.organizationId.trim()
  if (!UUID_RE.test(organizationId)) {
    return { status: "failed", reason: "Invalid organization id." }
  }

  const normalized = normalizeMessage(input.userMessage)
  const woId = input.workOrderId?.trim()
  const eqId = input.equipmentId?.trim()
  const lowExplicit = explicitLowStockPhrase(normalized)

  const vendors = await loadVendors(supabase, organizationId)

  if (woId && UUID_RE.test(woId)) {
    return resolveFromWorkOrder(supabase, organizationId, woId, vendors)
  }
  if (eqId && UUID_RE.test(eqId)) {
    return resolveFromEquipment(supabase, organizationId, eqId, vendors)
  }
  if (lowExplicit) {
    return resolveFromLowStockOrg(supabase, organizationId, vendors)
  }

  return {
    status: "needs_clarification",
    reason:
      "Open a work order, an equipment record, or say “low stock” / “reorder center” from inventory context so AIden can pick parts and locations.",
    customerCandidates: [],
  }
}
