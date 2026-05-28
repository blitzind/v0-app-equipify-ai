/**
 * Unified operator assist orchestration — Phase 2B regression checks.
 * Run: pnpm test:voice-unified-operator-assist-phase-2b
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildAssistDedupeKey, dedupeUnifiedAssistEvents, preferGrowthGuidanceOnConflict } from "../lib/growth/operator-assist/deduplication"
import { detectConversationalInterruptions } from "../lib/growth/operator-assist/interruption-detection"
import {
  isActiveAssistLifecycle,
  mapGrowthGuidancePatchAction,
  mapLifecyclePatchAction,
  normalizeGrowthGuidanceLifecycle,
  normalizeVoiceIntelligenceLifecycle,
} from "../lib/growth/operator-assist/lifecycle"
import { resolveUnifiedNextBestAction } from "../lib/growth/operator-assist/nba-resolver"
import { buildUnifiedOperatorAssistSnapshot } from "../lib/growth/operator-assist/orchestration"
import { VOICE_UNIFIED_OPERATOR_ASSIST_QA_MARKER } from "../lib/growth/operator-assist/types"
import { partitionUnifiedAssistFeed, rankUnifiedAssistEvents } from "../lib/growth/operator-assist/unified-priority"
import { VOICE_SCHEMA_MIGRATION_ID, VOICE_SCHEMA_PROBE_VERSION } from "../lib/voice/schema-health"

assert.equal(VOICE_UNIFIED_OPERATOR_ASSIST_QA_MARKER, "voice-unified-operator-assist-v1")
assert.equal(VOICE_SCHEMA_PROBE_VERSION, "v19")
assert.equal(VOICE_SCHEMA_MIGRATION_ID, "20270619120000_voice_workflow_orchestration_phase_5c")

const dedupeKey = buildAssistDedupeKey({
  category: "objection",
  eventType: "pricing_objection",
  evidenceText: "Price is too high",
})
assert.match(dedupeKey, /^objection:pricing_objection:/)

const growthEvent = {
  id: "growth:1",
  source: "growth_guidance" as const,
  sourceKind: "growth_guidance" as const,
  lifecycleStatus: "active" as const,
  category: "objection" as const,
  eventType: "objection_guidance",
  severity: "medium" as const,
  title: "Pricing pushback",
  operatorPrompt: "Acknowledge budget concern",
  recommendation: "Ask about budget cycle",
  evidenceText: "price is too high",
  confidenceScore: 82,
  priorityLabel: "High" as const,
  priorityScore: 400,
  surfacedAt: new Date().toISOString(),
  expiresAt: null,
  dedupeKey,
  transcriptSegmentId: null,
  sequenceNumber: null,
  voiceCallId: null,
  growthGuidanceEventId: "1",
  coachingLeadId: "lead-1",
  realtimeSessionId: "session-1",
}

const voiceDuplicate = {
  ...growthEvent,
  id: "voice:2",
  source: "voice_intelligence" as const,
  sourceKind: "voice_objection" as const,
  voiceCallId: "call-1",
  growthGuidanceEventId: null,
  confidenceScore: 0.91,
}

const deduped = preferGrowthGuidanceOnConflict(dedupeUnifiedAssistEvents([growthEvent, voiceDuplicate]))
assert.equal(deduped.length, 1)
assert.equal(deduped[0]?.source, "growth_guidance")

assert.equal(normalizeGrowthGuidanceLifecycle({ dismissedAt: "2026-01-01T00:00:00.000Z", acceptedAt: null, surfacedAt: new Date().toISOString() }), "dismissed")
assert.equal(normalizeGrowthGuidanceLifecycle({ dismissedAt: null, acceptedAt: "2026-01-01T00:00:00.000Z", surfacedAt: new Date().toISOString() }), "acknowledged")
assert.equal(
  normalizeVoiceIntelligenceLifecycle({
    status: "operator_acknowledged",
    createdAt: new Date().toISOString(),
    eventType: "pricing_objection",
  }),
  "acknowledged",
)
assert.equal(mapLifecyclePatchAction("acknowledge"), "operator_acknowledged")
assert.equal(mapGrowthGuidancePatchAction("acknowledge"), "accept")
assert.equal(isActiveAssistLifecycle("escalated"), true)
assert.equal(isActiveAssistLifecycle("dismissed"), false)

const interruptionSummary = detectConversationalInterruptions({
  growthEvents: [
    {
      id: "t1",
      sessionId: "session-1",
      speaker: "prospect",
      content: "We have been evaluating vendors for months and need to understand pricing before we can move forward with any decision.",
      sequenceNumber: 1,
      timestampMs: 0,
      createdAt: new Date(0).toISOString(),
    },
    {
      id: "t2",
      sessionId: "session-1",
      speaker: "rep",
      content: "Absolutely, let me jump in quickly on pricing.",
      sequenceNumber: 2,
      timestampMs: 200,
      createdAt: new Date(200).toISOString(),
    },
  ],
})
assert.ok(interruptionSummary.operatorInterruptions >= 1)
assert.ok(interruptionSummary.recentEvents.length >= 1)

const snapshot = buildUnifiedOperatorAssistSnapshot({
  coachingState: null,
  coachingMode: "transcript_only",
  coachingLeadId: null,
  realtimeSessionId: null,
  voiceCallId: "call-1",
  conversationIntelligence: {
    qaMarker: "voice-conversation-intelligence-v1",
    voiceCallId: "call-1",
    passiveModeEnabled: true,
    autonomousActionsDisabled: true,
    liveSignals: [],
    objections: [
      {
        id: "obj-1",
        eventType: "pricing_objection",
        confidenceScore: 0.9,
        evidenceText: "price is too high for our budget",
        suggestedOperatorAction: "Explore budget timing",
        analysisProvider: "deterministic_rules",
        status: "detected",
        transcriptSegmentId: "seg-1",
        sequenceNumber: 1,
        createdAt: new Date().toISOString(),
      },
    ],
    buyingSignals: [],
    riskEvents: [],
    operatorGuidance: [],
    suggestedNextBestAction: {
      id: "nba-1",
      eventType: "next_best_action",
      confidenceScore: 0.88,
      evidenceText: "ready to schedule demo",
      suggestedOperatorAction: "Offer two meeting times",
      analysisProvider: "deterministic_rules",
      status: "detected",
      transcriptSegmentId: "seg-2",
      sequenceNumber: 2,
      createdAt: new Date().toISOString(),
    },
    memoryDrafts: [],
    analysisProvider: "deterministic_rules",
    generatedAt: new Date().toISOString(),
  },
  voiceTranscript: null,
  liveSnapshot: null,
  leadContext: { recommendedNextAction: "Review lead command center" },
  participants: [{
    id: "p1",
    label: "Supervisor",
    participantRole: "supervisor",
    participantUserId: null,
    phoneNumber: "",
    clientIdentity: "",
    status: "connected",
    isMuted: true,
    isOnHold: false,
    joinedAt: new Date().toISOString(),
  }],
})

assert.equal(snapshot.qaMarker, VOICE_UNIFIED_OPERATOR_ASSIST_QA_MARKER)
assert.equal(snapshot.passiveModeEnabled, true)
assert.ok(snapshot.feed.length >= 1)
assert.ok(snapshot.topPriority.length <= 3)
assert.ok(snapshot.nextBestAction.primary)
assert.equal(snapshot.supervisorVisibility.assistFeedReadOnly, true)
assert.ok(snapshot.supervisorVisibility.activeSupervisorCount >= 1)

const nba = resolveUnifiedNextBestAction({
  coachingState: null,
  liveSnapshot: null,
  conversationIntelligence: snapshot.conversationIntelligence,
  leadContext: { recommendedNextAction: "Review lead command center" },
  rankedAssistEvents: rankUnifiedAssistEvents(snapshot.feed),
})
assert.ok(nba.primary)
assert.ok(nba.supporting.length <= 3)

const partitioned = partitionUnifiedAssistFeed(rankUnifiedAssistEvents(snapshot.feed))
assert.ok(partitioned.topPriority.length <= 3)

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270608120000_voice_unified_operator_assist_phase_2b.sql"),
  "utf8",
)
assert.match(migration, /operator_assist_preferences/)
assert.match(migration, /voice_intelligence_event_status/)
assert.match(migration, /escalated/)

const bridgeSource = fs.readFileSync(path.join(process.cwd(), "lib/voice/browser-calling/workspace-bridge.ts"), "utf8")
assert.match(bridgeSource, /fetchUnifiedOperatorAssistSnapshot/)
assert.match(bridgeSource, /operatorAssist/)

const syncTypes = fs.readFileSync(path.join(process.cwd(), "lib/voice/browser-calling/types.ts"), "utf8")
assert.match(syncTypes, /operatorAssist/)

const liveCoachingPanel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-workspace-live-coaching-panel.tsx"),
  "utf8",
)
assert.doesNotMatch(liveCoachingPanel, /setInterval\(\(\) => \{\s*void refreshCoaching/s)

const centerPanel = fs.readFileSync(path.join(process.cwd(), "components/growth/growth-call-workspace-center-panel.tsx"), "utf8")
assert.match(centerPanel, /GrowthCallWorkspaceUnifiedAssistPanel/)
assert.doesNotMatch(centerPanel, /GrowthCallWorkspaceLiveCoachingPanel/)
assert.doesNotMatch(centerPanel, /GrowthCallWorkspaceConversationIntelligencePanel/)

const unifiedPanel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-workspace-unified-assist-panel.tsx"),
  "utf8",
)
assert.match(unifiedPanel, /VOICE_UNIFIED_OPERATOR_ASSIST_QA_MARKER/)
assert.match(unifiedPanel, /supervisor-visibility-strip/)
assert.match(unifiedPanel, /LiveCoachingGuidancePanel/)
assert.doesNotMatch(unifiedPanel, /setInterval/)

const workspace = fs.readFileSync(path.join(process.cwd(), "components/growth/growth-call-workspace.tsx"), "utf8")
assert.match(workspace, /data-voice-unified-operator-assist-qa-marker/)
assert.match(workspace, /operatorAssist=\{voiceBrowser\.snapshot\?\.operatorAssist/)
assert.doesNotMatch(workspace, /justify-end gap-2[\s\S]*Refresh/)

const intelligenceRail = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-workspace-intelligence-rail.tsx"),
  "utf8",
)
assert.match(intelligenceRail, /commandLeadFocusHref/)
assert.match(intelligenceRail, /buyingSignalsLabel/)
assert.doesNotMatch(intelligenceRail, /value="—"/)

const voicePatchRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/voice/calls/[callId]/intelligence/events/[eventId]/route.ts"),
  "utf8",
)
assert.match(voicePatchRoute, /mapLifecyclePatchAction/)
assert.match(voicePatchRoute, /VOICE_UNIFIED_OPERATOR_ASSIST_QA_MARKER/)

const prefsRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/operator-assist/preferences/route.ts"),
  "utf8",
)
assert.match(prefsRoute, /fetchOperatorAssistPreferences/)
assert.match(prefsRoute, /upsertOperatorAssistPreferences/)

console.log("voice-unified-operator-assist-phase-2b: all checks passed")
