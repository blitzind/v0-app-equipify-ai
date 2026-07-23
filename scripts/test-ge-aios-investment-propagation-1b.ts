/**
 * GE-AIOS-INVESTMENT-PROPAGATION-1B — Bounded research investment certification.
 *
 * Run: pnpm test:ge-aios-investment-propagation-1b
 */
import assert from "node:assert/strict"
import { qualifyGrowthLeadResearch } from "@/lib/growth/aios/growth/growth-lead-research-workflow-types"
import {
  assessGrowthResearchSufficiency,
  buildResearchSufficiencyInputFromAssessment,
  GROWTH_RESEARCH_SUFFICIENCY_MAX_TARGETED_PASSES,
  isPackageReadyFromSufficiency,
  isSendReadyFromSufficiency,
} from "@/lib/growth/research/growth-research-sufficiency-1a"
import { shouldAutoQueueLeadResearch } from "@/lib/growth/research/growth-lead-research-readiness"
import {
  authorizeSpendForInvestmentState,
  evaluateResourceAllocationFacade,
  projectInvestmentStateFromSignals,
} from "@/lib/growth/resource-allocation/resource-allocation-facade-engine"
import { buildResourceAllocationSignalsFromLead } from "@/lib/growth/resource-allocation/resource-allocation-signal-builders"
import {
  applyResearchSufficiencyAdmissionPolicy,
  buildAdmissionPolicyMetadataFromSufficiency,
  GROWTH_ADMISSION_POLICY_1A_QA_MARKER,
} from "@/lib/growth/revenue-workflow/growth-admission-policy-1a"
import {
  evaluateGrowthLeadAdmission,
} from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import {
  buildBoundedResearchSignalProjectionFromMetadata,
  filterSpecificAuthorizedActions,
  GROWTH_BOUNDED_RESEARCH_INVESTMENT_UNIT,
  GROWTH_INVESTMENT_PROPAGATION_1B_QA_MARKER,
  isGenericResearchAction,
  mapMissingEvidenceToAuthorizedActions,
  resolveBoundedResearchAuthorizationFromMetadata,
  shouldAuthorizeBoundedLeadResearch,
  shouldBlockAutonomousResearchForPolicyMetadata,
  shouldQueueSpecificBoundedResearchAction,
} from "@/lib/growth/revenue-workflow/growth-investment-propagation-1b"
import {
  assessGrowthResearchSufficiencyFromLead,
} from "@/lib/growth/research/growth-research-sufficiency-1a"

const PHASE = "GE-AIOS-INVESTMENT-PROPAGATION-1B" as const
const ORG_ID = "00757488-1026-44a5-aac4-269533ac21be"

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
  lead: Record<string, unknown> = { country: "US", website: "https://metro-hvac.example" },
  extra: {
    targetedResearchPassesUsed?: number
    researchTimeBudgetExhausted?: boolean
    providerIndustryLabel?: string | null
  } = {},
) {
  const qualification = qualifyGrowthLeadResearch({
    result: result as never,
    researchRunStatus: "succeeded",
  }).qualification
  return assessGrowthResearchSufficiency(
    buildResearchSufficiencyInputFromAssessment({
      result: result as never,
      qualification,
      lead: lead as never,
      targetedResearchPassesUsed: extra.targetedResearchPassesUsed,
      researchTimeBudgetExhausted: extra.researchTimeBudgetExhausted,
      providerIndustryLabel: extra.providerIndustryLabel,
    }),
  )
}

function buildLeadMetadataFromSufficiency(
  sufficiency: ReturnType<typeof assessGrowthResearchSufficiency>,
  extra: Record<string, unknown> = {},
) {
  return {
    admission_state: "review",
    requires_human_review: true,
    admission_policy_qa_marker: GROWTH_ADMISSION_POLICY_1A_QA_MARKER,
    ...buildAdmissionPolicyMetadataFromSufficiency(sufficiency),
    ...extra,
  }
}

function projectResearchInvestment(metadata: Record<string, unknown>) {
  const signals = buildResourceAllocationSignalsFromLead(
    {
      metadata,
      status: "new",
      prospectRecommendedNextAction: "Continue research",
      nextBestAction: null,
      lastProspectResearchedAt: null,
      latestProspectResearchRunId: null,
      score: 55,
    },
    { budgetAvailable: true, killSwitchActive: false },
  )
  return projectInvestmentStateFromSignals({
    organizationId: ORG_ID,
    accountId: "lead-test",
    resourceClass: "website_research",
    signals,
  })
}

