/**
 * BlitzPay Phase 5C — warranty / claims / protection foundations (deterministic helpers + route presence).
 * Run: pnpm test:blitzpay-phase-5c-insurance-warranty-claims
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { SupabaseClient } from "@supabase/supabase-js"
import { hashBlitzpayClaimsAudit, hashBlitzpayClaimPayoutReference } from "../lib/blitzpay/blitzpay-claims-audit"
import {
  buildPhase5cClaimsReportingSlice,
  prioritizeClaimsDeterministic,
} from "../lib/blitzpay/blitzpay-claims-orchestration"
import {
  claimsReserveCoverageScore0to100,
  reserveReplenishmentIndicator0to100,
  reserveUtilizationScore0to100,
  warrantyReserveExposureCents,
} from "../lib/blitzpay/blitzpay-warranty-reserves"
import { protectionPlanAnnualizedRecurringCents, sumActiveEstimatedExposureCents } from "../lib/blitzpay/blitzpay-protection-plans"
import { maxStormTreasuryPressure0to100, sumStormClaimExposureCents } from "../lib/blitzpay/blitzpay-storm-financials"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_ROOT = path.resolve(__dirname, "..")

function read(rel: string): string {
  return fs.readFileSync(path.join(APP_ROOT, rel), "utf8")
}

const ORG = "11111111-1111-4111-8111-111111111111"

function mockAdmin(rows: Record<string, unknown[]>): SupabaseClient {
  return {
    from(table: string) {
      const data = rows[table] ?? []
      const chain = {
        select() {
          return chain
        },
        eq() {
          return chain
        },
        order() {
          return chain
        },
        limit() {
          return Promise.resolve({ data, error: null })
        },
      }
      return chain
    },
  } as unknown as SupabaseClient
}

async function main(): Promise<void> {
  assert.equal(reserveUtilizationScore0to100(50_000, 100_000), 50)
  assert.equal(reserveReplenishmentIndicator0to100(50_000, 100_000), 50)
  assert.equal(reserveReplenishmentIndicator0to100(100_000, 100_000), 0)
  assert.equal(
    warrantyReserveExposureCents([
      { id: "b", reserve_status: "active", reserve_balance_cents: 100, projected_exposure_cents: 500 },
      { id: "a", reserve_status: "active", reserve_balance_cents: 200, projected_exposure_cents: null },
    ]),
    500,
  )
  assert.equal(claimsReserveCoverageScore0to100(10_000, 20_000), 50)
  assert.equal(
    sumActiveEstimatedExposureCents([
      { id: "x", plan_status: "active", estimated_exposure_cents: 100 },
      { id: "y", plan_status: "expired", estimated_exposure_cents: 999 },
    ]),
    100,
  )
  assert.equal(
    protectionPlanAnnualizedRecurringCents([
      { id: "m", plan_status: "active", monthly_price_cents: 1000 },
      { id: "n", plan_status: "active", monthly_price_cents: 500 },
    ]),
    18_000,
  )
  assert.equal(
    maxStormTreasuryPressure0to100([
      { id: "s1", event_status: "active", estimated_treasury_pressure: 40 },
      { id: "s2", event_status: "monitoring", estimated_treasury_pressure: 80 },
      { id: "s3", event_status: "completed", estimated_treasury_pressure: 99 },
    ]),
    80,
  )
  assert.equal(
    sumStormClaimExposureCents([
      { id: "a", event_status: "active", estimated_claim_exposure_cents: 1000 },
      { id: "b", event_status: "archived", estimated_claim_exposure_cents: 50_000 },
    ]),
    1000,
  )

  const ordered = prioritizeClaimsDeterministic([
    { id: "z", claim_status: "draft", estimated_claim_amount_cents: 100, submitted_at: null },
    { id: "y", claim_status: "submitted", estimated_claim_amount_cents: 50, submitted_at: "2020-01-02" },
    { id: "x", claim_status: "submitted", estimated_claim_amount_cents: 50, submitted_at: "2020-01-03" },
  ])
  assert.deepEqual(
    ordered.map((r) => r.id),
    ["x", "y", "z"],
  )

  const h1 = hashBlitzpayClaimsAudit({
    audit_type: "claim_created",
    organization_id: ORG,
    claim_id: null,
    audit_summary: "test",
    actor_type: "system",
    actor_id: null,
    metadata: { a: 1 },
  })
  const h2 = hashBlitzpayClaimsAudit({
    audit_type: "claim_created",
    organization_id: ORG,
    claim_id: null,
    audit_summary: "test",
    actor_type: "system",
    actor_id: null,
    metadata: { a: 1 },
  })
  assert.equal(h1, h2)
  assert.equal(h1.length, 64)

  const pr = hashBlitzpayClaimPayoutReference({
    organizationId: ORG,
    claimId: "22222222-2222-4222-8222-222222222222",
    amountCents: 100,
    createdAtIso: "2026-01-01T00:00:00.000Z",
  })
  assert.equal(pr.length, 64)

  const admin = mockAdmin({
    blitzpay_warranty_reserves: [
      { id: "r1", reserve_status: "active", reserve_balance_cents: 20_000, projected_exposure_cents: 30_000 },
    ],
    blitzpay_claims: [{ id: "c1", claim_status: "submitted", estimated_claim_amount_cents: 10_000, submitted_at: null }],
    blitzpay_equipment_protection_plans: [
      { id: "p1", plan_status: "active", monthly_price_cents: 1000, estimated_exposure_cents: 5000 },
    ],
    blitzpay_storm_event_financials: [
      { id: "st1", event_status: "active", estimated_claim_exposure_cents: 2000, estimated_treasury_pressure: 25 },
    ],
    blitzpay_claims_payout_tracking: [{ id: "pay1", payout_status: "pending", payout_amount_cents: 3000 }],
  })
  const slice = await buildPhase5cClaimsReportingSlice(admin, ORG, {
    openDisputesAmountCents: 0,
    treasuryPendingPayoutTotalsCents: 10_000,
    apDue30OpenCents: 5_000,
    estimatedOperatingCashCents: 200_000,
  })
  assert.equal(slice.warrantyReserveExposure, 30_000)
  assert.equal(slice.claimsExposureCents, 10_000)
  assert.ok(slice.claimsReserveCoverageScore >= 0 && slice.claimsReserveCoverageScore <= 100)
  assert.ok(slice.protectionPlanRecurringRevenue > 0)
  assert.ok(slice.stormEventTreasuryPressure >= 0)
  assert.equal(slice.claimsPayoutExposure, 3000)

  const routePathsWithLimit = [
    "organizations/[organizationId]/blitzpay/claims/reserves/route.ts",
    "organizations/[organizationId]/blitzpay/claims/route.ts",
    "organizations/[organizationId]/blitzpay/claims/payouts/route.ts",
    "organizations/[organizationId]/blitzpay/protection-plans/route.ts",
    "organizations/[organizationId]/blitzpay/storm-events/route.ts",
  ]
  for (const p of routePathsWithLimit) {
    const src = read(path.join("app/api", p))
    assert.ok(src.includes("requireAnyOrgPermission"), p)
    assert.ok(src.includes("blitzpaySchemaGuardNextResponse"), p)
    assert.ok(src.includes(".limit("), p)
  }
  const healthPath = "organizations/[organizationId]/blitzpay/claims/health/route.ts"
  const healthSrc = read(path.join("app/api", healthPath))
  assert.ok(healthSrc.includes("requireAnyOrgPermission"), healthPath)
  assert.ok(healthSrc.includes("blitzpaySchemaGuardNextResponse"), healthPath)
  assert.ok(healthSrc.includes("fetchBlitzpayOrgReportingSnapshot"), healthPath)

  const schema = read("lib/blitzpay/blitzpay-schema-health.ts")
  for (const t of [
    "blitzpay_warranty_reserves",
    "blitzpay_claims",
    "blitzpay_claim_reserve_movements",
    "blitzpay_equipment_protection_plans",
    "blitzpay_claims_payout_tracking",
    "blitzpay_storm_event_financials",
    "blitzpay_claims_audit_log",
    "blitzpay_protection_plan_snapshots",
  ]) {
    assert.ok(schema.includes(t), t)
  }

  console.log("blitzpay phase 5c tests passed")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
