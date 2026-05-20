import { randomUUID } from "crypto"
import { parseCsvText } from "@/lib/migration-imports/parse-csv"
import {
  inferCatalogImportManufacturerFromColumn,
  normalizeCatalogImportPayload,
  sanitizeCatalogImportManufacturerName,
} from "@/lib/catalog/catalog-import-manufacturer"
import {
  pickCatalogImportColumnHeaders,
} from "@/lib/catalog/catalog-import-header-map"
import {
  mapAiRowToExtracted,
  type ExtractedCatalogRow,
  type StoredPriceListPayload,
} from "@/lib/catalog/import-types"
import { PRICE_LIST_CSV_MAX_ROWS } from "@/lib/catalog/price-list-file-validation"
import { logCatalogCsvImport } from "@/lib/catalog/csv-import-debug-log"

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

  const columns = pickCatalogImportColumnHeaders(parsed.headers)
  const {
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
  } = columns

  logCatalogCsvImport("csv_headers_mapped", {
    fileName: args.fileName,
    headerCount: parsed.headers.length,
    parsedRowCount: parsed.rows.length,
    mapped: {
      part: partCol ?? null,
      name: nameCol ?? null,
      description: descCol ?? null,
      manufacturer: mfgCol ?? null,
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
      "No price columns were detected (e.g. List Price, Unit Cost, Cost Price). Prices were left blank.",
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
  const descriptionValues: string[] = []

  for (const row of parsed.rows) {
    if (isBlankRow(row)) continue

    const partNumber = cell(row, partCol) || cell(row, skuCol && skuCol !== partCol ? skuCol : undefined)
    const description = cell(row, descCol)
    if (description) descriptionValues.push(description)

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

  let manufacturerName: string | null = null
  const hintSanitized = sanitizeCatalogImportManufacturerName(args.manufacturerNameHint, {
    descriptionValues,
    nameValues: rows.map((r) => r.name),
  })
  if (hintSanitized.warning) warnings.push(hintSanitized.warning)
  manufacturerName = hintSanitized.value

  if (!manufacturerName && mfgCol) {
    const inferred = inferCatalogImportManufacturerFromColumn({
      rows: parsed.rows,
      manufacturerColumn: mfgCol,
      descriptionColumn: descCol,
      notesColumn: notesCol,
      cell,
    })
    if (inferred.warning) warnings.push(inferred.warning)
    manufacturerName = inferred.value
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

  return normalizeCatalogImportPayload({
    version: 1,
    manufacturerName,
    effectiveDate,
    warnings,
    rows,
  })
}
