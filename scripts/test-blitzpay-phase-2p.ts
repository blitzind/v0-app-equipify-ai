/**
 * BlitzPay Phase 2P — work order collection panel, field-safe actions, reporting hooks.
 * Run: pnpm test:blitzpay-phase-2p
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { getOrgPermissionsForRole } from "../lib/permissions/model"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, "..")

function read(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8")
}

function testMigrationMarkers() {
  const sql = read("supabase/migrations/20260923210000_blitzpay_phase_2p_work_order_collection.sql")
  assert.match(sql, /blitzpay_field_invoice_later_at/)
  assert.match(sql, /idx_blitzpay_payment_plans_org_work_order/)
}

function testWorkOrderSummaryShape() {
  const src = read("lib/blitzpay/work-order-blitzpay-summary.ts")
  assert.match(src, /export type WorkOrderBlitzpaySummary/)
  assert.match(src, /fieldInvoiceLaterAt/)
  assert.match(src, /paidInstallmentsCents/)
  assert.match(src, /displayReference:/)
  assert.match(src, /blitzpayDisplayPaymentReference/)
  assert.doesNotMatch(src, /stripe/i)
}

function testSummaryRouteGates() {
  const src = read("app/api/organizations/[organizationId]/work-orders/[workOrderId]/blitzpay/summary/route.ts")
  assert.match(src, /canViewFinancials/)
  assert.match(src, /canAssistBlitzpayCollection/)
  assert.match(src, /fieldView/)
}

function testTechnicianPermissionLimits() {
  const tech = getOrgPermissionsForRole("tech")
  assert.equal(tech.canAssistBlitzpayCollection, true)
  assert.equal(tech.canViewFinancials, false)
  assert.equal(tech.canEditInvoices, false)

  const none = getOrgPermissionsForRole(null)
  assert.equal(none.canAssistBlitzpayCollection, false)
}

function testPaymentLinkMetadataFromWorkOrder() {
  const src = read(
    "app/api/organizations/[organizationId]/work-orders/[workOrderId]/blitzpay/invoices/[invoiceId]/collect/payment-link/route.ts",
  )
  assert.match(src, /work_order_collect/)
  assert.match(src, /work_order_id/)
}

function testFieldCheckoutResponseStripsSessionId() {
  const src = read(
    "app/api/organizations/[organizationId]/work-orders/[workOrderId]/blitzpay/invoices/[invoiceId]/collect/open-checkout/route.ts",
  )
  assert.match(src, /fieldMode/)
  assert.match(src, /return NextResponse.json\(\{ url: result.data.url \}\)/)
  assert.match(src, /checkoutSessionId/)
}

function testWalletApplyNotGatedOnAssist() {
  const src = read("app/api/organizations/[organizationId]/customers/[customerId]/blitzpay/wallet/apply-invoice/route.ts")
  assert.match(src, /requireOrgPermission\(organizationId, \["canEditInvoices", "canViewFinancials"\]\)/)
  assert.doesNotMatch(src, /canAssistBlitzpayCollection/)
}

function testReportingWorkOrderCollectMetrics() {
  const snap = read("lib/blitzpay/blitzpay-reporting-snapshot.ts")
  assert.match(snap, /blitzpayWorkOrderCollectPaymentLinksWindowCount/)
  assert.match(snap, /workOrdersFieldInvoiceLaterWindowCount/)
  assert.match(snap, /work_order_collect/)
}

function testDrawerMountsPanel() {
  const drawer = read("components/drawers/work-order-drawer.tsx")
  assert.match(drawer, /WorkOrderBlitzpayPanel/)
  assert.match(drawer, /BlitzPay/)
}

function testCapabilitiesMetadata() {
  const cap = read("lib/permissions/capabilities.ts")
  assert.match(cap, /canAssistBlitzpayCollection:/)
}

function testDocsPhase2p() {
  const doc = read("docs/BLITZPAY_PHASE_2_ARCHITECTURE.md")
  assert.match(doc, /12\.17 Phase 2P/)
}

testMigrationMarkers()
testWorkOrderSummaryShape()
testSummaryRouteGates()
testTechnicianPermissionLimits()
testPaymentLinkMetadataFromWorkOrder()
testFieldCheckoutResponseStripsSessionId()
testWalletApplyNotGatedOnAssist()
testReportingWorkOrderCollectMetrics()
testDrawerMountsPanel()
testCapabilitiesMetadata()
testDocsPhase2p()

console.log("blitzpay phase 2p tests passed")
