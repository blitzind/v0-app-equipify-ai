/**
 * Live coaching refresh — voice→Growth bridge, guidance supersession, feed ranking.
 * Run: pnpm test:live-coaching-refresh
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { generateLiveGuidanceCandidates } from "../lib/growth/live-guidance/live-guidance-engine"
import { planGuidanceSync } from "../lib/growth/live-guidance/guidance-sync-logic"
import { inferGuidanceDedupeKey } from "../lib/growth/live-guidance/infer-guidance-dedupe-key"
import type { GrowthLiveGuidanceEvent } from "../lib/growth/live-guidance/live-guidance-types"
import { mapVoiceSpeakerToGrowthRealtime } from "../lib/growth/realtime/voice-speaker-mapper"
import { analyzeRealtimeCallTranscript } from "../lib/growth/realtime/realtime-session-analyzer"
import type { GrowthRealtimeTranscriptEvent } from "../lib/growth/realtime/realtime-call-types"
import { buildUnifiedOperatorAssistSnapshot } from "../lib/growth/operator-assist/orchestration"
import {
  applyUnifiedAssistRecencyAdjustments,
  rankUnifiedAssistEvents,
} from "../lib/growth/operator-assist/unified-priority"
import type { UnifiedOperatorAssistEvent } from "../lib/growth/operator-assist/types"

const QA_MARKER = "live-coaching-refresh-v1"

function transcriptEvent(input: {
  id: string
  speaker: "rep" | "prospect"
  content: string
  sequenceNumber: number
  timestampMs: number
}): GrowthRealtimeTranscriptEvent {
  return {
    id: input.id,
    sessionId: "session-1",
    speaker: input.speaker,
    content: input.content,
    sequenceNumber: input.sequenceNumber,
    timestampMs: input.timestampMs,
    sourceVoiceSegmentId: null,
    createdAt: new Date(input.timestampMs).toISOString(),
  }
}

const leadInput = {
  decisionMakerStatus: "unknown",
  executivePriorityTier: "standard",
  conversationCompetitorPressure: 0,
}

// --- Phase 1: speaker mapping + bridge wiring ---

assert.equal(mapVoiceSpeakerToGrowthRealtime("operator"), "rep")
assert.equal(mapVoiceSpeakerToGrowthRealtime("customer"), "prospect")

const bridgeModule = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/realtime/voice-transcript-bridge.ts"),
  "utf8",
)
assert.match(bridgeModule, /bridgeVoiceSegmentToGrowthRealtime/)
assert.match(bridgeModule, /recomputeGrowthRealtimeCallSession/)
assert.match(bridgeModule, /ensureInboundCallWorkspaceLiveCoachingLinked/)
assert.match(bridgeModule, /voice_growth_transcript_bridge_outcome/)

const coachingService = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/native-dialer/call-workspace-coaching-service.ts"),
  "utf8",
)
assert.match(coachingService, /ensureInboundCallWorkspaceLiveCoachingLinked/)
assert.match(coachingService, /voice_growth_coaching_auto_linked/)

const workspaceBridge = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/browser-calling/workspace-bridge.ts"),
  "utf8",
)
assert.match(workspaceBridge, /ensureInboundCallWorkspaceLiveCoachingLinked/)

const telemetry = fs.readFileSync(path.join(process.cwd(), "lib/voice/telemetry.ts"), "utf8")
assert.match(telemetry, /voice_growth_transcript_bridge_outcome/)

const mediaSession = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/media-streaming/media-session-service.ts"),
  "utf8",
)
assert.match(mediaSession, /bridgeVoiceSegmentToGrowthRealtime/)

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270620121000_voice_growth_live_coaching_bridge.sql"),
  "utf8",
)
assert.match(migration, /source_voice_segment_id/)
assert.match(migration, /dedupe_key/)

// --- Phase 2: guidance supersession ---

function guidanceEvent(partial: Partial<GrowthLiveGuidanceEvent> & Pick<GrowthLiveGuidanceEvent, "id">): GrowthLiveGuidanceEvent {
  return {
    organizationId: null,
    leadId: "lead-1",
    realtimeCallSessionId: "session-1",
    dedupeKey: partial.dedupeKey ?? null,
    eventType: partial.eventType ?? "discovery_gap_guidance",
    severity: partial.severity ?? "high",
    title: partial.title ?? "Decision Maker Not Confirmed",
    operatorPrompt: partial.operatorPrompt ?? "Map buying committee.",
    recommendation: partial.recommendation ?? "Who else is involved?",
    supportingReason: partial.supportingReason ?? "Decision maker discovery incomplete.",
    confidenceScore: partial.confidenceScore ?? 86,
    surfacedAt: partial.surfacedAt ?? "2026-05-29T12:00:00.000Z",
    dismissedAt: partial.dismissedAt ?? null,
    acceptedAt: partial.acceptedAt ?? null,
    createdAt: partial.createdAt ?? "2026-05-29T12:00:00.000Z",
    ...partial,
  }
}

const staleDmCard = guidanceEvent({
  id: "g1",
  dedupeKey: "discovery_gap_guidance:dm",
  title: "Decision Maker Not Confirmed",
})

const earlySnapshot = analyzeRealtimeCallTranscript({ events: [], lead: leadInput })
const earlyCandidates = generateLiveGuidanceCandidates({ snapshot: earlySnapshot, events: [], lead: leadInput })
assert.ok(
  earlyCandidates.some((candidate) => candidate.dedupeKey === "discovery_gap_guidance:dm"),
  "empty transcript should surface decision-maker gap",
)

const dmResolvedEvents: GrowthRealtimeTranscriptEvent[] = [
  transcriptEvent({
    id: "t1",
    speaker: "prospect",
    content: "I'm the owner here and I make the final call on software purchases.",
    sequenceNumber: 0,
    timestampMs: 1_000,
  }),
]
const dmResolvedSnapshot = analyzeRealtimeCallTranscript({ events: dmResolvedEvents, lead: leadInput })
const dmResolvedCandidates = generateLiveGuidanceCandidates({
  snapshot: dmResolvedSnapshot,
  events: dmResolvedEvents,
  lead: leadInput,
})
assert.ok(
  !dmResolvedCandidates.some((candidate) => candidate.dedupeKey === "discovery_gap_guidance:dm"),
  "decision-maker gap should retire after authority signal",
)
assert.ok(
  dmResolvedCandidates.some((candidate) => candidate.dedupeKey === "buying_signal_detected:dm_confirmed"),
  "decision-maker confirmation should produce buying committee guidance",
)

const retireActions = planGuidanceSync({
  activeEvents: [staleDmCard],
  candidates: dmResolvedCandidates,
  passesThreshold: () => true,
})
assert.ok(
  retireActions.some((action) => action.type === "dismiss" && action.eventId === "g1"),
  "stale decision-maker card should be dismissed",
)

// --- Simulated call progression + top-card changes ---

type Stage = { label: string; events: GrowthRealtimeTranscriptEvent[] }

const progression: Stage[] = [
  {
    label: "decision maker unknown",
    events: [
      transcriptEvent({
        id: "s1",
        speaker: "rep",
        content: "Thanks for picking up. Tell me about your current workflow.",
        sequenceNumber: 0,
        timestampMs: 1_000,
      }),
    ],
  },
  {
    label: "decision maker known",
    events: [
      transcriptEvent({
        id: "s2",
        speaker: "prospect",
        content: "I'm the owner and I approve all vendor decisions for our team.",
        sequenceNumber: 1,
        timestampMs: 5_000,
      }),
    ],
  },
  {
    label: "budget objection",
    events: [
      transcriptEvent({
        id: "s3",
        speaker: "prospect",
        content: "Honestly this feels too expensive for our budget this quarter.",
        sequenceNumber: 2,
        timestampMs: 10_000,
      }),
    ],
  },
  {
    label: "competitor mention",
    events: [
      transcriptEvent({
        id: "s4",
        speaker: "prospect",
        content: "We already use Housecall Pro and it mostly works for us.",
        sequenceNumber: 3,
        timestampMs: 15_000,
      }),
    ],
  },
  {
    label: "migration concern",
    events: [
      transcriptEvent({
        id: "s5",
        speaker: "prospect",
        content: "My biggest worry is the migration and getting our data transferred safely.",
        sequenceNumber: 4,
        timestampMs: 20_000,
      }),
    ],
  },
  {
    label: "demo request",
    events: [
      transcriptEvent({
        id: "s6",
        speaker: "prospect",
        content: "Can you show me how scheduling and dispatch would work in a demo?",
        sequenceNumber: 5,
        timestampMs: 25_000,
      }),
    ],
  },
]

const topKeys: string[] = []
const surfacedKeys = new Set<string>()
let topChanges = 0
let cumulative: GrowthRealtimeTranscriptEvent[] = []
let previousTop: string | null = null

for (const stage of progression) {
  cumulative = [...cumulative, ...stage.events]
  const snapshot = analyzeRealtimeCallTranscript({ events: cumulative, lead: leadInput })
  const candidates = generateLiveGuidanceCandidates({ snapshot, events: cumulative, lead: leadInput })
  assert.ok(candidates.length > 0, `expected guidance candidate at stage: ${stage.label}`)

  for (const candidate of candidates) {
    surfacedKeys.add(candidate.dedupeKey)
  }

  const top = candidates[0]!.dedupeKey
  topKeys.push(top)
  if (previousTop && previousTop !== top) topChanges += 1
  previousTop = top
}

assert.ok(topChanges >= 2, `expected top card to change during call, keys: ${topKeys.join(" → ")}`)
assert.ok(surfacedKeys.has("discovery_gap_guidance:dm"), "decision-maker gap should surface early")
assert.ok(surfacedKeys.has("pricing_pressure") || surfacedKeys.has("objection_guidance:budget"), "budget coaching should surface")
assert.ok(surfacedKeys.has("competitor_response"), "competitor coaching should surface")
assert.ok(surfacedKeys.has("objection_guidance:implementation"), "migration coaching should surface")
assert.equal(topKeys[topKeys.length - 1], "meeting_lock_prompt:demo", "final stage should prioritize demo opportunity")

const now = Date.now()
const recentIso = (offsetMs: number) => new Date(now - offsetMs).toISOString()

// --- Phase 3: feed re-ranking ---

const staleScore = applyUnifiedAssistRecencyAdjustments(3200, recentIso(20 * 60_000), now)
const freshScore = applyUnifiedAssistRecencyAdjustments(3000, recentIso(30_000), now)
assert.ok(freshScore > staleScore, "newer evidence should outrank stale card after recency boost")

const feedEvents: UnifiedOperatorAssistEvent[] = [
  {
    id: "growth:old",
    source: "growth_guidance",
    sourceKind: "growth_guidance",
    lifecycleStatus: "active",
    category: "coaching",
    eventType: "discovery_gap_guidance",
    severity: "high",
    title: "Decision Maker Not Confirmed",
    operatorPrompt: "Ask who decides",
    recommendation: "Who else is involved?",
    evidenceText: "Decision maker discovery incomplete.",
    confidenceScore: 86,
    surfacedAt: recentIso(20 * 60_000),
    expiresAt: null,
    transcriptSegmentId: null,
    sequenceNumber: null,
    voiceCallId: null,
    growthGuidanceEventId: "g-old",
    coachingLeadId: "lead-1",
    realtimeSessionId: "session-1",
    dedupeKey: "discovery_gap_guidance:dm",
    priorityScore: 0,
    priorityLabel: "High",
  },
  {
    id: "growth:new",
    source: "growth_guidance",
    sourceKind: "growth_guidance",
    lifecycleStatus: "active",
    category: "objection",
    eventType: "pricing_pressure",
    severity: "high",
    title: "Pricing Pressure",
    operatorPrompt: "Do not defend pricing immediately.",
    recommendation: "What feels expensive compared to today?",
    evidenceText: "Prospect raised pricing objection.",
    confidenceScore: 88,
    surfacedAt: recentIso(30_000),
    expiresAt: null,
    transcriptSegmentId: null,
    sequenceNumber: null,
    voiceCallId: null,
    growthGuidanceEventId: "g-new",
    coachingLeadId: "lead-1",
    realtimeSessionId: "session-1",
    dedupeKey: "pricing_pressure",
    priorityScore: 0,
    priorityLabel: "High",
  },
]

const ranked = rankUnifiedAssistEvents(feedEvents, now)
assert.equal(ranked[0]?.dedupeKey, "pricing_pressure", "recent pricing card should rise to top")

const unified = buildUnifiedOperatorAssistSnapshot({
  coachingState: {
    executionScore: {
      score: 55,
      badge: "recoverable",
      badgeLabel: "Recoverable",
      factors: {
        talkRatio: 50,
        discoveryCoverage: 40,
        objectionsHandled: 30,
        buyingSignalsCaptured: 20,
        timelineDiscovered: false,
        decisionMakerIdentified: false,
        nextStepSecured: false,
      },
    },
    suggestedNextQuestion: null,
    riskLevel: "medium",
    momentum: "stable",
    activeGuidance: [
      guidanceEvent({
        id: "live-1",
        dedupeKey: "pricing_pressure",
        eventType: "pricing_pressure",
        title: "Pricing Pressure",
        supportingReason: "Prospect raised pricing objection.",
        surfacedAt: recentIso(30_000),
      }),
    ],
    guidanceLatencyMs: 12,
  },
  coachingMode: "lead_linked",
  coachingLeadId: "lead-1",
  realtimeSessionId: "session-1",
  voiceCallId: "voice-1",
  conversationIntelligence: null,
  voiceTranscript: null,
  liveSnapshot: analyzeRealtimeCallTranscript({ events: cumulative, lead: leadInput }),
  leadContext: null,
  participants: [],
  preferences: {
    quietMode: false,
    minimumPriorityLabel: "Low",
    enabledCategories: {
      coaching: true,
      objection: true,
      buying_signal: true,
      risk: true,
      guidance: true,
      conversation: true,
      interruption: true,
    },
  },
  generatedAt: new Date(now).toISOString(),
})

assert.ok(unified?.topPriority.length, "unified assist should expose top priority cards")
assert.equal(inferGuidanceDedupeKey({ eventType: "discovery_gap_guidance", title: "Timeline Not Covered", dedupeKey: null }), "discovery_gap_guidance:timeline")

console.log(`${QA_MARKER} checks passed`)
