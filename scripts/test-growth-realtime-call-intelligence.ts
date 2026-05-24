/**
 * Regression checks for Growth Engine Realtime Call Intelligence (slice 6.9A).
 * Run: pnpm test:growth-realtime-call-intelligence
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { mergeRealtimeBuyingSignals, detectRealtimeBuyingSignals } from "../lib/growth/realtime/realtime-buying-signals"
import { buildRealtimeCompetitorGuidance } from "../lib/growth/realtime/realtime-competitor-guidance"
import { computeRealtimeDiscoveryCoverage } from "../lib/growth/realtime/realtime-discovery"
import { buildRealtimeGuidance } from "../lib/growth/realtime/realtime-guidance"
import { mergeRealtimeObjections, detectRealtimeObjections } from "../lib/growth/realtime/realtime-objections"
import { detectRealtimeRiskFlags } from "../lib/growth/realtime/realtime-risk-detection"
import { analyzeRealtimeCallTranscript } from "../lib/growth/realtime/realtime-session-analyzer"
import { computeRealtimeTalkRatio } from "../lib/growth/realtime/realtime-talk-ratio"
import { createRealtimeProviderInstance } from "../lib/growth/realtime/providers/provider-registry"
import { REALTIME_PROVIDER_IDS } from "../lib/growth/realtime/providers/provider-types"
import {
  GROWTH_CALL_AUDIO_CAPTURE_ENABLED,
  GROWTH_CALL_AUTO_DISPOSITION_ENABLED,
  GROWTH_CALL_DIALER_SAFETY_COPY,
} from "../lib/growth/call-workflow-copy"
import { GROWTH_COMMAND_LEAD_FOCUS_VALUES } from "../lib/growth/command/command-lead-focus"

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

const stub = createRealtimeProviderInstance("stub")
assert.equal(stub.providerId, "stub")
assert.ok(REALTIME_PROVIDER_IDS.includes("deepgram"))
assert.equal(createRealtimeProviderInstance("deepgram").providerId, "deepgram")
assert.equal(createRealtimeProviderInstance("assemblyai").providerId, "assemblyai")

assert.equal(GROWTH_CALL_AUDIO_CAPTURE_ENABLED, false, "no browser audio capture invariant")
assert.equal(GROWTH_CALL_AUTO_DISPOSITION_ENABLED, false, "no auto-disposition invariant")
assert.match(GROWTH_CALL_DIALER_SAFETY_COPY, /does not record audio/)
assert.ok(GROWTH_COMMAND_LEAD_FOCUS_VALUES.includes("realtime-call"))
assert.ok(GROWTH_COMMAND_LEAD_FOCUS_VALUES.includes("call-copilot"))

const callSheetSource = fs.readFileSync(path.join(process.cwd(), "components/growth/growth-call-action-sheet.tsx"), "utf8")
assert.match(callSheetSource, /notifyDialStarted/, "dial creates/surfaces call workflow")
assert.match(callSheetSource, /Start Realtime Coaching/, "realtime coaching start visible after call")
assert.match(callSheetSource, /GROWTH_CALL_DIALER_SAFETY_COPY/, "safety copy in call sheet")

const realtimeUiSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-realtime-call-intelligence.tsx"),
  "utf8",
)
assert.match(realtimeUiSource, /Start Realtime Coaching/, "realtime card coaching CTA")
assert.match(realtimeUiSource, /Append Transcript/, "manual transcript append visible")
assert.doesNotMatch(realtimeUiSource, /getUserMedia|MediaRecorder|navigator\.mediaDevices/, "no audio capture APIs")

console.log("growth-realtime-call-intelligence: all checks passed")
