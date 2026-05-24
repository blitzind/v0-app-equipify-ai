/**
 * Regression checks for Growth Engine Live Guidance (slice 6.10A).
 * Run: pnpm test:growth-live-guidance
 */
import assert from "node:assert/strict"
import { generateLiveGuidanceCandidates, pickSuggestedNextQuestion } from "../lib/growth/live-guidance/live-guidance-engine"
import {
  computeCallExecutionScore,
  computeLiveMomentum,
  computeLiveRiskLevel,
} from "../lib/growth/live-guidance/live-execution-score"
import { LIVE_GUIDANCE_AUTONOMOUS_ACTIONS } from "../lib/growth/live-guidance/live-guidance-types"
import { analyzeRealtimeCallTranscript } from "../lib/growth/realtime/realtime-session-analyzer"
import type { GrowthRealtimeTranscriptEvent } from "../lib/growth/realtime/realtime-call-types"

const events: GrowthRealtimeTranscriptEvent[] = [
  {
    id: "1",
    sessionId: "s1",
    speaker: "rep",
    content: "Tell me about your current process and who makes the final decision here.",
    sequenceNumber: 0,
    timestampMs: 0,
    createdAt: "2026-05-18T12:00:00.000Z",
  },
  {
    id: "2",
    sessionId: "s1",
    speaker: "prospect",
    content: "We use Housecall Pro today and pricing feels too expensive for our budget.",
    sequenceNumber: 1,
    timestampMs: 1000,
    createdAt: "2026-05-18T12:00:01.000Z",
  },
  {
    id: "3",
    sessionId: "s1",
    speaker: "rep",
    content: "I hear you. Let me explain every feature we offer and our full pricing tiers in detail.",
    sequenceNumber: 2,
    timestampMs: 2000,
    createdAt: "2026-05-18T12:00:02.000Z",
  },
  {
    id: "4",
    sessionId: "s1",
    speaker: "rep",
    content: "We also integrate with QuickBooks, have mobile apps, dispatch boards, and reporting.",
    sequenceNumber: 3,
    timestampMs: 3000,
    createdAt: "2026-05-18T12:00:03.000Z",
  },
  {
    id: "5",
    sessionId: "s1",
    speaker: "prospect",
    content: "We'd like this live before summer if we move forward.",
    sequenceNumber: 4,
    timestampMs: 4000,
    createdAt: "2026-05-18T12:00:04.000Z",
  },
]

const leadInput = {
  decisionMakerStatus: "unknown",
  executivePriorityTier: "executive_now",
  revenueTrajectory: "at_risk",
  conversationMomentum: "slowing",
  conversationBuyingIntent: "weak",
  conversationCompetitorPressure: 45,
  relationshipTrend: "cooling",
  conversationUrgencyLevel: "high",
}

const snapshot = analyzeRealtimeCallTranscript({ events, lead: leadInput })

const candidates = generateLiveGuidanceCandidates({ snapshot, events, lead: leadInput })
assert.ok(candidates.length > 0, "should generate guidance candidates")

assert.ok(
  candidates.some((entry) => entry.eventType === "pricing_pressure" || entry.eventType === "objection_guidance"),
  "pricing/budget objection guidance",
)
assert.ok(
  candidates.some((entry) => entry.eventType === "competitor_response"),
  "competitor response guidance",
)
assert.ok(
  candidates.some((entry) => entry.eventType === "discovery_gap_guidance"),
  "discovery gap guidance",
)
assert.ok(
  candidates.some((entry) => entry.eventType === "buying_signal_detected"),
  "buying signal guidance",
)

const highRepTalkEvents: GrowthRealtimeTranscriptEvent[] = [
  ...events.slice(0, 2),
  {
    id: "6",
    sessionId: "s1",
    speaker: "rep",
    content: "Let me walk through our entire platform for the next ten minutes without stopping.",
    sequenceNumber: 5,
    timestampMs: 5000,
    createdAt: "2026-05-18T12:00:05.000Z",
  },
]
const talkSnapshot = analyzeRealtimeCallTranscript({ events: highRepTalkEvents, lead: leadInput })
const talkCandidates = generateLiveGuidanceCandidates({
  snapshot: talkSnapshot,
  events: highRepTalkEvents,
  lead: leadInput,
})
assert.ok(
  talkCandidates.some((entry) => entry.eventType === "talking_too_much"),
  "talk ratio coaching when rep dominates",
)

const momentumSnapshot = analyzeRealtimeCallTranscript({
  events: [
    ...events,
    {
      id: "7",
      sessionId: "s1",
      speaker: "prospect",
      content: "Honestly this is not a priority and timing is bad.",
      sequenceNumber: 6,
      timestampMs: 6000,
      createdAt: "2026-05-18T12:00:06.000Z",
    },
  ],
  lead: leadInput,
})
const momentumCandidates = generateLiveGuidanceCandidates({
  snapshot: momentumSnapshot,
  events: highRepTalkEvents,
  lead: leadInput,
})
assert.ok(
  momentumCandidates.some((entry) => entry.eventType === "momentum_drop" || entry.eventType === "relationship_recovery"),
  "momentum or relationship recovery guidance",
)

const suggested = pickSuggestedNextQuestion({ snapshot, candidates })
assert.ok(suggested, "suggested next question should be populated")

const executionScore = computeCallExecutionScore({ snapshot, events, acceptedGuidanceCount: 2 })
assert.ok(executionScore.score >= 0 && executionScore.score <= 100, "execution score in range")
assert.ok(executionScore.badgeLabel.length > 0, "badge label present")
assert.equal(typeof executionScore.factors.timelineDiscovered, "boolean")

const riskLevel = computeLiveRiskLevel(snapshot)
assert.ok(["low", "medium", "high"].includes(riskLevel))

const momentum = computeLiveMomentum(snapshot)
assert.ok(["building", "stable", "slowing", "at_risk"].includes(momentum))

assert.deepEqual(LIVE_GUIDANCE_AUTONOMOUS_ACTIONS, [], "no autonomous actions invariant")

console.log("growth-live-guidance: all checks passed")
