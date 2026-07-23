/**
 * GE-AIOS-INVESTMENT-PROPAGATION-1B-EXECUTION-CLOSURE — Bounded action enforcement certification.
 *
 * Run: pnpm test:ge-aios-investment-propagation-1b-execution-closure
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { qualifyGrowthLeadResearch } from "@/lib/growth/aios/growth/growth-lead-research-workflow-types"
import { assessGrowthLeadResearchOpportunity } from "@/lib/growth/aios/growth/growth-lead-research-opportunity-assessment"
import { shouldAutoQueueLeadResearch } from "@/lib/growth/research/growth-lead-research-readiness"
import {
  assessGrowthResearchSufficiency,
  buildResearchSufficiencyInputFromAssessment,
  GROWTH_RESEARCH_SUFFICIENCY_MAX_TARGETED_PASSES,
  isPackageReadyFromSufficiency,
  isSendReadyFromSufficiency,
} from "@/lib/growth/research/growth-research-sufficiency-1a"
import {
  authorizeSpendForInvestmentState,
  evaluateResourceAllocationFacade,
} from "@/lib/growth/resource-allocation/resource-allocation-facade-engine"
import { buildResourceAllocationSignalsFromLead } from "@/lib/growth/resource-allocation/resource-allocation-signal-builders"
import {
  buildAdmissionPolicyMetadataFromSufficiency,
  GROWTH_ADMISSION_POLICY_1A_QA_MARKER,
} from "@/lib/growth/revenue-workflow/growth-admission-policy-1a"
import {
  isGenericResearchAction,
  shouldQueueSpecificBoundedResearchAction,
} from "@/lib/growth/revenue-workflow/growth-investment-propagation-1b"
import {
  applyBoundedResearchExecutionPlan,
  buildBoundedResearchCompletionMetadataPatch,
  buildBoundedResearchInProgressMetadataPatch,
  buildBoundedResearchOperatorProjection,
  evaluateBoundedResearchExecutionGate,
  rejectGenericBoundedResearchAction,
  resolveTargetedResearchPassesUsedForReconcile,
  selectNextBoundedResearchAction,
  shouldQueueSpecificBoundedResearchActionByKey,
} from "@/lib/growth/revenue-workflow/growth-investment-propagation-1b-execution-closure"
import { planGrowthLeadResearchExecution } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"

const PHASE = "GE-AIOS-INVESTMENT-PROPAGATION-1B-EXECUTION-CLOSURE" as const
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
    }),
  )
}

function buildBoundedMetadata(
  missingEvidence: string[],
  extra: Record<string, unknown> = {},
) {
  const sufficiency = sufficiencyFromResult(
    baseResult({
      outreachAngles: [],
      equipifyPainPoints: [],
      equipmentServiceIndicators: [],
      websiteSummary: null,
      sourceUrls: [],
    }),
  )
  assert.equal(sufficiency.decision, "targeted_research_required")
  return {
    admission_state: "review",
    requires_human_review: true,
    admission_policy_qa_marker: GROWTH_ADMISSION_POLICY_1A_QA_MARKER,
    ...buildAdmissionPolicyMetadataFromSufficiency(sufficiency),
    admission_targeted_research_missing_evidence: missingEvidence,
    admission_max_additional_investment: GROWTH_RESEARCH_SUFFICIENCY_MAX_TARGETED_PASSES,
    ...extra,
  }
}

function minimalExecutionPlanInput(nextBestAction: {
  label: string
  kind: "continue_research"
}) {
  return {
    nextBestAction: {
      ...nextBestAction,
      reason: "test",
      priority: "medium" as const,
      urgency: "low" as const,
    },
    opportunityAssessment: {
      opportunityScore: 55,
      fitScore: 55,
      buyingSignalScore: 40,
      confidence: 0.5,
      estimatedRevenueRange: null,
      estimatedSalesCycle: "medium",
      urgency: "medium",
      effort: "medium",
      roiEstimate: "medium",
      recommendation: "continue_research",
      worthPursuing: true,
      summary: "test",
    },
    evidenceSummary: {
      verifiedEvidence: ["Verified website"],
      missingEvidence: ["verified_company_identity"],
      potentialRisks: [],
      assumptions: [],
      humanReviewNotes: [],
    },
    qualification: {
      fitScore: 55,
      confidence: 0.5,
      missingEvidence: ["verified_company_identity"],
      qualificationStatus: "needs_research",
      reasons: [],
    },
  }
}

runGate("Fixture A — One authorized identity action selected and queued once", () => {
  const metadata = buildBoundedMetadata(["verified_company_identity"])
  const gate = evaluateBoundedResearchExecutionGate(metadata)
  assert.equal(gate.mode, "bounded")
  assert.equal(gate.authorized, true)
  assert.equal(gate.selection?.actionKey, "verify_company_identity")
  assert.equal(gate.selection?.missingEvidenceTarget, "verified_company_identity")
  assert.deepEqual(metadata.admission_bounded_actions_completed, undefined)
  assert.equal(shouldAutoQueueLeadResearch({ status: "new", website: "https://example.com", metadata }), true)
  const inProgress = buildBoundedResearchInProgressMetadataPatch(gate.selection!)
  assert.equal(
    (inProgress.admission_bounded_action_in_progress as Record<string, unknown>).actionKey,
    "verify_company_identity",
  )
})

runGate("Fixture B — Unauthorized action rejected", () => {
  const metadata = buildBoundedMetadata(["verified_company_identity"])
  assert.equal(shouldQueueSpecificBoundedResearchActionByKey(metadata, "verify_us_territory"), false)
  assert.equal(shouldQueueSpecificBoundedResearchAction(metadata, "Confirm United States operating presence"), false)
})

runGate("Fixture C — Generic action rejected for bounded execution", () => {
  const metadata = buildBoundedMetadata(["verified_company_identity"])
  assert.equal(rejectGenericBoundedResearchAction("research company"), true)
  assert.equal(isGenericResearchAction("gather more data"), true)
  assert.equal(shouldQueueSpecificBoundedResearchAction(metadata, "research company"), false)
  const gate = evaluateBoundedResearchExecutionGate(metadata)
  const plan = applyBoundedResearchExecutionPlan({
    metadata,
    executionPlan: planGrowthLeadResearchExecution(
      minimalExecutionPlanInput({ label: "Research company", kind: "continue_research" }),
    ),
  })
  assert.equal(plan.nextBestAction, "Verify official company identity")
  assert.notEqual(plan.nextBestAction, "Research company")
})

runGate("Fixture D — Completed action not queued again", () => {
  const metadata = buildBoundedMetadata(["verified_company_identity"], {
    admission_bounded_actions_completed: ["verify_company_identity"],
    admission_targeted_research_passes_used: 1,
  })
  assert.equal(selectNextBoundedResearchAction(metadata), null)
  assert.equal(shouldAutoQueueLeadResearch({ status: "new", website: "https://example.com", metadata }), false)
  const passes = resolveTargetedResearchPassesUsedForReconcile({
    existingMetadata: metadata,
    researchRun: { id: "run-dup", status: "completed", signals: { boundedResearchActionKey_1b: "verify_company_identity" } },
  })
  assert.equal(passes, 1)
})

runGate("Fixture E — Two authorized actions deterministic ordering", () => {
  const metadata = buildBoundedMetadata(["defensible_outreach_angle", "verified_company_identity"])
  const first = selectNextBoundedResearchAction(metadata)
  assert.equal(first?.actionKey, "verify_company_identity")
  assert.equal(shouldQueueSpecificBoundedResearchActionByKey(metadata, "identify_outreach_angle"), false)
})

runGate("Fixture F — Successful completion persists action key and consumes pass once", () => {
  const metadata = buildBoundedMetadata(["verified_company_identity"])
  const patch = buildBoundedResearchCompletionMetadataPatch({
    existingMetadata: metadata,
    completion: {
      actionKey: "verify_company_identity",
      runId: "run-f-1",
      missingEvidenceTarget: "verified_company_identity",
      completedAt: "2026-07-23T12:00:00.000Z",
      outcome: "semantic_success",
    },
  })
  assert.deepEqual(patch.admission_bounded_actions_completed, ["verify_company_identity"])
  assert.equal(patch.admission_targeted_research_passes_used, 1)
  assert.deepEqual(patch.admission_bounded_research_runs_consumed, ["run-f-1"])
  assert.equal(patch.admission_bounded_action_in_progress, null)
})

runGate("Fixture G — Duplicate completion event is idempotent", () => {
  const metadata = buildBoundedMetadata(["verified_company_identity"], {
    admission_bounded_actions_completed: ["verify_company_identity"],
    admission_targeted_research_passes_used: 1,
    admission_bounded_research_runs_consumed: ["run-g-1"],
  })
  const patch = buildBoundedResearchCompletionMetadataPatch({
    existingMetadata: metadata,
    completion: {
      actionKey: "verify_company_identity",
      runId: "run-g-1",
      missingEvidenceTarget: "verified_company_identity",
      completedAt: "2026-07-23T12:00:00.000Z",
      outcome: "semantic_success",
    },
  })
  assert.equal(patch.admission_targeted_research_passes_used, 1)
  assert.deepEqual(patch.admission_bounded_actions_completed, ["verify_company_identity"])
})

runGate("Fixture H — Transient failure not marked complete", () => {
  const metadata = buildBoundedMetadata(["verified_company_identity"], {
    admission_bounded_action_in_progress: {
      actionKey: "verify_company_identity",
      missingEvidenceTarget: "verified_company_identity",
    },
  })
  const passes = resolveTargetedResearchPassesUsedForReconcile({
    existingMetadata: metadata,
    researchRun: { id: "run-h-1", status: "failed", signals: { boundedResearchActionKey_1b: "verify_company_identity" } },
  })
  assert.equal(passes, 0)
  assert.equal(metadata.admission_bounded_actions_completed, undefined)
})

runGate("Fixture I — Evidence sufficient stops bounded queueing", () => {
  const sufficiency = sufficiencyFromResult(baseResult({ researchConfidence: 0.92, equipifyFitScore: 88 }))
  const metadata = {
    admission_state: "review",
    admission_policy_qa_marker: GROWTH_ADMISSION_POLICY_1A_QA_MARKER,
    ...buildAdmissionPolicyMetadataFromSufficiency(sufficiency),
    package_ready: isPackageReadyFromSufficiency(sufficiency),
    send_ready: isSendReadyFromSufficiency(sufficiency),
  }
  const gate = evaluateBoundedResearchExecutionGate(metadata)
  assert.notEqual(gate.authorized, true)
  assert.equal(shouldAutoQueueLeadResearch({ status: "new", website: "https://example.com", metadata }), false)
})

runGate("Fixture J — Budget exhausted blocks selection", () => {
  const metadata = buildBoundedMetadata(["verified_company_identity"], {
    admission_targeted_research_passes_used: GROWTH_RESEARCH_SUFFICIENCY_MAX_TARGETED_PASSES,
    admission_max_additional_investment: 0,
  })
  assert.equal(selectNextBoundedResearchAction(metadata), null)
  const projection = buildBoundedResearchOperatorProjection(metadata)
  assert.equal(projection.exhausted, true)
  const signals = buildResourceAllocationSignalsFromLead({
    id: "lead-j",
    status: "review",
    metadata,
  } as never)
  const ra = evaluateResourceAllocationFacade({
    organizationId: ORG_ID,
    accountId: "lead-j",
    resourceClass: "website_research",
    signals,
  })
  assert.equal(ra.investment_state, "pending_investment")
})

runGate("Fixture K — Terminal evidence rejects bounded execution", () => {
  const metadata = {
    admission_state: "rejected",
    admission_policy_qa_marker: GROWTH_ADMISSION_POLICY_1A_QA_MARKER,
    research_sufficiency_decision: "terminal_reject",
    admission_targeted_research_missing_evidence: ["verified_company_identity"],
    admission_max_additional_investment: 2,
  }
  const gate = evaluateBoundedResearchExecutionGate(metadata)
  assert.equal(gate.authorized, false)
  assert.equal(gate.reason, "terminal_reject")
})

runGate("Fixture L — Package-ready without DM allows package progression, blocks transport", () => {
  const sufficiency = sufficiencyFromResult(baseResult({ researchConfidence: 0.9, equipifyFitScore: 90 }), {
    country: "US",
    website: "https://example.com",
  })
  const metadata = {
    admission_state: "review",
    admission_policy_qa_marker: GROWTH_ADMISSION_POLICY_1A_QA_MARKER,
    ...buildAdmissionPolicyMetadataFromSufficiency(sufficiency),
    package_ready: true,
    send_ready: false,
  }
  assert.equal(isPackageReadyFromSufficiency(sufficiency), true)
  assert.equal(isSendReadyFromSufficiency(sufficiency), false)
  const signals = buildResourceAllocationSignalsFromLead({
    id: "lead-l",
    status: "review",
    metadata,
    prospectRecommendedNextAction: "prepare_outreach",
  } as never)
  const outbound = evaluateResourceAllocationFacade({
    organizationId: ORG_ID,
    accountId: "lead-l",
    resourceClass: "voice_generation",
    signals,
  })
  assert.equal(authorizeSpendForInvestmentState(outbound.investment_state, "outbound"), false)
})

runGate("Fixture M — Legacy review record without policy metadata stays legacy", () => {
  const metadata = { admission_state: "review", requires_human_review: true }
  const gate = evaluateBoundedResearchExecutionGate(metadata)
  assert.equal(gate.mode, "legacy")
  assert.equal(gate.authorized, true)
})

runGate("Fixture N — Outbound disabled; research wiring remains transport-safe", () => {
  const executionSource = readFileSync("lib/growth/research/growth-lead-research-execution-service.ts", "utf8")
  assert.match(executionSource, /evaluateBoundedResearchExecutionGate/)
  assert.doesNotMatch(executionSource, /outbound.*enabled/i)
  const reconcileSource = readFileSync(
    "lib/growth/revenue-workflow/growth-operational-keyword-validation-server-1a.ts",
    "utf8",
  )
  assert.match(reconcileSource, /buildBoundedResearchCompletionMetadataPatchForRun/)
  assert.match(reconcileSource, /resolveTargetedResearchPassesUsedForReconcile/)
})

runGate("Execution plan preserves evidence target linkage", () => {
  const metadata = buildBoundedMetadata(["operational_fit"])
  const gate = evaluateBoundedResearchExecutionGate(metadata)
  const plan = applyBoundedResearchExecutionPlan({
    metadata,
    executionPlan: planGrowthLeadResearchExecution(
      minimalExecutionPlanInput({ label: "generic", kind: "continue_research" }),
    ),
  })
  assert.ok(plan.requiredEvidence.includes("operational_fit"))
  assert.ok(plan.requiredEvidence.some((entry) => entry.startsWith("bounded_action:")))
  assert.equal(gate.selection?.actionKey, "inspect_services_for_operational_fit")
})

runGate("Opportunity assessment applies bounded execution plan when metadata present", () => {
  const metadata = buildBoundedMetadata(["verified_company_identity"])
  const qualification = qualifyGrowthLeadResearch({
    result: baseResult() as never,
    researchRunStatus: "succeeded",
  }).qualification
  const intelligence = assessGrowthLeadResearchOpportunity({
    result: baseResult() as never,
    qualification,
    leadMetadata: metadata,
  })
  assert.equal(intelligence.executionPlan.workflowType, "research_company")
  assert.ok(intelligence.executionPlan.requiredEvidence.includes("verified_company_identity"))
})

console.log(`[${PHASE}] PASS`)
