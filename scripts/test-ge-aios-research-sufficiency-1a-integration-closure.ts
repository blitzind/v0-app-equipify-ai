/**
 * GE-AIOS-RESEARCH-SUFFICIENCY-1A-INTEGRATION-CLOSURE — Agent-chain alignment certification.
 *
 * Run: pnpm test:ge-aios-research-sufficiency-1a-integration-closure
 */
import assert from "node:assert/strict"
import { assessGrowthLeadResearchOpportunity } from "@/lib/growth/aios/growth/growth-lead-research-opportunity-assessment"
import { qualifyGrowthLeadResearch } from "@/lib/growth/aios/growth/growth-lead-research-workflow-types"
import { isInternalMutationRuntimeWorkflow } from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-types"
import { resolveEarliestIncompleteDurableStage } from "@/lib/growth/draft-factory/draft-factory-durable-engine"
import type { AiOsDraftFactoryCanonicalEvidence } from "@/lib/growth/draft-factory/draft-factory-durable-types"
import {
  assessGrowthResearchSufficiency,
  assessGrowthResearchSufficiencyFromLead,
  buildResearchSufficiencyInputFromAssessment,
  isPackageReadyFromSufficiency,
  isSendReadyFromSufficiency,
} from "@/lib/growth/research/growth-research-sufficiency-1a"
import { authorizeSpendForInvestmentState } from "@/lib/growth/resource-allocation/resource-allocation-facade-engine"

const PHASE = "GE-AIOS-RESEARCH-SUFFICIENCY-1A-INTEGRATION-CLOSURE" as const

function runGate(label: string, fn: () => void): void {
  fn()
  console.log(`  ✓ ${label}`)
}

function baseResult(overrides: Record<string, unknown> = {}) {
  return {
    companySummary: "Regional commercial HVAC contractor.",
    websiteSummary: "Commercial HVAC maintenance and dispatch.",
    likelyServiceCategory: "HVAC",
    serviceAreaClues: ["Midwest"],
    companySizeEstimate: "40-60",
    equipmentServiceIndicators: ["fleet dispatch"],
    equipifyPainPoints: ["dispatch efficiency"],
    equipifyFitScore: 62,
    outreachAngles: ["fleet optimization"],
    recommendedNextAction: "Verify contacts",
    researchConfidence: 0.86,
    sourceUrls: ["https://example.com/services"],
    caveats: [],
    fitModelVersion: "v3",
    decisionMakerCandidates: [],
    estimatedAnnualRevenue: "$1.2M",
    estimatedEmployeeCount: "40-60",
    fleetSizeEstimate: "35 trucks",
    crmDetected: null,
    fieldServiceStackDetected: null,
    ...overrides,
  }
}

function packageReadyLead(overrides: Record<string, unknown> = {}) {
  return {
    companyName: "Metro HVAC Services",
    website: "https://metro-hvac.example/services",
    country: "US",
    score: 62,
    contactEmail: null,
    contactName: null,
    primaryDecisionMakerId: null,
    decisionMakerStatus: null,
    metadata: {
      research_summary: "Commercial HVAC maintenance and dispatch operations.",
      website_summary: "Preventive maintenance and commercial HVAC service pages.",
      suggested_pitch_angle: "Field service automation",
    },
    ...overrides,
  }
}

function dfEvidence(partial: Partial<AiOsDraftFactoryCanonicalEvidence>): AiOsDraftFactoryCanonicalEvidence {
  return {
    admitted: true,
    researchCurrent: true,
    knowledgeComplete: true,
    stopInvestment: false,
    portfolioSelected: true,
    decisionMakerAvailable: false,
    contactVerifiedForEmail: false,
    personalizationReady: true,
    draftValid: false,
    approved: false,
    rejected: false,
    ...partial,
  }
}

function orchestratorPackageReadyProjection(
  lead: ReturnType<typeof packageReadyLead>,
  workflowStatus: string | null = null,
): boolean {
  if (workflowStatus === "assessed" || workflowStatus === "qualified" || workflowStatus === "research_complete") {
    return true
  }
  return isPackageReadyFromSufficiency(assessGrowthResearchSufficiencyFromLead(lead as never))
}

console.log(`[${PHASE}] Integration closure certification`)

runGate("Fixture A — internal dry-run workflow remains verify_email", () => {
  const internalResult = baseResult({ equipifyFitScore: 52 })
  const qualification = qualifyGrowthLeadResearch({ result: internalResult as never, researchRunStatus: "succeeded" })
  const intelligence = assessGrowthLeadResearchOpportunity({
    result: internalResult as never,
    qualification: qualification.qualification,
  })
  assert.equal(intelligence.opportunityAssessment.recommendation, "verify_contacts")
  assert.equal(intelligence.executionPlan.workflowType, "verify_email")
  assert.equal(isInternalMutationRuntimeWorkflow(intelligence.executionPlan.workflowType), true)
})

runGate("Fixture B — package-ready without decision maker (orchestrator projection)", () => {
  const sufficiency = assessGrowthResearchSufficiencyFromLead(packageReadyLead() as never)
  assert.equal(sufficiency.packageReady, true)
  assert.equal(sufficiency.sendReady, false)
  assert.ok(orchestratorPackageReadyProjection(packageReadyLead()))
  assert.equal(isSendReadyFromSufficiency(sufficiency), false)
})

runGate("Fixture C — package-ready with operator approval still pending", () => {
  const stage = resolveEarliestIncompleteDurableStage(
    dfEvidence({
      researchSufficientForPackage: true,
      sendReady: false,
      investmentState: "increase_investment",
      spendAuthorized: true,
    }),
  )
  assert.equal(stage, "generation")
  assert.equal(isInternalMutationRuntimeWorkflow("outreach_generation"), false)
})

runGate("Fixture D — send-ready evidence still blocks outbound transport", () => {
  const result = baseResult({
    decisionMakerCandidates: [
      {
        fullName: "Jordan Lee",
        title: "Owner",
        email: "owner@example.com",
        phone: null,
        linkedinUrl: null,
        confidence: 0.9,
        evidenceExcerpt: null,
      },
    ],
  })
  const qualification = qualifyGrowthLeadResearch({ result: result as never, researchRunStatus: "succeeded" })
  const sufficiency = assessGrowthResearchSufficiency(
    buildResearchSufficiencyInputFromAssessment({
      result: result as never,
      qualification: qualification.qualification,
      lead: {
        country: "US",
        contactEmail: "owner@example.com",
        contactName: "Jordan Lee",
        decisionMakerStatus: "verified_contactable",
      } as never,
    }),
  )
  assert.equal(isSendReadyFromSufficiency(sufficiency), true)
  assert.equal(authorizeSpendForInvestmentState("increase_investment", "outbound"), false)
})

runGate("Fixture E — package-ready path is separate from internal dry-run", () => {
  const packageResult = baseResult({ equipifyFitScore: 78 })
  const qualification = qualifyGrowthLeadResearch({ result: packageResult as never, researchRunStatus: "succeeded" })
  const intelligence = assessGrowthLeadResearchOpportunity({
    result: packageResult as never,
    qualification: qualification.qualification,
  })
  assert.equal(intelligence.opportunityAssessment.recommendation, "prepare_outreach")
  assert.equal(intelligence.executionPlan.workflowType, "outreach_generation")
  assert.equal(isInternalMutationRuntimeWorkflow(intelligence.executionPlan.workflowType), false)
})

console.log(`[${PHASE}] PASS`)
