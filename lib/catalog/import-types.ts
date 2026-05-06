import { z } from "zod"

export const CATALOG_ITEM_TYPES = [
  "equipment",
  "part",
  "accessory",
  "service",
  "rental",
  "option",
  "other",
] as const
export type CatalogItemType = (typeof CATALOG_ITEM_TYPES)[number]

export const CATALOG_STATUSES = ["active", "inactive", "discontinued", "needs_review"] as const
export type CatalogItemStatus = (typeof CATALOG_STATUSES)[number]

export type DuplicateAction = "skip" | "update" | "create"

export const extractedCatalogRowSchema = z.object({
  category: z.string().optional().default(""),
  itemType: z.string().optional().default("other"),
  partNumber: z.union([z.string(), z.null()]).optional(),
  name: z.string(),
  description: z.union([z.string(), z.null()]).optional(),
  listPrice: z.union([z.number(), z.string(), z.null()]).optional(),
  cost: z.union([z.number(), z.string(), z.null()]).optional(),
  notes: z.union([z.string(), z.null()]).optional(),
  replacementPartNumber: z.union([z.string(), z.null()]).optional(),
  status: z.string().optional().default("active"),
  confidence: z.union([z.number(), z.null()]).optional(),
  rawExtractedText: z.union([z.string(), z.null()]).optional(),
})

export const priceListAiResponseSchema = z.object({
  manufacturerName: z.union([z.string(), z.null()]).optional(),
  effectiveDate: z.union([z.string(), z.null()]).optional(),
  warnings: z.array(z.string()).optional().default([]),
  rows: z.array(extractedCatalogRowSchema),
})

export type PriceListAiResponse = z.infer<typeof priceListAiResponseSchema>

export type ExtractedCatalogRow = {
  id: string
  category: string
  itemType: CatalogItemType
  partNumber: string
  name: string
  description: string | null
  listPrice: number | null
  cost: number | null
  notes: string | null
  replacementPartNumber: string | null
  status: CatalogItemStatus
  confidence: number | null
  rawExtractedText: string | null
  selected: boolean
}

export type StoredPriceListPayload = {
  version: 1
  manufacturerName: string | null
  effectiveDate: string | null
  warnings: string[]
  rows: ExtractedCatalogRow[]
}

export function normalizeItemType(raw: string | undefined | null): CatalogItemType {
  const k = (raw ?? "other").toLowerCase().trim().replace(/\s+/g, "_")
  const map: Record<string, CatalogItemType> = {
    equipment: "equipment",
    part: "part",
    accessory: "accessory",
    accessories: "accessory",
    service: "service",
    services: "service",
    rental: "rental",
    rentals: "rental",
    option: "option",
    options: "option",
    other: "other",
  }
  return map[k] ?? "other"
}

export function normalizeCatalogStatus(raw: string | undefined | null): CatalogItemStatus {
  const k = (raw ?? "active").toLowerCase().trim()
  if (k.includes("discontinu")) return "discontinued"
  if (k.includes("review")) return "needs_review"
  if (k === "inactive") return "inactive"
  return "active"
}

function parseMoney(v: unknown): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string") {
    const t = v.trim()
    if (!t || t === "—" || t === "-") return null
    const n = Number.parseFloat(t.replace(/[$,\s]/g, ""))
    return Number.isFinite(n) ? n : null
  }
  return null
}

export function mapAiRowToExtracted(row: z.infer<typeof extractedCatalogRowSchema>, id: string): ExtractedCatalogRow {
  const pn = row.partNumber?.trim() ?? ""
  return {
    id,
    category: row.category?.trim() ?? "",
    itemType: normalizeItemType(row.itemType),
    partNumber: pn,
    name: row.name.trim(),
    description: row.description?.trim() || null,
    listPrice: parseMoney(row.listPrice),
    cost: parseMoney(row.cost),
    notes: row.notes?.trim() || null,
    replacementPartNumber: row.replacementPartNumber?.trim() || null,
    status: normalizeCatalogStatus(row.status),
    confidence:
      typeof row.confidence === "number" && Number.isFinite(row.confidence)
        ? Math.min(1, Math.max(0, row.confidence))
        : null,
    rawExtractedText: row.rawExtractedText?.trim() || null,
    selected: true,
  }
}