function projectBillableInvestment(metadata: Record<string, unknown>) {
  const signals = buildResourceAllocationSignalsFromLead(
    {
      metadata,
      status: "new",
      prospectRecommendedNextAction: "Continue research",
      nextBestAction: null,
      lastProspectResearchedAt: null,
      latestProspectResearchRunId: null,
      score: 55,
    },
    { budgetAvailable: true, killSwitchActive: false },
  )
  return evaluateResourceAllocationFacade({
    organizationId: ORG_ID,
    accountId: "lead-test",
    resourceClass: "email_drafting",
    signals,
  })
}

console.log(`[${PHASE}] Bounded research investment certification`)
assert.equal(GROWTH_INVESTMENT_PROPAGATION_1B_QA_MARKER, "ge-aios-investment-propagation-1b-v1")
assert.equal(GROWTH_BOUNDED_RESEARCH_INVESTMENT_UNIT, "targeted_research_pass")
console.log("  ✓ QA marker + canonical budget unit exported")

runGate("Fixture A — terminal reject stops investment", () => {
  const sufficiency = sufficiencyFromResult(
    baseResult({ equipifyFitScore: 12, websiteSummary: null, sourceUrls: [] }),
  )
  assert.equal(sufficiency.decision, "terminal_reject")
  const metadata = buildLeadMetadataFromSufficiency(sufficiency, { admission_state: "rejected" })
  const research = projectResearchInvestment(metadata)
  assert.equal(research.investment_state, "stop_investment")
  assert.equal(shouldAuthorizeBoundedLeadResearch(metadata), false)
  assert.equal(shouldAutoQueueLeadResearch({ website: "https://example.com", status: "new", metadata, lastProspectResearchedAt: null, latestProspectResearchRunId: null, lastResearchedAt: null, latestResearchRunId: null }), false)
})

runGate("Fixture B — operator review only pending investment", () => {
  const sufficiency = sufficiencyFromResult(
    baseResult({
      equipifyFitScore: 48,
      researchConfidence: 0.42,
      websiteSummary: "Commercial HVAC maintenance and dispatch operations.",
    }),
    { country: "US" },
    { providerIndustryLabel: "Construction" },
  )
  assert.equal(sufficiency.decision, "operator_review_required")
  const metadata = buildLeadMetadataFromSufficiency(sufficiency)
  const research = projectResearchInvestment(metadata)
  assert.equal(research.investment_state, "pending_investment")
  assert.equal(shouldAuthorizeBoundedLeadResearch(metadata), false)
  assert.equal(shouldBlockAutonomousResearchForPolicyMetadata(metadata), true)
})

runGate("Fixture C — targeted identity research bounded increase", () => {
  const result = baseResult({
    outreachAngles: [],
    equipifyPainPoints: [],
    equipmentServiceIndicators: [],
    websiteSummary: null,
    sourceUrls: [],
  })
  const sufficiency = sufficiencyFromResult(result)
  assert.equal(sufficiency.decision, "targeted_research_required")
  const metadata = buildLeadMetadataFromSufficiency(sufficiency, {
    admission_targeted_research_missing_evidence: ["verified_company_identity"],
  })
  const auth = resolveBoundedResearchAuthorizationFromMetadata(metadata)
  assert.equal(auth.authorized, true)
  assert.ok(auth.authorizedActions.includes("verify official domain"))
  assert.ok(auth.investmentRemaining > 0)
  const research = projectResearchInvestment(metadata)
  assert.equal(research.investment_state, "increase_investment")
  assert.ok(research.reason.includes("Bounded targeted research"))
  assert.equal(
    authorizeSpendForInvestmentState(research.investment_state, "low_cost"),
    true,
  )
})

runGate("Fixture D — targeted operational-fit actions remain specific", () => {
  const metadata = buildLeadMetadataFromSufficiency(
    sufficiencyFromResult(
      baseResult({
        outreachAngles: [],
        equipifyPainPoints: [],
        equipmentServiceIndicators: [],
      }),
    ),
    {
      admission_targeted_research_missing_evidence: ["operational_fit"],
    },
  )
  const auth = resolveBoundedResearchAuthorizationFromMetadata(metadata)
  assert.ok(auth.authorizedActions.includes("inspect services page"))
  assert.ok(auth.authorizedActions.includes("inspect maintenance offerings"))
  assert.equal(isGenericResearchAction("research company"), true)
  assert.equal(filterSpecificAuthorizedActions(["research company", "inspect services page"]).length, 1)
  assert.equal(shouldQueueSpecificBoundedResearchAction(metadata, "inspect services page"), true)
  assert.equal(shouldQueueSpecificBoundedResearchAction(metadata, "research company"), false)
})

