/** Shared preview types for AIden `create_parts_reorder_request` (client + server). */

export type CreatePartsReorderExecutionMode = "draft_purchase_order" | "restock_requests"

export type CreatePartsReorderPreviewSource = "work_order" | "equipment" | "low_stock_org"

export type CreatePartsReorderPreviewLine = {
  /** Stable id for PATCH merge (server-generated UUID). */
  lineKey: string
  catalogItemId: string
  partName: string
  sku: string | null
  partNumber: string | null
  currentStockAvailable: number
  suggestedQuantity: number
  /** Effective vendor for draft PO validation; editable in preview. */
  vendorId: string | null
  vendorName: string | null
  inventoryLocationId: string
  inventoryLocationLabel: string
  reason: string
}

export type CreatePartsReorderPreviewPayload = {
  source: CreatePartsReorderPreviewSource
  executionMode: CreatePartsReorderExecutionMode
  /** True when every line shares a non-null vendor (catalog default) so a single-vendor draft PO is structurally valid. */
  draftPurchaseOrderEligible: boolean
  lines: CreatePartsReorderPreviewLine[]
  relatedWorkOrder: { id: string; number: number; title: string | null } | null
  relatedEquipment: { id: string; name: string } | null
  availableVendors: Array<{ id: string; name: string }>
  internalNotes: string
}
