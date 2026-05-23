/**
 * Regression checks for Growth Engine operational capacity intelligence (slice 5.9A).
 * Run: pnpm test:growth-operational-capacity
 */
import assert from "node:assert/strict"
import { computeGrowthLeadNextBestAction } from "../lib/growth/next-best-action"
import { EMPTY_GROWTH_LEAD_EMAIL_EVENT_SUMMARY } from "../lib/growth/outbound/types"
import { detectCapacityConflicts } from "../lib/growth/operational-capacity-conflicts"
import {
  computePlatformPressureLevel,
  detectOperationalConstraints,
} from "../lib/growth/operational-capacity-constraints"
import { matchesOperationalCapacityQueueFilter } from "../lib/growth/operational-capacity-queue-filters"
import {
  computeCapacityPressureVolatility,
  computeCapacityRecoveryDirection,
  computeConstraintAgeBucket,
  computeGrowthLeadOperationalCapacity,
} from "../lib/growth/operational-capacity-score"
import type { GrowthLeadOperationalCapacityInput } from "../lib/growth/operational-capacity-types"

const NOW = new Date("2026-05-18T12:00:00.000Z")

function emptySnapshot(): GrowthLeadOperationalCapacityInput["snapshot"] {
  return {
    executiveNowCount: 0,
    executivePriorityCount: 0,
    openFollowUpCount: 0,
    callQueueLoadCount: 0,
    interventionBacklogCount: 0,
    interventionAgingCount: 0,
    interventionStalledCount: 0,
    priorityOpportunityCount: 0,
    leadershipBottleneckCount: 0,
    stalledOpportunityCount: 0,
    forecastAttentionCount: 0,
    hotOpportunityCount: 0,
    manualTouchBacklogCount: 0,
    decisionMakerBacklogCount: 0,
    protectedPipelineCount: 0,
    protectedPipelineHealthyCount: 0,
    assignedWorkOrders: 0,
    assignedTechnicians: 0,
    dispatchPressure: 0,
    supportQueuePressure: 0,
  }
}

function baseInput(
  overrides: Partial<GrowthLeadOperationalCapacityInput> = {},
): GrowthLeadOperationalCapacityInput {
  return {
    status: "qualified",
    fit: 82,
    followUpAt: null,
    callPriorityTier: "high",
    lastHumanTouchAt: "2026-05-10T12:00:00.000Z",
    nextBestAction: "call_now",
    engagementTier: "engaged",
    engagementLastActivityAt: "2026-05-17T12:00:00.000Z",
    opportunityReadinessTier: "sales_ready",
    opportunityAgeBucket: "developing",
    opportunityBlockerKeys: [],
    workflowHealth: "healthy",
    revenueProbabilityTier: "forecasted",
    forecastAttentionLevel: "important",
    executivePriorityTier: "important",
    executiveInterventionAgeBucket: "new",
    relationshipOwnerAttentionLevel: "recommended",
    intelligenceConflictSeverityScore: 10,
    decisionMakerStatus: "confirmed",
    opportunityBuyingSignalStrength: "moderate",
    relationshipStrengthTier: "trusted",
    snapshot: emptySnapshot(),
    previousCapacityScore: null,
    previousPressureLevel: null,
    previousCapacityTier: null,
    previousConstraintKeys: [],
    previousConstraintOpenedAt: null,
    previousConstraintCount: 0,
    now: NOW,
    ...overrides,
  }
}

const healthy = computeGrowthLeadOperationalCapacity(baseInput())
assert.equal(healthy.tier, "healthy")
assert.ok(healthy.score >= 70)
assert.ok(healthy.pressureVolatility >= 0 && healthy.pressureVolatility <= 100)
assert.equal(healthy.recoveryDirection, "stable")

const criticalSnapshot = emptySnapshot()
criticalSnapshot.executiveNowCount = 8
criticalSnapshot.callQueueLoadCount = 20
criticalSnapshot.openFollowUpCount = 15
criticalSnapshot.leadershipBottleneckCount = 10
criticalSnapshot.interventionAgingCount = 3
criticalSnapshot.interventionStalledCount = 2

const critical = computeGrowthLeadOperationalCapacity(
  baseInput({
    snapshot: criticalSnapshot,
    executivePriorityTier: "executive_now",
    revenueProbabilityTier: "commit_candidate",
    previousConstraintKeys: [],
    previousConstraintOpenedAt: null,
  }),
)
assert.ok(critical.tier === "constrained" || critical.tier === "critical")
assert.ok(critical.pressureLevel >= 60)
assert.ok(critical.constraints.some((entry) => entry.key === "executive_overload"))
assert.equal(critical.constraintAgeBucket, "new")
assert.ok(critical.constraintOpenedAt)

assert.equal(computeConstraintAgeBucket("2026-05-17T12:00:00.000Z", NOW), "new")
assert.equal(computeConstraintAgeBucket("2026-04-01T12:00:00.000Z", NOW), "stalled")

assert.equal(
  computeCapacityRecoveryDirection({
    previousCapacityScore: 40,
    currentCapacityScore: 55,
    previousPressureLevel: 70,
    currentPressureLevel: 55,
  }),
  "recovering",
)

assert.equal(
  computeCapacityRecoveryDirection({
    previousCapacityScore: 70,
    currentCapacityScore: 55,
    previousPressureLevel: 30,
    currentPressureLevel: 45,
  }),
  "worsening",
)

