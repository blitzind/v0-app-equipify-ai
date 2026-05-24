/**
 * Regression checks for Growth Engine Realtime Call Intelligence (slice 6.9A).
 * Run: pnpm test:growth-realtime-call-intelligence
 */
import assert from "node:assert/strict"
import { mergeRealtimeBuyingSignals, detectRealtimeBuyingSignals } from "../lib/growth/realtime/realtime-buying-signals"
import { buildRealtimeCompetitorGuidance } from "../lib/growth/realtime/realtime-competitor-guidance"
import { computeRealtimeDiscoveryCoverage } from "../lib/growth/realtime/realtime-discovery"
import { buildRealtimeGuidance } from "../lib/growth/realtime/realtime-guidance"
import { mergeRealtimeObjections, detectRealtimeObjections } from "../lib/growth/realtime/realtime-objections"
import { detectRealtimeRiskFlags } from "../lib/growth/realtime/realtime-risk-detection"
import { analyzeRealtimeCallTranscript } from "../lib/growth/realtime/realtime-session-analyzer"
import { computeRealtimeTalkRatio } from "../lib/growth/realtime/realtime-talk-ratio"
import {
  REALTIME_TRANSCRIPT_PROVIDER_IDS,
  StubRealtimeTranscriptProvider,
  createRealtimeTranscriptProvider,
} from "../lib/growth/realtime/realtime-transcript-provider"

const events = [
  {
    id: "1",
    sessionId: "s1",
    speaker: "rep" as const,
    content: "What is your budget and timeline for implementation?",
    sequenceNumber: 0,
    timestampMs: 0,
    createdAt: "2026-05-18T12:00:00.000Z",
  },
  {
    id: "2",
    sessionId: "s1",
    speaker: "prospect" as const,
    content: "We use Housecall Pro today and pricing feels too expensive for us.",
    sequenceNumber: 1,
    timestampMs: 1000,
    createdAt: "2026-05-18T12:00:01.000Z",
  },
  {
    id: "3",
    sessionId: "s1",
    speaker: "rep" as const,
    content: "Understood. Who else needs to sign off on this decision?",
    sequenceNumber: 2,
    timestampMs: 2000,
    createdAt: "2026-05-18T12:00:02.000Z",
  },
  {
    id: "4",
    sessionId: "s1",
    speaker: "prospect" as const,
    content: "I'm the owner and we want to move forward this week.",
    sequenceNumber: 3,
    timestampMs: 3000,
    createdAt: "2026-05-18T12:00:03.000Z",
  },
]

const talkRatio = computeRealtimeTalkRatio(events)
assert.ok(talkRatio.repTalkPercent >= 0 && talkRatio.repTalkPercent <= 100)
assert.equal(talkRatio.repTalkPercent + talkRatio.prospectTalkPercent, 100)

const objections = mergeRealtimeObjections(events.map((event) => ({ content: event.content, sequenceNumber: event.sequenceNumber })))
assert.ok(objections.some((entry) => entry.key === "pricing_objection" || entry.key === "budget_concern"))
assert.ok(objections.some((entry) => entry.key === "competitor_mention"))

const buyingSignals = mergeRealtimeBuyingSignals(
  events.map((event) => ({
    content: event.content,
    sequenceNumber: event.sequenceNumber,
    speaker: event.speaker,
  })),
)
assert.ok(buyingSignals.some((entry) => entry.key === "commitment_language" || entry.key === "timeline_urgency"))

const discovery = computeRealtimeDiscoveryCoverage(events)
assert.ok(discovery.covered.includes("budget_asked"))
assert.ok(discovery.covered.includes("timeline_asked"))

const snapshot = analyzeRealtimeCallTranscript({
  events,
  lead: {
    decisionMakerStatus: "unknown",
    executivePriorityTier: "executive_now",
    revenueTrajectory: "at_risk",
    conversationMomentum: "slowing",
  },
})

assert.ok(snapshot.guidanceTips.length > 0)
assert.ok(snapshot.competitorGuidance.some((entry) => entry.competitor === "Housecall Pro"))
assert.ok(snapshot.recommendedNextQuestion)

const riskFlags = detectRealtimeRiskFlags({
  talkRatio,
  discovery,
  objections,
  buyingSignals,
  lead: { executivePriorityTier: "executive_now", revenueTrajectory: "at_risk", conversationMomentum: "slowing" },
  recentProspectSentimentNegative: false,
  hasNextStepLanguage: true,
})
assert.ok(riskFlags.includes("executive_account_risk") || riskFlags.includes("call_momentum_slowing"))

const guidance = buildRealtimeGuidance({
  lead: { decisionMakerStatus: "missing" },
  discovery,
  objections,
  buyingSignals,
  riskFlags,
})
assert.ok(guidance.tips.some((tip) => tip.message.includes("Decision maker")))

assert.ok(detectRealtimeObjections({ content: "We already use Jobber", sequenceNumber: 1 }).some((entry) => entry.key === "already_using_solution"))
assert.ok(detectRealtimeBuyingSignals({ content: "Let's move forward next week", sequenceNumber: 2, speaker: "prospect" }).some((entry) => entry.key === "commitment_language"))

const competitorGuidance = buildRealtimeCompetitorGuidance("We currently use Housecall Pro")
assert.equal(competitorGuidance[0]?.suggestedAngle, "What would you improve today?")

const stub = new StubRealtimeTranscriptProvider()
assert.equal(stub.providerId, "stub")
assert.ok(REALTIME_TRANSCRIPT_PROVIDER_IDS.includes("deepgram"))
assert.ok(createRealtimeTranscriptProvider("deepgram") instanceof StubRealtimeTranscriptProvider)
assert.ok(createRealtimeTranscriptProvider("assemblyai").providerId === "stub")

console.log("growth-realtime-call-intelligence: all checks passed")
