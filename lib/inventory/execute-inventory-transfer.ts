import "server-only"

import { randomUUID } from "crypto"
import {
  applyStockPatch,
  ensureStockRow,
  insertLedger,
  type InventorySvc,
} from "@/lib/inventory/inventory-mutations"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function executeInventoryTransfer(params: {
  svc: InventorySvc
  organizationId: string
  catalogItemId: string
  fromLocationId: string
  toLocationId: string
  quantity: number
  notes?: string | null
  createdByUserId: string | null
}): Promise<{ correlation_id: string }> {
  const {
    svc,
    organizationId,
    catalogItemId,
    fromLocationId,
    toLocationId,
    quantity,
    notes,
    createdByUserId,
  } = params

  if (!UUID_RE.test(catalogItemId) || !UUID_RE.test(fromLocationId) || !UUID_RE.test(toLocationId)) {
    throw new Error("Invalid ids.")
  }
  if (fromLocationId === toLocationId) {
    throw new Error("Locations must differ.")
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("quantity must be positive.")
  }

  const fromRow = await ensureStockRow(svc, organizationId, catalogItemId, fromLocationId)
  const available = fromRow.quantity_on_hand - fromRow.quantity_allocated
  if (available < quantity) {
    throw new Error("Insufficient available quantity at source location.")
  }

  const nextFromOh = fromRow.quantity_on_hand - quantity
  await applyStockPatch(svc, organizationId, fromRow.id, {
    quantity_on_hand: nextFromOh,
    quantity_allocated: fromRow.quantity_allocated,
  })

  const toRow = await ensureStockRow(svc, organizationId, catalogItemId, toLocationId)
  const nextToOh = toRow.quantity_on_hand + quantity
  await applyStockPatch(svc, organizationId, toRow.id, {
    quantity_on_hand: nextToOh,
    quantity_allocated: toRow.quantity_allocated,
  })

  const correlationId = randomUUID()

  await insertLedger(svc, {
    organization_id: organizationId,
    catalog_item_id: catalogItemId,
    location_id: fromLocationId,
    transaction_type: "transfer_out",
    quantity,
    delta_on_hand: -quantity,
    delta_allocated: 0,
    correlation_id: correlationId,
    counterparty_location_id: toLocationId,
    notes: notes ?? null,
    created_by: createdByUserId,
  })

  await insertLedger(svc, {
    organization_id: organizationId,
    catalog_item_id: catalogItemId,
    location_id: toLocationId,
    transaction_type: "transfer_in",
    quantity,
    delta_on_hand: quantity,
    delta_allocated: 0,
    correlation_id: correlationId,
    counterparty_location_id: fromLocationId,
    notes: notes ?? null,
    created_by: createdByUserId,
  })

  return { correlation_id: correlationId }
}
