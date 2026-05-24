/**
 * Regression checks for Growth Engine sequence intelligence (slice 6.6A).
 * Run: pnpm test:growth-sequence-intelligence
 */
import assert from "node:assert/strict"
import {
  computeExecutiveSequenceWeight,
  computeLeadSequenceFatigueRisk,
  computeSequenceEffectivenessMetrics,
} from "../lib/growth/sequence/sequence-effectiveness-score"
import { evaluateSequenceOutcome } from "../lib/growth/sequence/sequence-outcome-evaluator"
import { matchPatternTouches } from "../lib/growth/sequence/sequence-pattern-matcher"
import { recommendGrowthSequencePattern } from "../lib/growth/sequence/sequence-recommendation"
import type { GrowthSequencePattern, GrowthSequenceTouch } from "../lib/growth/sequence-types"
import { computeGrowthLeadNextBestAction } from "../lib/growth/next-best-action"
import type { GrowthLead } from "../lib/growth/types"

const NOW = new Date("2026-05-18T12:00:00.000Z")

const basePattern = (partial: Partial<GrowthSequencePattern>): GrowthSequencePattern => ({
  id: "pattern-1",
  key: "email_then_call",
  label: "Email then call",
  description: null,
  patternKind: "catalog",
  sequenceVersion: 1,
  isActive: true,
  minTouches: 2,
  maxObservationDays: 30,
  attemptCount: 10,
  replyRate: 0.4,
  positiveReplyRate: 0.25,
  meetingSignalRate: 0.1,
  followUpCompletionRate: 0.2,
  sequenceAbandonmentRate: 0.15,
  opportunityLift: 5,
  revenueProbabilityLift: 3,
  conversationHealthLift: 4,
  averageTimeToReplyHours: 24,
  averageTouchesToPositiveSignal: 2,
  sequenceQualityScore: 62,
  sequenceFatigueRisk: "low",
  confidenceScore: 70,
  computedAt: NOW.toISOString(),
  steps: [],
  ...partial,
})

const baseLead = (partial: Partial<GrowthLead> = {}): GrowthLead =>
  ({
    id: "lead-1",
    companyName: "Acme",
    status: "qualified",
    score: 88,
    contactPhone: "555-0100",
    contactTemperature: "engaged",
    executivePriorityTier: "priority",
    relationshipStrengthTier: "strategic",
    conversationBuyingIntent: "moderate",
    conversationObjectionProfile: { clusters: [], totalSeverityScore: 0 },
    conversationCompetitorMentions: [],
    recommendedSequencePatternId: null,
    recommendedSequenceConfidence: null,
    recommendedSequenceNextStep: {},
    sequenceFatigueRisk: null,
    ...partial,
  }) as GrowthLead

const touches: GrowthSequenceTouch[] = [
  {
    occurredAt: "2026-05-10T10:00:00.000Z",
    channel: "email",
    generationType: "cold_email",
  },
  {
    occurredAt: "2026-05-14T10:00:00.000Z",
    channel: "manual_call",
    generationType: null,
    signalKind: "call_interested",
  },
  {
    occurredAt: "2026-05-15T09:00:00.000Z",
    channel: "reply",
    generationType: "interested",
    signalKind: "interested",
  },
]

const matches = matchPatternTouches(touches, [
  { channel: "email", delayDaysMin: 0, delayDaysMax: 0, generationType: "cold_email" },
  { channel: "manual_call", delayDaysMin: 3, delayDaysMax: 7, generationType: null },
])
assert.equal(matches.length, 1)

const outcome = evaluateSequenceOutcome({
  patternId: "pattern-1",
  leadId: "lead-1",
  matchedTouches: matches[0]!,
  allTouches: touches,
  outcomeWindowDays: 30,
  opportunityScoreBefore: 40,
  opportunityScoreAfter: 52,
  revenueProbabilityBefore: 30,
  revenueProbabilityAfter: 38,
  conversationHealthBefore: 50,
  conversationHealthAfter: 58,
  leadIndustryBucket: "general",
  dominantObjectionKey: null,
  buyingIntentAtStart: "moderate",
  stepCount: 2,
})
assert.equal(outcome.gotReply, true)
assert.equal(outcome.gotPositiveReply, true)

const metrics = computeSequenceEffectivenessMetrics([outcome, { ...outcome, abandoned: true, gotReply: false }])
assert.ok(metrics.sequenceQualityScore >= 0 && metrics.sequenceQualityScore <= 100)
assert.ok(metrics.sequenceAbandonmentRate > 0)

assert.equal(computeLeadSequenceFatigueRisk(8), "high")
assert.equal(computeLeadSequenceFatigueRisk(1), "none")

const execWeight = computeExecutiveSequenceWeight({
  executivePriorityTier: "priority",
  relationshipStrengthTier: "strategic",
  fitScore: 90,
})
assert.ok(execWeight >= 55)

const recommendation = recommendGrowthSequencePattern({
  lead: baseLead(),
  patterns: [basePattern({ key: "executive_follow_up", label: "Executive follow-up" })],
  touches: [],
  now: NOW,
})
assert.ok(recommendation.patternKey === "executive_follow_up")
assert.ok(recommendation.confidence >= 40)

const startSequence = computeGrowthLeadNextBestAction({
  status: "qualified",
  score: 80,
  website: "https://example.com",
  websiteFetchStatus: "success",
  lastResearchedAt: "2026-05-01T00:00:00.000Z",
  latestResearchRunId: "00000000-0000-4000-8000-000000000001",
  contactPhone: "+15551234567",
  callDisposition: null,
  followUpAt: null,
  recommendedNextAction: null,
  decisionMakerStatus: "confirmed",
  primaryDecisionMakerPhone: null,
  recommendedSequencePatternId: "pattern-1",
  recommendedSequenceConfidence: 72,
  sequenceFatigueRisk: "low",
  now: NOW,
})
assert.equal(startSequence.action, "start_recommended_sequence")

const fatigued = recommendGrowthSequencePattern({
  lead: baseLead(),
  patterns: [basePattern({})],
  touches: Array.from({ length: 8 }, (_, i) => ({
    occurredAt: new Date(NOW.getTime() - i * 24 * 60 * 60 * 1000).toISOString(),
    channel: "email" as const,
    generationType: "cold_email",
  })),
  now: NOW,
})
assert.equal(fatigued.patternId, null)
assert.equal(fatigued.fatigueRisk, "high")

console.log("growth-sequence-intelligence: ok")
