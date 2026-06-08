import assert from "node:assert/strict"
import {
  formatAddressBlockLines,
  formatTaxedIndicator,
  splitLineItemDescription,
} from "../lib/documents/document-address"

assert.equal(
  formatAddressBlockLines({
    name: "Acme Labs",
    line1: "315 East 18th Street",
    city: "Bakersfield",
    state: "California",
    postalCode: "93305",
  }),
  "Acme Labs\n315 East 18th Street\nBakersfield, California 93305",
)

assert.deepEqual(splitLineItemDescription("Widget\n\nIncludes calibration kit"), {
  title: "Widget",
  detail: "Includes calibration kit",
})

assert.deepEqual(splitLineItemDescription("Single line item"), {
  title: "Single line item",
  detail: null,
})

assert.equal(formatTaxedIndicator(false), "No")
assert.equal(formatTaxedIndicator(true), "Yes")
assert.equal(formatTaxedIndicator(undefined), null)

console.log("document-address tests passed")
