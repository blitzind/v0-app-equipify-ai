/**
 * DOC-CUSTOMER-INFO-HOTFIX regression tests.
 * Run: pnpm test:document-customer-info-hotfix
 */
import assert from "node:assert/strict"
import { deriveBillingAddress, type BillingAddress, type CustomerHierarchySummary, type ServiceAddress } from "../lib/customers/hierarchy"
import { customerDocumentFieldsFromCustomerAndHierarchy } from "../lib/documents/customer-document-fields"
import { resolveInvoiceBillToFields } from "../lib/invoices/resolve-invoice-bill-to-fields"

const childService: ServiceAddress = {
  locationId: "loc-child",
  name: "Primary service location",
  line1: "2530 Atlantic Ave",
  line2: "Suite D",
  city: "Long Beach",
  state: "CA",
  postalCode: "90806",
}

function hierarchyStub(
  billingAddress: BillingAddress,
  defaultService: ServiceAddress | null,
): CustomerHierarchySummary {
  return {
    customerId: "cust-1",
    organizationId: "org-1",
    parent: null,
    children: [],
    locationCount: 1,
    childCount: 0,
    defaultServiceAddress: defaultService,
    billingAddress,
    billingAddressSameAsService: true,
    billingLocationId: null,
    billingAddressMissing: false,
    schemaMigrationPending: false,
  }
}

function testSameAsServiceBillingAddressBlocks() {
  const { address } = deriveBillingAddress(
    { billing_address_same_as_service: true, billing_behavior: "own_billing", billing_name: "Site Billing Name" },
    childService,
    null,
  )
  const fields = customerDocumentFieldsFromCustomerAndHierarchy(
    {
      company_name: "Acme Field Service",
      billing_email: "ap@acme.example",
      billing_contact_phone: "(661) 555-0100",
    },
    hierarchyStub(address, childService),
  )

  assert.ok(fields.billingAddressBlock?.includes("2530 Atlantic Ave"))
  assert.ok(fields.billingAddressBlock?.includes("Long Beach"))
  assert.ok(fields.serviceAddressBlock?.includes("2530 Atlantic Ave"))
  assert.equal(fields.billingName, "Site Billing Name")
}

function testInvoiceEmptySnapshotUsesCustomerProfile() {
  const customerFields = customerDocumentFieldsFromCustomerAndHierarchy(
    { company_name: "Beta Labs", billing_name: "Beta Labs AP" },
    hierarchyStub(
      deriveBillingAddress(
        {
          billing_address_same_as_service: true,
          billing_behavior: "own_billing",
          billing_name: "Beta Labs AP",
        },
        childService,
        null,
      ).address,
      childService,
    ),
  )

  const resolved = resolveInvoiceBillToFields(
    {
      billing_name: null,
      billing_address_line1: null,
      billing_city: null,
      billing_state: null,
      billing_postal_code: null,
    },
    customerFields,
  )

  assert.equal(resolved.billToName, "Beta Labs AP")
  assert.ok(resolved.billToAddressBlock.includes("2530 Atlantic Ave"))
  assert.ok(resolved.billToAddressBlock.includes("Long Beach"))
}

function testQuoteContextIncludesBillingAndServiceAddresses() {
  const { address } = deriveBillingAddress(
    { billing_address_same_as_service: true, billing_behavior: "own_billing" },
    childService,
    null,
  )
  const fields = customerDocumentFieldsFromCustomerAndHierarchy({ company_name: "Gamma Corp" }, hierarchyStub(address, childService))

  assert.ok(fields.billingAddressBlock?.trim())
  assert.ok(fields.serviceAddressBlock?.trim())
  assert.ok(fields.billingAddressBlock!.includes("Long Beach"))
  assert.ok(fields.serviceAddressBlock!.includes("2530 Atlantic Ave"))
}

function testPurchaseOrderCustomerContextIncludesAddressBlocks() {
  const customBilling = {
    billing_behavior: "own_billing" as const,
    billing_address_same_as_service: false,
    billing_name: "Delta Purchasing",
    billing_address_line1: "900 Industrial Way",
    billing_city: "Ontario",
    billing_state: "CA",
    billing_postal_code: "91761",
  }
  const { address } = deriveBillingAddress(customBilling, childService, null)
  const fields = customerDocumentFieldsFromCustomerAndHierarchy(
    { company_name: "Delta Corp", billing_email: "buyer@delta.example" },
    hierarchyStub(address, childService),
  )

  assert.equal(fields.customerCompanyName, "Delta Corp")
  assert.ok(fields.billingAddressBlock?.includes("900 Industrial Way"))
  assert.ok(fields.billingAddressBlock?.includes("Ontario"))
  assert.equal(fields.customerEmail, "buyer@delta.example")
}

function testSnapshotWinsOverLiveCustomerFields() {
  const customerFields = customerDocumentFieldsFromCustomerAndHierarchy(
    { company_name: "Live Customer" },
    hierarchyStub(
      deriveBillingAddress(
        { billing_address_same_as_service: true, billing_behavior: "own_billing" },
        childService,
        null,
      ).address,
      childService,
    ),
  )

  const resolved = resolveInvoiceBillToFields(
    {
      billing_name: "Snapshot Bill To",
      billing_address_line1: "1 Snapshot St",
      billing_city: "Irvine",
      billing_state: "CA",
      billing_postal_code: "92618",
    },
    customerFields,
  )

  assert.equal(resolved.billToName, "Snapshot Bill To")
  assert.ok(resolved.billToAddressBlock.includes("1 Snapshot St"))
  assert.ok(!resolved.billToAddressBlock.includes("2530 Atlantic Ave"))
}

const tests: Array<{ name: string; fn: () => void }> = [
  { name: "billing_address_same_as_service resolves address blocks", fn: testSameAsServiceBillingAddressBlocks },
  { name: "invoice empty snapshot falls back to customer profile", fn: testInvoiceEmptySnapshotUsesCustomerProfile },
  { name: "quote context includes billing and service addresses", fn: testQuoteContextIncludesBillingAndServiceAddresses },
  { name: "purchase order customer context includes address blocks", fn: testPurchaseOrderCustomerContextIncludesAddressBlocks },
  { name: "invoice snapshot wins over live customer fields", fn: testSnapshotWinsOverLiveCustomerFields },
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
console.log(`\nAll ${tests.length} document-customer-info-hotfix tests passed.`)
