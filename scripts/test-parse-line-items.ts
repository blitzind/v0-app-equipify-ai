/**
 * Regression checks for invoice `line_items` JSON parsing (QuickBooks shapes, camelCase, etc.).
 * Run: pnpm exec tsx scripts/test-parse-line-items.ts
 */
import assert from "node:assert/strict"
import { parseLineItems, stableCanonicalLineItemsKey } from "../lib/org-quotes-invoices/map"

function assertApprox(a: number, b: number, msg: string) {
  assert.ok(Math.abs(a - b) < 1e-6, `${msg}: expected ~${b}, got ${a}`)
}

const qbWrapped = {
  Line: [
    {
      DetailType: "SalesItemLineDetail",
      Description: "Cal labor",
      Amount: 240,
      SalesItemLineDetail: {
        ItemRef: { value: "1", name: "Labor" },
        Qty: 2,
        UnitPrice: 120,
      },
    },
  ],
}

const qbLines = qbWrapped.Line

const camelEnvelope = { lineItems: [{ description: "Parts", qty: 3, unit: 10.5 }] }

const legacySnake = { line_items: [{ description: "Fee", quantity: 1, unit_price: 25 }] }

const unitCentsRow = [{ description: "Cents priced", qty: 2, unitCents: 150 }]

parseLineItems(null)
parseLineItems(undefined)
parseLineItems("")

const fromQbEnvelope = parseLineItems(qbWrapped)
assert.equal(fromQbEnvelope.length, 1, "QBO Line envelope")
assert.equal(fromQbEnvelope[0]?.description, "Cal labor")
assertApprox(fromQbEnvelope[0]?.unit ?? 0, 120, "unit from SalesItemLineDetail")
assert.equal(fromQbEnvelope[0]?.qty, 2)

const fromArray = parseLineItems(qbLines)
assert.equal(fromArray.length, 1)

const camel = parseLineItems(camelEnvelope)
assert.equal(camel.length, 1)
assertApprox(camel[0]?.unit ?? 0, 10.5, "camel lineItems")

const snake = parseLineItems(legacySnake)
assert.equal(snake.length, 1)
assert.equal(snake[0]?.description, "Fee")
assertApprox(snake[0]?.unit ?? 0, 25, "legacy unit_price")

const cents = parseLineItems(unitCentsRow)
assert.equal(cents.length, 1)
assertApprox(cents[0]?.unit ?? 0, 1.5, "unitCents / 100")

const keyA = stableCanonicalLineItemsKey([{ description: "a", qty: 1, unit: 10 }])
const keyB = stableCanonicalLineItemsKey([{ description: "a", qty: 1, unit: 10 }])
assert.equal(keyA, keyB, "stable key")

console.log("parse-line-items tests passed.")
