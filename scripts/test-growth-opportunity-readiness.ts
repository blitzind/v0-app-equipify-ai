/**
 * Regression checks for Growth Engine opportunity readiness intelligence (slice 5.6A).
 * Run: pnpm test:growth-opportunity-readiness
 */
import assert from "node:assert/strict"
import { computeGrowthLeadNextBestAction } from "../lib/growth/next-best-action"
import { EMPTY_GROWTH_LEAD_EMAIL_EVENT_SUMMARY } from "../lib/growth/outbound/types"
import { deriveOpportunityAccelerators } from "../lib/growth/opportunity-accelerators"
import { deriveOpportunityBlockers } from "../lib/growth/opportunity-blockers"
import { matchesOpportunityQueueFilter } from "../lib/growth/opportunity-queue-filters"
import { computeGrowthLeadOpportunityReadiness } from "../lib/growth/opportunity-readiness-score"
import type { GrowthLeadOpportunityReadinessInput } from "../lib/growth/opportunity-types"

const NOW = new Date("2026-05-18T12:00:00.000Z")

function baseInput(
  overrides: Partial<GrowthLeadOpportunityReadinessInput> = {},
): GrowthLeadOpportunityReadinessInput {
  return {
    status: "qualified",
    fit: 75,
    website: "https://example.com",
    contactPhone: "+15551234567",
    primaryDecisionMakerPhone: null,
    lastResearchedAt: "2026-05-01T00:00:00.000Z",
    latestResearchRunId: "run-1",
    researchConfidence: 0.75,
    hasUsableResearch: true,
    decisionMakerStatus: "confirmed",
    engagementTier: "hot",
    engagementScore: 80,
    engagementLastActivityAt: "2026-05-17T00:00:00.000Z",
    relationshipStrengthTier: "trusted",
    relationshipStrengthScore: 70,
    relationshipTrend: "stable",
    relationshipLastMeaningfulTouchAt: "2026-05-16T00:00:00.000Z",
    lastHumanTouchAt: "2026-05-15T00:00:00.000Z",
    connectedCallCount: 1,
    callAttemptCount: 1,
    voicemailCount: 0,
    isSuppressed: false,
    hasPositiveReply: true,
    hasNotInterestedReply: false,
    createdAt: "2026-04-01T00:00:00.000Z",
    previousScore: null,
    previousTrend: null,
    now: NOW,
    ...overrides,
  }
}

const salesReady = computeGrowthLeadOpportunityReadiness(
  baseInput({
    fit: 72,
    engagementTier: "engaged",
    hasPositiveReply: false,
    relationshipStrengthTier: "trusted",
    relationshipStrengthScore: 68,
    researchConfidence: 0.55,
  }),
)
assert.ok(salesReady.score >= 65)
assert.equal(salesReady.tier, "sales_ready")

const priority = computeGrowthLeadOpportunityReadiness(baseInput())
assert.equal(priority.tier, "priority_opportunity")
assert.ok(priority.confidence >= 50)
assert.equal(priority.buyingSignalStrength, "strong")

const suppressed = computeGrowthLeadOpportunityReadiness(
  baseInput({ isSuppressed: true, fit: 95, engagementTier: "hot" }),
)
assert.ok(suppressed.tier === "not_ready" || suppressed.tier === "developing" || suppressed.tier === "qualified")
assert.notEqual(suppressed.tier, "sales_ready")
assert.notEqual(suppressed.tier, "priority_opportunity")

const notInterested = computeGrowthLeadOpportunityReadiness(
  baseInput({ hasNotInterestedReply: true, fit: 95, engagementTier: "hot" }),
)
assert.ok(
  notInterested.tier === "not_ready" ||
    notInterested.tier === "developing" ||
    notInterested.tier === "qualified",
)
assert.notEqual(notInterested.tier, "sales_ready")
assert.notEqual(notInterested.tier, "priority_opportunity")
assert.ok(notInterested.blockers.some((entry) => entry.key === "not_interested"))

const blockers = deriveOpportunityBlockers(
  baseInput({ decisionMakerStatus: "none", contactPhone: null, primaryDecisionMakerPhone: null }),
)
assert.ok(blockers.some((entry) => entry.key === "missing_decision_maker"))
assert.ok(blockers.some((entry) => entry.key === "no_phone"))

const accelerators = deriveOpportunityAccelerators(baseInput())
assert.ok(accelerators.some((entry) => entry.key === "positive_reply"))
assert.ok(accelerators.some((entry) => entry.key === "hot_engagement"))

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
  }).action,
  "immediate_sales_action",
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
    decisionMakerStatus: "none",
    primaryDecisionMakerPhone: null,
    emailSummary: EMPTY_GROWTH_LEAD_EMAIL_EVENT_SUMMARY,
    engagementTier: "engaged",
    relationshipStrengthTier: "active",
    relationshipTrend: "stable",
    opportunityReadinessTier: "qualified",
    opportunityBlockerKeys: ["missing_decision_maker"],
  }).action,
  "find_decision_maker",
)

assert.equal(
  computeGrowthLeadNextBestAction({
    status: "call_ready",
    score: 82,
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
    relationshipStrengthTier: "strategic",
    relationshipTrend: "stable",
    opportunityReadinessTier: "sales_ready",
    opportunityBlockerKeys: [],
  }).action,
  "owner_close_motion",
)

assert.ok(
  matchesOpportunityQueueFilter("priority_opportunities", {
    status: "qualified",
    score: 80,
    opportunityReadinessScore: 90,
    opportunityReadinessTier: "priority_opportunity",
    opportunityBlockers: [],
  }),
)

assert.ok(
  matchesOpportunityQueueFilter("blocked_opportunities", {
    status: "qualified",
    score: 80,
    opportunityReadinessScore: 55,
    opportunityReadinessTier: "qualified",
    opportunityBlockers: [{ key: "no_phone" }],
  }),
)

console.log("growth-opportunity-readiness: ok")
