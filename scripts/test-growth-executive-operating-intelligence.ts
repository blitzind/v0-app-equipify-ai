/**
 * Regression checks for Growth Engine executive operating intelligence (slice 5.8A).
 * Run: pnpm test:growth-executive-operating-intelligence
 */
import assert from "node:assert/strict"
import { computeGrowthLeadNextBestAction } from "../lib/growth/next-best-action"
import { EMPTY_GROWTH_LEAD_EMAIL_EVENT_SUMMARY } from "../lib/growth/outbound/types"
import { isExecutiveCloseCandidate } from "../lib/growth/executive-operating-close-candidate"
import {
  computeIntelligenceConflictSeverityScore,
  detectIntelligenceConflicts,
} from "../lib/growth/executive-operating-conflicts"
import { matchesExecutiveOperatingQueueFilter } from "../lib/growth/executive-operating-queue-filters"
import {
  computeExecutiveInterventionAgeBucket,
  computeGrowthLeadExecutiveOperating,
} from "../lib/growth/executive-operating-score"
import type { GrowthLeadExecutiveOperatingInput } from "../lib/growth/executive-operating-types"

const NOW = new Date("2026-05-18T12:00:00.000Z")

function baseInput(
  overrides: Partial<GrowthLeadExecutiveOperatingInput> = {},
): GrowthLeadExecutiveOperatingInput {
  return {
    status: "qualified",
    fit: 88,
    assignedTo: "owner-1",
    momentumTier: "strong",
    momentumScore: 75,
    workflowHealth: "healthy",
    engagementScore: 82,
    engagementTier: "hot",
    relationshipStrengthTier: "strategic",
    relationshipTrend: "stable",
    relationshipOwnerAttentionLevel: "important",
    opportunityReadinessScore: 78,
    opportunityReadinessTier: "priority_opportunity",
    opportunityBuyingSignalStrength: "strong",
    opportunityBlockerKeys: [],
    revenueProbabilityScore: 88,
    revenueProbabilityTier: "commit_candidate",
    revenueProbabilityConfidence: 72,
    revenueTrajectory: "accelerating",
    revenueProbabilityPreviousScore: 80,
    revenueProbabilityVolatility: 12,
    forecastAttentionLevel: "critical",
    decisionMakerStatus: "confirmed",
    previousExecutiveScore: null,
    previousExecutiveTier: null,
    previousConflictCount: 0,
    previousInterventionOpenedAt: null,
    now: NOW,
    ...overrides,
  }
}

const executiveNow = computeGrowthLeadExecutiveOperating(baseInput())
assert.equal(executiveNow.tier, "executive_now")
assert.ok(executiveNow.score >= 85)
assert.ok(executiveNow.volatility >= 0 && executiveNow.volatility <= 100)
assert.equal(executiveNow.owner, "owner-1")
assert.ok(executiveNow.conflictSeverityScore >= 0)

const conflicts = detectIntelligenceConflicts(
  baseInput({
    fit: 80,
    engagementTier: "cold",
    relationshipStrengthTier: "developing",
    engagementScore: 20,
  }),
)
assert.ok(conflicts.some((entry) => entry.key === "high_fit_low_engagement"))
assert.ok(conflicts.some((entry) => entry.key === "hot_engagement_poor_relationship") === false)

const fitEngagementConflict = detectIntelligenceConflicts(
  baseInput({ fit: 75, engagementTier: "warming", engagementScore: 30 }),
)
assert.ok(fitEngagementConflict.some((entry) => entry.key === "high_fit_low_engagement"))

const severity = computeIntelligenceConflictSeverityScore([
  { key: "a", label: "A", severity: "critical" },
  { key: "b", label: "B", severity: "warning" },
])
assert.ok(severity >= 30)

assert.ok(
  isExecutiveCloseCandidate({
    fit: 85,
    opportunityReadinessTier: "sales_ready",
    relationshipStrengthTier: "trusted",
    opportunityBuyingSignalStrength: "strong",
    revenueProbabilityTier: "probable",
    decisionMakerStatus: "confirmed",
  }),
)

assert.equal(computeExecutiveInterventionAgeBucket("2026-05-17T12:00:00.000Z", NOW), "new")
assert.equal(computeExecutiveInterventionAgeBucket("2026-04-01T12:00:00.000Z", NOW), "stalled")

const intervention = computeGrowthLeadExecutiveOperating(
  baseInput({
    revenueTrajectory: "at_risk",
    revenueProbabilityPreviousScore: 92,
    revenueProbabilityScore: 86,
    previousInterventionOpenedAt: null,
  }),
)
assert.ok(intervention.interventionNeeded)
assert.ok(intervention.interventionOpenedAt)

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
    revenueProbabilityTier: "commit_candidate",
    revenueProbabilityScore: 88,
    revenueProbabilityPreviousScore: 92,
    revenueTrajectory: "at_risk",
    executivePriorityTier: "executive_now",
    workflowHealth: "healthy",
  }).action,
  "executive_takeover",
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
    engagementTier: "engaged",
    relationshipStrengthTier: "trusted",
    relationshipTrend: "stable",
    opportunityReadinessTier: "sales_ready",
    opportunityBlockerKeys: [],
    revenueProbabilityTier: "commit_candidate",
    revenueProbabilityScore: 72,
    revenueProbabilityPreviousScore: 90,
    revenueTrajectory: "at_risk",
    executivePriorityTier: "priority",
    workflowHealth: "healthy",
  }).action,
  "executive_intervention",
)

assert.ok(
  matchesExecutiveOperatingQueueFilter("executive_now", {
    status: "qualified",
    executivePriorityScore: 90,
    executivePriorityTier: "executive_now",
    intelligenceConflictSeverityScore: 10,
    intelligenceConflictCount: 0,
    executiveInterventionAgeBucket: "new",
    workflowHealth: "healthy",
    opportunityBlockerCount: 0,
  }),
)

assert.ok(
  matchesExecutiveOperatingQueueFilter("leadership_bottlenecks", {
    status: "qualified",
    executivePriorityScore: 55,
    executivePriorityTier: "important",
    intelligenceConflictSeverityScore: 44,
    intelligenceConflictCount: 2,
    executiveInterventionAgeBucket: "aging",
    workflowHealth: "stalled",
    opportunityBlockerCount: 1,
  }),
)

console.log("growth-executive-operating-intelligence: ok")
