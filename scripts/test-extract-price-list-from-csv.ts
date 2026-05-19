import assert from "node:assert/strict"
import { extractPriceListPayloadFromCsv } from "../lib/catalog/extract-price-list-from-csv"
import { detectPriceListFileKind, validatePriceListFile } from "../lib/catalog/price-list-file-validation"

const csv = [
  "Invoice Item Name,Item #/SKU,Unit Cost,Unit Price,Description",
  "Widget A,SKU-001,12.50,24.99,Primary widget",
  "Widget B,SKU-002,8.00,16.50,",
].join("\n")

const payload = extractPriceListPayloadFromCsv({
  buffer: Buffer.from(csv, "utf8"),
  fileName: "price-list.csv",
  manufacturerNameHint: "AMBCO",
})

assert.equal(payload.rows.length, 2)
assert.equal(payload.rows[0]?.name, "Widget A")
assert.equal(payload.rows[0]?.partNumber, "SKU-001")
assert.equal(payload.rows[0]?.listPrice, 24.99)
assert.equal(payload.rows[0]?.cost, 12.5)
assert.equal(payload.rows[1]?.name, "Widget B")

assert.equal(detectPriceListFileKind("list.csv", "text/csv"), "csv")
assert.equal(detectPriceListFileKind("list.csv", "application/csv"), "csv")
assert.equal(detectPriceListFileKind("list.csv", "text/plain"), "csv")
assert.equal(detectPriceListFileKind("list.csv", "application/octet-stream"), "csv")

const plainValidation = validatePriceListFile("list.csv", "text/plain", 100)
assert.equal(plainValidation.ok, true)
if (plainValidation.ok) assert.equal(plainValidation.kind, "csv")

console.log("test-extract-price-list-from-csv: ok")
