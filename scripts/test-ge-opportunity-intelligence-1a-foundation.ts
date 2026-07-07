/**
 * GE-OPPORTUNITY-INTELLIGENCE-1A — Canonical Opportunity Intelligence layer certification.
 * Run: pnpm test:ge-opportunity-intelligence-1a-foundation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_REVENUE_WORKFLOW_METADATA_KEY,
  GROWTH_REVENUE_WORKFLOW_QA_MARKER,
} from "../lib/growth/revenue-workflow/revenue-workflow-types"
import { GROWTH_REVENUE_EXECUTION_TIMELINE_METADATA_KEY } from "../lib/growth/revenue-execution/revenue-execution-types"
import {
  GROWTH_OPPORTUNITY_INTELLIGENCE_LAYER_QA_MARKER,
  GROWTH_PROSPECT_QUALIFICATION_METADATA_KEY,
  OPPORTUNITY_INTELLIGENCE_DEPENDENCY_GRAPH,
  OPPORTUNITY_INTELLIGENCE_SOURCES,
  availableOpportunityIntelligenceField,
  parseGrowthLeadResearchWorkflowSnapshotFromEvent,
  parsePersistedOpportunityAssessment,
  readProspectQualificationFromLeadMetadata,
  readRevenueExecutionTimelineFromMetadata,
  readRevenueReadinessSnapshotFromMetadata,
  readWorkflowSignalsFromLead,
  unavailableOpportunityIntelligenceField,
} from "../lib/growth/opportunity-intelligence"
import type { GrowthLead } from "../lib/growth/types"

const GROWTH_OPPORTUNITY_INTELLIGENCE_1A_PHASE = "GE-OPPORTUNITY-INTELLIGENCE-1A" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function minimalLead(overrides: Partial<GrowthLead> = {}): GrowthLead {
  return {
    id: "lead-oi-1a",
    sourceKind: "manual",
    sourceDetail: null,
    externalRef: null,
    companyName: "Acme HVAC",
    contactName: "Jane Doe",
    contactEmail: "jane@acme.example",
    contactPhone: null,
    website: "https://acme.example",
    addressLine1: null,
    city: null,
    state: null,
    postalCode: null,
    country: null,
    status: "qualified",
    promotedOrganizationId: null,
    promotedProspectId: null,
    promotedAt: null,
    score: 72,
    notes: null,
    metadata: {},
    latestResearchRunId: null,
    lastResearchedAt: null,
    latestProspectResearchRunId: null,
    lastProspectResearchedAt: null,
    prospectRecommendedNextAction: null,
    researchPriority: "normal",
    callDisposition: null,
    callDispositionAt: null,
    lastCallAt: null,
    followUpAt: null,
    callPriorityScore: null,
    callPriorityTier: null,
    callPriorityComputedAt: null,
    callPriorityOverride: null,
    lastHumanTouchAt: null,
    decisionMakerStatus: "partial",
    primaryDecisionMakerId: null,
    nextBestAction: "run_research",
    nextBestActionReason: "Research stale",
    nextBestActionComputedAt: "2026-07-01T12:00:00.000Z",
    estimatedAnnualRevenue: null,
    estimatedEmployeeCount: null,
    fleetSizeEstimate: null,
    crmDetected: null,
    fieldServiceStackDetected: null,
    momentumScore: null,
    momentumTier: null,
    momentumWhySummary: null,
    momentumComputedAt: null,
    workflowHealth: "healthy",
    workflowHealthReason: "Signals current",
    workflowHealthComputedAt: "2026-07-01T11:00:00.000Z",
    sourceChannel: null,
    sourceCampaign: null,
    sourceImportBatchId: null,
    sourceVendor: null,
    agingDays: null,
    agingBucket: null,
    firstHumanTouchAt: null,
    timeToFirstTouchHours: null,
    contactTemperature: null,
    callAttemptCount: 0,
    voicemailCount: 0,
    connectedCallCount: 0,
    engagementScore: null,
    engagementTier: "warm",
    engagementLastActivityAt: null,
    engagementSummary: null,
    engagementTopSignals: [],
    engagementDormancyExemptUntil: null,
    engagementComputedAt: "2026-07-01T10:00:00.000Z",
    relationshipStrengthScore: null,
    relationshipStrengthTier: "developing",
    relationshipLastMeaningfulTouchAt: null,
    relationshipSummary: null,
    relationshipTopSignals: [],
    relationshipTrend: "stable",
    relationshipPreviousScore: null,
    relationshipOwnerAttentionLevel: "normal",
    relationshipRecoveryAttemptCount: 0,
    relationshipComputedAt: null,
    opportunityReadinessScore: 68,
    opportunityReadinessTier: "warming",
    opportunityReadinessSummary: "Warming account",
    opportunityReadinessTopSignals: [],
    opportunityBlockers: [{ key: "missing_decision_maker", label: "Decision maker not confirmed" }],
    opportunityAccelerators: [],
    opportunityReadinessTrend: "stable",
    opportunityReadinessPreviousScore: null,
    opportunityBuyingSignalStrength: "moderate",
    opportunityReadinessConfidence: 0.6,
    opportunityAgeBucket: "recent",
    opportunityReadinessComputedAt: "2026-07-01T09:00:00.000Z",
    revenueProbabilityScore: null,
    revenueProbabilityTier: null,
    revenueProbabilitySummary: null,
    revenueProbabilityTopSignals: [],
    revenueProbabilityConfidence: 0,
    revenueProbabilityPreviousScore: null,
    revenueTrajectory: "stable",
    revenueProbabilityVolatility: 0,
    forecastContributionWeight: 0,
    forecastAttentionLevel: "normal",
    forecastAttentionLastChangedAt: null,
    revenueForecastComputedAt: null,
    executivePriorityScore: null,
    executivePriorityTier: null,
    executivePrioritySummary: null,
    executivePriorityTopSignals: [],
    executivePriorityVolatility: 0,
    executivePriorityPreviousScore: null,
    intelligenceConflicts: [],
    intelligenceConflictSeverityScore: 0,
    executiveRecommendation: null,
    executiveOwner: null,
    executiveInterventionOpenedAt: null,
    executiveInterventionAgeBucket: "none",
    executiveOperatingComputedAt: null,
    operationalCapacityScore: null,
    operationalCapacityTier: null,
    operationalCapacitySummary: null,
    operationalCapacityTopConstraints: [],
    capacityPressureLevel: 0,
    capacityPressureVolatility: 0,
    protectedPipelineCoverage: 0,
    operationalConstraints: [],
    capacityConflicts: [],
    capacityProtectionRecommendation: null,
    constraintOpenedAt: null,
    constraintAgeBucket: "none",
    capacityRecoveryDirection: "stable",
    operationalCapacityComputedAt: null,
    conversationHealthTier: null,
    conversationSentiment: null,
    conversationUrgencyLevel: null,
    conversationBuyingIntent: null,
    conversationCompetitorPressure: 0,
    conversationMomentum: null,
    conversationTrend: null,
    conversationTopSignals: [],
    conversationObjectionProfile: null,
    conversationResponsePattern: null,
    conversationComputedAt: null,
    recommendedSequencePatternId: null,
    recommendedSequenceConfidence: null,
    recommendedSequenceComputedAt: null,
    recommendedSequenceNextStep: null,
    sequenceFatigueRisk: null,
    sequenceEffectivenessScore: null,
    assignedTo: null,
    assignedAt: null,
    assignedBy: null,
    assignmentSource: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-07-01T12:00:00.000Z",
    createdBy: null,
    ...overrides,
  }
}

async function main(): Promise<void> {
  console.log(`[${GROWTH_OPPORTUNITY_INTELLIGENCE_1A_PHASE}] Opportunity Intelligence layer certification`)

  assert.equal(GROWTH_OPPORTUNITY_INTELLIGENCE_LAYER_QA_MARKER, "growth-opportunity-intelligence-layer-v1")
  assert.ok(OPPORTUNITY_INTELLIGENCE_DEPENDENCY_GRAPH.length >= 10)
  assert.equal(
    OPPORTUNITY_INTELLIGENCE_SOURCES.growthLeadResearchOpportunityAssessment,
    "Growth Lead Research Opportunity Assessment",
  )

  const aggregatorSource = readSource("lib/growth/opportunity-intelligence/opportunity-intelligence-aggregator.ts")
  const forbiddenEngineTokens = [
    "assessGrowthLeadResearchOpportunity",
    "buildProspectQualification",
    "computeRevenueReadiness",
    "computeGrowthLeadNextBestAction",
    "scoreOpportunityRecommendation",
    "runAiDecisionEngine",
    "recomputeGrowthLead",
    "buildNextBestAction",
    "qualifyGrowthLeadResearch",
    "openai",
  ]
  for (const token of forbiddenEngineTokens) {
    assert.equal(
      aggregatorSource.includes(token),
      false,
      `aggregator must not invoke engine token: ${token}`,
    )
  }

  assert.match(aggregatorSource, /readRevenueReadinessSnapshotFromMetadata/)
  assert.match(aggregatorSource, /readProspectQualificationFromLeadMetadata/)
  assert.match(aggregatorSource, /fetchLatestGrowthLeadResearchWorkflowSnapshot/)
  assert.match(aggregatorSource, /listOpportunitySignals/)
  assert.match(aggregatorSource, /listOpportunityRecommendations/)
  assert.doesNotMatch(aggregatorSource, /datamoon|apollo/i)

  const unavailable = unavailableOpportunityIntelligenceField<string>()
  assert.equal(unavailable.available, false)
  assert.equal(unavailable.value, null)

  const available = availableOpportunityIntelligenceField({
    source: OPPORTUNITY_INTELLIGENCE_SOURCES.revenueReadiness,
    computedAt: "2026-07-01T12:00:00.000Z",
    value: "ok",
  })
  assert.equal(available.available, true)
  assert.equal(available.value, "ok")

  const readinessSnapshot = {
    score: 72,
    tier: "qualified" as const,
    summary: "Qualified for human review",
    topPositiveSignals: [{ kind: "buying_signals", label: "2 buying signal(s)", points: 8 }],
    topRisks: [{ kind: "objections", label: "1 unresolved objection", severity: "medium" as const }],
    computedAt: "2026-07-01T12:00:00.000Z",
    qaMarker: GROWTH_REVENUE_WORKFLOW_QA_MARKER,
  }

  const metadata = {
    [GROWTH_REVENUE_WORKFLOW_METADATA_KEY]: readinessSnapshot,
    [GROWTH_REVENUE_EXECUTION_TIMELINE_METADATA_KEY]: [
      {
        id: "rev-1",
        occurredAt: "2026-07-01T11:00:00.000Z",
        category: "revenue_readiness",
        title: "Revenue readiness updated",
        summary: "Score 72",
        metadata: {},
      },
    ],
  }

  assert.deepEqual(readRevenueReadinessSnapshotFromMetadata(metadata), readinessSnapshot)
  assert.equal(readProspectQualificationFromLeadMetadata(metadata), null)
  assert.equal(readRevenueExecutionTimelineFromMetadata(metadata).length, 1)

  const workflowSignals = readWorkflowSignalsFromLead(minimalLead())
  assert.equal(workflowSignals.workflowHealth, "healthy")
  assert.equal(workflowSignals.opportunityReadinessScore, 68)

  const researchPayload = {
    workflow_key: "growth_lead_research",
    workflow_status: "assessed",
    research_run_id: "run-1",
    opportunity_assessment: {
      opportunity_score: 78,
      fit_score: 72,
      buying_signal_score: 65,
      confidence: 0.86,
      estimated_revenue_range: "$1M–$2M",
      estimated_sales_cycle: "60–90 days",
      urgency: "high",
      effort: "low",
      roi_estimate: "high",
      recommendation: "prepare_outreach",
      worth_pursuing: true,
      summary: "Worth pursuing",
    },
    next_best_action: {
      label: "Prepare outreach draft",
      kind: "generate_outreach_draft",
      reason: "Strong fit",
      priority: "high",
      urgency: "high",
    },
    evidence_summary: {
      verified_evidence: ["Company summary captured"],
      missing_evidence: [],
      potential_risks: ["Contact email unverified"],
      assumptions: [],
      human_review_notes: [],
    },
  }

  const parsedAssessment = parsePersistedOpportunityAssessment(researchPayload)
  assert.ok(parsedAssessment)
  assert.equal(parsedAssessment!.recommendation, "prepare_outreach")

  const snapshot = parseGrowthLeadResearchWorkflowSnapshotFromEvent({
    leadId: "lead-oi-1a",
    occurredAt: "2026-07-02T08:00:00.000Z",
    missionId: null,
    workOrderId: null,
    payload: researchPayload,
  })
  assert.ok(snapshot)
  assert.equal(snapshot!.workflowStatus, "assessed")
  assert.equal(snapshot!.opportunityAssessment?.opportunityScore, 78)
  assert.equal(snapshot!.nextBestAction?.kind, "generate_outreach_draft")
  assert.equal(snapshot!.evidenceSummary?.potentialRisks.length, 1)

  const pqeMetadata = {
    [GROWTH_PROSPECT_QUALIFICATION_METADATA_KEY]: {
      version: 1,
      companyId: "lead-oi-1a",
      generatedAt: "2026-07-01T08:00:00.000Z",
      qualification: "qualified",
      overallScore: 74,
      fitScore: 80,
      contactScore: 70,
      engagementScore: 65,
      buyingCommitteeCoverage: 50,
      confidence: 0.72,
      acquisitionCandidate: {
        primaryContact: { fullName: "Jane Doe", email: "jane@acme.example", title: "Director", phone: null },
        overallConfidence: 75,
      },
      strengths: ["Strong ICP match"],
      risks: ["Limited committee coverage"],
      blockers: [],
      recommendations: ["Verify contact"],
      nextAction: "verify_contact",
    },
  }

  const pqe = readProspectQualificationFromLeadMetadata(pqeMetadata)
  assert.ok(pqe)
  assert.equal(pqe!.overallScore, 74)

  console.log(`[${GROWTH_OPPORTUNITY_INTELLIGENCE_1A_PHASE}] PASS — Opportunity Intelligence layer certified (local)`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
