import "server-only"

import { randomUUID } from "crypto"
import { pickHeader } from "@/lib/migration-imports/map-columns"
import { parseCsvText } from "@/lib/migration-imports/parse-csv"
import {
  mapAiRowToExtracted,
  type ExtractedCatalogRow,
  type StoredPriceListPayload,
} from "@/lib/catalog/import-types"
import { PRICE_LIST_CSV_MAX_ROWS } from "@/lib/catalog/price-list-file-validation"

const PART_ALIASES = [
  "part_number",
  "part number",
  "part no",
  "part #",
  "part#",
  "sku",
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
]

const NAME_ALIASES = ["name", "item name", "product name", "title", "product", "item"]

const DESC_ALIASES = ["description", "desc", "details", "long description", "product description"]

const LIST_PRICE_ALIASES = [
  "list price",
  "list",
  "price",
  "unit price",
  "msrp",
  "retail price",
  "sell price",
  "retail",
  "list usd",
]

const COST_ALIASES = ["cost", "dealer cost", "net cost", "wholesale", "your cost", "buy price", "net price"]

const CATEGORY_ALIASES = [
  "category",
  "product category",
  "group",
  "department",
  "class",
  "family",
  "product group",
]

const MFG_ALIASES = ["manufacturer", "mfg", "brand", "vendor", "make"]

const TYPE_ALIASES = ["type", "item type", "product type"]

const UNIT_ALIASES = ["unit", "uom", "unit of measure", "units"]

const NOTES_ALIASES = ["notes", "note", "comment", "remarks"]

const EFFECTIVE_ALIASES = ["effective date", "price date", "as of", "effective", "valid from"]

function cell(row: Record<string, string>, header: string | undefined): string {
  if (!header) return ""
  return (row[header] ?? "").trim()
}

function isBlankRow(row: Record<string, string>): boolean {
  return Object.values(row).every((v) => !v.trim())
}

/**
 * Deterministic CSV → catalog draft rows (no AI). Column headers are matched by common aliases.
 */
export function extractPriceListPayloadFromCsv(args: {
  buffer: Buffer
  fileName: string
  manufacturerNameHint?: string | null
}): StoredPriceListPayload {
  const text = args.buffer.toString("utf8")
  const parsed = parseCsvText(text, PRICE_LIST_CSV_MAX_ROWS)

  if (parsed.headers.length === 0) {
    throw new Error("The CSV file is empty.")
  }

  const partCol = pickHeader(parsed.headers, PART_ALIASES)
  const nameCol = pickHeader(parsed.headers, NAME_ALIASES)
  const descCol = pickHeader(parsed.headers, DESC_ALIASES)
  const listPriceCol = pickHeader(parsed.headers, LIST_PRICE_ALIASES)
  const costCol = pickHeader(parsed.headers, COST_ALIASES)
  const categoryCol = pickHeader(parsed.headers, CATEGORY_ALIASES)
  const mfgCol = pickHeader(parsed.headers, MFG_ALIASES)
  const typeCol = pickHeader(parsed.headers, TYPE_ALIASES)
  const unitCol = pickHeader(parsed.headers, UNIT_ALIASES)
  const notesCol = pickHeader(parsed.headers, NOTES_ALIASES)
  const effectiveCol = pickHeader(parsed.headers, EFFECTIVE_ALIASES)

  if (!partCol && !nameCol && !descCol) {
    throw new Error(
      "Could not map catalog columns. Include a header such as Part Number, SKU, Item Number, Name, or Description.",
    )
  }

  const warnings: string[] = [
    "Parsed from CSV using column headers — verify part numbers, names, and prices before saving.",
  ]

  if (!listPriceCol) {
    warnings.push("No price column was detected (e.g. List Price, Price, MSRP). Prices were left blank.")
  }

  const totalDataLines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim().length > 0).length - 1
  if (totalDataLines > PRICE_LIST_CSV_MAX_ROWS) {
    warnings.push(`Only the first ${PRICE_LIST_CSV_MAX_ROWS.toLocaleString()} data rows were parsed.`)
  }

  const rows: ExtractedCatalogRow[] = []

  for (const row of parsed.rows) {
    if (isBlankRow(row)) continue

    const partNumber = cell(row, partCol)
    const description = cell(row, descCol)
    let name = cell(row, nameCol)
    if (!name && description) name = description
    if (!name && partNumber) name = partNumber
    if (!name) continue

    const notesParts = [cell(row, notesCol)]
    const unit = cell(row, unitCol)
    if (unit) notesParts.push(`Unit: ${unit}`)

    const mapped = mapAiRowToExtracted(
      {
        category: cell(row, categoryCol),
        itemType: cell(row, typeCol) || "other",
        partNumber: partNumber || null,
        name,
        description: description && description !== name ? description : null,
        listPrice: cell(row, listPriceCol) || null,
        cost: cell(row, costCol) || null,
        notes: notesParts.filter(Boolean).join(" · ") || null,
        replacementPartNumber: null,
        status: "active",
        confidence: 0.95,
        rawExtractedText: null,
      },
      randomUUID(),
    )

    rows.push(mapped)
  }

  if (rows.length === 0) {
    throw new Error("No catalog rows were found in the CSV. Check headers and data rows.")
  }

  let manufacturerName = args.manufacturerNameHint?.trim() || null
  if (!manufacturerName && mfgCol) {
    const counts = new Map<string, number>()
    for (const row of parsed.rows) {
      const v = cell(row, mfgCol)
      if (!v) continue
      counts.set(v, (counts.get(v) ?? 0) + 1)
    }
    let best = ""
    let bestN = 0
    for (const [k, n] of counts) {
      if (n > bestN) {
        best = k
        bestN = n
      }
    }
    manufacturerName = best || null
  }

  let effectiveDate: string | null = null
  if (effectiveCol) {
    for (const row of parsed.rows) {
      const v = cell(row, effectiveCol)
      if (v) {
        effectiveDate = v.slice(0, 10)
        break
      }
    }
  }

  return {
    version: 1,
    manufacturerName,
    effectiveDate,
    warnings,
    rows,
  }
}
