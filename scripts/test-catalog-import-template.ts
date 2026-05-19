import assert from "node:assert/strict"
import {
  pickCatalogCostColumn,
  pickCatalogImportPriceColumns,
  pickCatalogListPriceColumn,
} from "../lib/catalog/catalog-import-column-map"
import {
  CATALOG_IMPORT_TEMPLATE_EXAMPLE_ROWS,
  CATALOG_IMPORT_TEMPLATE_FILENAME,
  CATALOG_IMPORT_TEMPLATE_HEADERS,
  generateCatalogImportTemplateCsv,
} from "../lib/catalog/catalog-import-template"
import { extractPriceListPayloadFromCsv } from "../lib/catalog/extract-price-list-from-csv"

assert.equal(CATALOG_IMPORT_TEMPLATE_FILENAME, "equipify-catalog-import-template.csv")
assert.deepEqual(CATALOG_IMPORT_TEMPLATE_HEADERS.slice(0, 3), ["Item Name", "Part Number", "SKU"])

const templateCsv = generateCatalogImportTemplateCsv(true)
assert.match(templateCsv, /^Item Name,Part Number,SKU/)
assert.match(templateCsv, /Ultrasound probe cover/)
assert.match(templateCsv, /"Probe cover, large ""XL"""/)
assert.match(templateCsv, /"Line one\nLine two"/)
assert.match(templateCsv, /"Includes ""starter kit"", optional"/)

const templatePayload = extractPriceListPayloadFromCsv({
  buffer: Buffer.from(generateCatalogImportTemplateCsv(), "utf8"),
  fileName: CATALOG_IMPORT_TEMPLATE_FILENAME,
})
assert.equal(templatePayload.rows.length, 2)
assert.equal(templatePayload.rows[0]?.name, CATALOG_IMPORT_TEMPLATE_EXAMPLE_ROWS[0]["Item Name"])
assert.equal(templatePayload.rows[0]?.partNumber, "USC-100")
assert.equal(templatePayload.rows[0]?.cost, 12.5)
assert.equal(templatePayload.rows[0]?.listPrice, 25)
assert.equal(templatePayload.rows[1]?.cost, 75)
assert.equal(templatePayload.rows[1]?.listPrice, 125)

function extractOneRow(csv: string) {
  const payload = extractPriceListPayloadFromCsv({
    buffer: Buffer.from(csv, "utf8"),
    fileName: "test.csv",
  })
  assert.equal(payload.rows.length, 1)
  return payload.rows[0]!
}

const unitCostRow = extractOneRow("Item Name,Unit Cost,List Price\nWidget,12.50,25.00")
assert.equal(unitCostRow.cost, 12.5)
assert.equal(unitCostRow.listPrice, 25)

const costPriceRow = extractOneRow("Item Name,Cost Price,Unit Price\nWidget,9.99,19.99")
assert.equal(costPriceRow.cost, 9.99)
assert.equal(costPriceRow.listPrice, 19.99)

const itemCostRow = extractOneRow("Item Name,Item Cost,Sales Price\nWidget,3.25,6.50")
assert.equal(itemCostRow.cost, 3.25)
assert.equal(itemCostRow.listPrice, 6.5)

const wholesaleRow = extractOneRow("Item Name,Wholesale Cost,Retail Price\nWidget,100.00,125.00")
assert.equal(wholesaleRow.cost, 100)
assert.equal(wholesaleRow.listPrice, 125)

const listOnlyRow = extractOneRow("Item Name,List Price\nWidget,30.00")
assert.equal(listOnlyRow.cost, null)
assert.equal(listOnlyRow.listPrice, 30)

const costOnlyRow = extractOneRow("Item Name,Unit Cost\nWidget,12.50")
assert.equal(costOnlyRow.cost, 12.5)
assert.equal(costOnlyRow.listPrice, null)

const headers = ["Item Name", "Unit Cost", "List Price", "Cost Price"]
const priceCols = pickCatalogImportPriceColumns(headers)
assert.equal(priceCols.costCol, "Unit Cost")
assert.equal(priceCols.listPriceCol, "List Price")
assert.equal(pickCatalogListPriceColumn(headers, "Unit Cost"), "List Price")
assert.equal(pickCatalogCostColumn(["Item Name", "Cost Price", "Unit Price"]), "Cost Price")

console.log("test-catalog-import-template: ok")
