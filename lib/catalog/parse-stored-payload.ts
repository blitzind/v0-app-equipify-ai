import type { StoredPriceListPayload, ExtractedCatalogRow } from "@/lib/catalog/import-types"
import { CATALOG_ITEM_TYPES, CATALOG_STATUSES } from "@/lib/catalog/import-types"

function isItemType(s: string): s is ExtractedCatalogRow["itemType"] {
  return (CATALOG_ITEM_TYPES as readonly string[]).includes(s)
}

function isStatus(s: string): s is ExtractedCatalogRow["status"] {
  return (CATALOG_STATUSES as readonly string[]).includes(s)
}

export function parseStoredPriceListPayload(raw: unknown): StoredPriceListPayload | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  if (o.version !== 1) return null
  if (!Array.isArray(o.rows)) return null

  const rows: ExtractedCatalogRow[] = []
  for (const r of o.rows) {
    if (!r || typeof r !== "object") continue
    const x = r as Record<string, unknown>
    const id = typeof x.id === "string" ? x.id : null
    const name = typeof x.name === "string" ? x.name : null
    if (!id || !name) continue

    const itemTypeRaw = typeof x.itemType === "string" ? x.itemType : "other"
    const statusRaw = typeof x.status === "string" ? x.status : "active"

    rows.push({
      id,
      category: typeof x.category === "string" ? x.category : "",
      itemType: isItemType(itemTypeRaw) ? itemTypeRaw : "other",
      partNumber: typeof x.partNumber === "string" ? x.partNumber : "",
      name,
      description: typeof x.description === "string" ? x.description : null,
      listPrice: typeof x.listPrice === "number" && Number.isFinite(x.listPrice) ? x.listPrice : null,
      cost: typeof x.cost === "number" && Number.isFinite(x.cost) ? x.cost : null,
      notes: typeof x.notes === "string" ? x.notes : null,
      replacementPartNumber: typeof x.replacementPartNumber === "string" ? x.replacementPartNumber : null,
      status: isStatus(statusRaw) ? statusRaw : "needs_review",
      confidence: typeof x.confidence === "number" && Number.isFinite(x.confidence) ? x.confidence : null,
      rawExtractedText: typeof x.rawExtractedText === "string" ? x.rawExtractedText : null,
      selected: x.selected !== false,
    })
  }

  return {
    version: 1,
    manufacturerName: typeof o.manufacturerName === "string" ? o.manufacturerName : null,
    effectiveDate: typeof o.effectiveDate === "string" ? o.effectiveDate : null,
    warnings: Array.isArray(o.warnings) ? o.warnings.filter((w): w is string => typeof w === "string") : [],
    rows,
  }
}