const volatility = computeCapacityPressureVolatility({
  previousPressureLevel: 30,
  currentPressureLevel: 55,
  previousConstraintCount: 1,
  currentConstraintCount: 3,
  previousCapacityTier: "healthy",
  currentCapacityTier: "strained",
})
assert.ok(volatility >= 30 && volatility <= 100)

const constraints = detectOperationalConstraints(criticalSnapshot)
assert.ok(constraints.length >= 2)
assert.ok(computePlatformPressureLevel(criticalSnapshot, constraints) >= 60)

const protectedCoverageSnapshot = emptySnapshot()
protectedCoverageSnapshot.protectedPipelineCount = 4
protectedCoverageSnapshot.protectedPipelineHealthyCount = 3
const withCoverage = computeGrowthLeadOperationalCapacity(
  baseInput({ snapshot: protectedCoverageSnapshot }),
)
assert.equal(withCoverage.protectedPipelineCoverage, 75)

const conflicts = detectCapacityConflicts({
  snapshot: criticalSnapshot,
  constraints,
  lead: baseInput({
    snapshot: criticalSnapshot,
    revenueProbabilityTier: "commit_candidate",
  }),
  pressureLevel: 80,
  tier: "critical",
  isProtectedOpportunity: true,
})
assert.ok(conflicts.some((entry) => entry.key === "protected_pipeline_capacity_risk"))

assert.equal(
  computeGrowthLeadNextBestAction({
    status: "call_ready",
    score: 80,
    website: "https://example.com",
    websiteFetchStatus: "success",
    lastResearchedAt: "2026-05-01T00:00:00.000Z",
    latestResearchRunId: "run-1",
    contactPhone: "+15551234567",
    callDisposition: null,
    followUpAt: null,
    recommendedNextAction: null,
    decisionMakerStatus: "confirmed",
    primaryDecisionMakerPhone: null,
    emailSummary: EMPTY_GROWTH_LEAD_EMAIL_EVENT_SUMMARY,
    engagementTier: "engaged",
    relationshipStrengthTier: "trusted",
    relationshipTrend: "stable",
    opportunityReadinessTier: "sales_ready",
    opportunityBlockerKeys: [],
    revenueProbabilityTier: "probable",
    executivePriorityTier: "important",
    operationalCapacityTier: "critical",
    capacityPressureLevel: 85,
    operationalConstraintKeys: ["call_queue_backlog"],
    isProtectedOpportunity: false,
    workflowHealth: "healthy",
  }).action,
  "reduce_new_outreach",
)

assert.equal(
  computeGrowthLeadNextBestAction({
    status: "call_ready",
    score: 88,
    website: "https://example.com",
    websiteFetchStatus: "success",
    lastResearchedAt: "2026-05-01T00:00:00.000Z",
    latestResearchRunId: "run-1",
    contactPhone: "+15551234567",
    callDisposition: null,
    followUpAt: null,
    recommendedNextAction: null,
    decisionMakerStatus: "confirmed",
    primaryDecisionMakerPhone: null,
    emailSummary: EMPTY_GROWTH_LEAD_EMAIL_EVENT_SUMMARY,
    engagementTier: "hot",
    relationshipStrengthTier: "strategic",
    relationshipTrend: "stable",
    opportunityReadinessTier: "priority_opportunity",
    opportunityBlockerKeys: [],
    revenueProbabilityTier: "forecasted",
    executivePriorityTier: "priority",
    operationalCapacityTier: "constrained",
    capacityPressureLevel: 70,
    operationalConstraintKeys: ["executive_overload"],
    isProtectedOpportunity: true,
    workflowHealth: "healthy",
  }).action,
  "redistribute_attention",
)

assert.equal(
  computeGrowthLeadNextBestAction({
    status: "call_ready",
    score: 90,
    website: "https://example.com",
    websiteFetchStatus: "success",
    lastResearchedAt: "2026-05-01T00:00:00.000Z",
    latestResearchRunId: "run-1",
    contactPhone: "+15551234567",
    callDisposition: null,
    followUpAt: null,
    recommendedNextAction: null,
    decisionMakerStatus: "confirmed",
    primaryDecisionMakerPhone: null,
    emailSummary: EMPTY_GROWTH_LEAD_EMAIL_EVENT_SUMMARY,
    engagementTier: "hot",
    relationshipStrengthTier: "strategic",
    relationshipTrend: "stable",
    opportunityReadinessTier: "priority_opportunity",
    opportunityBlockerKeys: [],
    revenueProbabilityTier: "forecasted",
    executivePriorityTier: "important",
    operationalCapacityTier: "constrained",
    capacityPressureLevel: 55,
    operationalConstraintKeys: [],
    isProtectedOpportunity: true,
    workflowHealth: "healthy",
  }).action,
  "protect_close_motion",
)

assert.ok(
  matchesOperationalCapacityQueueFilter("capacity_risk", {
    status: "qualified",
    operationalCapacityScore: 35,
    operationalCapacityTier: "constrained",
    capacityPressureLevel: 72,
    operationalConstraintKeys: ["executive_overload"],
    operationalConstraintCount: 1,
    isProtectedOpportunity: false,
    capacityConflictCount: 1,
  }),
)

assert.ok(
  matchesOperationalCapacityQueueFilter("protected_opportunities", {
    status: "qualified",
    operationalCapacityScore: 60,
    operationalCapacityTier: "strained",
    capacityPressureLevel: 40,
    operationalConstraintKeys: [],
    operationalConstraintCount: 0,
    isProtectedOpportunity: true,
    capacityConflictCount: 0,
  }),
)

console.log("growth-operational-capacity: ok")
