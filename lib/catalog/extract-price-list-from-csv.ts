import { randomUUID } from "crypto"
import { pickHeader } from "@/lib/migration-imports/map-columns"
import { parseCsvText } from "@/lib/migration-imports/parse-csv"
import {
  pickCatalogImportPriceColumns,
} from "@/lib/catalog/catalog-import-column-map"
import {
  mapAiRowToExtracted,
  type ExtractedCatalogRow,
  type StoredPriceListPayload,
} from "@/lib/catalog/import-types"
import { PRICE_LIST_CSV_MAX_ROWS } from "@/lib/catalog/price-list-file-validation"
import { logCatalogCsvImport } from "@/lib/catalog/csv-import-debug-log"

const PART_ALIASES = [
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
]

const NAME_ALIASES = [
  "name",
  "item name",
  "invoice item name",
  "product name",
  "title",
  "product",
  "item",
  "invoice item",
]

const DESC_ALIASES = ["description", "desc", "details", "long description", "product description"]

const CATEGORY_ALIASES = [
  "category",
  "product category",
  "group",
  "department",
  "class",
  "family",
  "product group",
]

const MFG_ALIASES = ["manufacturer", "mfg", "brand", "make"]

const VENDOR_ALIASES = ["vendor", "supplier", "distributor"]

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
  const skuCol = pickHeader(parsed.headers, ["sku", "item sku"])
  const nameCol = pickHeader(parsed.headers, NAME_ALIASES)
  const descCol = pickHeader(parsed.headers, DESC_ALIASES)
  const { listPriceCol, costCol } = pickCatalogImportPriceColumns(parsed.headers)
  const categoryCol = pickHeader(parsed.headers, CATEGORY_ALIASES)
  const mfgCol = pickHeader(parsed.headers, MFG_ALIASES)
  const vendorCol = pickHeader(parsed.headers, VENDOR_ALIASES)
  const typeCol = pickHeader(parsed.headers, TYPE_ALIASES)
  const unitCol = pickHeader(parsed.headers, UNIT_ALIASES)
  const notesCol = pickHeader(parsed.headers, NOTES_ALIASES)
  const effectiveCol = pickHeader(parsed.headers, EFFECTIVE_ALIASES)

  logCatalogCsvImport("csv_headers_mapped", {
    fileName: args.fileName,
    headerCount: parsed.headers.length,
    parsedRowCount: parsed.rows.length,
    mapped: {
      part: partCol ?? null,
      name: nameCol ?? null,
      description: descCol ?? null,
      listPrice: listPriceCol ?? null,
      cost: costCol ?? null,
    },
  })

  if (!partCol && !nameCol && !descCol) {
    throw new Error(
      "Could not map catalog columns. Include a header such as Part Number, SKU, Item Number, Name, or Description.",
    )
  }

  const warnings: string[] = [
    "Parsed from CSV using column headers — verify part numbers, names, and prices before saving.",
  ]

  if (!listPriceCol && !costCol) {
    warnings.push(
      "No price columns were detected (e.g. List Price, Unit Price, Unit Cost). Prices were left blank.",
    )
  } else if (!listPriceCol) {
    warnings.push("No list price column was detected (e.g. List Price, Unit Price). List prices were left blank.")
  } else if (!costCol) {
    warnings.push("No cost column was detected (e.g. Unit Cost, Cost Price). Costs were left blank.")
  }

  const totalDataLines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim().length > 0).length - 1
  if (totalDataLines > PRICE_LIST_CSV_MAX_ROWS) {
    warnings.push(`Only the first ${PRICE_LIST_CSV_MAX_ROWS.toLocaleString()} data rows were parsed.`)
  }

  const rows: ExtractedCatalogRow[] = []

  for (const row of parsed.rows) {
    if (isBlankRow(row)) continue

    const partNumber = cell(row, partCol) || cell(row, skuCol && skuCol !== partCol ? skuCol : undefined)
    const description = cell(row, descCol)
    let name = cell(row, nameCol)
    if (!name && description) name = description
    if (!name && partNumber) name = partNumber
    if (!name) continue

    const notesParts = [cell(row, notesCol)]
    const unit = cell(row, unitCol)
    if (unit) notesParts.push(`Unit: ${unit}`)
    const vendor = cell(row, vendorCol)
    if (vendor) notesParts.push(`Vendor: ${vendor}`)
    const skuValue = cell(row, skuCol)
    if (skuValue && skuValue !== partNumber) notesParts.push(`SKU: ${skuValue}`)

    const listPriceRaw = cell(row, listPriceCol) || null
    const costRaw = cell(row, costCol) || null

    const mapped = mapAiRowToExtracted(
      {
        category: cell(row, categoryCol),
        itemType: cell(row, typeCol) || "other",
        partNumber: partNumber || null,
        name,
        description: description && description !== name ? description : null,
        listPrice: listPriceRaw,
        cost: costRaw,
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
    logCatalogCsvImport("csv_zero_rows", {
      fileName: args.fileName,
      parsedRowCount: parsed.rows.length,
      mappedNameCol: nameCol ?? null,
      mappedDescCol: descCol ?? null,
      mappedPartCol: partCol ?? null,
    })
    throw new Error(
      "No catalog rows were found in the CSV. Include Item Name (or Description / Part Number / SKU) on each row. Download the CSV template for the recommended column layout.",
    )
  }

  logCatalogCsvImport("csv_extract_ok", {
    fileName: args.fileName,
    extractionRowCount: rows.length,
  })

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
