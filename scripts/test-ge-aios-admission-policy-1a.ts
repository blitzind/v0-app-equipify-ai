/**
 * GE-AIOS-ADMISSION-POLICY-1A — Research Sufficiency → Admission alignment certification.
 *
 * Run: pnpm test:ge-aios-admission-policy-1a
 */
import assert from "node:assert/strict"
import { qualifyGrowthLeadResearch } from "@/lib/growth/aios/growth/growth-lead-research-workflow-types"
import { resolveEarliestIncompleteDurableStage } from "@/lib/growth/draft-factory/draft-factory-durable-engine"
import type { AiOsDraftFactoryCanonicalEvidence } from "@/lib/growth/draft-factory/draft-factory-durable-types"
import {
  assessGrowthResearchSufficiency,
  buildResearchSufficiencyInputFromAssessment,
} from "@/lib/growth/research/growth-research-sufficiency-1a"
import {
  applyResearchSufficiencyAdmissionPolicy,
  buildAdmissionPolicyMetadataFromSufficiency,
  buildResearchSufficiencyDecisionForPostResearchAdmission,
  GROWTH_ADMISSION_POLICY_1A_QA_MARKER,
  resolveLegacyAdmissionPolicyRead,
} from "@/lib/growth/revenue-workflow/growth-admission-policy-1a"
import {
  evaluateGrowthLeadAdmission,
  resolveLeadAdmissionStateFromMetadata,
} from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import { buildAdmissionSignalFromLeadMetadata } from "@/lib/growth/resource-allocation/resource-allocation-signal-builders"
import { projectInvestmentStateFromSignals } from "@/lib/growth/resource-allocation/resource-allocation-facade-engine"
import { GROWTH_EARLY_OUTREACH_MIN_CONFIDENCE } from "@/lib/growth/outreach/growth-autonomous-revenue-loop-1a"

const PHASE = "GE-AIOS-ADMISSION-POLICY-1A" as const

const SAMPLE_PROFILE = {
  company: {
    companyName: "Equipify",
    website: "https://equipify.example",
    shortDescription: "Field service software",
    productsServices: ["CMMS", "field service"],
    businessModel: "B2B SaaS",
    primaryValueProposition: "Equipment service operations",
  },
  idealCustomers: {
    targetIndustries: ["medical equipment service", "biomedical repair", "hvac"],
    companySizeRanges: ["11-50", "51-200"],
    geography: ["United States"],
    buyerPersonas: ["Owner", "Operations Manager"],
    disqualifiers: ["consumer retail only"],
  },
  problemsAndTriggers: {
    painPoints: ["manual dispatch"],
    buyingTriggers: ["equipment downtime"],
    competitorsAlternatives: [],
    keywords: ["medical equipment service", "hvac maintenance"],
    negativeKeywords: ["consumer retail only"],
  },
  salesAndMarketing: {
    averageDealSize: null,
    salesCycleEstimate: null,
    messagingAngles: [],
    qualificationCriteria: ["service business"],
  },
  confidence: {
    score: 85,
    assumptions: [],
    missingInformation: [],
  },
} as const

function runGate(label: string, fn: () => void): void {
  fn()
  console.log(`  ✓ ${label}`)
}

function baseResult(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  }
}

function sufficiencyFromResult(
  result: ReturnType<typeof baseResult>,
  lead: Record<string, unknown> = { country: "US" },
  extra: {
    providerIndustryLabel?: string | null
    researchTimeBudgetExhausted?: boolean
    targetedResearchPassesUsed?: number
    fitScore?: number
    confidence?: number
    missingEvidenceCount?: number
  } = {},
) {
  const qualification = qualifyGrowthLeadResearch({
    result: result as never,
    researchRunStatus: "succeeded",
  }).qualification
  const input = buildResearchSufficiencyInputFromAssessment({
    result: result as never,
    qualification: {
      ...qualification,
      fitScore: extra.fitScore ?? qualification.fitScore,
      confidence: extra.confidence ?? qualification.confidence,
      missingEvidence:
        extra.missingEvidenceCount != null
          ? Array.from({ length: extra.missingEvidenceCount }, (_, index) => `gap_${index + 1}`)
          : qualification.missingEvidence,
    },
    lead: lead as never,
    providerIndustryLabel: extra.providerIndustryLabel,
    researchTimeBudgetExhausted: extra.researchTimeBudgetExhausted,
    targetedResearchPassesUsed: extra.targetedResearchPassesUsed,
  })
  return assessGrowthResearchSufficiency(input)
}

