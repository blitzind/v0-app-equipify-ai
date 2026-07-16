/**
 * GE-AIOS-FIRST-CUSTOMER-PORTFOLIO-INTAKE-1D — Local certification.
 * Run: pnpm test:ge-aios-first-customer-portfolio-intake-1d
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  assertAllNonPromotedClassified,
  buildClassificationSummary,
  COMPLETED_RUN_ORPHAN_INTAKE_TRACE,
  projectIntakeThroughputFromEvidence,
  splitPromotionCorrectness,
} from "../lib/growth/training/portfolio-intake-survivor-classification-1d"
import {
  GROWTH_AIOS_FIRST_CUSTOMER_PORTFOLIO_INTAKE_1D_QA_MARKER,
  type PortfolioIntakeSurvivorInventoryRow,
} from "../lib/growth/training/portfolio-intake-survivor-types-1d"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function sampleRow(
  overrides: Partial<PortfolioIntakeSurvivorInventoryRow>,
): PortfolioIntakeSurvivorInventoryRow {
  return {
    survivorKey: "run:company",
    canonicalCompanyKey: "company",
    company: "Acme",
    website: "acme.com",
    runId: "run",
    audienceId: "1",
    discoveryDate: "2026-07-16T00:00:00.000Z",
    score: 0.5,
    runRank: 1,
    runSurvivorCount: 2,
    batchSizeAtRun: 25,
    researchStatus: "none",
    leadStatus: "not_promoted",
    leadId: null,
    admissionStatus: null,
    classification: "bug",
    promotionCorrect: false,
    decisionTrace: COMPLETED_RUN_ORPHAN_INTAKE_TRACE,
    notes: "",
    ...overrides,
  }
}

console.log(`[${GROWTH_AIOS_FIRST_CUSTOMER_PORTFOLIO_INTAKE_1D_QA_MARKER}] Portfolio intake certification\n`)

const rows: PortfolioIntakeSurvivorInventoryRow[] = [
  sampleRow({
    survivorKey: "r1:c1",
    classification: "promoted_to_lead",
    leadStatus: "promoted",
    promotionCorrect: null,
    leadId: "lead-1",
  }),
  sampleRow({
    survivorKey: "r2:c2",
    classification: "duplicate_company",
    promotionCorrect: true,
  }),
  sampleRow({
    survivorKey: "r3:c3",
    classification: "bug",
    promotionCorrect: false,
  }),
]

const summary = buildClassificationSummary(rows)
assert.equal(summary.find((row) => row.classification === "duplicate_company")?.count, 1)
assert.equal(summary.find((row) => row.classification === "bug")?.count, 1)
console.log("  ✓ Classification summary excludes promoted")

const check = assertAllNonPromotedClassified(rows)
assert.equal(check.nonPromotedTotal, 2)
assert.equal(check.ok, true)
console.log("  ✓ All non-promoted survivors classified")

const split = splitPromotionCorrectness(rows)
assert.equal(split.incorrectlyNotPromoted.length, 1)
console.log("  ✓ Correct vs incorrect split")

const projection = projectIntakeThroughputFromEvidence({
  uniqueCanonicalSurvivors: 10,
  promotedLeads: 2,
  incorrectlyNotPromoted: 1,
  currentResearchStarted: 1,
  currentOutreachEligible: 1,
  currentPackagesReady: 1,
  incorrectBugCount: 1,
})
assert.equal(projection.leadsCreated, 3)
console.log("  ✓ Throughput projection uses evidence only")

const auditSource = readSource("lib/growth/training/portfolio-intake-production-audit-1d.ts")
assert.match(auditSource, /INTAKE_PENDING_RESUME_TRACE/)
assert.match(auditSource, /executeBulkPushToLeadInbox/)
assert.doesNotMatch(auditSource, /autonomy_outbound_enabled: true/)
console.log("  ✓ Production audit traces canonical promotion path")

const probeSource = readSource("scripts/probe-ge-aios-first-customer-portfolio-intake-1d.ts")
assert.match(probeSource, /EQUIPIFY_PRODUCTION_ORG_ID/)
console.log("  ✓ Production probe wired")

console.log(`\nPASS ${GROWTH_AIOS_FIRST_CUSTOMER_PORTFOLIO_INTAKE_1D_QA_MARKER}`)
console.log("Run pnpm probe:ge-aios-first-customer-portfolio-intake-1d for production survivor data")
