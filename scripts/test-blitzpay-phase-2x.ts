/**
 * BlitzPay Phase 2X — native memberships, recurring billing engine, portal read APIs (deterministic).
 * Run: pnpm test:blitzpay-phase-2x
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { addMonths, addWeeks, addYears, subDays } from "date-fns"

import { blitzpayMembershipInvoiceGenerationKeyV1 } from "../lib/blitzpay/idempotency-keys"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, "..")

function read(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8")
}

function testMigrationPresent() {
  const p = "supabase/migrations/20260926120000_blitzpay_phase_2x_memberships_recurring_revenue.sql"
  const s = read(p)
  assert.match(s, /create table if not exists public\.blitzpay_memberships/)
  assert.match(s, /blitzpay_membership_invoices/)
  assert.match(s, /blitzpay_membership_payment_failures/)
  assert.match(s, /blitzpay_membership_events/)
  assert.match(s, /blitzpay_membership_retention_snapshots/)
}

function testIdempotencyKeyDeterministic() {
  const a = blitzpayMembershipInvoiceGenerationKeyV1({
    membershipId: "11111111-1111-4111-8111-111111111111",
    billingPeriodStart: "2026-05-01",
    billingPeriodEnd: "2026-05-31",
    generatedBy: "scheduler",
  })
  const b = blitzpayMembershipInvoiceGenerationKeyV1({
    membershipId: "11111111-1111-4111-8111-111111111111",
    billingPeriodStart: "2026-05-01",
    billingPeriodEnd: "2026-05-31",
    generatedBy: "scheduler",
  })
  assert.equal(a, b)
  assert.match(a, /^blitzpay:membership_inv:v1:/)
}

function testBoundedCaps() {
  const memberships = read("lib/blitzpay/blitzpay-memberships.ts")
  const listCap = Number(memberships.match(/MEMBERSHIP_LIST_CAP = (\d+)/)?.[1])
  const dueCap = Number(memberships.match(/MEMBERSHIP_DUE_SCAN_CAP = (\d+)/)?.[1])
  const snapCap = Number(memberships.match(/MEMBERSHIP_SNAPSHOT_ORG_CAP = (\d+)/)?.[1])
  assert.ok(listCap > 0 && listCap <= 600)
  assert.ok(dueCap > 0 && dueCap <= 120)
  assert.ok(snapCap > 0 && snapCap <= 200)
  const rollup = read("lib/blitzpay/blitzpay-platform-membership-rollup.ts")
  const plat = Number(rollup.match(/PLATFORM_MEMBERSHIP_ORG_SAMPLE_CAP = (\d+)/)?.[1])
  assert.ok(plat > 0 && plat <= 120)
}

/** Mirrors `computeBillingPeriodEndUtc` in blitzpay-memberships.ts (test-only; no server-only import). */
function computeBillingPeriodEndUtc(periodStartYmd: string, frequency: string): string {
  const start = new Date(`${periodStartYmd}T12:00:00Z`)
  const f = String(frequency || "").toLowerCase()
  let endBase = start
  if (f === "weekly") endBase = addWeeks(start, 1)
  else if (f === "monthly") endBase = addMonths(start, 1)
  else if (f === "quarterly") endBase = addMonths(start, 3)
  else if (f === "annual") endBase = addYears(start, 1)
  else endBase = addMonths(start, 1)
  const end = subDays(endBase, 1)
  return end.toISOString().slice(0, 10)
}

function nextBillingPeriodStartYmd(periodStartYmd: string, frequency: string): string {
  const start = new Date(`${periodStartYmd}T12:00:00Z`)
  const f = String(frequency || "").toLowerCase()
  if (f === "weekly") return addWeeks(start, 1).toISOString().slice(0, 10)
  if (f === "monthly") return addMonths(start, 1).toISOString().slice(0, 10)
  if (f === "quarterly") return addMonths(start, 3).toISOString().slice(0, 10)
  if (f === "annual") return addYears(start, 1).toISOString().slice(0, 10)
  return addMonths(start, 1).toISOString().slice(0, 10)
}

function testBillingPeriodMath() {
  const end = computeBillingPeriodEndUtc("2026-01-15", "monthly")
  assert.equal(end, "2026-02-14")
  const next = nextBillingPeriodStartYmd("2026-01-15", "monthly")
  assert.equal(next.slice(0, 7), "2026-02")
}

function testCronRouteAuth() {
  const s = read("app/api/cron/blitzpay-memberships/route.ts")
  assert.match(s, /CRON_SECRET/)
  assert.match(s, /blitzpaySchemaDriftIfUnhealthy/)
}

function testOrgApisGated() {
  for (const f of [
    "app/api/organizations/[organizationId]/blitzpay/memberships/route.ts",
    "app/api/organizations/[organizationId]/blitzpay/membership-insights/route.ts",
    "app/api/organizations/[organizationId]/blitzpay/retention-report/route.ts",
  ]) {
    const s = read(f)
    assert.match(s, /requireAnyOrgPermission/)
    assert.match(s, /blitzpaySchemaGuardNextResponse/)
  }
  const m = read("app/api/organizations/[organizationId]/blitzpay/memberships/route.ts")
  assert.match(m, /requireOrgPermission/)
}

function testPortalMinimal() {
  const s = read("app/api/portal/memberships/route.ts")
  assert.match(s, /requirePortalSession/)
  assert.doesNotMatch(s, /stripe/i)
  const d = read("lib/portal/portal-memberships.ts")
  assert.doesNotMatch(d, /stripe_/i)
}

function testSchemaHealthTables() {
  const s = read("lib/blitzpay/blitzpay-schema-health.ts")
  assert.match(s, /blitzpay_memberships/)
  assert.match(s, /blitzpay_membership_invoices/)
}

function testNoStripeIdsInClientPanel() {
  const s = read("components/blitzpay/blitzpay-memberships-dashboard.tsx")
  assert.doesNotMatch(s, /pi_|sub_|cus_/)
}

function main() {
  testMigrationPresent()
  testIdempotencyKeyDeterministic()
  testBoundedCaps()
  testBillingPeriodMath()
  testCronRouteAuth()
  testOrgApisGated()
  testPortalMinimal()
  testSchemaHealthTables()
  testNoStripeIdsInClientPanel()
  console.info("blitzpay phase 2x tests: OK")
}

main()
