/**
 * GE-AIOS-REVENUE-FLOW-RECOVERY-1A — Local wiring test.
 *
 * Run: pnpm test:ge-aios-revenue-flow-recovery-1a-wiring
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { assessGrowthLeadResearchOpportunity } from "@/lib/growth/aios/growth/growth-lead-research-opportunity-assessment"
import { qualifyGrowthLeadResearch } from "@/lib/growth/aios/growth/growth-lead-research-workflow-types"
import {
  GROWTH_AUTONOMOUS_REVENUE_LOOP_1A_QA_MARKER,
  isGoodEnoughForEarlyOutreachFromRun,
} from "@/lib/growth/outreach/growth-autonomous-revenue-loop-1a"
import {
  GROWTH_AIOS_REVENUE_FLOW_RECOVERY_1A_QA_MARKER,
} from "@/lib/growth/training/revenue-flow-recovery-production-validation-1a"
import {
  evaluateGrowthOperationalKeywordValidation,
} from "@/lib/growth/revenue-workflow/growth-operational-keyword-validation-1a"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

const baseResult = {
  companySummary: "Commercial HVAC contractor serving Atlanta metro.",
  websiteSummary: "Service-focused website with fleet and maintenance pages.",
  sourceUrls: ["https://example.com"],
  equipifyFitScore: 62,
  equipifyPainPoints: ["Manual scheduling"],
  outreachAngles: ["Field service automation"],
  equipmentServiceIndicators: ["Fleet maintenance", "HVAC service"],
  decisionMakerCandidates: [{ name: "Jordan Lee", title: "Owner" }],
  recommendedNextAction: "Map buying committee before outreach",
  researchConfidence: 0.52,
  estimatedAnnualRevenue: null,
  fleetSizeEstimate: "25 technicians",
  companySizeEstimate: "mid-market",
  equipifyCaveats: [],
  caveats: [],
  crmDetected: null,
  fitModelVersion: "test",
}

const qualification = qualifyGrowthLeadResearch({
  result: baseResult,
  researchRunStatus: "completed",
}).qualification

const intelligence = assessGrowthLeadResearchOpportunity({
  result: baseResult,
  qualification,
})

assert.equal(intelligence.opportunityAssessment.recommendation, "prepare_outreach")
assert.ok(
  isGoodEnoughForEarlyOutreachFromRun({
    researchConfidence: 55,
    websiteMaturityScore: 60,
  }),
)

const keywordValidation = evaluateGrowthOperationalKeywordValidation({
  companyName: "Acme HVAC Services",
  website: "https://acmehvac.example",
  industry: "HVAC",
  providerKeywords: ["HVAC service"],
  websiteCrawlText: "Commercial HVAC maintenance and fleet service.",
  operationalEvidence: [
    "Commercial HVAC contractor with fleet maintenance operations.",
    "missing online booking",
  ],
  requiredKeywords: ["HVAC"],
})
assert.ok(keywordValidation.pass, keywordValidation.reason ?? "keyword validation should pass with research evidence")

const keywordSource = readSource("lib/growth/revenue-workflow/growth-operational-keyword-validation-1a.ts")
assert.match(keywordSource, /researchRun/)
assert.match(keywordSource, /resolveProviderKeywordOperationalProof/)

const reconcileSource = readSource("lib/growth/revenue-workflow/growth-operational-keyword-validation-server-1a.ts")
assert.match(reconcileSource, /researchRun/)

const aslSource = readSource("lib/growth/specialists/execution/reconcile-asl-prospect-research-outcome-8b4.ts")
assert.match(aslSource, /isGoodEnoughForEarlyOutreachFromRun/)
assert.match(aslSource, /runAutonomousOutreachPreparationManualRequest/)

const validationModule = readSource("lib/growth/training/revenue-flow-recovery-production-validation-1a.ts")
assert.match(validationModule, /runRevenueFlowRecoveryProductionValidation/)
assert.match(validationModule, /applyRevenueFlowRecoveryCorrections/)

console.log(`[GE-AIOS-REVENUE-FLOW-RECOVERY-1A] wiring ok`)
console.log(`  loop marker: ${GROWTH_AUTONOMOUS_REVENUE_LOOP_1A_QA_MARKER}`)
console.log(`  validation marker: ${GROWTH_AIOS_REVENUE_FLOW_RECOVERY_1A_QA_MARKER}`)
console.log(`  recommendation: ${intelligence.opportunityAssessment.recommendation}`)
