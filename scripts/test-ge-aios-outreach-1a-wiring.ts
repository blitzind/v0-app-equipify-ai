/**
 * GE-AIOS-OUTREACH-1A — Autonomous revenue loop wiring test.
 *
 * Run: pnpm test:ge-aios-outreach-1a-wiring
 */
import assert from "node:assert/strict"
import { assessGrowthLeadResearchOpportunity } from "@/lib/growth/aios/growth/growth-lead-research-opportunity-assessment"
import { qualifyGrowthLeadResearch } from "@/lib/growth/aios/growth/growth-lead-research-workflow-types"
import {
  GROWTH_AUTONOMOUS_REVENUE_LOOP_1A_QA_MARKER,
  GROWTH_EARLY_OUTREACH_MIN_CONFIDENCE,
  assessGrowthResearchSufficiency,
  isGoodEnoughForEarlyOutreach,
  isGoodEnoughForEarlyOutreachFromRun,
  isResearchCompleteForOutreach,
} from "@/lib/growth/outreach/growth-autonomous-revenue-loop-1a"
import { buildGrowthHomeRuntimeTrustViewModel } from "@/lib/growth/home/growth-home-runtime-trust-presenter-1b"
import { buildHomeMeasurableProgressPresentation } from "@/lib/growth/workspace/executive-briefing/growth-home-operator-experience-live-3b"

const baseResult = {
  companySummary: "Commercial HVAC contractor serving Atlanta metro.",
  websiteSummary: "Service-focused website with fleet and maintenance pages.",
  sourceUrls: ["https://example.com"],
  equipifyFitScore: 62,
  equipifyPainPoints: ["Manual scheduling"],
  outreachAngles: ["Field service automation"],
  equipmentServiceIndicators: ["Fleet maintenance"],
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

assert.equal(qualification.confidence, 0.52)
assert.ok(qualification.fitScore >= 55)

const intelligence = assessGrowthLeadResearchOpportunity({
  result: baseResult,
  qualification,
})

assert.equal(
  intelligence.opportunityAssessment.recommendation,
  "prepare_outreach",
  "50%+ confidence with likely contact should route to outreach prep",
)

assert.ok(
  isResearchCompleteForOutreach({
    fitScore: baseResult.equipifyFitScore,
    confidence: baseResult.researchConfidence,
    missingEvidenceCount: qualification.missingEvidence.length,
    result: baseResult,
  }),
)

assert.ok(
  isGoodEnoughForEarlyOutreach({
    fitScore: baseResult.equipifyFitScore,
    confidence: baseResult.researchConfidence,
    missingEvidenceCount: qualification.missingEvidence.length,
    result: baseResult,
  }),
)

assert.ok(
  isGoodEnoughForEarlyOutreachFromRun({
    researchConfidence: 55,
    websiteMaturityScore: 60,
  }),
)

const packageReadyWithoutDm = assessGrowthResearchSufficiency({
  fitScore: baseResult.equipifyFitScore,
  confidence: baseResult.researchConfidence,
  missingEvidenceCount: qualification.missingEvidence.length,
  result: { ...baseResult, decisionMakerCandidates: [] },
  lead: { country: "US" },
})
assert.equal(packageReadyWithoutDm.decision, "sufficient_for_supervised_outreach")
assert.equal(packageReadyWithoutDm.sendReady, false)

const runtimeTrust = buildGrowthHomeRuntimeTrustViewModel({
  server: null,
  salesOutcomes: {
    qaMarker: "ge-aios-17a-specialist-execution-bridge-v1",
    outcomes: [],
    dailySummary: {
      qaMarker: "ge-aios-17a-specialist-execution-bridge-v1",
      generatedAt: new Date().toISOString(),
      researched: 12,
      qualified: 8,
      strong_opportunities: 3,
      outreach_prepared: 5,
      meetings_prepared: 1,
      approvals_pending: 3,
    },
  },
  activeWork: null,
  pendingApprovals: 3,
  setupIncomplete: false,
  emailsSentToday: 2,
  repliesToday: 1,
  meetingsToday: 1,
})

assert.ok(runtimeTrust.pipelinePace)
assert.equal(runtimeTrust.pipelinePace?.outreachDraftsCreated, 5)
assert.equal(runtimeTrust.pipelinePace?.awaitingApproval, 3)
assert.ok(
  runtimeTrust.heartbeat.some((line) => line.label === "Waiting for approval"),
  "Home heartbeat should surface approval queue",
)

const progress = buildHomeMeasurableProgressPresentation({
  dailySummary: runtimeTrust.pipelinePace
    ? {
        qaMarker: "ge-aios-17a-specialist-execution-bridge-v1",
        generatedAt: new Date().toISOString(),
        researched: 12,
        qualified: 8,
        strong_opportunities: 0,
        outreach_prepared: 5,
        meetings_prepared: 0,
        approvals_pending: 3,
      }
    : null,
  pendingApprovals: 3,
})

assert.equal(progress.items[0]?.label, "Outreach drafts created")

console.log(`[GE-AIOS-OUTREACH-1A] wiring ok — ${GROWTH_AUTONOMOUS_REVENUE_LOOP_1A_QA_MARKER}`)
console.log(`  early outreach confidence floor: ${GROWTH_EARLY_OUTREACH_MIN_CONFIDENCE}`)
console.log(`  recommendation: ${intelligence.opportunityAssessment.recommendation}`)
