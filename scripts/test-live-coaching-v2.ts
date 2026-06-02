/**
 * Growth Live Coaching V2 — conversation coach regression checks.
 * Run: pnpm test:live-coaching-v2
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { classifyConversationStage } from "../lib/growth/live-coaching/conversation-stage-engine"
import {
  isCoachingTopicAllowed,
  isGuidanceEventAllowedForStage,
  phraseViolatesStagePolicy,
} from "../lib/growth/live-coaching/stage-coaching-policy"
import {
  buildInboundBootstrapCoachTurn,
  generateDeterministicCoachTurn,
} from "../lib/growth/live-coaching/turn-coach-generator"
import {
  lastCustomerFacingTranscriptEvent,
  shouldRefreshCoachForCustomerSpeech,
} from "../lib/growth/live-coaching/prospect-turn-detection"
import { generateLiveGuidanceCandidates } from "../lib/growth/live-guidance/live-guidance-engine"
import { emptyRealtimeLiveSnapshot } from "../lib/growth/realtime/realtime-live-snapshot-defaults"
import {
  compareCoachTurnRecency,
  isBootstrapCoachTurn,
  pickPreferredCoachTurn,
} from "../lib/growth/live-coaching/coach-turn-recency"
import {
  mergeOperatorAssistPreferringNewerCoach,
  resolveSayThisNext,
} from "../lib/growth/operator-assist/resolve-say-this-next"
import { resolveUnifiedNextBestAction } from "../lib/growth/operator-assist/nba-resolver"
import { buildUnifiedOperatorAssistSnapshot } from "../lib/growth/operator-assist/orchestration"

const snapshot = emptyRealtimeLiveSnapshot()
const events = [
  {
    id: "1",
    sessionId: "s1",
    speaker: "prospect" as const,
    content: "We are struggling with manual follow-ups every week.",
    sequenceNumber: 1,
    timestampMs: Date.now(),
    sourceVoiceSegmentId: null,
    createdAt: new Date().toISOString(),
  },
]

const stage = classifyConversationStage({ events, snapshot })
assert.equal(stage.stage, "pain", "manual follow-up struggle should reach pain stage")

assert.equal(isCoachingTopicAllowed("rapport", "decision_maker"), false)
assert.equal(isCoachingTopicAllowed("discovery", "decision_maker"), true)
assert.equal(isCoachingTopicAllowed("rapport", "budget"), false)
assert.equal(isCoachingTopicAllowed("impact", "budget"), true)

assert.equal(
  isGuidanceEventAllowedForStage("rapport", "discovery_gap_guidance", "discovery_gap_guidance:dm"),
  false,
)
assert.equal(
  isGuidanceEventAllowedForStage("discovery", "discovery_gap_guidance", "discovery_gap_guidance:dm"),
  true,
)

assert.equal(
  phraseViolatesStagePolicy("rapport", "Who besides yourself would be involved in this decision?"),
  true,
)

const bootstrap = buildInboundBootstrapCoachTurn()
assert.match(bootstrap.primaryPhrase, /prompted you to reach out/i)
assert.equal(bootstrap.stage, "rapport")

const turn = generateDeterministicCoachTurn({
  events,
  stage: "pain",
  snapshot,
  inbound: true,
})
assert.match(turn.primaryPhrase, /hardest part|hardest/i)
assert.ok(turn.rationale.length > 10)

const rapportCandidates = generateLiveGuidanceCandidates({
  snapshot: {
    ...snapshot,
    discovery: {
      covered: [],
      missing: ["decision_maker_confirmed", "timeline_asked", "budget_asked", "implementation_asked", "current_solution_identified"],
    },
  },
  events: [],
  lead: {
    decisionMakerStatus: "missing",
    conversationBuyingIntent: "weak",
    conversationUrgencyLevel: "low",
    relationshipTrend: "stable",
    revenueTrajectory: "stable",
    executivePriorityTier: "standard",
    conversationCompetitorPressure: 0,
    recommendedSequenceNextStep: null,
  },
  conversationStage: "rapport",
})
assert.equal(
  rapportCandidates.some((candidate) => candidate.dedupeKey === "discovery_gap_guidance:dm"),
  false,
  "decision-maker gap card should be gated in rapport",
)

const coachingState = {
  executionScore: {
    score: 70,
    badge: "good" as const,
    badgeLabel: "Good",
    factors: {
      talkRatio: 80,
      discoveryCoverage: 40,
      objectionsHandled: 100,
      buyingSignalsCaptured: 25,
      timelineDiscovered: false,
      decisionMakerIdentified: false,
      nextStepSecured: false,
    },
  },
  suggestedNextQuestion: bootstrap.primaryPhrase,
  riskLevel: "low" as const,
  momentum: "stable" as const,
  activeGuidance: [],
  guidanceLatencyMs: 12,
  conversationStage: "rapport" as const,
  stageObjective: bootstrap.stageObjective,
  primaryCoach: bootstrap,
}

const sayThisNext = resolveSayThisNext({
  qaMarker: "voice-unified-operator-assist-v1",
  generatedAt: new Date().toISOString(),
  passiveModeEnabled: true,
  autonomousActionsDisabled: true,
  canonicalTranscriptSource: "none",
  coachingState,
  liveSnapshot: snapshot,
  coachingMode: "transcript_only",
  coachingLeadId: "lead-1",
  realtimeSessionId: "rt-1",
  voiceCallId: "vc-1",
  conversationIntelligence: null,
  feed: [],
  topPriority: [],
  additional: [],
  nextBestAction: resolveUnifiedNextBestAction({
    coachingState,
    liveSnapshot: snapshot,
    conversationIntelligence: null,
    leadContext: null,
    rankedAssistEvents: [],
  }),
  interruptionSummary: {
    operatorInterruptions: 0,
    customerInterruptions: 0,
    totalInterruptions: 0,
    recentEvents: [],
  },
  supervisorVisibility: { assistFeedReadOnly: true, supervisorParticipantCount: 0 },
  preferences: {
    quietMode: false,
    minimumPriorityLabel: "Low",
    enabledCategories: {
      objection: true,
      buying_signal: true,
      risk: true,
      guidance: true,
      coaching: true,
      interruption: true,
      conversation: true,
    },
  },
})

assert.ok(sayThisNext)
assert.equal(sayThisNext?.phrase, bootstrap.primaryPhrase)
assert.equal(sayThisNext?.stageObjective, bootstrap.stageObjective)

const generatedCoach = generateDeterministicCoachTurn({
  events,
  stage: "pain",
  snapshot,
  inbound: true,
  previousCoach: bootstrap,
})
const refreshedBootstrap = {
  ...bootstrap,
  updatedAt: new Date(Date.now() + 60_000).toISOString(),
}
assert.ok(compareCoachTurnRecency(generatedCoach, refreshedBootstrap) > 0)
assert.equal(
  pickPreferredCoachTurn(refreshedBootstrap, generatedCoach)?.primaryPhrase,
  generatedCoach.primaryPhrase,
)
assert.equal(isBootstrapCoachTurn(bootstrap), true)
assert.equal(isBootstrapCoachTurn(generatedCoach), false)

const staleAssist = buildUnifiedOperatorAssistSnapshot({
  coachingState: {
    executionScore: {
      score: 70,
      badge: "good",
      badgeLabel: "Good",
      factors: {
        talkRatio: 80,
        discoveryCoverage: 0,
        objectionsHandled: 100,
        buyingSignalsCaptured: 0,
        timelineDiscovered: false,
        decisionMakerIdentified: false,
        nextStepSecured: false,
      },
    },
    suggestedNextQuestion: refreshedBootstrap.primaryPhrase,
    riskLevel: "low",
    momentum: "stable",
    activeGuidance: [],
    guidanceLatencyMs: 0,
    conversationStage: refreshedBootstrap.stage,
    stageObjective: refreshedBootstrap.stageObjective,
    primaryCoach: refreshedBootstrap,
  },
  coachingMode: "transcript_only",
  coachingLeadId: "lead-1",
  realtimeSessionId: "session-1",
  voiceCallId: "vc-1",
  conversationIntelligence: null,
  voiceTranscript: null,
  liveSnapshot: snapshot,
  leadContext: null,
  participants: [],
  preferences: {
    quietMode: false,
    minimumPriorityLabel: "Low",
    enabledCategories: {
      objection: true,
      buying_signal: true,
      risk: true,
      guidance: true,
      coaching: true,
      interruption: true,
      conversation: true,
    },
  },
})

const freshAssist = buildUnifiedOperatorAssistSnapshot({
  coachingState: {
    executionScore: {
      score: 70,
      badge: "good",
      badgeLabel: "Good",
      factors: {
        talkRatio: 80,
        discoveryCoverage: 0,
        objectionsHandled: 100,
        buyingSignalsCaptured: 0,
        timelineDiscovered: false,
        decisionMakerIdentified: false,
        nextStepSecured: false,
      },
    },
    suggestedNextQuestion: generatedCoach.primaryPhrase,
    riskLevel: "low",
    momentum: "stable",
    activeGuidance: [],
    guidanceLatencyMs: 0,
    conversationStage: generatedCoach.stage,
    stageObjective: generatedCoach.stageObjective,
    primaryCoach: generatedCoach,
  },
  coachingMode: "transcript_only",
  coachingLeadId: "lead-1",
  realtimeSessionId: "session-1",
  voiceCallId: "vc-1",
  conversationIntelligence: null,
  voiceTranscript: null,
  liveSnapshot: snapshot,
  leadContext: null,
  participants: [],
  preferences: {
    quietMode: false,
    minimumPriorityLabel: "Low",
    enabledCategories: {
      objection: true,
      buying_signal: true,
      risk: true,
      guidance: true,
      coaching: true,
      interruption: true,
      conversation: true,
    },
  },
})

const merged = mergeOperatorAssistPreferringNewerCoach(staleAssist, freshAssist)
assert.equal(merged.coachingState?.primaryCoach?.primaryPhrase, generatedCoach.primaryPhrase)

const regressed = mergeOperatorAssistPreferringNewerCoach(freshAssist, staleAssist)
assert.equal(regressed.coachingState?.primaryCoach?.primaryPhrase, generatedCoach.primaryPhrase)

const sessionDetail = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/realtime/run-realtime-call-session.ts"),
  "utf8",
)
assert.doesNotMatch(sessionDetail, /liveSnapshot: snapshot \}\)\s*\n\s*let coachingState/s)
assert.match(sessionDetail, /session,\s*\n\s*\}\)/)

const syncCoach = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/live-coaching/sync-conversation-coach.ts"),
  "utf8",
)
assert.doesNotMatch(syncCoach, /updatedAt: new Date\(\)\.toISOString\(\),\s*\n\s*\}\s*\n\s*\}/)

const answerRepo = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/native-dialer/native-dialer-repository.ts"),
  "utf8",
)
assert.match(answerRepo, /autoStartCallWorkspaceLiveCoachingOnAnswer/)
assert.match(answerRepo, /await autoStartCallWorkspaceLiveCoachingOnAnswer/)

const assistPanel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-workspace-unified-assist-panel.tsx"),
  "utf8",
)
assert.match(assistPanel, /showStartCoachingButton/)
assert.match(assistPanel, /realtimeSessionId/)
assert.match(assistPanel, /LiveCoachingGuidancePanel[\s\S]*compact/)

const guidanceUiSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/live-coaching/live-coaching-guidance-ui.tsx"),
  "utf8",
)
assert.match(
  guidanceUiSource,
  /export function LiveCoachingGuidanceRow[\s\S]*return \(\s*<div/,
  "compact guidance rows must not render li outside ul (React hydration #418)",
)
assert.doesNotMatch(
  guidanceUiSource,
  /export function LiveCoachingGuidanceRow[\s\S]*return \(\s*<li/,
  "LiveCoachingGuidanceRow root must not be li when parent panel uses div",
)

const hero = fs.readFileSync(
  path.join(process.cwd(), "components/growth/live-coaching/say-this-next-card.tsx"),
  "utf8",
)
assert.match(hero, /stageObjective/)
assert.match(hero, /Why:/)

const tasks = fs.readFileSync(path.join(process.cwd(), "lib/ai/tasks.ts"), "utf8")
assert.match(tasks, /growth_live_turn_coach/)

const workspaceSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-workspace.tsx"),
  "utf8",
)
assert.match(workspaceSource, /buildOptimisticActiveInboundSession/)
assert.match(workspaceSource, /setOptimisticCoachTurn/)
assert.match(workspaceSource, /reconcileInboundAnswer/)
assert.match(workspaceSource, /pickDisplayOperatorAssistSnapshot/)

const coachingService = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/native-dialer/call-workspace-coaching-service.ts"),
  "utf8",
)
assert.match(coachingService, /hydrateDetail/)

const mislabeledCustomer = [
  {
    id: "1",
    sessionId: "s1",
    speaker: "rep" as const,
    content: "We need help with our billing workflow this quarter.",
    sequenceNumber: 0,
    timestampMs: Date.now(),
    sourceVoiceSegmentId: "seg-1",
    createdAt: new Date().toISOString(),
  },
]

assert.equal(
  lastCustomerFacingTranscriptEvent(mislabeledCustomer, { previousCoach: bootstrap })?.sequenceNumber,
  0,
)
assert.equal(
  shouldRefreshCoachForCustomerSpeech({ events: mislabeledCustomer, previousCoach: bootstrap }),
  true,
)

const refreshedTurn = generateDeterministicCoachTurn({
  events: mislabeledCustomer,
  stage: "rapport",
  snapshot,
  inbound: true,
  previousCoach: bootstrap,
})
assert.notEqual(refreshedTurn.primaryPhrase, bootstrap.primaryPhrase)
assert.ok(refreshedTurn.triggeredBySequenceNumber === 0)

const streamRegistry = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/media-streaming/stream-transcript-runtime-registry.ts"),
  "utf8",
)
assert.match(streamRegistry, /fixedTrack/)
assert.match(streamRegistry, /TWILIO_MEDIA_TRACKS/)

const deepgramBridge = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/media-streaming/deepgram-twilio-realtime-bridge.ts"),
  "utf8",
)
assert.match(deepgramBridge, /fixedTrack/)

console.log("live-coaching-v2 checks passed")
