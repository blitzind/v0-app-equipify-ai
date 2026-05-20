import assert from "node:assert/strict"

import {
  inferCatalogImportManufacturerFromColumn,
  isDescriptionLikeManufacturerCandidate,
  normalizeCatalogImportPayload,
  sanitizeCatalogImportManufacturerName,
} from "../lib/catalog/catalog-import-manufacturer"
import { pickCatalogImportColumnHeaders } from "../lib/catalog/catalog-import-header-map"
import { extractPriceListPayloadFromCsv } from "../lib/catalog/extract-price-list-from-csv"
import { parseStoredPriceListPayload } from "../lib/catalog/parse-stored-payload"

const LONG_DESCRIPTION =
  "This is a long product description for the first catalog line item that should never be stored as a manufacturer name for every imported row."

assert.equal(isDescriptionLikeManufacturerCandidate(LONG_DESCRIPTION), true)
assert.equal(isDescriptionLikeManufacturerCandidate("Acme Medical"), false)

const exclusive = pickCatalogImportColumnHeaders([
  "Item Name",
  "Description",
  "Manufacturer",
  "Long Description",
  "Notes",
])
assert.equal(exclusive.descCol, "Description")
assert.equal(exclusive.mfgCol, "Manufacturer")
assert.notEqual(exclusive.mfgCol, exclusive.descCol)

const regressionCsv = [
  "Item Name,Manufacturer,Description,Unit Cost,List Price",
  `"Widget A","${LONG_DESCRIPTION}","Actual short description",12.50,24.99`,
  "Widget B,,Second item description,8.00,16.50",
].join("\n")

const regressionPayload = extractPriceListPayloadFromCsv({
  buffer: Buffer.from(regressionCsv, "utf8"),
  fileName: "josh-regression.csv",
})

assert.equal(regressionPayload.manufacturerName, null)
assert.equal(regressionPayload.rows.length, 2)
assert.equal(regressionPayload.rows[0]?.description, "Actual short description")
assert.ok(
  regressionPayload.warnings.some((w) => w.toLowerCase().includes("manufacturer")),
  "expected manufacturer guardrail warning",
)

const validCsv = [
  "Item Name,Manufacturer,Description,List Price",
  "Widget A,Acme Medical,Probe cover,24.99",
  "Widget B,,Another item,16.50",
].join("\n")

const validPayload = extractPriceListPayloadFromCsv({
  buffer: Buffer.from(validCsv, "utf8"),
  fileName: "valid-mfg.csv",
})
assert.equal(validPayload.manufacturerName, "Acme Medical")

const storedRoundTrip = parseStoredPriceListPayload({
  version: 1,
  manufacturerName: LONG_DESCRIPTION,
  effectiveDate: null,
  warnings: [],
  rows: regressionPayload.rows,
})
assert.equal(storedRoundTrip?.manufacturerName, null)

const inferred = inferCatalogImportManufacturerFromColumn({
  rows: [
    { Manufacturer: LONG_DESCRIPTION, Description: "Short" },
    { Manufacturer: "", Description: "Other" },
  ],
  manufacturerColumn: "Manufacturer",
  descriptionColumn: "Description",
  cell: (row, header) => (header ? (row[header] ?? "").trim() : ""),
})
assert.equal(inferred.value, null)

const normalized = normalizeCatalogImportPayload({
  version: 1,
  manufacturerName: LONG_DESCRIPTION,
  effectiveDate: null,
  warnings: [],
  rows: [
    {
      id: "1",
      category: "",
      itemType: "other",
      partNumber: "",
      name: "Widget",
      description: LONG_DESCRIPTION,
      listPrice: null,
      cost: null,
      notes: null,
      replacementPartNumber: null,
      status: "active",
      confidence: null,
      rawExtractedText: null,
      selected: true,
    },
  ],
})
assert.equal(normalized.manufacturerName, null)

const descOnlyOverlap = pickCatalogImportColumnHeaders(["Item Name", "Description", "List Price"])
assert.equal(descOnlyOverlap.mfgCol, undefined)

const sanitizedHint = sanitizeCatalogImportManufacturerName(LONG_DESCRIPTION, {
  descriptionValues: [LONG_DESCRIPTION],
})
assert.equal(sanitizedHint.value, null)

console.log("test-catalog-import-manufacturer: ok")
