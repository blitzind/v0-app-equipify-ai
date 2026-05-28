/**
 * Voice deep copilot — Phase 3B regression checks.
 * Run: pnpm test:voice-deep-copilot-phase-3b
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { detectConversationPhase } from "../lib/voice/copilot-strategy/phase-detection"
import { mapObjectionStage } from "../lib/voice/copilot-strategy/objection-stage"
import { analyzeDiscoveryCompleteness } from "../lib/voice/copilot-strategy/discovery-completeness"
import { analyzeEscalationLikelihood } from "../lib/voice/copilot-strategy/escalation-likelihood"
import { analyzeConversationPacing } from "../lib/voice/copilot-strategy/pacing-analysis"
import { detectCallQualityInsights } from "../lib/voice/copilot-strategy/call-quality"
import { buildStructuredCallNotes, buildStructuredFollowUpOutline } from "../lib/voice/copilot-strategy/structured-notes"
import { applyAdaptiveCopilotPrioritization, isOperatorOverloadActive } from "../lib/voice/copilot-strategy/prioritization"
import { generateDeepCopilotDrafts } from "../lib/voice/copilot-strategy/deep-copilot-drafts"
import { buildCopilotStrategySnapshot } from "../lib/voice/copilot-strategy/strategy-engine"
import {
  VOICE_CONVERSATION_PHASES,
  VOICE_DEEP_COPILOT_MAX_ACTIVE_SUGGESTIONS,
  VOICE_DEEP_COPILOT_OVERLOAD_ASSIST_THRESHOLD,
  VOICE_DEEP_COPILOT_QA_MARKER,
  VOICE_DEEP_COPILOT_SUGGESTION_TYPES,
} from "../lib/voice/copilot-strategy/types"
import {
  sanitizeCopilotStructuredDraft,
  validateAndSanitizeStructuredDrafts,
} from "../lib/voice/ai-copilot/structured-output-validation"
import { isOpenAiCopilotConfigured } from "../lib/voice/ai-copilot/openai-provider"
import { VOICE_DEEP_COPILOT_QA_MARKER as SNAPSHOT_DEEP_MARKER } from "../lib/voice/ai-copilot/types"
import { VOICE_SCHEMA_MIGRATION_ID, VOICE_SCHEMA_PROBE_VERSION } from "../lib/voice/schema-health"

assert.equal(VOICE_DEEP_COPILOT_QA_MARKER, "voice-deep-copilot-v1")
assert.equal(SNAPSHOT_DEEP_MARKER, "voice-deep-copilot-v1")
assert.equal(VOICE_SCHEMA_PROBE_VERSION, "v18")
assert.equal(VOICE_SCHEMA_MIGRATION_ID, "20270618120000_voice_observability_analytics_phase_5b")
assert.equal(VOICE_CONVERSATION_PHASES.length, 10)
assert.equal(VOICE_DEEP_COPILOT_SUGGESTION_TYPES.length, 11)
assert.equal(VOICE_DEEP_COPILOT_MAX_ACTIVE_SUGGESTIONS, 6)
assert.equal(VOICE_DEEP_COPILOT_OVERLOAD_ASSIST_THRESHOLD, 5)

const transcript = [
  "Hi thanks for calling",
  "The price is too high for our budget this quarter",
  "We might need to talk to a manager about this",
]

const phase = detectConversationPhase({
  transcriptTexts: transcript,
  objectionCount: 2,
  buyingSignalCount: 0,
  riskCount: 1,
  retentionRiskActive: false,
  operatorAssistCategoryCounts: { objection: 2, risk: 1 },
})
assert.ok(["objection_handling", "pricing_discussion", "escalation_risk"].includes(phase.phase))
assert.ok(phase.confidenceScore >= 0.5)

const objectionStage = mapObjectionStage({
  objectionEvents: [{ title: "Pricing", evidenceText: transcript[1] }],
  transcriptTexts: transcript,
})
assert.ok(["surfaced", "unresolved", "addressing", "exploring"].includes(objectionStage.stage))

const discovery = analyzeDiscoveryCompleteness(transcript)
assert.ok(discovery.score >= 0)

const escalation = analyzeEscalationLikelihood({
  riskEventCount: 1,
  objectionCount: 2,
  interruptionCount: 0,
  transcriptTexts: transcript,
  retentionRiskActive: false,
})
assert.ok(["low", "moderate", "elevated", "critical"].includes(escalation.level))

const pacing = analyzeConversationPacing([
  { speakerType: "operator", text: "Let me explain our pricing model in detail ".repeat(3) },
  { speakerType: "customer", text: "Okay" },
])
assert.ok(pacing.operatorTalkPercent >= 50)

const strategy = buildCopilotStrategySnapshot({
  operatorAssist: {
    feed: [
      {
        id: "obj-1",
        source: "voice_intelligence",
        sourceKind: "voice_objection",
        lifecycleStatus: "active",
        category: "objection",
        eventType: "pricing_objection",
        severity: "high",
        title: "Pricing objection",
        operatorPrompt: "Address pricing",
        recommendation: "Acknowledge budget",
        evidenceText: transcript[1],
        confidenceScore: 0.9,
        priorityLabel: "High",
        priorityScore: 90,
        surfacedAt: new Date().toISOString(),
        expiresAt: null,
        dedupeKey: "obj:1",
        transcriptSegmentId: null,
        sequenceNumber: null,
        voiceCallId: "call-1",
        growthGuidanceEventId: null,
        coachingLeadId: null,
        realtimeSessionId: null,
      },
    ],
    topPriority: [],
    additional: [],
    nextBestAction: { primary: null, supporting: [] },
    qaMarker: "voice-unified-operator-assist-v1",
    generatedAt: new Date().toISOString(),
    passiveModeEnabled: true,
    autonomousActionsDisabled: true,
    canonicalTranscriptSource: "voice_segments",
    coachingState: null,
    liveSnapshot: null,
    coachingMode: "transcript_only",
    coachingLeadId: null,
    realtimeSessionId: null,
    voiceCallId: "call-1",
    conversationIntelligence: null,
    interruptionSummary: null,
    supervisorVisibility: null,
    preferences: null,
  },
  liveTranscript: {
    qaMarker: "voice-media-streaming-v1",
    connectionStatus: "connected",
    transcriptDelayMs: 100,
    mediaSessionId: "m1",
    transcriptSessionId: "t1",
    segments: transcript.map((text, i) => ({
      id: `s${i}`,
      speakerIdentity: i % 2 === 0 ? "op" : "cust",
      speakerType: i % 2 === 0 ? "operator" : "customer",
      speakerLabel: i % 2 === 0 ? "Operator" : "Customer",
      transcriptText: text,
      confidenceScore: 0.9,
      startedAt: null,
      endedAt: null,
      sequenceNumber: i + 1,
    })),
    lastSequenceNumber: 3,
  },
  retentionIntelligence: null,
})

assert.equal(strategy.qaMarker, VOICE_DEEP_COPILOT_QA_MARKER)
assert.ok(strategy.callQualityInsights.length >= 0)

const notes = buildStructuredCallNotes({
  transcriptTexts: transcript,
  objectionEvents: [{ title: "Pricing", evidenceText: transcript[1] }],
  buyingSignalEvents: [],
  riskEvents: [],
  phase: phase.phase,
})
assert.ok(notes.keyObjections.length >= 1)

const followUp = buildStructuredFollowUpOutline({
  notes,
  phase: phase.phase,
  retentionRecovery: false,
  expansionSignal: false,
})
assert.ok(followUp.callbackOutline.length > 10)

const deepDrafts = generateDeepCopilotDrafts(
  {
    organizationId: "org-1",
    voiceCallId: "call-1",
    callState: "active",
    operatorAssistEvents: [
      {
        id: "obj-1",
        source: "voice_intelligence",
        category: "objection",
        title: "Pricing",
        evidenceText: transcript[1],
        recommendation: "Acknowledge",
      },
    ],
    retentionSignals: [],
    revenueSignals: [],
    transcriptWindow: transcript.map((text, i) => ({
      id: `s${i}`,
      sequenceNumber: i,
      speakerType: "customer",
      text,
    })),
    relationshipSummary: null,
    contactLabel: "Alex",
    strategy,
  },
  strategy,
)
assert.ok(deepDrafts.some((d) => d.suggestionType === "objection_strategy" || d.suggestionType === "pricing_positioning"))

const prioritized = applyAdaptiveCopilotPrioritization(
  [
    ...deepDrafts,
    {
      suggestionType: "compliance_reminder",
      priority: 40,
      title: "Low",
      body: "Reminder",
      evidenceText: transcript[1],
      sourceEventIds: [],
    },
  ],
  { ...strategy, escalationLikelihood: { ...escalation, level: "critical" }, escalationSafeModeEnabled: true },
  6,
)
assert.ok(prioritized.every((d) => d.suggestionType !== "compliance_reminder" || d.priority >= 45))

assert.equal(isOperatorOverloadActive(5), true)
assert.equal(isOperatorOverloadActive(2), false)

const quality = detectCallQualityInsights({
  pacing,
  discovery,
  objectionStage,
  escalation,
  buyingSignalCount: 0,
  closeAttemptDetected: false,
  interruptionCount: 0,
  segmentCount: 3,
})
assert.ok(Array.isArray(quality))

const validDraft = sanitizeCopilotStructuredDraft({
  suggestionType: "objection_strategy",
  priority: 80,
  title: "Test",
  body: "Body text here",
  evidenceText: transcript[1],
  sourceEventIds: [],
})
assert.ok(validDraft)

const invalidDraft = sanitizeCopilotStructuredDraft({
  suggestionType: "invalid_type",
  title: "",
  body: "",
  evidenceText: "x",
})
assert.equal(invalidDraft, null)

assert.equal(validateAndSanitizeStructuredDrafts([validDraft, invalidDraft, null]).length, 1)

const prevOpenAi = process.env.VOICE_AI_COPILOT_OPENAI_ENABLED
delete process.env.VOICE_AI_COPILOT_OPENAI_ENABLED
assert.equal(isOpenAiCopilotConfigured(), false)
if (prevOpenAi) process.env.VOICE_AI_COPILOT_OPENAI_ENABLED = prevOpenAi

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270613120000_voice_deep_copilot_phase_3b.sql"),
  "utf8",
)
assert.match(migration, /voice_operator_performance_insights/)
assert.match(migration, /objection_strategy/)

const ui = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-workspace-ai-copilot-section.tsx"),
  "utf8",
)
assert.match(ui, /voice-deep-copilot-v1|VOICE_DEEP_COPILOT_QA_MARKER/)
assert.match(ui, /Phase:/)
assert.match(ui, /Top prioritized guidance/)

console.log("voice-deep-copilot-phase-3b: all checks passed")
