/**
 * Unit tests: create invoice from work order resolver (customer matching + normalization).
 * Run: pnpm test:create-invoice-from-work-order-resolver
 */
import assert from "node:assert/strict"
import {
  normalizeMatchKey,
  rankCustomerMatches,
} from "../lib/aiden/actions/resolvers/create-invoice-from-work-order-resolver"

function testNormalizeMatchKey() {
  assert.equal(normalizeMatchKey("  Acme   LLC  "), "acme llc")
}

function testRankSingleExact() {
  const rows = [
    { id: "1", company_name: "Beta Inc", billing_name: null },
    { id: "2", company_name: "Acme LLC", billing_name: null },
  ]
  const r = rankCustomerMatches("Acme LLC", rows)
  assert.equal(r.length, 1)
  assert.equal(r[0].id, "2")
  assert.ok(r[0].score >= 90)
}

function testRankBillingNameExact() {
  const rows = [{ id: "a", company_name: "HoldCo", billing_name: "Acme LLC" }]
  const r = rankCustomerMatches("Acme LLC", rows)
  assert.equal(r[0].id, "a")
  assert.equal(r[0].score, 100)
}

function testRankAmbiguousTie() {
  const rows = [
    { id: "1", company_name: "Acme LLC", billing_name: null },
    { id: "2", company_name: "Acme LLC", billing_name: null },
  ]
  const r = rankCustomerMatches("Acme LLC", rows)
  assert.equal(r.length, 2)
  assert.equal(r[0].score, r[1].score)
}

function testRankNoMatch() {
  const rows = [{ id: "1", company_name: "Zebra Co", billing_name: null }]
  const r = rankCustomerMatches("Completely Unrelated Name XYZ", rows)
  assert.equal(r.length, 0)
}

const tests: Array<{ name: string; fn: () => void }> = [
  { name: "normalize match key", fn: testNormalizeMatchKey },
  { name: "rank single exact company", fn: testRankSingleExact },
  { name: "rank billing name exact", fn: testRankBillingNameExact },
  { name: "rank ambiguous tie", fn: testRankAmbiguousTie },
  { name: "rank no match", fn: testRankNoMatch },
]

let failed = 0
for (const t of tests) {
  try {
    t.fn()
    console.log(`ok\t${t.name}`)
  } catch (e) {
    failed += 1
    console.error(`fail\t${t.name}`)
    console.error(e)
  }
}

if (failed > 0) process.exit(1)
console.log(`\nAll ${tests.length} tests passed.`)
