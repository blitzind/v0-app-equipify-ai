/**
 * DOC-CUSTOMER-INFO-HOTFIX-2 regression tests.
 * Run: pnpm test:document-customer-info-hotfix-2
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { deriveBillingAddress, type BillingAddress, type CustomerHierarchySummary, type ServiceAddress } from "../lib/customers/hierarchy"
import { customerDocumentFieldsFromCustomerAndHierarchy } from "../lib/documents/customer-document-fields"
import { resolveInvoiceBillToFields } from "../lib/invoices/resolve-invoice-bill-to-fields"
import { resolveInvoiceDocumentCustomerIds } from "../lib/invoices/resolve-invoice-document-customer-ids"

const childService: ServiceAddress = {
  locationId: "loc-child",
  name: "Primary campus",
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

function testCustomerSelectOmitsNonexistentPhoneColumn() {
  const loaderSource = fs.readFileSync(
    path.join(process.cwd(), "lib/documents/load-customer-document-fields.ts"),
    "utf8",
  )
  const selectMatch = loaderSource.match(/CUSTOMER_DOCUMENT_FIELDS_SELECT\s*=\s*\n?\s*"([^"]+)"/)
  assert.ok(selectMatch, "CUSTOMER_DOCUMENT_FIELDS_SELECT constant expected")
  const CUSTOMER_DOCUMENT_FIELDS_SELECT = selectMatch[1]
  assert.ok(!/\bphone\b/.test(CUSTOMER_DOCUMENT_FIELDS_SELECT), "customers table has no phone column")
  assert.ok(CUSTOMER_DOCUMENT_FIELDS_SELECT.includes("company_name"))
  assert.ok(CUSTOMER_DOCUMENT_FIELDS_SELECT.includes("billing_email"))
  assert.ok(loaderSource.includes("customer_contacts"), "primary contact fallback expected")
}

function testPrimaryContactPhoneEmailFallback() {
  const { address } = deriveBillingAddress(
    { billing_address_same_as_service: true, billing_behavior: "own_billing" },
    childService,
    null,
  )
  const fields = customerDocumentFieldsFromCustomerAndHierarchy(
    {
      company_name: "Precision Biomedical Site",
      primary_contact_email: "ce@pbs-demo.local",
      primary_contact_phone: "(209) 555-2001",
    },
    hierarchyStub(address, childService),
  )

  assert.equal(fields.customerCompanyName, "Precision Biomedical Site")
  assert.equal(fields.customerEmail, "ce@pbs-demo.local")
  assert.equal(fields.customerPhone, "(209) 555-2001")
  assert.ok(fields.billingAddressBlock?.includes("2530 Atlantic Ave"))
}

function testInvoiceDocumentCustomerIdResolution() {
  assert.deepEqual(resolveInvoiceDocumentCustomerIds("site-id", "parent-id"), {
    operationalCustomerId: "site-id",
    billToCustomerId: "parent-id",
  })
  assert.deepEqual(resolveInvoiceDocumentCustomerIds("site-id", null), {
    operationalCustomerId: "site-id",
    billToCustomerId: "site-id",
  })
  assert.deepEqual(resolveInvoiceDocumentCustomerIds(null, "parent-id"), {
    operationalCustomerId: null,
    billToCustomerId: "parent-id",
  })
}

function testSeedInvoiceScenarioInvArPbs7020() {
  // Mirrors seed-precision-biomedical-demo: invoice has customer_id, no billing snapshot.
  const { address } = deriveBillingAddress(
    { billing_address_same_as_service: true, billing_behavior: "own_billing" },
    childService,
    null,
  )
  const customerFields = customerDocumentFieldsFromCustomerAndHierarchy(
    {
      company_name: "Valley Regional Medical Center",
      primary_contact_email: "ce-valley@pbs-demo.local",
      primary_contact_phone: "(209) 555-2012",
    },
    hierarchyStub(address, childService),
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

  const debug = {
    invoiceNumberLabel: "INV-AR-PBS-7020",
    customer_id: "seed-equipment-customer-id",
    billing_customer_id: null,
    customerFieldsCustomerCompanyName: customerFields.customerCompanyName,
    customerFieldsBillingName: customerFields.billingName,
    customerFieldsBillingAddressBlock: customerFields.billingAddressBlock,
    customerFieldsServiceAddressBlock: customerFields.serviceAddressBlock,
    finalBillToName: resolved.billToName,
    finalBillToAddressBlock: resolved.billToAddressBlock,
  }

  console.log("certification:invoice-document-context-debug", JSON.stringify(debug, null, 2))

  assert.equal(resolved.billToName, "Valley Regional Medical Center")
  assert.ok(resolved.billToAddressBlock.includes("2530 Atlantic Ave"))
  assert.ok(resolved.billToAddressBlock.includes("Long Beach"))
  assert.notEqual(resolved.billToName, "Customer")
}

function testPdfRouteUsesCanonicalLoader() {
  const routeSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/organizations/[organizationId]/invoices/[invoiceId]/pdf/route.ts"),
    "utf8",
  )
  assert.ok(routeSource.includes("loadInvoiceDocumentContext"))
  assert.ok(routeSource.includes("generateInvoicePdfBuffer"))

  const loaderSource = fs.readFileSync(
    path.join(process.cwd(), "lib/invoices/load-invoice-document-context.ts"),
    "utf8",
  )
  assert.ok(loaderSource.includes("resolveInvoiceBillToFields"))
  assert.ok(loaderSource.includes("billing_customer_id"))
  assert.ok(loaderSource.includes("resolveInvoiceDocumentCustomerIds"))
}

const tests: Array<{ name: string; fn: () => void }> = [
  { name: "customer select omits nonexistent customers.phone", fn: testCustomerSelectOmitsNonexistentPhoneColumn },
  { name: "primary contact email/phone fallback", fn: testPrimaryContactPhoneEmailFallback },
  { name: "invoice document customer id resolution", fn: testInvoiceDocumentCustomerIdResolution },
  { name: "INV-AR-PBS-7020 seed scenario resolves bill-to", fn: testSeedInvoiceScenarioInvArPbs7020 },
  { name: "PDF route uses canonical invoice document loader", fn: testPdfRouteUsesCanonicalLoader },
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
console.log(`\nAll ${tests.length} document-customer-info-hotfix-2 tests passed.`)
