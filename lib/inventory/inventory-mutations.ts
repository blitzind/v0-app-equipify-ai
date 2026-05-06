import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

export type InventorySvc = SupabaseClient

function num(v: unknown): number {
  const n = typeof v === "string" ? Number.parseFloat(v) : Number(v)
  return Number.isFinite(n) ? n : 0
}

export async function fetchStockRow(
  svc: InventorySvc,
  organizationId: string,
  catalogItemId: string,
  locationId: string,
): Promise<{
  id: string
  quantity_on_hand: number
  quantity_allocated: number
} | null> {
  const { data, error } = await svc
    .from("inventory_stock")
    .select("id, quantity_on_hand, quantity_allocated")
    .eq("organization_id", organizationId)
    .eq("catalog_item_id", catalogItemId)
    .eq("location_id", locationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  return {
    id: data.id as string,
    quantity_on_hand: num(data.quantity_on_hand),
    quantity_allocated: num(data.quantity_allocated),
  }
}

export async function ensureStockRow(
  svc: InventorySvc,
  organizationId: string,
  catalogItemId: string,
  locationId: string,
): Promise<{ id: string; quantity_on_hand: number; quantity_allocated: number }> {
  const existing = await fetchStockRow(svc, organizationId, catalogItemId, locationId)
  if (existing) return existing

  const { data, error } = await svc
    .from("inventory_stock")
    .insert({
      organization_id: organizationId,
      catalog_item_id: catalogItemId,
      location_id: locationId,
      quantity_on_hand: 0,
      quantity_allocated: 0,
    })
    .select("id, quantity_on_hand, quantity_allocated")
    .single()

  if (error) throw new Error(error.message)
  return {
    id: data.id as string,
    quantity_on_hand: num(data.quantity_on_hand),
    quantity_allocated: num(data.quantity_allocated),
  }
}

export async function applyStockPatch(
  svc: InventorySvc,
  organizationId: string,
  stockId: string,
  patch: { quantity_on_hand: number; quantity_allocated: number },
): Promise<void> {
  if (patch.quantity_on_hand < 0 || patch.quantity_allocated < 0 || patch.quantity_allocated > patch.quantity_on_hand) {
    throw new Error("Stock quantities invalid after update.")
  }

  const { error } = await svc
    .from("inventory_stock")
    .update({
      quantity_on_hand: patch.quantity_on_hand,
      quantity_allocated: patch.quantity_allocated,
    })
    .eq("organization_id", organizationId)
    .eq("id", stockId)

  if (error) throw new Error(error.message)
}

export async function insertLedger(
  svc: InventorySvc,
  row: {
    organization_id: string
    catalog_item_id: string
    location_id: string
    transaction_type: string
    quantity: number
    delta_on_hand: number
    delta_allocated: number
    correlation_id?: string | null
    work_order_id?: string | null
    purchase_order_id?: string | null
    invoice_id?: string | null
    counterparty_location_id?: string | null
    notes?: string | null
    metadata?: Record<string, unknown>
    created_by?: string | null
  },
): Promise<void> {
  const { error } = await svc.from("inventory_transactions").insert({
    organization_id: row.organization_id,
    catalog_item_id: row.catalog_item_id,
    location_id: row.location_id,
    transaction_type: row.transaction_type,
    quantity: row.quantity,
    delta_on_hand: row.delta_on_hand,
    delta_allocated: row.delta_allocated,
    correlation_id: row.correlation_id ?? null,
    work_order_id: row.work_order_id ?? null,
    purchase_order_id: row.purchase_order_id ?? null,
    invoice_id: row.invoice_id ?? null,
    counterparty_location_id: row.counterparty_location_id ?? null,
    notes: row.notes ?? null,
    metadata: row.metadata ?? {},
    created_by: row.created_by ?? null,
  })

  if (error) throw new Error(error.message)
}
