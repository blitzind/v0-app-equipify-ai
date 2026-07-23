/**
 * GE-AIOS-RESEARCH-SUFFICIENCY-1A — Canonical research sufficiency contract certification.
 *
 * Run: pnpm test:ge-aios-research-sufficiency-1a
 */
import assert from "node:assert/strict"
import { assessGrowthLeadResearchOpportunity } from "@/lib/growth/aios/growth/growth-lead-research-opportunity-assessment"
import { qualifyGrowthLeadResearch } from "@/lib/growth/aios/growth/growth-lead-research-workflow-types"
import { resolveEarliestIncompleteDurableStage } from "@/lib/growth/draft-factory/draft-factory-durable-engine"
import type { AiOsDraftFactoryCanonicalEvidence } from "@/lib/growth/draft-factory/draft-factory-durable-types"
import { projectInvestmentStateFromSignals, authorizeSpendForInvestmentState } from "@/lib/growth/resource-allocation/resource-allocation-facade-engine"
import {
  assessGrowthResearchSufficiency,
  GROWTH_RESEARCH_SUFFICIENCY_1A_QA_MARKER,
  hasFirstPartyOperationalEvidence,
  providerClassificationConflictsWithFirstPartyEvidence,
} from "@/lib/growth/research/growth-research-sufficiency-1a"
import {
  GROWTH_EARLY_OUTREACH_MIN_CONFIDENCE,
  GROWTH_EARLY_OUTREACH_MIN_FIT_SCORE,
  isGoodEnoughForEarlyOutreach,
  isResearchCompleteForOutreach,
  isSendReadyFromSufficiency,
} from "@/lib/growth/outreach/growth-autonomous-revenue-loop-1a"

const baseResult = {
  companySummary: "Commercial HVAC contractor serving Atlanta metro.",
  websiteSummary: "Preventive maintenance and commercial HVAC service pages.",
  likelyServiceCategory: "HVAC",
  serviceAreaClues: ["Atlanta"],
  companySizeEstimate: "mid-market",
  equipmentServiceIndicators: ["Fleet maintenance", "Commercial HVAC"],
  equipifyPainPoints: ["Manual scheduling"],
  equipifyFitScore: 62,
  outreachAngles: ["Field service automation"],
  recommendedNextAction: "Prepare outreach draft",
  researchConfidence: 0.52,
  sourceUrls: ["https://example.com/services"],
  caveats: [],
  fitModelVersion: "test",
  decisionMakerCandidates: [],
  estimatedAnnualRevenue: null,
  estimatedEmployeeCount: null,
  fleetSizeEstimate: "25 technicians",
  crmDetected: null,
  fieldServiceStackDetected: null,
}

function sufficiencyInput(overrides: Partial<Parameters<typeof assessGrowthResearchSufficiency>[0]> = {}) {
  return {
    fitScore: 62,
    confidence: 0.52,
    missingEvidenceCount: 0,
    result: baseResult,
    lead: { country: "US" },
    ...overrides,
  }
}

function evidence(partial: Partial<AiOsDraftFactoryCanonicalEvidence>): AiOsDraftFactoryCanonicalEvidence {
  return {
    admitted: true,
    researchCurrent: true,
    knowledgeComplete: true,
    stopInvestment: false,
    portfolioSelected: true,
    decisionMakerAvailable: false,
    contactVerifiedForEmail: false,
    personalizationReady: false,
    draftValid: false,
    approved: false,
    rejected: false,
    ...partial,
  }
}

assert.equal(GROWTH_RESEARCH_SUFFICIENCY_1A_QA_MARKER, "ge-aios-research-sufficiency-1a-v1")

const packageReadyNoDm = assessGrowthResearchSufficiency(sufficiencyInput())
assert.equal(packageReadyNoDm.decision, "sufficient_for_supervised_outreach")
assert.equal(packageReadyNoDm.packageReady, true)
assert.equal(packageReadyNoDm.sendReady, false)
assert.ok(
  packageReadyNoDm.decision === "sufficient_for_supervised_outreach" &&
    packageReadyNoDm.optionalEvidenceMissing.includes("named_decision_maker"),
)

