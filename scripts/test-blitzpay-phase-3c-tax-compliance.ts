/**
 * BlitzPay Phase 3C — tax & compliance foundations (deterministic helpers + static guards; no DB).
 * Run: pnpm test:blitzpay-phase-3c-tax-compliance
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { buildComplianceAuditImmutableHash } from "../lib/blitzpay/blitzpay-compliance-audit"
import { estimateEmployerPayrollTaxCents } from "../lib/blitzpay/blitzpay-payroll-tax-estimates"
import {
  BLITZPAY_COMPLIANCE_AUDIT_LIST_CAP,
  BLITZPAY_TAX_CALCULATION_LIST_CAP,
  BLITZPAY_TAX_JURISDICTION_LIST_CAP,
  BLITZPAY_TAX_RULE_LIST_CAP,
  calculateTaxCentsFromRule,
  computeComplianceRiskScore0to100,
  computeConvenienceFeeExposureRisk0to100,
  computeFilingReadinessScore0to100,
  computeVendor1099Readiness0to100,
  evaluateConvenienceFeeEligibility,
  isAchAuthorizationRetained,
  jurisdictionTypePrecedenceRank,
  parseConvenienceFeePolicyFromRuleMetadata,
  resolveActiveTaxRulesForAppliesTo,
  type TaxRuleRowInput,
} from "../lib/blitzpay/blitzpay-tax-engine"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_ROOT = path.resolve(__dirname, "..")

function readUtf8(rel: string): string {
  return fs.readFileSync(path.join(APP_ROOT, rel), "utf8")
}

function baseRule(over: Partial<TaxRuleRowInput>): TaxRuleRowInput {
  return {
    id: over.id ?? "00000000-0000-4000-8000-000000000001",
    jurisdiction_id: over.jurisdiction_id ?? "10000000-0000-4000-8000-000000000001",
    jurisdiction_type: over.jurisdiction_type ?? "state",
    tax_rule_type: over.tax_rule_type ?? "sales_tax",
    calculation_method: over.calculation_method ?? "percentage",
    rate_basis_points: over.rate_basis_points ?? 600,
    flat_amount_cents: over.flat_amount_cents ?? null,
    threshold_amount_cents: over.threshold_amount_cents ?? null,
    applies_to: over.applies_to ?? "invoice",
    effective_start_date: over.effective_start_date ?? "2020-01-01",
    effective_end_date: over.effective_end_date ?? null,
    compliance_status: over.compliance_status ?? "active",
  }
}

// --- Jurisdiction precedence rank (more local = higher rank number) ---
assert.ok(jurisdictionTypePrecedenceRank("city") > jurisdictionTypePrecedenceRank("state"))

// --- Rule resolution: locality before broader; newer effective_start before older at same locality ---
const rState = baseRule({
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  jurisdiction_id: "20000000-0000-4000-8000-000000000001",
  jurisdiction_type: "state",
  effective_start_date: "2019-06-01",
})
const rCityOlder = baseRule({
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  jurisdiction_id: "30000000-0000-4000-8000-000000000001",
  jurisdiction_type: "city",
  effective_start_date: "2018-01-01",
})
const rCityNewer = baseRule({
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  jurisdiction_id: "40000000-0000-4000-8000-000000000001",
  jurisdiction_type: "city",
  effective_start_date: "2022-01-01",
})
const resolved = resolveActiveTaxRulesForAppliesTo([rState, rCityOlder, rCityNewer], "invoice", "2026-01-15")
assert.deepEqual(
  resolved.map((x) => x.id),
  [rCityNewer.id, rCityOlder.id, rState.id],
  "deterministic: city rules (newer start first) then state",
)

// --- Archived / out-of-range rules excluded ---
const rArchived = baseRule({
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  compliance_status: "archived",
})
const rFuture = baseRule({
  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  effective_start_date: "2030-01-01",
})
assert.equal(resolveActiveTaxRulesForAppliesTo([rArchived, rFuture], "invoice", "2026-01-01").length, 0)

// --- Deterministic tax math (integer cents / bps) ---
const pct = calculateTaxCentsFromRule(12_345, baseRule({ calculation_method: "percentage", rate_basis_points: 825 }))
assert.equal(pct.taxCents, Math.round((12_345 * 825) / 10_000))
assert.equal(pct.effectiveBps, 825)

const flat = calculateTaxCentsFromRule(50_000, baseRule({ calculation_method: "flat", flat_amount_cents: 199 }))
assert.equal(flat.taxCents, 199)

const th = calculateTaxCentsFromRule(
  20_000,
  baseRule({
    calculation_method: "threshold",
    threshold_amount_cents: 5_000,
    rate_basis_points: 1000,
  }),
)
assert.equal(th.taxCents, 1_500)

const tiered = calculateTaxCentsFromRule(99, baseRule({ calculation_method: "tiered" }))
assert.equal(tiered.taxCents, 0)

// --- Convenience fee policy ---
assert.equal(parseConvenienceFeePolicyFromRuleMetadata(null), "allowed")
assert.equal(parseConvenienceFeePolicyFromRuleMetadata({ convenience_fee_policy: "Prohibited" }), "prohibited")
const cond = evaluateConvenienceFeeEligibility("conditional", {})
assert.equal(cond.permitted, false)
assert.ok(cond.warningCode)
const condOk = evaluateConvenienceFeeEligibility("conditional", { disclosureAcknowledged: true })
assert.equal(condOk.permitted, true)

// --- Payroll tax estimate ---
assert.equal(estimateEmployerPayrollTaxCents(100_000, 765), 7_650)
assert.equal(estimateEmployerPayrollTaxCents(100_000, 50_001), 100_000)

// --- Filing readiness / risk / 1099 / ACH / convenience-fee exposure (bounded 0–100) ---
const filing = computeFilingReadinessScore0to100({
  jurisdictionsConfigured: 2,
  activeTaxRules: 3,
  vendor1099ReadinessPct: 80,
  achCoveragePct: 50,
})
assert.equal(filing, 45)

const risk = computeComplianceRiskScore0to100({
  convenienceFeeExposureRisk: 50,
  overdueComplianceFlags: 2,
  voidedCalculationRatioPct: 10,
})
assert.equal(risk, 39)

assert.equal(computeVendor1099Readiness0to100(false, null), 100)
assert.equal(
  computeVendor1099Readiness0to100(true, {
    tax_profile_status: "complete",
    w9_received_at: "2026-01-01T00:00:00Z",
    tin_reference_hash: "h",
  }),
  100,
)

const frozen = new Date("2030-01-01T00:00:00Z").getTime()
assert.equal(
  isAchAuthorizationRetained({
    authorization_status: "active",
    expires_at: "2029-12-31T23:59:59Z",
    revoked_at: null,
    nowMs: frozen,
  }),
  false,
)
assert.equal(
  isAchAuthorizationRetained({
    authorization_status: "active",
    expires_at: null,
    revoked_at: null,
    nowMs: frozen,
  }),
  true,
)

assert.equal(computeConvenienceFeeExposureRisk0to100("prohibited", true), 85)
assert.equal(
  computeVendor1099Readiness0to100(true, {
    tax_profile_status: "flagged",
    w9_received_at: "2026-01-01T00:00:00Z",
    tin_reference_hash: "h",
  }),
  55,
)

// --- Immutable audit hash: key order independent; content-sensitive ---
const h1 = buildComplianceAuditImmutableHash({ b: 2, a: 1, summary: "x" })
const h2 = buildComplianceAuditImmutableHash({ a: 1, b: 2, summary: "x" })
assert.equal(h1, h2)
assert.notEqual(h1, buildComplianceAuditImmutableHash({ a: 1, b: 2, summary: "y" }))

// --- Migration immutability guards ---
const mig = readUtf8("supabase/migrations/20261013120000_blitzpay_phase_3c_tax_compliance.sql")
assert.match(mig, /blitzpay_compliance_audit_block_mutation/)
assert.match(mig, /blitzpay_tax_rules_archived_immutable/)

// --- API gates (financial permissions + schema guard + UUID org gate) ---
for (const rel of [
  "app/api/organizations/[organizationId]/blitzpay/tax/jurisdictions/route.ts",
  "app/api/organizations/[organizationId]/blitzpay/tax/rules/route.ts",
  "app/api/organizations/[organizationId]/blitzpay/tax/calculations/route.ts",
  "app/api/organizations/[organizationId]/blitzpay/tax/calculate/route.ts",
  "app/api/organizations/[organizationId]/blitzpay/tax/liabilities/route.ts",
  "app/api/organizations/[organizationId]/blitzpay/compliance/audit-log/route.ts",
  "app/api/organizations/[organizationId]/blitzpay/compliance/health/route.ts",
  "app/api/organizations/[organizationId]/blitzpay/ach-authorizations/route.ts",
  "app/api/organizations/[organizationId]/blitzpay/vendor-tax-profiles/route.ts",
]) {
  const s = readUtf8(rel)
  assert.match(s, /requireAnyOrgPermission/)
  assert.match(s, /blitzpaySchemaGuardNextResponse/)
  assert.match(s, /UUID_RE/)
}

// --- Bounded list caps ---
assert.ok(BLITZPAY_TAX_RULE_LIST_CAP > 0 && BLITZPAY_TAX_RULE_LIST_CAP < 10_000)
assert.ok(BLITZPAY_TAX_CALCULATION_LIST_CAP > 0 && BLITZPAY_TAX_CALCULATION_LIST_CAP < 10_000)
assert.ok(BLITZPAY_TAX_JURISDICTION_LIST_CAP > 0 && BLITZPAY_TAX_JURISDICTION_LIST_CAP < 10_000)
assert.ok(BLITZPAY_COMPLIANCE_AUDIT_LIST_CAP > 0 && BLITZPAY_COMPLIANCE_AUDIT_LIST_CAP < 10_000)

// --- Schema health: Phase 3C tables ---
const schemaHealth = readUtf8("lib/blitzpay/blitzpay-schema-health.ts")
for (const t of [
  "blitzpay_tax_jurisdictions",
  "blitzpay_tax_rules",
  "blitzpay_tax_calculations",
  "blitzpay_compliance_audit_log",
  "blitzpay_ach_authorizations",
  "blitzpay_vendor_tax_profiles",
  "blitzpay_tax_liability_snapshots",
]) {
  assert.ok(schemaHealth.includes(`"${t}"`), `schema health lists ${t}`)
}

// --- Default tax COA extension present ---
const gl = readUtf8("lib/blitzpay/blitzpay-general-ledger.ts")
assert.ok(gl.includes("BLITZPAY_TAX_COA_EXTENSION") && gl.includes("2310"))

// --- Reporting snapshot imports tax compliance fields ---
const reporting = readUtf8("lib/blitzpay/blitzpay-reporting-snapshot.ts")
assert.match(reporting, /fetchTaxComplianceReportingFields/)

console.log("blitzpay phase 3c tax compliance tests passed")
