import { pickHeader } from "@/lib/migration-imports/map-columns"
import {
  pickCatalogImportPriceColumns,
} from "@/lib/catalog/catalog-import-column-map"

/** Manufacturer-like headers only — never description or notes. */
export const CATALOG_IMPORT_MANUFACTURER_ALIASES = [
  "manufacturer",
  "manufacturer name",
  "mfg",
  "mfr",
  "brand",
  "make",
] as const

export const CATALOG_IMPORT_DESCRIPTION_ALIASES = [
  "description",
  "item description",
  "long description",
  "product description",
  "desc",
  "details",
] as const

export const CATALOG_IMPORT_NOTES_ALIASES = ["notes", "note", "comment", "remarks"] as const

export const CATALOG_IMPORT_PART_ALIASES = [
  "part_number",
  "part number",
  "part no",
  "part #",
  "part#",
  "sku",
  "item #/sku",
  "item sku",
  "item number",
  "item no",
  "item #",
  "catalog number",
  "catalog #",
  "model number",
  "model #",
  "product code",
  "product number",
  "item code",
] as const

export const CATALOG_IMPORT_NAME_ALIASES = [
  "name",
  "item name",
  "invoice item name",
  "product name",
  "title",
  "product",
  "item",
  "invoice item",
] as const

export const CATALOG_IMPORT_CATEGORY_ALIASES = [
  "category",
  "product category",
  "group",
  "department",
  "class",
  "family",
  "product group",
] as const

export const CATALOG_IMPORT_VENDOR_ALIASES = ["vendor", "supplier", "distributor"] as const

export const CATALOG_IMPORT_TYPE_ALIASES = ["type", "item type", "product type"] as const

export const CATALOG_IMPORT_UNIT_ALIASES = ["unit", "uom", "unit of measure", "units"] as const

export const CATALOG_IMPORT_EFFECTIVE_ALIASES = [
  "effective date",
  "price date",
  "as of",
  "effective",
  "valid from",
] as const

export type CatalogImportColumnMap = {
  partCol?: string
  skuCol?: string
  nameCol?: string
  descCol?: string
  listPriceCol?: string
  costCol?: string
  categoryCol?: string
  mfgCol?: string
  vendorCol?: string
  typeCol?: string
  unitCol?: string
  notesCol?: string
  effectiveCol?: string
}

function pickExclusiveHeader(headers: string[], aliases: readonly string[], used: Set<string>): string | undefined {
  const available = headers.filter((h) => !used.has(h))
  const picked = pickHeader(available, [...aliases])
  if (picked) used.add(picked)
  return picked
}

/**
 * Map CSV headers to catalog fields. Description and notes columns are reserved first so they
 * cannot be reused for manufacturer inference.
 */
export function pickCatalogImportColumnHeaders(headers: string[]): CatalogImportColumnMap {
  const used = new Set<string>()

  const descCol = pickExclusiveHeader(headers, CATALOG_IMPORT_DESCRIPTION_ALIASES, used)
  const notesCol = pickExclusiveHeader(headers, CATALOG_IMPORT_NOTES_ALIASES, used)
  const mfgCol = pickExclusiveHeader(headers, CATALOG_IMPORT_MANUFACTURER_ALIASES, used)

  const partCol = pickExclusiveHeader(headers, CATALOG_IMPORT_PART_ALIASES, used)
  const skuCol = pickHeader(headers.filter((h) => !used.has(h)), ["sku", "item sku"])
  if (skuCol) used.add(skuCol)

  const nameCol = pickExclusiveHeader(headers, CATALOG_IMPORT_NAME_ALIASES, used)
  const { listPriceCol, costCol } = pickCatalogImportPriceColumns(headers)
  if (listPriceCol) used.add(listPriceCol)
  if (costCol) used.add(costCol)

  const categoryCol = pickExclusiveHeader(headers, CATALOG_IMPORT_CATEGORY_ALIASES, used)
  const vendorCol = pickExclusiveHeader(headers, CATALOG_IMPORT_VENDOR_ALIASES, used)
  const typeCol = pickExclusiveHeader(headers, CATALOG_IMPORT_TYPE_ALIASES, used)
  const unitCol = pickExclusiveHeader(headers, CATALOG_IMPORT_UNIT_ALIASES, used)
  const effectiveCol = pickExclusiveHeader(headers, CATALOG_IMPORT_EFFECTIVE_ALIASES, used)

  return {
    partCol,
    skuCol,
    nameCol,
    descCol,
    listPriceCol,
    costCol,
    categoryCol,
    mfgCol,
    vendorCol,
    typeCol,
    unitCol,
    notesCol,
    effectiveCol,
  }
}