assert.ok(
  isGoodEnoughForEarlyOutreach({
    fitScore: 62,
    confidence: 0.52,
    missingEvidenceCount: 0,
    result: baseResult,
    lead: { country: "US" },
  }),
  "package readiness must not require decision maker",
)

assert.ok(
  isResearchCompleteForOutreach({
    fitScore: 62,
    confidence: 0.52,
    missingEvidenceCount: 0,
    result: baseResult,
    lead: { country: "US" },
  }),
)

const sendReady = assessGrowthResearchSufficiency(
  sufficiencyInput({
    lead: {
      country: "US",
      contactEmail: "owner@example.com",
      contactName: "Jordan Lee",
      decisionMakerStatus: "verified_contactable",
    },
    result: {
      ...baseResult,
      decisionMakerCandidates: [{ fullName: "Jordan Lee", title: "Owner", email: "owner@example.com", phone: null, linkedinUrl: null, confidence: 0.9, evidenceExcerpt: null }],
    },
  }),
)
assert.equal(sendReady.decision, "sufficient_for_supervised_outreach")
assert.equal(sendReady.sendReady, true)
assert.ok(isSendReadyFromSufficiency(sendReady))

const targeted = assessGrowthResearchSufficiency(
  sufficiencyInput({
    fitScore: 62,
    confidence: 0.52,
    missingEvidenceCount: 0,
    result: {
      ...baseResult,
      outreachAngles: [],
      equipifyPainPoints: [],
      equipmentServiceIndicators: [],
      websiteSummary: null,
      sourceUrls: [],
    },
  }),
)
assert.equal(targeted.decision, "targeted_research_required")

const operatorReview = assessGrowthResearchSufficiency(
  sufficiencyInput({
    providerIndustryLabel: "Construction",
    fitScore: 48,
    confidence: 0.42,
  }),
)
assert.equal(operatorReview.decision, "operator_review_required")

const terminal = assessGrowthResearchSufficiency(
  sufficiencyInput({
    fitScore: 30,
    confidence: 0.2,
    missingEvidenceCount: 5,
  }),
)
assert.equal(terminal.decision, "terminal_reject")

assert.ok(
  hasFirstPartyOperationalEvidence(baseResult),
  "website service indicators count as tier-1 evidence",
)
assert.ok(
  providerClassificationConflictsWithFirstPartyEvidence({
    providerIndustryLabel: "Construction",
    result: baseResult,
  }),
)

const qualification = qualifyGrowthLeadResearch({
  result: baseResult,
  researchRunStatus: "succeeded",
}).qualification

const intelligence = assessGrowthLeadResearchOpportunity({
  result: baseResult,
  qualification,
})
assert.equal(intelligence.opportunityAssessment.recommendation, "prepare_outreach")

const dfStage = resolveEarliestIncompleteDurableStage(
  evidence({
    researchSufficientForPackage: true,
    personalizationReady: true,
    investmentState: "increase_investment",
    spendAuthorized: true,
  }),
)
assert.equal(dfStage, "generation", "package-ready path skips DM/contact blocking stages")

const dfLegacyStage = resolveEarliestIncompleteDurableStage(
  evidence({
    researchSufficientForPackage: false,
    decisionMakerAvailable: false,
  }),
)
assert.equal(dfLegacyStage, "decision_maker")

const investment = projectInvestmentStateFromSignals({
  organizationId: "org-1",
  accountId: "lead-1",
  resourceClass: "email_drafting",
  signals: {
    admission: { state: "accepted" },
    evidenceConfidence: GROWTH_EARLY_OUTREACH_MIN_CONFIDENCE,
    budgetAvailable: true,
    researchSufficientForPackage: true,
    hasUsableResearch: true,
  },
})
assert.equal(investment.investment_state, "increase_investment")