function evaluateWithSufficiency(input: {
  intake: Parameters<typeof evaluateGrowthLeadAdmission>[0]
  sufficiency: ReturnType<typeof assessGrowthResearchSufficiency>
  keywordPass?: boolean
  industryGatePassed?: boolean
}) {
  return evaluateGrowthLeadAdmission(
    input.intake,
    { approvedProfile: SAMPLE_PROFILE as never },
    {
      operationalKeywordValidation:
        input.keywordPass == null
          ? null
          : {
              pass: input.keywordPass,
              reason: input.keywordPass ? null : "operational keywords missing",
            },
      prospectSearchIndustryGatePassed: input.industryGatePassed ?? true,
      researchSufficiency: input.sufficiency,
    },
  )
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

console.log(`[${PHASE}] Admission policy alignment certification`)

assert.equal(GROWTH_ADMISSION_POLICY_1A_QA_MARKER, "ge-aios-admission-policy-1a-v1")
console.log("  ✓ QA marker exported")

runGate("Fixture A — strong first-party fit, weak provider label", () => {
  const result = baseResult({
    websiteSummary:
      "Commercial HVAC maintenance, preventive maintenance contracts, emergency equipment repair, service agreements, dispatch.",
    equipmentServiceIndicators: ["Commercial HVAC", "Preventive maintenance"],
  })
  const sufficiency = sufficiencyFromResult(result, { country: "US" }, { providerIndustryLabel: "Construction" })
  assert.notEqual(sufficiency.decision, "terminal_reject")

  const admission = evaluateWithSufficiency({
    intake: {
      companyName: "Metro HVAC Services",
      website: "https://metro-hvac.example/services",
      domain: "metro-hvac.example",
      industry: "Construction",
      email: "ops@metro-hvac.example",
      contactName: "Alex Morgan",
      identityUncertain: false,
      source: "datamoon",
      metadata: {},
    },
    sufficiency,
    keywordPass: false,
    industryGatePassed: false,
  })

  assert.notEqual(admission.state, "rejected")
  assert.ok(["accepted", "review"].includes(admission.state))
  assert.ok(
    admission.reasons.some((reason) =>
      /profile_aligned|operator_review|first_party|admission_evidence|insufficient_first_party/.test(reason),
    ),
  )
})

runGate("Fixture B — strong provider label, contradictory website", () => {
  const result = baseResult({
    websiteSummary: "Consumer retail storefront with online shopping only.",
    outreachAngles: [],
    equipifyPainPoints: [],
    equipmentServiceIndicators: [],
    sourceUrls: ["https://example.com/shop"],
    equipifyFitScore: 72,
    researchConfidence: 0.62,
  })
  const sufficiency = sufficiencyFromResult(result, { country: "US" }, { providerIndustryLabel: "Medical equipment service" })
  assert.notEqual(sufficiency.decision, "sufficient_for_supervised_outreach")
  assert.equal(sufficiency.packageReady, false)

  const admission = evaluateWithSufficiency({
    intake: {
      companyName: "Retail Shop LLC",
      website: "https://retail-shop.example/shop",
      domain: "retail-shop.example",
      industry: "Medical equipment service",
      email: "info@retail-shop.example",
      contactName: "Owner",
      identityUncertain: false,
      source: "datamoon",
      metadata: {},
    },
    sufficiency,
    keywordPass: true,
    industryGatePassed: true,
  })

  assert.notEqual(admission.state, "accepted")
})

runGate("Fixture C — valid company, decision maker missing", () => {
  const sufficiency = sufficiencyFromResult(baseResult())
  assert.equal(sufficiency.decision, "sufficient_for_supervised_outreach")
  assert.equal(sufficiency.packageReady, true)
  assert.equal(sufficiency.sendReady, false)
  assert.ok(
    sufficiency.decision === "sufficient_for_supervised_outreach" &&
      sufficiency.optionalEvidenceMissing.includes("named_decision_maker"),
  )

  const admission = evaluateWithSufficiency({
    intake: {
      companyName: "Metro HVAC Services",
      website: "https://metro-hvac.example/services",
      domain: "metro-hvac.example",
      industry: "HVAC",
      email: "ops@metro-hvac.example",
      contactName: null,
      identityUncertain: false,
      source: "datamoon",
      metadata: {},
    },
    sufficiency,
    keywordPass: true,
    industryGatePassed: true,
  })

  assert.equal(admission.state, "accepted")
  assert.ok(admission.reasons.includes("decision_maker_optional_for_admission"))
  assert.ok(!admission.reasons.some((reason) => /missing_decision_maker/.test(reason)))
})

runGate("Fixture D — verified contact missing", () => {
  const sufficiency = sufficiencyFromResult(baseResult())
  assert.equal(sufficiency.sendReady, false)

  const admission = evaluateWithSufficiency({
    intake: {
      companyName: "Metro HVAC Services",
      website: "https://metro-hvac.example/services",
      domain: "metro-hvac.example",
      industry: "HVAC",
      email: null,
      contactName: null,
      identityUncertain: false,
      source: "datamoon",
      metadata: {},
    },
    sufficiency,
    keywordPass: true,
    industryGatePassed: true,
  })

  assert.equal(admission.state, "accepted")
  assert.ok(admission.reasons.includes("contact_verification_optional_for_admission"))

  const stage = resolveEarliestIncompleteDurableStage(
    dfEvidence({
      researchSufficientForPackage: true,
      sendReady: false,
      contactVerifiedForEmail: false,
      investmentState: "increase_investment",
      spendAuthorized: true,
    }),
  )
  assert.equal(stage, "generation")
})

runGate("Fixture E — required evidence gap with known next action", () => {
  const result = baseResult({
    outreachAngles: [],
    equipifyPainPoints: [],
    equipmentServiceIndicators: [],
    websiteSummary: null,
    sourceUrls: [],
  })
  const sufficiency = sufficiencyFromResult(result)
  assert.equal(sufficiency.decision, "targeted_research_required")

  const admission = evaluateWithSufficiency({
    intake: {
      companyName: "Metro HVAC Services",
      website: "https://metro-hvac.example",
      domain: "metro-hvac.example",
      industry: "HVAC",
      email: "ops@metro-hvac.example",
      contactName: "Alex Morgan",
      identityUncertain: false,
      source: "datamoon",
      metadata: {},
    },
    sufficiency,
    keywordPass: false,
    industryGatePassed: true,
  })

  assert.equal(admission.state, "review")
  assert.notEqual(admission.state, "rejected")
  const metadata = buildAdmissionPolicyMetadataFromSufficiency(sufficiency)
  assert.ok(Array.isArray(metadata.admission_bounded_next_actions))
  assert.equal(typeof metadata.admission_max_additional_investment, "number")
})

runGate("Fixture F — conflicting evidence", () => {
  const result = baseResult({
    equipifyFitScore: 48,
    researchConfidence: 0.42,
    websiteSummary: "Commercial HVAC maintenance and dispatch operations.",
  })
  const sufficiency = sufficiencyFromResult(result, { country: "US" }, { providerIndustryLabel: "Construction" })
  assert.equal(sufficiency.decision, "operator_review_required")

  const base = evaluateGrowthLeadAdmission(
    {
      companyName: "Metro HVAC Services",
      website: "https://metro-hvac.example/services",
      domain: "metro-hvac.example",
      industry: "Construction",
      email: "ops@metro-hvac.example",
      contactName: "Alex Morgan",
      identityUncertain: false,
      source: "datamoon",
      metadata: {},
    },
    { approvedProfile: SAMPLE_PROFILE as never },
    {
      operationalKeywordValidation: { pass: false, reason: "keyword mismatch" },
      prospectSearchIndustryGatePassed: false,
    },
  )
  assert.equal(base.state, "rejected")

  const aligned = applyResearchSufficiencyAdmissionPolicy({ base, sufficiency })
  assert.equal(aligned.state, "review")
  assert.notEqual(aligned.state, "rejected")
  assert.ok(aligned.reasons.includes("first_party_evidence_conflicts_with_provider_classification"))
})

runGate("Fixture G — true terminal disqualifier", () => {
  const sufficiency = sufficiencyFromResult(baseResult(), { country: "US" }, {
    fitScore: 30,
    confidence: 0.2,
    missingEvidenceCount: 5,
  })
  assert.equal(sufficiency.decision, "terminal_reject")

  const admission = evaluateWithSufficiency({
    intake: {
      companyName: "Unknown Co",
      website: "https://unknown.example",
      domain: "unknown.example",
      industry: "HVAC",
      email: "ops@unknown.example",
      contactName: "Alex Morgan",
      identityUncertain: false,
      source: "datamoon",
      metadata: {},
    },
    sufficiency,
    keywordPass: true,
    industryGatePassed: true,
  })

  assert.equal(admission.state, "rejected")
  const ra = projectInvestmentStateFromSignals({
    organizationId: "org-1",
    accountId: "lead-1",
    resourceClass: "email_drafting",
    signals: {
      admission: buildAdmissionSignalFromLeadMetadata({
        admission_state: admission.state,
        requires_human_review: admission.requiresHumanReview,
      }),
      evidenceConfidence: GROWTH_EARLY_OUTREACH_MIN_CONFIDENCE,
      budgetAvailable: true,
    },
  })
  assert.equal(ra.investment_state, "stop_investment")
})

runGate("Fixture H — high score, missing required operational evidence", () => {
  const result = baseResult({
    equipifyFitScore: 78,
    researchConfidence: 0.82,
    outreachAngles: [],
    equipifyPainPoints: [],
    equipmentServiceIndicators: [],
    websiteSummary: null,
    sourceUrls: [],
    companySummary: "",
  })
  const sufficiency = sufficiencyFromResult(result)
  assert.notEqual(sufficiency.decision, "sufficient_for_supervised_outreach")
  assert.equal(sufficiency.packageReady, false)

  const admission = evaluateWithSufficiency({
    intake: {
      companyName: "Score Only LLC",
      website: "https://score-only.example",
      domain: "score-only.example",
      industry: "HVAC",
      email: "ops@score-only.example",
      contactName: "Alex Morgan",
      identityUncertain: false,
      source: "datamoon",
      metadata: {},
    },
    sufficiency,
    keywordPass: true,
    industryGatePassed: true,
  })

  assert.notEqual(admission.state, "accepted")
})

runGate("Fixture I — low score, strong first-party evidence", () => {
  const result = baseResult({
    equipifyFitScore: 48,
    researchConfidence: 0.52,
    outreachAngles: [],
    equipifyPainPoints: [],
    equipmentServiceIndicators: [],
    websiteSummary: "Commercial HVAC maintenance contracts and dispatch operations.",
  })
  const sufficiency = sufficiencyFromResult(result)
  assert.notEqual(sufficiency.decision, "terminal_reject")

  const admission = evaluateWithSufficiency({
    intake: {
      companyName: "Strong Site HVAC",
      website: "https://strong-site.example/services",
      domain: "strong-site.example",
      industry: "HVAC",
      email: "ops@strong-site.example",
      contactName: "Alex Morgan",
      identityUncertain: false,
      source: "datamoon",
      metadata: {},
    },
    sufficiency,
    keywordPass: false,
    industryGatePassed: false,
  })

  assert.notEqual(admission.state, "rejected")
})

runGate("Fixture J — legacy record without sufficiency fields", () => {
  const legacy = resolveLegacyAdmissionPolicyRead({
    admissionState: resolveLeadAdmissionStateFromMetadata({
      admission_state: "review",
      admission_reasons: ["pending_operational_keyword_validation"],
    }),
    metadata: {
      admission_state: "review",
      admission_reasons: ["pending_operational_keyword_validation"],
      admission_qa_marker: "ge-aios-21c-lead-admission-gate-v1",
    },
  })
  assert.equal(legacy.admissionState, "review")
  assert.equal(legacy.sufficiencyDecision, null)
  assert.equal(legacy.hasPolicyMetadata, false)
})

runGate("Post-research sufficiency builder projects provider label", () => {
  const decision = buildResearchSufficiencyDecisionForPostResearchAdmission({
    lead: {
      companyName: "Metro HVAC Services",
      website: "https://metro-hvac.example/services",
      industry: "Construction",
      metadata: { provider_industry: "Construction" },
      score: 62,
      country: "US",
      contactEmail: "ops@metro-hvac.example",
      contactName: "Alex Morgan",
      primaryDecisionMakerId: null,
      decisionMakerStatus: null,
    },
    researchRun: {
      researchSummary: "Commercial HVAC maintenance and preventive service contracts.",
      suggestedPitchAngle: "Field service automation",
      recommendedNextAction: "Prepare outreach draft",
      industryGuess: "Construction",
      detectedTechnologies: [],
      signals: { pain_signals: ["dispatch efficiency"] },
      equipifyFitScore: 62,
      researchConfidence: 0.52,
    },
    websiteCrawlText: "Commercial HVAC maintenance, emergency repair, service agreements.",
  })
  assert.notEqual(decision.decision, "terminal_reject")
})

console.log(`[${PHASE}] PASS`)
