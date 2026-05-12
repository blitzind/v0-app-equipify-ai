/**
 * BlitzPay Phase 3D — financing marketplace foundations (deterministic helpers + static guards; no DB).
 * Run: pnpm test:blitzpay-phase-3d-financing-marketplace
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { buildComplianceAuditImmutableHash } from "../lib/blitzpay/blitzpay-compliance-audit"
import { advanceExposureFromModelsCents, estimateAdvancePaybackCents } from "../lib/blitzpay/blitzpay-contractor-advances"
import {
  BLITZPAY_FINANCING_APPLICATION_LIST_CAP,
  BLITZPAY_FINANCING_AUDIT_LIST_CAP,
  BLITZPAY_FINANCING_OFFER_LIST_CAP,
  BLITZPAY_MARKETPLACE_PROVIDER_LIST_CAP,
  computeProviderCompatibilityScore0to100,
  daysUntilExpirationYmd,
  sortFinancingOffersForComparison,
  sortProviderMatchesDeterministic,
  treasuryImpactScoreFromCoverageBps,
} from "../lib/blitzpay/blitzpay-financing-marketplace"
import { computeFinancingQualificationScore0to100, passesQualificationThreshold } from "../lib/blitzpay/blitzpay-financing-qualification"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_ROOT = path.resolve(__dirname, "..")

function readUtf8(rel: string): string {
  return fs.readFileSync(path.join(APP_ROOT, rel), "utf8")
}

const prov = (over: Partial<{ id: string; provider_type: string; minimum_amount_cents: number | null; maximum_amount_cents: number | null }>) => ({
  id: over.id ?? "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  organization_id: null as string | null,
  provider_name: "P",
  provider_status: "active",
  provider_type: over.provider_type ?? "customer_financing",
  minimum_amount_cents: over.minimum_amount_cents ?? 0,
  maximum_amount_cents: over.maximum_amount_cents ?? 1_000_000_00,
  supported_products: ["service"],
})

// --- Qualification ---
const q = computeFinancingQualificationScore0to100({
  recurringRevenueProxyCents: 500_000,
  invoicePaidCountWindow: 10,
  collectionHealthScore0to100: 80,
  membershipRenewalSuccessProxyPct: 70,
  treasuryCoverageBps: 250_000,
})
assert.ok(q >= 0 && q <= 100)
assert.equal(passesQualificationThreshold(q, q), true)
assert.equal(passesQualificationThreshold(10, 50), false)

// --- Provider compatibility & deterministic ordering ---
const c1 = computeProviderCompatibilityScore0to100({
  applicationType: "customer_service",
  requestedAmountCents: 100_000,
  provider: prov({ provider_type: "customer_financing" }),
})
assert.ok(c1.score >= 0 && c1.score <= 100)
const cBad = computeProviderCompatibilityScore0to100({
  applicationType: "customer_service",
  requestedAmountCents: 10,
  provider: prov({ minimum_amount_cents: 1_000_000, maximum_amount_cents: 2_000_000 }),
})
assert.ok(cBad.score < c1.score)
const sorted = sortProviderMatchesDeterministic([
  { providerId: "b", score: 50, providerName: "Z" },
  { providerId: "a", score: 50, providerName: "A" },
  { providerId: "c", score: 60, providerName: "M" },
])
assert.deepEqual(
  sorted.map((x) => x.providerId),
  ["c", "a", "b"],
)

// --- Offer ordering ---
const offers = sortFinancingOffersForComparison([
  { id: "b", offer_amount_cents: 1000, estimated_apr_basis_points: 1200, estimated_payment_cents: 10, estimated_term_months: 12 },
  { id: "a", offer_amount_cents: 2000, estimated_apr_basis_points: 800, estimated_payment_cents: 20, estimated_term_months: 12 },
])
assert.deepEqual(
  offers.map((o) => o.id),
  ["a", "b"],
)

// --- Treasury impact ---
assert.equal(treasuryImpactScoreFromCoverageBps(500_000), 50)

// --- Contractor advance ---
assert.equal(estimateAdvancePaybackCents(100_000, 500), 105_000)
assert.equal(
  advanceExposureFromModelsCents(
    [
      { model_status: "active", estimated_advance_amount_cents: 1000 },
      { model_status: "inactive", estimated_advance_amount_cents: 9999 },
    ],
    10,
  ),
  1000,
)

// --- Expiration days ---
assert.equal(daysUntilExpirationYmd("2030-01-10", "2030-01-01"), 9)
assert.equal(daysUntilExpirationYmd(null, "2030-01-01"), null)

// --- Financing audit hash (reuse compliance pepper pipeline) ---
const fh = buildComplianceAuditImmutableHash({ a: 1, z: 2, summary: "fin" })
assert.equal(fh, buildComplianceAuditImmutableHash({ z: 2, a: 1, summary: "fin" }))

// --- Migration append-only audit ---
const mig = readUtf8("supabase/migrations/20261014120000_blitzpay_phase_3d_financing_marketplace.sql")
assert.match(mig, /blitzpay_financing_audit_block_mutation/)
assert.match(mig, /blitzpay_marketplace_financing_providers/)

// --- API gates ---
for (const rel of [
  "app/api/organizations/[organizationId]/blitzpay/financing/providers/route.ts",
  "app/api/organizations/[organizationId]/blitzpay/financing/applications/route.ts",
  "app/api/organizations/[organizationId]/blitzpay/financing/offers/route.ts",
  "app/api/organizations/[organizationId]/blitzpay/financing/provider-matches/route.ts",
  "app/api/organizations/[organizationId]/blitzpay/financing/contractor-advances/route.ts",
  "app/api/organizations/[organizationId]/blitzpay/financing/health/route.ts",
  "app/api/organizations/[organizationId]/blitzpay/financing/applications/[applicationId]/submit/route.ts",
  "app/api/organizations/[organizationId]/blitzpay/financing/applications/[applicationId]/cancel/route.ts",
]) {
  const s = readUtf8(rel)
  assert.match(s, /requireAnyOrgPermission/)
  assert.match(s, /blitzpaySchemaGuardNextResponse/)
  assert.match(s, /UUID_RE/)
}
for (const rel of ["app/api/portal/financing/applications/route.ts", "app/api/portal/financing/offers/route.ts"]) {
  const s = readUtf8(rel)
  assert.match(s, /requirePortalSession/)
}

// --- Bounded caps ---
assert.ok(BLITZPAY_MARKETPLACE_PROVIDER_LIST_CAP > 0 && BLITZPAY_MARKETPLACE_PROVIDER_LIST_CAP < 10_000)
assert.ok(BLITZPAY_FINANCING_APPLICATION_LIST_CAP > 0)
assert.ok(BLITZPAY_FINANCING_OFFER_LIST_CAP > 0)
assert.ok(BLITZPAY_FINANCING_AUDIT_LIST_CAP > 0)

// --- Schema health lists Phase 3D tables ---
const schemaHealth = readUtf8("lib/blitzpay/blitzpay-schema-health.ts")
for (const t of [
  "blitzpay_marketplace_financing_providers",
  "blitzpay_financing_applications",
  "blitzpay_financing_application_offers",
  "blitzpay_contractor_advance_models",
  "blitzpay_financing_audit_log",
  "blitzpay_financing_provider_matches",
]) {
  assert.ok(schemaHealth.includes(`"${t}"`), `schema health lists ${t}`)
}

// --- GL financing COA extension ---
const gl = readUtf8("lib/blitzpay/blitzpay-general-ledger.ts")
assert.ok(gl.includes("BLITZPAY_FINANCING_COA_EXTENSION") && gl.includes("1250"))

// --- Reporting imports financing fields ---
const reporting = readUtf8("lib/blitzpay/blitzpay-reporting-snapshot.ts")
assert.match(reporting, /fetchFinancingMarketplaceReportingFields/)

console.log("blitzpay phase 3d financing marketplace tests passed")