const packageReadySendBlocked = evidence({
  researchSufficientForPackage: true,
  sendReady: false,
  decisionMakerAvailable: false,
  contactVerifiedForEmail: false,
  personalizationReady: true,
  investmentState: "increase_investment",
  spendAuthorized: true,
})
assert.equal(
  resolveEarliestIncompleteDurableStage(packageReadySendBlocked),
  "generation",
  "package-ready leads may generate without DM/contact stages",
)
assert.equal(packageReadySendBlocked.decisionMakerAvailable, false)
assert.equal(packageReadySendBlocked.contactVerifiedForEmail, false)
assert.equal(packageReadySendBlocked.sendReady, false)

const outboundTransport = projectInvestmentStateFromSignals({
  organizationId: "org-1",
  accountId: "lead-1",
  resourceClass: "voice_generation",
  signals: {
    admission: { state: "accepted" },
    evidenceConfidence: GROWTH_EARLY_OUTREACH_MIN_CONFIDENCE,
    budgetAvailable: true,
    researchSufficientForPackage: true,
    sendReady: false,
    hasUsableResearch: true,
  },
})
assert.ok(
  outboundTransport.blocking_conditions.includes("outbound_requires_separate_approval"),
  "send-not-ready must not authorize outbound transport",
)
assert.equal(
  authorizeSpendForInvestmentState(outboundTransport.investment_state, "outbound"),
  false,
  "outbound cost tier never authorizes transport send from facade",
)

const caseA = assessGrowthResearchSufficiency(
  sufficiencyInput({
    providerIndustryLabel: "Construction",
    result: {
      ...baseResult,
      websiteSummary: "Commercial HVAC maintenance and service contracts.",
    },
  }),
)
assert.notEqual(caseA.decision, "terminal_reject", "provider taxonomy alone must not terminal-reject strong first-party ops evidence")
assert.ok(
  ["sufficient_for_supervised_outreach", "targeted_research_required", "operator_review_required"].includes(
    caseA.decision,
  ),
)

const caseB = assessGrowthResearchSufficiency(
  sufficiencyInput({
    providerIndustryLabel: "HVAC",
    fitScore: 72,
    confidence: 0.62,
    result: {
      ...baseResult,
      websiteSummary: "Online consumer retail store with no field-service operation.",
      outreachAngles: [],
      equipifyPainPoints: [],
      equipmentServiceIndicators: [],
      sourceUrls: ["https://example.com/shop"],
    },
  }),
)
assert.notEqual(caseB.decision, "sufficient_for_supervised_outreach")
assert.equal(caseB.packageReady, false)

const caseC = assessGrowthResearchSufficiency(
  sufficiencyInput({
    fitScore: 48,
    confidence: 0.52,
    result: {
      ...baseResult,
      outreachAngles: [],
      equipifyPainPoints: [],
      equipmentServiceIndicators: [],
      websiteSummary: "Commercial HVAC maintenance contracts and dispatch operations.",
    },
  }),
)
assert.equal(caseC.decision, "targeted_research_required")
assert.equal(caseC.packageReady, false)

const caseD = assessGrowthResearchSufficiency(
  sufficiencyInput({
    fitScore: 72,
    confidence: 0.62,
    result: {
      ...baseResult,
      companySummary: "",
      websiteSummary: null,
      sourceUrls: [],
      outreachAngles: [],
      equipifyPainPoints: [],
      equipmentServiceIndicators: [],
    },
  }),
)
assert.equal(caseD.decision, "targeted_research_required")
assert.equal(caseD.packageReady, false)

console.log(`[GE-AIOS-RESEARCH-SUFFICIENCY-1A] ok — ${GROWTH_RESEARCH_SUFFICIENCY_1A_QA_MARKER}`)
console.log(`  package-ready without DM: ${packageReadyNoDm.decision}`)
console.log(`  send-ready with verified contact: ${sendReady.sendReady}`)
console.log(`  thresholds unchanged: fit>=${GROWTH_EARLY_OUTREACH_MIN_FIT_SCORE}, confidence>=${GROWTH_EARLY_OUTREACH_MIN_CONFIDENCE}`)
