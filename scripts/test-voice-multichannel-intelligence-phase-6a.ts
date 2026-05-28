/**
 * Unified multi-channel communications intelligence — Phase 6A regression checks.
 * Run: pnpm test:voice-multichannel-intelligence-phase-6a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  extractChannelTransitions,
  summarizeChannelContinuity,
  detectFailedChannels,
} from "../lib/voice/multi-channel-intelligence/channel-continuity"
import {
  buildCommunicationHealthSummary,
  detectCommunicationFatigue,
  detectUnresolvedCommunications,
} from "../lib/voice/multi-channel-intelligence/communication-health"
import {
  analyzeEscalationContinuity,
  generateEscalationContinuityRecommendations,
  generateCommunicationRecoveryRecommendations,
} from "../lib/voice/multi-channel-intelligence/escalation-continuity"
import {
  futureChannelEventType,
  isFutureChannelHook,
  validateFutureChannelHook,
} from "../lib/voice/multi-channel-intelligence/future-channel-hooks"
import { detectPreferredChannels } from "../lib/voice/multi-channel-intelligence/preferred-channel-detector"
import {
  generateMultichannelRecommendations,
  generateFollowUpTimingRecommendation,
} from "../lib/voice/multi-channel-intelligence/recommendations"
import {
  buildMultichannelCommandSummary,
  buildMultichannelWorkspaceSnapshot,
} from "../lib/voice/multi-channel-intelligence/snapshot-builder"
import {
  buildUnifiedCommunicationTimeline,
  capTimelineEvents,
  multichannelRetentionCutoffIso,
  staleThreadCutoffIso,
} from "../lib/voice/multi-channel-intelligence/timeline-builder"
import {
  VOICE_MULTICHANNEL_AUTONOMOUS_OMNICHANNEL_DISABLED,
  VOICE_MULTICHANNEL_AUTO_CHANNEL_SWITCH_DISABLED,
  VOICE_MULTICHANNEL_AUTO_SEND_DISABLED,
  VOICE_MULTICHANNEL_FATIGUE_CONTACT_THRESHOLD,
  VOICE_MULTICHANNEL_HIDDEN_SCORING_DISABLED,
  VOICE_MULTICHANNEL_INTELLIGENCE_QA_MARKER,
  VOICE_MULTICHANNEL_MAX_TIMELINE_EVENTS,
  VOICE_MULTICHANNEL_RETENTION_DAYS,
  VOICE_MULTICHANNEL_STALE_HOURS,
} from "../lib/voice/multi-channel-intelligence/types"
import { VOICE_SCHEMA_MIGRATION_ID, VOICE_SCHEMA_PROBE_VERSION } from "../lib/voice/schema-health"

assert.equal(VOICE_MULTICHANNEL_INTELLIGENCE_QA_MARKER, "voice-multichannel-intelligence-v1")
assert.equal(VOICE_SCHEMA_PROBE_VERSION, "v20")
assert.equal(VOICE_SCHEMA_MIGRATION_ID, "20270620120000_voice_multichannel_intelligence_phase_6a")
assert.equal(VOICE_MULTICHANNEL_AUTONOMOUS_OMNICHANNEL_DISABLED, true)
assert.equal(VOICE_MULTICHANNEL_AUTO_CHANNEL_SWITCH_DISABLED, true)
assert.equal(VOICE_MULTICHANNEL_AUTO_SEND_DISABLED, true)
assert.equal(VOICE_MULTICHANNEL_HIDDEN_SCORING_DISABLED, true)
assert.equal(VOICE_MULTICHANNEL_RETENTION_DAYS, 90)
assert.equal(VOICE_MULTICHANNEL_STALE_HOURS, 72)
assert.equal(VOICE_MULTICHANNEL_MAX_TIMELINE_EVENTS, 50)
assert.equal(VOICE_MULTICHANNEL_FATIGUE_CONTACT_THRESHOLD, 5)

const orgId = "00000000-0000-4000-8000-000000000001"
const threadId = "00000000-0000-4000-8000-000000000002"

const mockThread = {
  id: threadId,
  organizationId: orgId,
  threadType: "support" as const,
  relationshipMemoryProfileId: null,
  relatedCustomerId: null,
  relatedProspectId: null,
  relatedOpportunityId: null,
  primaryChannel: "voice" as const,
  currentState: "active" as const,
  escalationState: null,
  lastChannelUsed: "voice" as const,
  preferredChannel: null,
  communicationSummary: "Test thread",
  unresolvedIssueCount: 0,
  lastInteractionAt: new Date().toISOString(),
  metadata: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const mockEvents = [
  {
    id: "e1",
    organizationId: orgId,
    threadId,
    eventType: "voice_call_completed" as const,
    channel: "voice" as const,
    sourceSystem: "voice",
    evidenceText: "Inbound call completed",
    sourceSessionId: null,
    sourceCallId: null,
    payload: {},
    createdBy: null,
    createdAt: new Date(Date.now() - 5000).toISOString(),
  },
  {
    id: "e2",
    organizationId: orgId,
    threadId,
    eventType: "callback_completed" as const,
    channel: "callback" as const,
    sourceSystem: "missed_call_recovery",
    evidenceText: "Callback completed",
    sourceSessionId: null,
    sourceCallId: null,
    payload: {},
    createdBy: null,
    createdAt: new Date(Date.now() - 3000).toISOString(),
  },
  {
    id: "e3",
    organizationId: orgId,
    threadId,
    eventType: "escalation_triggered" as const,
    channel: "voice" as const,
    sourceSystem: "workflow_orchestration",
    evidenceText: "Escalation triggered",
    sourceSessionId: null,
    sourceCallId: null,
    payload: {},
    createdBy: null,
    createdAt: new Date().toISOString(),
  },
]

// Timeline builder
const timeline = buildUnifiedCommunicationTimeline(mockEvents)
assert.equal(timeline.length, 3)
assert.equal(timeline[0]?.eventType, "voice_call_completed")
assert.equal(capTimelineEvents(mockEvents, 2).length, 2)
assert.ok(multichannelRetentionCutoffIso(90).length > 0)
assert.ok(staleThreadCutoffIso(72).length > 0)

// Channel continuity
const transitions = extractChannelTransitions(mockEvents)
assert.ok(transitions.length >= 1)
const continuity = summarizeChannelContinuity(mockEvents)
assert.ok(continuity.channelsVisited.includes("voice"))
assert.ok(continuity.channelsVisited.includes("callback"))
const failed = detectFailedChannels([
  ...mockEvents,
  {
    ...mockEvents[0]!,
    id: "e4",
    eventType: "communication_failed",
    channel: "voicemail",
    evidenceText: "Voicemail failed",
    createdAt: new Date().toISOString(),
  },
])
assert.ok(failed.includes("voicemail"))

// Preferred channel detection
const preferred = detectPreferredChannels(mockEvents)
assert.ok(Array.isArray(preferred))
assert.ok(preferred.every((p) => p.hiddenScoringDisabled === true))
assert.ok(preferred.every((p) => p.operatorOverrideAllowed === true))

const overridePreferred = detectPreferredChannels(mockEvents, "callback")
assert.equal(overridePreferred[0]?.channel, "callback")
assert.ok(overridePreferred[0]?.reason.includes("override"))

// Escalation continuity
const escalationSummary = analyzeEscalationContinuity([
  ...mockEvents,
  { ...mockEvents[2]!, id: "e5", createdAt: new Date().toISOString() },
  { ...mockEvents[2]!, id: "e6", createdAt: new Date().toISOString() },
])
assert.ok(escalationSummary.escalationCount >= 1)

const escalationRecs = generateEscalationContinuityRecommendations({
  ...escalationSummary,
  escalationLoopDetected: true,
  escalationCount: 3,
})
assert.ok(escalationRecs.length > 0)
assert.ok(escalationRecs.every((r) => r.autonomousExecutionDisabled === true))

const recoveryRecs = generateCommunicationRecoveryRecommendations([
  {
    ...mockEvents[0]!,
    eventType: "communication_failed",
    evidenceText: "Call dropped",
  },
])
assert.equal(recoveryRecs.length, 1)

// Communication health
const health = buildCommunicationHealthSummary({ threads: [mockThread], events: mockEvents })
assert.ok(health.engagementContinuityScore >= 0)
assert.ok(["low", "medium", "high"].includes(health.relationshipCommunicationRisk))

const fatigueEvents = Array.from({ length: 6 }, (_, i) => ({
  ...mockEvents[0]!,
  id: `fatigue-${i}`,
  eventType: "callback_completed" as const,
  channel: "callback" as const,
}))
assert.equal(detectCommunicationFatigue(fatigueEvents), true)

const unresolved = detectUnresolvedCommunications([
  { ...mockThread, unresolvedIssueCount: 2, currentState: "stalled" },
])
assert.equal(unresolved.length, 1)

// Recommendations
const recommendations = generateMultichannelRecommendations({ events: mockEvents, preferredChannelInsights: preferred })
assert.ok(recommendations.length > 0)
assert.ok(recommendations.every((r) => r.requiresOperatorReview === true))

const followUp = generateFollowUpTimingRecommendation([
  {
    ...mockEvents[0]!,
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    eventType: "followup_recommended",
  },
])
assert.ok(followUp === null || followUp.requiresOperatorReview === true)

// Future channel hooks
assert.equal(isFutureChannelHook("sms"), true)
assert.equal(isFutureChannelHook("voice"), false)
assert.equal(futureChannelEventType("sms"), "sms_event_recorded")
assert.equal(futureChannelEventType("email"), "email_event_recorded")
assert.equal(futureChannelEventType("portal"), "portal_message_recorded")

const smsValidation = validateFutureChannelHook({ channel: "sms", eventType: "sms_event_recorded" })
assert.equal(smsValidation.allowed, true)
const badSms = validateFutureChannelHook({ channel: "sms", eventType: "voice_call_completed" })
assert.equal(badSms.allowed, false)

// Snapshots
const workspace = buildMultichannelWorkspaceSnapshot({
  activeThreads: [mockThread],
  recentEvents: mockEvents,
  preferredChannelInsights: preferred,
  health,
  recommendations,
})
assert.equal(workspace.qaMarker, "voice-multichannel-intelligence-v1")
assert.equal(workspace.autonomousOmnichannelDisabled, true)

const commandSummary = buildMultichannelCommandSummary({ activeThreads: [mockThread], health })
assert.equal(commandSummary.activeThreadCount, 1)

// Migration + API + UI
const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20270620120000_voice_multichannel_intelligence_phase_6a.sql",
)
assert.ok(fs.existsSync(migrationPath))
assert.ok(fs.readFileSync(migrationPath, "utf8").includes("voice_unified_communication_threads"))
assert.ok(fs.readFileSync(migrationPath, "utf8").includes("voice_unified_communication_events"))

const apiRoutes = [
  "app/api/platform/growth/voice/multichannel-intelligence/readiness/route.ts",
  "app/api/platform/growth/voice/multichannel-intelligence/workspace/route.ts",
  "app/api/platform/growth/voice/multichannel-intelligence/command-summary/route.ts",
  "app/api/platform/growth/voice/multichannel-intelligence/threads/route.ts",
  "app/api/platform/growth/voice/multichannel-intelligence/threads/[threadId]/route.ts",
]
for (const route of apiRoutes) {
  assert.ok(fs.existsSync(path.join(process.cwd(), route)), `Missing route: ${route}`)
}

const uiComponents = [
  "components/growth/growth-multichannel-intelligence-workspace.tsx",
  "components/growth/growth-multichannel-intelligence-readiness-section.tsx",
  "components/growth/growth-command-multichannel-intelligence-section.tsx",
]
for (const component of uiComponents) {
  const content = fs.readFileSync(path.join(process.cwd(), component), "utf8")
  assert.ok(content.includes("data-voice-multichannel-intelligence-qa-marker"))
}

const settingsPanel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-voice-infrastructure-settings-panel.tsx"),
  "utf8",
)
assert.ok(settingsPanel.includes("GrowthMultichannelIntelligenceReadinessSection"))
assert.ok(settingsPanel.includes("GrowthMultichannelIntelligenceWorkspace"))

const commandCenter = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-command-center-dashboard.tsx"),
  "utf8",
)
assert.ok(commandCenter.includes("GrowthCommandMultichannelIntelligenceSection"))

const schemaHealth = fs.readFileSync(path.join(process.cwd(), "lib/voice/schema-health.ts"), "utf8")
assert.match(schemaHealth, /"v20"/)
assert.match(schemaHealth, /voice_unified_communication_threads/)

console.log("voice-multichannel-intelligence-phase-6a: all checks passed")
