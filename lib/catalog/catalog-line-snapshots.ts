import type { LineItemJson } from "@/lib/org-quotes-invoices/map"
import type { Part } from "@/lib/mock-data"
import type { POLineItem } from "@/lib/purchase-order-store"

/** Subset of catalog list API row used for transactional snapshots (copied at insert time). */
export type CatalogListItemRow = {
  id: string
  name: string | null
  description: string | null
  sku: string | null
  part_number: string | null
  item_type: string | null
  unit: string | null
  category?: string | null
  list_price: number | null
  sale_price: number | null
  cost: number | null
}

export function catalogSkuDisplay(row: CatalogListItemRow): string {
  const s = (row.sku ?? "").trim()
  const p = (row.part_number ?? "").trim()
  if (s && p && s !== p) return `${s} / ${p}`
  return s || p || ""
}

/** Prefer sale → list → cost for customer-facing quotes/invoices; PO parts may still use cost-first elsewhere. */
export function snapshotSaleUnitPriceDollars(row: CatalogListItemRow): number {
  const sale = row.sale_price
  const list = row.list_price
  const cost = row.cost
  if (typeof sale === "number" && Number.isFinite(sale) && sale > 0) return sale
  if (typeof list === "number" && Number.isFinite(list) && list > 0) return list
  if (typeof cost === "number" && Number.isFinite(cost) && cost >= 0) return cost
  return 0
}

/** PO lines often track vendor cost — prefer cost, then sale, then list. */
export function snapshotPurchaseUnitPriceDollars(row: CatalogListItemRow): number {
  const cost = row.cost
  const sale = row.sale_price
  const list = row.list_price
  if (typeof cost === "number" && Number.isFinite(cost) && cost >= 0) return cost
  if (typeof sale === "number" && Number.isFinite(sale) && sale > 0) return sale
  if (typeof list === "number" && Number.isFinite(list) && list > 0) return list
  return 0
}

export function buildQuoteInvoiceLineSnapshot(row: CatalogListItemRow, qty: number): LineItemJson {
  const unit = snapshotSaleUnitPriceDollars(row)
  const title = (row.name ?? "").trim() || "Catalog item"
  const body = (row.description ?? "").trim()
  const description = body ? `${title}\n\n${body}` : title
  const sku = catalogSkuDisplay(row)
  const out: LineItemJson = {
    description,
    qty,
    unit,
    catalog_item_id: row.id,
  }
  if (sku) out.sku = sku
  if (row.item_type?.trim()) out.item_type = row.item_type.trim()
  if (row.unit?.trim()) out.unit_label = row.unit.trim()
  return out
}

export function buildWorkOrderPartFromCatalog(row: CatalogListItemRow, qty: number): Part {
  return {
    id: crypto.randomUUID(),
    name: (row.name ?? "").trim() || "Catalog item",
    partNumber: catalogSkuDisplay(row),
    quantity: qty,
    unitCost: snapshotSaleUnitPriceDollars(row),
    catalogItemId: row.id,
  }
}

export function buildPurchaseOrderLineFromCatalog(row: CatalogListItemRow, qty: number): POLineItem {
  const unitDollars = snapshotPurchaseUnitPriceDollars(row)
  const unitCostCents = Math.max(0, Math.round(unitDollars * 100))
  const lineTotalCents = Math.round(qty * unitCostCents)
  const sku = catalogSkuDisplay(row)
  return {
    description: (row.name ?? "").trim() || "Catalog item",
    quantity: qty,
    unitCostCents,
    lineTotalCents,
    catalogItemId: row.id,
    skuSnapshot: sku || undefined,
    itemTypeSnapshot: row.item_type?.trim() || undefined,
    unitLabelSnapshot: row.unit?.trim() || undefined,
  }
}
