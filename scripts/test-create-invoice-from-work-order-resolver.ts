/**
 * Unit tests: create invoice from work order resolver (customer matching + normalization).
 * Run: pnpm test:create-invoice-from-work-order-resolver
 */
import assert from "node:assert/strict"
import {
  mapBillingProfileToPreviewCustomer,
  mapCustomerRow,
  normalizeMatchKey,
  rankCustomerMatches,
} from "../lib/aiden/actions/resolvers/create-invoice-from-work-order-resolver"
import type { CustomerBillingProfile } from "../lib/customers/billing-profile"

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

function testMapBillingProfileUsesParentAddress() {
  const row = {
    id: "child",
    company_name: "Sonus Hearing Care - Atlantic",
    billing_name: null,
    billing_contact_name: null,
    billing_email: null,
    billing_contact_phone: null,
    billing_address_line1: "2530 Atlantic Ave",
    billing_address_line2: null,
    billing_city: "Long Beach",
    billing_state: "CA",
    billing_postal_code: "90806",
    billing_country: "US",
    tax_exempt: false,
    default_tax_basis: null,
    default_tax_category: null,
  }
  const profile: CustomerBillingProfile = {
    customerId: "child",
    customerName: "Sonus Hearing Care - Atlantic",
    billingCustomerId: "parent",
    billingCustomerName: "Sonus Hearing Care",
    behavior: "parent_billing",
    inheritedFromParent: true,
    billingName: "Sonus Hearing Care",
    billingContactName: null,
    billingContactEmail: null,
    billingContactPhone: null,
    addressLine1: "1425 W. Foothill Blvd",
    addressLine2: "Suite 220",
    city: "Upland",
    state: "CA",
    postalCode: "91786",
    country: "US",
    poRequired: false,
    poRequiredBeforeService: false,
    poRequiredBeforeInvoice: false,
    defaultPoNumber: null,
    invoiceInstructions: null,
    invoiceDeliveryPreference: null,
    defaultPaymentTermsKey: null,
    defaultPaymentTermsDays: null,
    defaultPaymentTermsLabel: null,
    taxExempt: false,
    taxExemptionId: null,
    taxExemptionNotes: null,
    defaultTaxBasis: null,
    defaultTaxCategory: null,
  }
  const mapped = mapBillingProfileToPreviewCustomer(row, profile)
  assert.equal(mapped.billingAddressLine1, "1425 W. Foothill Blvd")
  assert.equal(mapped.billingCity, "Upland")
  assert.notEqual(mapped.billingCity, row.billing_city)
}

function testMapCustomerRowFallback() {
  const row = {
    id: "1",
    company_name: "Acme",
    billing_name: null,
    billing_contact_name: null,
    billing_email: null,
    billing_contact_phone: null,
    billing_address_line1: "1 Main",
    billing_address_line2: null,
    billing_city: "LA",
    billing_state: "CA",
    billing_postal_code: "90001",
    billing_country: null,
    tax_exempt: null,
    default_tax_basis: null,
    default_tax_category: null,
  }
  const mapped = mapCustomerRow(row)
  assert.equal(mapped.billingAddressLine1, "1 Main")
}

const tests: Array<{ name: string; fn: () => void }> = [
  { name: "normalize match key", fn: testNormalizeMatchKey },
  { name: "rank single exact company", fn: testRankSingleExact },
  { name: "rank billing name exact", fn: testRankBillingNameExact },
  { name: "rank ambiguous tie", fn: testRankAmbiguousTie },
  { name: "rank no match", fn: testRankNoMatch },
  { name: "map billing profile uses parent address", fn: testMapBillingProfileUsesParentAddress },
  { name: "map customer row fallback", fn: testMapCustomerRowFallback },
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