runGate("Fixture E — budget exhausted pending without reset", () => {
  const metadata = {
    admission_state: "review",
    requires_human_review: true,
    admission_policy_qa_marker: GROWTH_ADMISSION_POLICY_1A_QA_MARKER,
    research_sufficiency_decision: "targeted_research_required",
    admission_targeted_research_missing_evidence: ["operational_fit"],
    admission_bounded_next_actions: ["inspect services page"],
    admission_max_additional_investment: 0,
    admission_targeted_research_passes_used: GROWTH_RESEARCH_SUFFICIENCY_MAX_TARGETED_PASSES,
    package_ready: false,
    send_ready: false,
  }
  const auth = resolveBoundedResearchAuthorizationFromMetadata(metadata)
  assert.equal(auth.investmentRemaining, 0)
  assert.equal(auth.authorized, false)
  const research = projectResearchInvestment(metadata)
  assert.equal(research.investment_state, "pending_investment")
  assert.ok(research.blocking_conditions.includes("bounded_research_exhausted"))
})

runGate("Fixture F — evidence sufficient stops bounded research", () => {
  const sufficiency = sufficiencyFromResult(
    baseResult({
      equipifyFitScore: 78,
      researchConfidence: 0.82,
      websiteSummary:
        "Commercial HVAC maintenance contracts, preventive maintenance, emergency repair, dispatch operations.",
      equipmentServiceIndicators: ["Commercial HVAC", "Preventive maintenance"],
      outreachAngles: ["Reduce downtime with preventive maintenance automation"],
    }),
  )
  assert.equal(sufficiency.decision, "sufficient_for_supervised_outreach")
  assert.equal(isPackageReadyFromSufficiency(sufficiency), true)
  const admission = applyResearchSufficiencyAdmissionPolicy({
    base: {
      state: "review",
      reasons: ["pending_operational_keyword_validation"],
      allowLeadCreation: true,
      allowAutoResearch: true,
      leadStatus: "new",
      requiresHumanReview: true,
      blockers: ["admission_review_required"],
      sanitized: {
        companyName: "Metro HVAC",
        domain: "metro-hvac.example",
        website: "https://metro-hvac.example",
      },
    },
    sufficiency,
  })
  assert.equal(admission.state, "accepted")
  const metadata = {
    admission_state: "accepted",
    ...buildAdmissionPolicyMetadataFromSufficiency(sufficiency),
  }
  const research = projectResearchInvestment(metadata)
  assert.notEqual(research.investment_state, "increase_investment")
  const billable = projectBillableInvestment(metadata)
  assert.equal(billable.investment_state, "increase_investment")
})

runGate("Fixture G — terminal after research stops investment", () => {
  const sufficiency = assessGrowthResearchSufficiency({
    fitScore: 10,
    confidence: 0.1,
    missingEvidenceCount: 4,
  })
  assert.equal(sufficiency.decision, "terminal_reject")
  const metadata = buildLeadMetadataFromSufficiency(sufficiency, { admission_state: "rejected" })
  assert.equal(projectResearchInvestment(metadata).investment_state, "stop_investment")
  assert.equal(resolveBoundedResearchAuthorizationFromMetadata(metadata).authorized, false)
})

runGate("Fixture H — package-ready without decision maker", () => {
  const sufficiency = sufficiencyFromResult(
    baseResult({
      equipifyFitScore: 78,
      researchConfidence: 0.8,
      websiteSummary:
        "Commercial HVAC maintenance, preventive maintenance contracts, emergency repair, dispatch.",
      equipmentServiceIndicators: ["Commercial HVAC"],
      outreachAngles: ["Maintenance contract automation"],
      decisionMakerCandidates: [],
    }),
  )
  assert.equal(isPackageReadyFromSufficiency(sufficiency), true)
  assert.equal(isSendReadyFromSufficiency(sufficiency), false)
  const metadata = {
    admission_state: "accepted",
    ...buildAdmissionPolicyMetadataFromSufficiency(sufficiency),
  }
  const billable = projectBillableInvestment(metadata)
  assert.equal(billable.investment_state, "increase_investment")
  assert.equal(billable.spend_authorized, true)
  assert.equal(metadata.send_ready, false)
})

