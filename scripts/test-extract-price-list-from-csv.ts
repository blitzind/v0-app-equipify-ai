import assert from "node:assert/strict"
import { extractPriceListPayloadFromCsv } from "../lib/catalog/extract-price-list-from-csv"
import {
  detectPriceListFileKind,
  friendlyPriceListStorageUploadError,
  getPriceListFileExtension,
  PRICE_LIST_INVALID_TYPE_MESSAGE,
  validatePriceListFile,
} from "../lib/catalog/price-list-file-validation"

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

const costPriceOnly = extractPriceListPayloadFromCsv({
  buffer: Buffer.from("Item Name,Cost Price,List Price\nGasket,4.75,9.95", "utf8"),
  fileName: "cost-price.csv",
})
assert.equal(costPriceOnly.rows[0]?.cost, 4.75)
assert.equal(costPriceOnly.rows[0]?.listPrice, 9.95)

assert.throws(
  () =>
    extractPriceListPayloadFromCsv({
      buffer: Buffer.from("Unit Cost,List Price\n12.50,25.00", "utf8"),
      fileName: "no-name.csv",
    }),
  /No catalog rows were found|Could not map catalog columns/,
)

assert.equal(detectPriceListFileKind("list.csv", "text/csv"), "csv")
assert.equal(detectPriceListFileKind("list.csv", "application/csv"), "csv")
assert.equal(detectPriceListFileKind("list.csv", "application/vnd.ms-excel"), "csv")
assert.equal(detectPriceListFileKind("list.csv", "text/plain"), "csv")
assert.equal(detectPriceListFileKind("list.csv", "application/octet-stream"), "csv")
assert.equal(detectPriceListFileKind("Item_export_sheet.csv", "text/csv"), "csv")
assert.equal(detectPriceListFileKind("price-list.pdf", "application/pdf"), "pdf")

assert.equal(detectPriceListFileKind("notes.txt", "text/plain"), null)
assert.equal(detectPriceListFileKind("binary.bin", "application/octet-stream"), null)
assert.equal(detectPriceListFileKind("random.exe", "application/octet-stream"), null)

assert.equal(getPriceListFileExtension("Item_export_sheet.csv"), "csv")

const textCsvValidation = validatePriceListFile("list.csv", "text/csv", 100)
assert.equal(textCsvValidation.ok, true)
if (textCsvValidation.ok) assert.equal(textCsvValidation.kind, "csv")

const plainValidation = validatePriceListFile("list.csv", "text/plain", 100)
assert.equal(plainValidation.ok, true)
if (plainValidation.ok) assert.equal(plainValidation.kind, "csv")

const octetValidation = validatePriceListFile("list.csv", "application/octet-stream", 100)
assert.equal(octetValidation.ok, true)
if (octetValidation.ok) assert.equal(octetValidation.kind, "csv")

const exportSheetValidation = validatePriceListFile("Item_export_sheet.csv", "text/csv", 2048)
assert.equal(exportSheetValidation.ok, true)
if (exportSheetValidation.ok) assert.equal(exportSheetValidation.kind, "csv")

const txtReject = validatePriceListFile("notes.txt", "text/plain", 100)
assert.equal(txtReject.ok, false)
if (!txtReject.ok) {
  assert.equal(txtReject.message, PRICE_LIST_INVALID_TYPE_MESSAGE)
  assert.equal(txtReject.reason, "plain_text_without_csv_extension")
}

const binaryReject = validatePriceListFile("data.bin", "application/octet-stream", 100)
assert.equal(binaryReject.ok, false)
if (!binaryReject.ok) {
  assert.equal(binaryReject.reason, "octet_stream_without_csv_extension")
}

const randomReject = validatePriceListFile("file.exe", "application/x-msdownload", 100)
assert.equal(randomReject.ok, false)
if (!randomReject.ok) {
  assert.equal(randomReject.reason, "unsupported_mime_or_extension")
}

assert.equal(
  friendlyPriceListStorageUploadError("mime type text/csv is not supported"),
  PRICE_LIST_INVALID_TYPE_MESSAGE,
)

console.log("test-extract-price-list-from-csv: ok")
