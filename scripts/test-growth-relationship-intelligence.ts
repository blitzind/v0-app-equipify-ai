/**
 * Regression checks for Growth Engine relationship intelligence (slice 5.5A).
 * Run: pnpm test:growth-relationship-intelligence
 */
import assert from "node:assert/strict"
import { computeGrowthLeadNextBestAction } from "../lib/growth/next-best-action"
import { EMPTY_GROWTH_LEAD_EMAIL_EVENT_SUMMARY } from "../lib/growth/outbound/types"
import { relationshipSignalPoints } from "../lib/growth/relationship-meaningful-touch"
import { matchesRelationshipQueueFilter } from "../lib/growth/relationship-queue-filters"
import {
  computeGrowthLeadRelationshipStrength,
  computeRelationshipOwnerAttentionLevel,
} from "../lib/growth/relationship-score"
import { computeRelationshipTrend } from "../lib/growth/relationship-trend"
import type { GrowthLeadRelationshipInput } from "../lib/growth/relationship-types"

const NOW = new Date("2026-05-18T12:00:00.000Z")

function baseInput(
  signals: GrowthLeadRelationshipInput["signals"],
  overrides: Partial<GrowthLeadRelationshipInput> = {},
): GrowthLeadRelationshipInput {
  return {
    status: "qualified",
    fit: 70,
    signals,
    isSuppressed: false,
    previousScore: null,
    previousTier: null,
    previousTrend: null,
    engagementTier: null,
    now: NOW,
    ...overrides,
  }
}

assert.equal(relationshipSignalPoints("manual_touch"), 3)
assert.equal(relationshipSignalPoints("connected_call"), 15)
assert.equal(relationshipSignalPoints("positive_reply"), 25)
assert.equal(relationshipSignalPoints("call_duration"), 0)
assert.equal(relationshipSignalPoints("meeting_scheduled"), 0)

const developing = computeGrowthLeadRelationshipStrength(
  baseInput([
    { kind: "manual_touch", occurredAt: "2026-05-18T10:00:00.000Z", label: "Manual touch" },
    { kind: "connected_call", occurredAt: "2026-05-17T10:00:00.000Z", label: "Connected call" },
  ]),
)
assert.equal(developing.tier, "developing")
assert.ok(developing.score >= 15)

const trusted = computeGrowthLeadRelationshipStrength(
  baseInput([
    { kind: "positive_reply", occurredAt: "2026-05-18T09:00:00.000Z", label: "Positive reply" },
    { kind: "connected_call", occurredAt: "2026-05-17T15:00:00.000Z", label: "Connected call" },
    { kind: "decision_maker_confirmed", occurredAt: "2026-05-10T12:00:00.000Z", label: "DM confirmed" },
    { kind: "follow_up_completed", occurredAt: "2026-05-16T12:00:00.000Z", label: "Follow-up completed" },
  ]),
)
assert.ok(trusted.score >= 65)
assert.equal(trusted.tier, "trusted")

const strategic = computeGrowthLeadRelationshipStrength(
  baseInput([
    { kind: "positive_reply", occurredAt: "2026-05-18T09:00:00.000Z", label: "Positive reply" },
    { kind: "connected_call", occurredAt: "2026-05-17T15:00:00.000Z", label: "Connected call" },
    { kind: "decision_maker_confirmed", occurredAt: "2026-05-10T12:00:00.000Z", label: "DM confirmed" },
    { kind: "decision_maker_engagement", occurredAt: "2026-05-17T15:00:00.000Z", label: "DM engagement" },
    { kind: "follow_up_completed", occurredAt: "2026-05-16T12:00:00.000Z", label: "Follow-up completed" },
    { kind: "multiple_touchpoints", occurredAt: "2026-05-16T12:00:00.000Z", label: "Multiple touchpoints" },
  ]),
)
assert.equal(strategic.tier, "strategic")

const strategicSilenceSignals = [
  { kind: "positive_reply" as const, occurredAt: "2026-03-01T09:00:00.000Z", label: "Positive reply" },
  { kind: "connected_call" as const, occurredAt: "2026-03-02T15:00:00.000Z", label: "Connected call" },
  { kind: "decision_maker_confirmed" as const, occurredAt: "2026-03-03T12:00:00.000Z", label: "DM confirmed" },
]
const withoutStrategicProtection = computeGrowthLeadRelationshipStrength(
  baseInput(strategicSilenceSignals, { previousTier: null }),
)
const withStrategicProtection = computeGrowthLeadRelationshipStrength(
  baseInput(strategicSilenceSignals, { previousTier: "strategic" }),
)
assert.ok(withStrategicProtection.score > withoutStrategicProtection.score)

const suppressed = computeGrowthLeadRelationshipStrength(
  baseInput([{ kind: "suppression", occurredAt: "2026-05-10T00:00:00.000Z", label: "Suppressed" }], {
    isSuppressed: true,
  }),
)
assert.ok(suppressed.score <= 15)

assert.equal(
  computeRelationshipTrend({
    previousScore: 50,
    currentScore: 60,
    previousTrend: "stable",
    tier: "active",
    lastMeaningfulTouchAt: "2026-05-17T00:00:00.000Z",
    now: NOW,
  }),
  "improving",
)

assert.equal(
  computeRelationshipTrend({
    previousScore: 70,
    currentScore: 58,
    previousTrend: "stable",
    tier: "trusted",
    lastMeaningfulTouchAt: "2026-05-17T00:00:00.000Z",
    now: NOW,
  }),
  "cooling",
)

assert.equal(
  computeRelationshipOwnerAttentionLevel({
    tier: "trusted",
    trend: "stable",
    fit: 85,
    engagementTier: "engaged",
  }),
  "recommended",
)

assert.equal(
  computeRelationshipOwnerAttentionLevel({
    tier: "strategic",
    trend: "stable",
    fit: 90,
    engagementTier: "hot",
  }),
  "critical",
)

assert.equal(
  computeGrowthLeadNextBestAction({
    status: "call_ready",
    score: 85,
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
  }).action,
  "immediate_owner_attention",
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
    relationshipStrengthTier: "trusted",
    relationshipTrend: "stable",
  }).action,
  "owner_follow_up",
)

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
    relationshipStrengthTier: "active",
    relationshipTrend: "cooling",
  }).action,
  "rebuild_relationship",
)

assert.ok(
  matchesRelationshipQueueFilter("trusted_relationships", {
    status: "qualified",
    score: 70,
    relationshipStrengthScore: 70,
    relationshipStrengthTier: "trusted",
    relationshipTrend: "stable",
  }),
)

assert.ok(
  matchesRelationshipQueueFilter("relationship_cooling", {
    status: "qualified",
    score: 70,
    relationshipStrengthScore: 70,
    relationshipStrengthTier: "trusted",
    relationshipTrend: "cooling",
  }),
)

console.log("growth-relationship-intelligence: ok")