runGate("Fixture I — duplicate action prevention", () => {
  const metadata = buildLeadMetadataFromSufficiency(
    sufficiencyFromResult(baseResult({ outreachAngles: [], sourceUrls: [] })),
    {
      admission_targeted_research_missing_evidence: ["verified_company_identity", "operational_fit"],
      admission_bounded_actions_completed: ["verify_company_identity"],
    },
  )
  const auth = resolveBoundedResearchAuthorizationFromMetadata(metadata)
  assert.equal(auth.authorizedActions.includes("verify official domain"), false)
  assert.ok(auth.authorizedActions.length > 0)
  assert.equal(
    shouldQueueSpecificBoundedResearchAction(metadata, "verify official domain"),
    false,
  )
})

runGate("Fixture J — legacy review record safe pending", () => {
  const metadata = { admission_state: "review", requires_human_review: true }
  const projection = buildBoundedResearchSignalProjectionFromMetadata(metadata)
  assert.equal(projection.researchSufficiencyDecision, null)
  assert.equal(projection.boundedResearchAuthorization, null)
  assert.equal(shouldAuthorizeBoundedLeadResearch(metadata), false)
  const research = projectResearchInvestment(metadata)
  assert.equal(research.investment_state, "pending_investment")
})

runGate("Fixture K — technical failure respects budget semantics", () => {
  const metadata = {
    admission_state: "review",
    requires_human_review: true,
    admission_policy_qa_marker: GROWTH_ADMISSION_POLICY_1A_QA_MARKER,
    research_sufficiency_decision: "targeted_research_required",
    admission_targeted_research_missing_evidence: ["operational_fit"],
    admission_bounded_next_actions: ["inspect services page"],
    admission_max_additional_investment: 1,
    admission_targeted_research_passes_used: 1,
    package_ready: false,
    send_ready: false,
  }
  const auth = resolveBoundedResearchAuthorizationFromMetadata(metadata)
  assert.equal(auth.attemptCount, 1)
  assert.equal(auth.maxAttempts, GROWTH_RESEARCH_SUFFICIENCY_MAX_TARGETED_PASSES)
  assert.equal(auth.investmentRemaining, 1)
  assert.equal(auth.authorized, true)
})

runGate("Fixture L — outbound remains blocked", () => {
  const metadata = {
    admission_state: "accepted",
    package_ready: true,
    send_ready: true,
    research_sufficiency_decision: "sufficient_for_supervised_outreach",
    admission_policy_qa_marker: GROWTH_ADMISSION_POLICY_1A_QA_MARKER,
  }
  const signals = buildResourceAllocationSignalsFromLead(
    {
      metadata,
      status: "new",
      prospectRecommendedNextAction: "prepare_outreach",
      nextBestAction: null,
      lastProspectResearchedAt: "2026-07-20T00:00:00.000Z",
      latestProspectResearchRunId: "run-1",
      score: 90,
    },
    {
      budgetAvailable: true,
      killSwitchActive: false,
      researchSufficientForPackage: true,
    },
  )
  const outbound = evaluateResourceAllocationFacade({
    organizationId: ORG_ID,
    accountId: "lead-test",
    resourceClass: "voice_generation",
    signals,
  })
  assert.equal(authorizeSpendForInvestmentState(outbound.investment_state, "outbound"), false)
  assert.equal(outbound.spend_authorized, false)
})

runGate("Evidence-to-action mapping rejects generic actions", () => {
  const actions = mapMissingEvidenceToAuthorizedActions(["verified_company_identity"])
  assert.ok(actions.includes("confirm legal business identity"))
  assert.equal(isGenericResearchAction("Resolve verified company identity"), true)
  assert.equal(isGenericResearchAction("inspect services page"), false)
})

runGate("Admission reconcile path persists pass consumption marker", () => {
  const source = require("node:fs").readFileSync(
    "lib/growth/revenue-workflow/growth-operational-keyword-validation-server-1a.ts",
    "utf8",
  )
  assert.match(source, /admission_targeted_research_passes_used/)
  assert.match(source, /targetedResearchPassesUsed/)
})

runGate("Ava orchestrator uses canonical package readiness", () => {
  const source = require("node:fs").readFileSync(
    "lib/growth/ava-home/growth-ava-research-orchestrator-service.ts",
    "utf8",
  )
  assert.match(source, /isPackageReadyFromSufficiency/)
  assert.match(source, /assessGrowthResearchSufficiencyFromLead/)
})

console.log(`[${PHASE}] PASS`)
