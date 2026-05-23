/**
 * Regression checks for Growth Engine revenue forecast intelligence (slice 5.7A).
 * Run: pnpm test:growth-revenue-forecast
 */
import assert from "node:assert/strict"
import { computeGrowthLeadNextBestAction } from "../lib/growth/next-best-action"
import { EMPTY_GROWTH_LEAD_EMAIL_EVENT_SUMMARY } from "../lib/growth/outbound/types"
import { matchesRevenueForecastQueueFilter } from "../lib/growth/revenue-forecast-queue-filters"
import { computeGrowthLeadRevenueForecast } from "../lib/growth/revenue-forecast-score"
import {
  computeRevenueProbabilityVolatility,
  computeRevenueTrajectory,
  isForecastRegression,
} from "../lib/growth/revenue-forecast-trajectory"
import type { GrowthLeadRevenueForecastInput } from "../lib/growth/revenue-forecast-types"

const NOW = new Date("2026-05-18T12:00:00.000Z")

function baseInput(
  overrides: Partial<GrowthLeadRevenueForecastInput> = {},
): GrowthLeadRevenueForecastInput {
  return {
    status: "qualified",
    fit: 82,
    decisionMakerStatus: "confirmed",
    workflowHealth: "healthy",
    momentumTier: "strong",
    engagementScore: 78,
    engagementTier: "hot",
    relationshipStrengthScore: 72,
    relationshipStrengthTier: "trusted",
    relationshipTrend: "stable",
    opportunityReadinessScore: 70,
    opportunityReadinessTier: "sales_ready",
    opportunityReadinessConfidence: 65,
    opportunityReadinessTrend: "improving",
    opportunityBuyingSignalStrength: "strong",
    opportunityBlockerKeys: [],
    opportunityAcceleratorCount: 2,
    hasPositiveReply: true,
    connectedCallCount: 1,
    hasUsableResearch: true,
    researchConfidence: 0.7,
    engagementComputedAt: "2026-05-17T00:00:00.000Z",
    relationshipComputedAt: "2026-05-17T00:00:00.000Z",
    opportunityReadinessComputedAt: "2026-05-17T00:00:00.000Z",
    previousScore: null,
    previousTier: null,
    previousConfidence: null,
    now: NOW,
    ...overrides,
  }
}

const forecasted = computeGrowthLeadRevenueForecast(
  baseInput({
    fit: 72,
    opportunityReadinessScore: 62,
    relationshipStrengthScore: 58,
    relationshipStrengthTier: "active",
    engagementScore: 55,
    engagementTier: "engaged",
    opportunityBuyingSignalStrength: "moderate",
  }),
)
assert.ok(forecasted.score >= 65)
assert.equal(forecasted.tier, "forecasted")
assert.ok(forecasted.confidence >= 45)
assert.ok(["accelerating", "steady", "slowing", "at_risk"].includes(forecasted.trajectory))
assert.ok(forecasted.volatility >= 0 && forecasted.volatility <= 100)

const commit = computeGrowthLeadRevenueForecast(
  baseInput({
    fit: 90,
    opportunityReadinessScore: 88,
    relationshipStrengthTier: "strategic",
    relationshipStrengthScore: 85,
    engagementScore: 90,
  }),
)
assert.equal(commit.tier, "commit_candidate")

const suppressed = computeGrowthLeadRevenueForecast(
  baseInput({
    fit: 95,
    opportunityBlockerKeys: ["suppressed"],
    opportunityReadinessScore: 90,
  }),
)
assert.notEqual(suppressed.tier, "forecasted")
assert.notEqual(suppressed.tier, "commit_candidate")

const trajectoryAtRisk = computeRevenueTrajectory({
  previousScore: 72,
  currentScore: 58,
  previousTier: "forecasted",
  currentTier: "probable",
  opportunityReadinessTrend: "declining",
  relationshipTrend: "cooling",
  workflowHealth: "stalled",
})
assert.equal(trajectoryAtRisk, "at_risk")

const volatility = computeRevenueProbabilityVolatility({
  previousScore: 70,
  currentScore: 52,
  previousConfidence: 60,
  currentConfidence: 45,
  previousTier: "forecasted",
  currentTier: "probable",
  blockerCount: 2,
})
assert.ok(volatility > 20)

assert.ok(
  isForecastRegression({
    previousScore: 75,
    currentScore: 62,
    previousTier: "forecasted",
    currentTier: "probable",
    trajectory: "at_risk",
  }),
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
    revenueProbabilityTier: "commit_candidate",
    workflowHealth: "healthy",
  }).action,
  "immediate_sales_action",
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
    workflowHealth: "healthy",
  }).action,
  "executive_close_motion",
)

assert.equal(
  computeGrowthLeadNextBestAction({
    status: "call_ready",
    score: 75,
    website: "https://example.com",
    websiteFetchStatus: "success",
    lastResearchedAt: "2026-05-01T00:00:00.000Z",
    latestResearchRunId: "run-1",
    contactPhone: "+15551234567",
    callDisposition: null,
    followUpAt: null,
    recommendedNextAction: null,
    decisionMakerStatus: "none",
    primaryDecisionMakerPhone: null,
    emailSummary: EMPTY_GROWTH_LEAD_EMAIL_EVENT_SUMMARY,
    engagementTier: "engaged",
    relationshipStrengthTier: "active",
    relationshipTrend: "stable",
    opportunityReadinessTier: "qualified",
    opportunityBlockerKeys: ["missing_decision_maker"],
    revenueProbabilityTier: "forecasted",
    workflowHealth: "healthy",
  }).action,
  "secure_decision_maker",
)

assert.equal(
  computeGrowthLeadNextBestAction({
    status: "call_ready",
    score: 70,
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
    relationshipStrengthTier: "active",
    relationshipTrend: "stable",
    opportunityReadinessTier: "qualified",
    opportunityBlockerKeys: [],
    revenueProbabilityTier: "probable",
    workflowHealth: "stalled",
  }).action,
  "unblock_progress",
)

assert.ok(
  matchesRevenueForecastQueueFilter("commit_candidates", {
    status: "qualified",
    revenueProbabilityScore: 90,
    revenueProbabilityTier: "commit_candidate",
    revenueProbabilityConfidence: 70,
  }),
)

assert.ok(
  matchesRevenueForecastQueueFilter("low_confidence_forecast", {
    status: "qualified",
    revenueProbabilityScore: 68,
    revenueProbabilityTier: "forecasted",
    revenueProbabilityConfidence: 30,
  }),
)

console.log("growth-revenue-forecast: ok")
