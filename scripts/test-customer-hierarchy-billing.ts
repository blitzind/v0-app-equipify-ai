/**
 * Unit tests: customer hierarchy billing address derivation.
 * Run: pnpm test:customer-hierarchy-billing
 */
import assert from "node:assert/strict"
import { deriveBillingAddress } from "../lib/customers/hierarchy"

const childService = {
  locationId: "loc-child",
  name: "Primary service location",
  line1: "2530 Atlantic Ave",
  line2: "Suite D",
  city: "Long Beach",
  state: "CA",
  postalCode: "90806",
}

const parentCustomBilling = {
  billing_behavior: "own_billing" as const,
  billing_address_same_as_service: false,
  billing_name: "Sonus Hearing Care",
  billing_address_line1: "1425 W. Foothill Blvd",
  billing_address_line2: "Suite 220",
  billing_city: "Upland",
  billing_state: "CA",
  billing_postal_code: "91786",
}

function testCustomBillingInline() {
  const { address, missing } = deriveBillingAddress(parentCustomBilling, childService, null)
  assert.equal(missing, false)
  assert.equal(address.line1, "1425 W. Foothill Blvd")
  assert.equal(address.city, "Upland")
  assert.equal(address.inheritsFromDefaultLocation, false)
  assert.equal(address.inheritedFromParent, false)
}

function testSameAsServiceUsesDefaultLocation() {
  const { address, missing } = deriveBillingAddress(
    { billing_address_same_as_service: true, billing_behavior: "own_billing" },
    childService,
    null,
  )
  assert.equal(missing, false)
  assert.equal(address.line1, "2530 Atlantic Ave")
  assert.equal(address.city, "Long Beach")
  assert.equal(address.inheritsFromDefaultLocation, true)
}

function testServiceAndBillingStaySeparate() {
  const parentBilling = deriveBillingAddress(parentCustomBilling, childService, null)
  assert.notEqual(parentBilling.address.line1, childService.line1)
  assert.notEqual(parentBilling.address.city, childService.city)
}

function testMissingCustomBilling() {
  const { missing } = deriveBillingAddress(
    { billing_address_same_as_service: false, billing_address_line1: "", billing_city: "" },
    childService,
    null,
  )
  assert.equal(missing, true)
}

const tests: Array<{ name: string; fn: () => void }> = [
  { name: "custom inline billing address", fn: testCustomBillingInline },
  { name: "same as service uses default location", fn: testSameAsServiceUsesDefaultLocation },
  { name: "service and billing addresses stay separate", fn: testServiceAndBillingStaySeparate },
  { name: "missing custom billing flagged", fn: testMissingCustomBilling },
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
