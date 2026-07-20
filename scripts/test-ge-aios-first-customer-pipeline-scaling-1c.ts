/**
 * GE-AIOS-FIRST-CUSTOMER-PIPELINE-SCALING-1C — Local certification.
 * Run: pnpm test:ge-aios-first-customer-pipeline-scaling-1c
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildPipelineFunnelStages,
  findLargestDropOff,
  projectWeeklyQualifiedOpportunities,
  assessDailySupervisedSalesReadiness,
  GROWTH_AIOS_FIRST_CUSTOMER_PIPELINE_SCALING_1C_QA_MARKER,
} from "../lib/growth/training/pipeline-scaling-funnel-metrics-1c"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

console.log(`[${GROWTH_AIOS_FIRST_CUSTOMER_PIPELINE_SCALING_1C_QA_MARKER}] Pipeline scaling certification\n`)

const stages = buildPipelineFunnelStages(
  {
    provider_records: 1000,
    preview_records: 800,
    normalized_companies: 120,
    after_duplicate_removal: 120,
    prospect_search_acceptance: 15,
    leads_created: 2,
    research_started: 2,
    admission_accepted: 1,
    admission_review: 1,
    outreach_eligible: 1,
  },
  [
    { id: "provider_records", label: "Provider records" },
    { id: "preview_records", label: "Preview records" },
    { id: "normalized_companies", label: "Normalized companies" },
    { id: "after_duplicate_removal", label: "After duplicate removal" },
    { id: "prospect_search_acceptance", label: "Prospect Search acceptance" },
    { id: "leads_created", label: "Leads created" },
    { id: "research_started", label: "Research started" },
    { id: "admission_accepted", label: "Admission accepted" },
    { id: "admission_review", label: "Admission review" },
    { id: "outreach_eligible", label: "Outreach eligible" },
  ],
)

const dropOff = findLargestDropOff(stages)
assert.ok(dropOff)
assert.equal(dropOff!.stageId, "prospect_search_acceptance")
console.log("  ✓ Funnel metrics — largest drop-off detection")

const capacity = projectWeeklyQualifiedOpportunities({
  outreachEligiblePerRun: 0.5,
  completedRunsPerWeek: 2,
  expectedImprovementMultiplier: 2,
})
assert.equal(capacity.currentPerWeek, 1)
assert.equal(capacity.projectedPerWeek, 2)
console.log("  ✓ Capacity projection — evidence-based math")

const notReady = assessDailySupervisedSalesReadiness({
  outreachEligibleLeads: 1,
  packagesReady: 1,
  minWeeklyQualified: 3,
  currentWeeklyQualified: 1,
})
assert.equal(notReady.ready, false)
console.log("  ✓ Supervised readiness — blocks on insufficient pipeline")

const auditSource = readSource("lib/growth/training/pipeline-scaling-production-audit-1c.ts")
assert.match(auditSource, /explainProspectSearchFilterDrop/)
assert.match(auditSource, /applyDatamoonProviderIndustryIcpBridge/)
assert.match(auditSource, /isLeadInPortfolioOrganizationScope/)
assert.match(auditSource, /classifyGrowthLeadAdmissionDrift/)
assert.doesNotMatch(auditSource, /autonomy_outbound_enabled: true/)
console.log("  ✓ Production audit — uses canonical gates, no outbound enable")

const probeSource = readSource("scripts/probe-ge-aios-first-customer-pipeline-scaling-1c.ts")
assert.match(probeSource, /EQUIPIFY_PRODUCTION_ORG_ID/)
console.log("  ✓ Production probe wired")

console.log(`\nPASS ${GROWTH_AIOS_FIRST_CUSTOMER_PIPELINE_SCALING_1C_QA_MARKER}`)
console.log("Run pnpm probe:ge-aios-first-customer-pipeline-scaling-1c for production funnel data")
