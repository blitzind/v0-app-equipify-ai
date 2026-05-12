/**
 * BlitzPay Phase 3A — billing profiles, saved payment method metadata, autopay enrollments.
 * Run: pnpm test:blitzpay-phase-3a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  computeAutopayReadinessState,
  computeBillingRiskIndicator,
  computeInvoiceCollectionReadiness,
  formatMaskedPaymentMethodLabel,
  hashStripeReference,
  phase3aReportingRates,
  redactStripeLikeStrings,
} from "../lib/blitzpay/blitzpay-billing-profiles"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, "..")

function read(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8")
}

function testMigration() {
  const p = "supabase/migrations/20261001120000_blitzpay_phase_3a_customer_billing.sql"
  const s = read(p)
  assert.match(s, /blitzpay_customer_billing_profiles/)
  assert.match(s, /blitzpay_customer_payment_methods/)
  assert.match(s, /blitzpay_autopay_enrollments/)
  assert.match(s, /is_org_member/)
  assert.match(s, /provider_reference_hash/)
}

function testPureHelpers() {
  assert.equal(hashStripeReference("pm_test123"), hashStripeReference("pm_test123"))
  assert.notEqual(hashStripeReference("pm_a"), hashStripeReference("pm_b"))

  assert.equal(
    formatMaskedPaymentMethodLabel({
      paymentMethodType: "card",
      displayBrand: "Visa",
      displayLast4: "4242",
    }),
    "Visa ending in 4242",
  )
  assert.equal(
    formatMaskedPaymentMethodLabel({
      paymentMethodType: "us_bank_account",
      displayBrand: "Bank account",
      displayLast4: "6789",
    }),
    "Bank account ending in 6789",
  )

  assert.equal(
    computeAutopayReadinessState({
      profileStatus: "active",
      autopayEnabled: true,
      enrollmentStatus: "active",
      hasActivePaymentMethod: true,
    }),
    "ready",
  )
  assert.equal(
    computeAutopayReadinessState({
      profileStatus: "active",
      autopayEnabled: true,
      enrollmentStatus: "active",
      hasActivePaymentMethod: false,
    }),
    "needs_payment_method",
  )
  assert.equal(
    computeAutopayReadinessState({
      profileStatus: "delinquent",
      autopayEnabled: true,
      enrollmentStatus: "active",
      hasActivePaymentMethod: true,
    }),
    "blocked_delinquent",
  )

  assert.equal(computeBillingRiskIndicator("delinquent"), "elevated")
  assert.equal(computeBillingRiskIndicator("inactive"), "watch")

  const coll = computeInvoiceCollectionReadiness({
    profileStatus: "active",
    preferredDelivery: "email",
    hasActivePaymentMethod: false,
    autopayReadiness: "needs_enrollment",
  })
  assert.equal(coll, "not_ready")

  const rates = phase3aReportingRates({
    profileCount: 4,
    profilesWithActiveAutopayEnrollment: 1,
    profilesWithSavedMethod: 2,
    profilesBillingReady: 3,
    delinquentProfileCount: 1,
  })
  assert.equal(rates.autopayEnrollmentRate, 25)
  assert.equal(rates.savedPaymentMethodRate, 50)
  assert.equal(rates.billingReadinessRate, 75)
  assert.equal(rates.delinquencyRiskRate, 25)

  const red = redactStripeLikeStrings({
    ok: true,
    pm: "pm_1234567890abcdef",
    cus: "cus_ABCDEFGHIJKL",
    label: "Visa",
  } as Record<string, unknown>)
  assert.equal((red as { ok?: boolean }).ok, true)
  assert.equal("pm" in red, false)
  assert.equal("cus" in red, false)
}

function testBoundedReads() {
  const lib = read("lib/blitzpay/blitzpay-billing-profiles.ts")
  const svc = read("lib/blitzpay/blitzpay-billing-profiles-service.ts")
  assert.match(lib, /BLITZPAY_BILLING_PROFILE_LIST_CAP = (\d+)/)
  assert.match(svc, /\.limit\(BLITZPAY_BILLING_PROFILE_LIST_CAP\)/)
  assert.match(svc, /\.limit\(BLITZPAY_PAYMENT_METHOD_LIST_CAP\)/)
  assert.match(svc, /\.limit\(BLITZPAY_AUTOPAY_LIST_CAP\)/)
  assert.match(svc, /\.limit\(BLITZPAY_PHASE_3A_REPORTING_PROFILE_CAP\)/)
}

function testOrgApisGated() {
  for (const f of [
    "app/api/organizations/[organizationId]/blitzpay/billing-profiles/route.ts",
    "app/api/organizations/[organizationId]/blitzpay/billing-profiles/[profileId]/route.ts",
    "app/api/organizations/[organizationId]/blitzpay/payment-methods/route.ts",
    "app/api/organizations/[organizationId]/blitzpay/payment-methods/sync/route.ts",
    "app/api/organizations/[organizationId]/blitzpay/autopay/route.ts",
    "app/api/organizations/[organizationId]/blitzpay/autopay/[enrollmentId]/route.ts",
  ]) {
    const s = read(f)
    assert.match(s, /requireAnyOrgPermission/)
    assert.match(s, /blitzpaySchemaGuardNextResponse/)
  }
}

function testSyncSafety() {
  const svc = read("lib/blitzpay/blitzpay-billing-profiles-service.ts")
  assert.doesNotMatch(svc, /paymentIntents\.create/)
  assert.doesNotMatch(svc, /subscriptions\.create/)
  assert.doesNotMatch(svc, /charges\.create/)
}

function testPortalIsolation() {
  const pm = read("app/api/portal/billing/payment-methods/route.ts")
  assert.match(pm, /requirePortalSession/)
  assert.match(pm, /displayLabel:/)
  assert.doesNotMatch(pm, /provider_reference_hash/)
  assert.doesNotMatch(pm, /id:/)

  const ap = read("app/api/portal/billing/autopay/route.ts")
  assert.match(ap, /customer_id !== portalUser\.customer_id/)
  assert.doesNotMatch(ap, /treasury/)
  assert.equal(fs.existsSync(path.join(ROOT, "app/api/portal/blitzpay/billing-profiles")), false)
}

function testSchemaHealthTables() {
  const s = read("lib/blitzpay/blitzpay-schema-health.ts")
  assert.match(s, /blitzpay_customer_billing_profiles/)
  assert.match(s, /blitzpay_customer_payment_methods/)
  assert.match(s, /blitzpay_autopay_enrollments/)
}

function testReportingSnapshotFields() {
  const s = read("lib/blitzpay/blitzpay-reporting-snapshot.ts")
  assert.match(s, /autopayEnrollmentRate/)
  assert.match(s, /savedPaymentMethodRate/)
  assert.match(s, /billingReadinessRate/)
  assert.match(s, /delinquencyRiskRate/)
}

function testStaffUiNoRawStripeIds() {
  const s = read("components/blitzpay/blitzpay-billing-profiles-panel.tsx")
  assert.doesNotMatch(s, /\bpm_[A-Za-z0-9]+\b/)
  assert.doesNotMatch(s, /\bcus_[A-Za-z0-9]+\b/)
}

function main() {
  testMigration()
  testPureHelpers()
  testBoundedReads()
  testOrgApisGated()
  testSyncSafety()
  testPortalIsolation()
  testSchemaHealthTables()
  testReportingSnapshotFields()
  testStaffUiNoRawStripeIds()
  console.log("blitzpay phase 3a tests passed")
}

main()
