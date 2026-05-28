/**
 * Voice AI inbound receptionist — Phase 4A regression checks.
 * Run: pnpm test:voice-ai-receptionist-phase-4a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  createInitialReceptionistFsmState,
  transitionReceptionistFsm,
} from "../lib/voice/ai-receptionist/conversation-state-machine"
import { matchApprovedFaq } from "../lib/voice/ai-receptionist/faq-orchestrator"
import {
  buildAiDisclosurePrefix,
  buildLatencyFallbackResponse,
  buildProviderFailureFallbackResponse,
  buildSilenceFallbackResponse,
  detectProhibitedTopic,
  sanitizeReceptionistResponse,
  shouldEscalateIntent,
} from "../lib/voice/ai-receptionist/guardrails"
import { detectCallerIntent } from "../lib/voice/ai-receptionist/intent-router"
import { analyzeInterruption } from "../lib/voice/ai-receptionist/interruption-handler"
import {
  applyQualificationAnswer,
  buildDefaultQualificationFlow,
  isQualificationComplete,
  qualificationProgress,
} from "../lib/voice/ai-receptionist/qualification-flows"
import { deterministicReceptionistProvider } from "../lib/voice/ai-receptionist/deterministic-provider"
import { generateReceptionistResponseWithTimeout, stubReceptionistProvider } from "../lib/voice/ai-receptionist/provider-registry"
import { buildAiReceptionistWorkspaceSnapshot } from "../lib/voice/ai-receptionist/snapshot-builder"
import { buildReceptionistHandoffDraft, buildMissedCallRecoveryHook } from "../lib/voice/ai-receptionist/transfer-preparation"
import {
  VOICE_AI_RECEPTIONIST_AUTONOMOUS_OUTBOUND_DISABLED,
  VOICE_AI_RECEPTIONIST_BOUNDED_CONVERSATION_ONLY,
  VOICE_AI_RECEPTIONIST_LATENCY_TARGET_MS,
  VOICE_AI_RECEPTIONIST_PROVIDER_TIMEOUT_MS,
  VOICE_AI_RECEPTIONIST_QA_MARKER,
} from "../lib/voice/ai-receptionist/types"
import { buildAiReceptionistTwiml } from "../lib/voice/call-control/twilio-twiml"
import { VOICE_SCHEMA_MIGRATION_ID, VOICE_SCHEMA_PROBE_VERSION } from "../lib/voice/schema-health"

assert.equal(VOICE_AI_RECEPTIONIST_QA_MARKER, "voice-ai-receptionist-v1")
assert.equal(VOICE_SCHEMA_PROBE_VERSION, "v17")
assert.equal(VOICE_SCHEMA_MIGRATION_ID, "20270617120000_voice_ai_outbound_phase_5a")
assert.equal(VOICE_AI_RECEPTIONIST_AUTONOMOUS_OUTBOUND_DISABLED, true)
assert.equal(VOICE_AI_RECEPTIONIST_BOUNDED_CONVERSATION_ONLY, true)
assert.equal(VOICE_AI_RECEPTIONIST_PROVIDER_TIMEOUT_MS, 1500)
assert.equal(VOICE_AI_RECEPTIONIST_LATENCY_TARGET_MS, 1500)

const orgId = "00000000-0000-4000-8000-000000000001"
const flow = buildDefaultQualificationFlow(orgId)

// FSM — greeting → intent → qualification
let fsm = createInitialReceptionistFsmState()
assert.equal(fsm.phase, "greeting")

fsm = transitionReceptionistFsm({
  current: fsm,
  callerText: "Hi",
  intent: "general_inquiry",
  qualificationComplete: false,
  faqMatched: false,
  operatorJoined: false,
  interruptionDetected: false,
  providerFailed: false,
  afterHours: false,
})
assert.equal(fsm.phase, "intent_detection")

fsm = transitionReceptionistFsm({
  current: fsm,
  callerText: "I need service on a forklift",
  intent: "service_request",
  qualificationComplete: false,
  faqMatched: false,
  operatorJoined: false,
  interruptionDetected: false,
  providerFailed: false,
  afterHours: false,
})
assert.equal(fsm.phase, "qualification")
assert.equal(fsm.status, "qualification")

// Escalation on speak-to-human
const escalated = transitionReceptionistFsm({
  current: fsm,
  callerText: "I want to speak to a manager",
  intent: "speak_to_human",
  qualificationComplete: false,
  faqMatched: false,
  operatorJoined: false,
  interruptionDetected: false,
  providerFailed: false,
  afterHours: false,
})
assert.equal(escalated.status, "transfer_pending")
assert.equal(escalated.escalationRequired, true)

// Operator takeover
const takeover = transitionReceptionistFsm({
  current: fsm,
  callerText: "",
  intent: "service_request",
  qualificationComplete: false,
  faqMatched: false,
  operatorJoined: true,
  interruptionDetected: false,
  providerFailed: false,
  afterHours: false,
})
assert.equal(takeover.status, "operator_joined")

// Intent router
assert.equal(detectCallerIntent("I need to schedule an appointment"), "appointment_request")
assert.equal(detectCallerIntent("This is an emergency"), "emergency")
assert.equal(detectCallerIntent(""), "unknown")
assert.equal(shouldEscalateIntent("speak_to_human"), true)

// Interruption
const interruption = analyzeInterruption({
  callerSpeaking: true,
  aiSpeaking: true,
  lastCallerSegmentMs: 100,
})
assert.equal(interruption.interrupted, true)
assert.equal(interruption.cancelPendingResponse, true)

// FAQ safety
const faqEntries = [
  {
    id: "f1",
    organizationId: orgId,
    topic: "hours",
    questionPattern: "hours|open",
    approvedAnswer: "We are open weekdays 8-5.",
    escalationRequired: false,
    blocked: false,
    sortOrder: 1,
  },
  {
    id: "f2",
    organizationId: orgId,
    topic: "legal",
    questionPattern: "legal|lawsuit",
    approvedAnswer: "n/a",
    escalationRequired: true,
    blocked: false,
    sortOrder: 2,
  },
]
const faqMatch = matchApprovedFaq("What are your hours?", faqEntries)
assert.equal(faqMatch.matched, true)
if (faqMatch.matched) assert.match(faqMatch.entry.approvedAnswer, /weekdays/)

const blockedFaq = matchApprovedFaq("I have a legal question", faqEntries)
assert.equal(blockedFaq.matched, false)
if (!blockedFaq.matched) assert.equal(blockedFaq.reason, "escalation_required")

// Guardrails
const prohibited = detectProhibitedTopic("I need legal advice about my contract")
assert.ok(prohibited?.escalate)
const sanitized = sanitizeReceptionistResponse("I can book your appointment for tomorrow guaranteed.")
assert.match(sanitized.text, /operator will confirm/)
assert.ok(sanitized.violations.length > 0)
assert.match(buildSilenceFallbackResponse(), /operator/i)
assert.match(buildLatencyFallbackResponse(), /team member/i)
assert.match(buildProviderFailureFallbackResponse(), /team member/i)
assert.match(buildAiDisclosurePrefix(true), /automated receptionist/i)

// Qualification flow
let qualState: Record<string, unknown> = {}
for (const step of flow.steps) {
  qualState = applyQualificationAnswer(qualState, step.key, `answer-${step.key}`)
}
assert.equal(isQualificationComplete(flow, qualState), true)
const progress = qualificationProgress(flow, qualState)
assert.equal(progress.completed, 3)
assert.equal(progress.total, 3)

async function main() {
  const deterministic = await deterministicReceptionistProvider.generateResponse({
    organizationId: orgId,
    voiceCallId: "call-1",
    callerText: "Hello",
    phase: "greeting",
    intent: null,
    relationshipSummary: null,
    faqAnswer: null,
    qualificationPrompt: null,
    afterHours: false,
  })
  assert.ok(deterministic.spokenText.length > 0)
  assert.equal(deterministic.providerId, "deterministic")

  const slowProvider = {
    id: "stub" as const,
    isConfigured: () => true,
    generateResponse: () =>
      new Promise<never>(() => {
        /* never resolves — triggers timeout race */
      }),
  }
  const timedOut = await generateReceptionistResponseWithTimeout(slowProvider, {
    organizationId: orgId,
    voiceCallId: "call-1",
    callerText: "Hello",
    phase: "greeting",
    intent: null,
    relationshipSummary: null,
    faqAnswer: null,
    qualificationPrompt: null,
    afterHours: false,
  })
  assert.match(timedOut.evidenceText, /timeout/i)
  assert.equal(timedOut.latencyMs, VOICE_AI_RECEPTIONIST_PROVIDER_TIMEOUT_MS)

  const stub = await stubReceptionistProvider.generateResponse({
    organizationId: orgId,
    voiceCallId: "call-1",
    callerText: "test",
    phase: "greeting",
    intent: null,
    relationshipSummary: null,
    faqAnswer: null,
    qualificationPrompt: null,
    afterHours: false,
  })
  assert.match(stub.spokenText, /stub/)

  // Snapshot + handoff
  const snapshot = buildAiReceptionistWorkspaceSnapshot({
    voiceCallId: "call-1",
    session: {
      id: "sess-1",
      organizationId: orgId,
      voiceCallId: "call-1",
      voiceConferenceId: null,
      relationshipMemoryProfileId: null,
      receptionistStatus: "qualification",
      currentConversationPhase: "qualification",
      escalationRiskLevel: "low",
      activeOperatorId: null,
      aiProvider: "deterministic",
      transcriptSessionId: null,
      mediaSessionId: null,
      qualificationState: qualState,
      handoffSummaryDraft: null,
      latencyMsLast: 120,
      startedAt: new Date().toISOString(),
      endedAt: null,
      metadata: {},
    },
    recentEvents: [],
    currentIntent: "service_request",
    qualificationFlow: flow,
  })
  assert.equal(snapshot.qaMarker, VOICE_AI_RECEPTIONIST_QA_MARKER)
  assert.equal(snapshot.autonomousOutboundDisabled, true)
  assert.equal(snapshot.operatorTakeoverAvailable, true)

  const handoff = buildReceptionistHandoffDraft({
    session: snapshot.session!,
    callerIntent: "service_request",
    recentTranscript: ["Need forklift service"],
  })
  assert.match(handoff.summary, /service/i)

  const recovery = buildMissedCallRecoveryHook({
    voiceCallId: "call-1",
    callerNumber: "+14155550199",
    handoff,
  })
  assert.equal(recovery.autonomousOutboundDisabled, true)

  const twiml = buildAiReceptionistTwiml({
    greetingText: "Thank you for calling.",
    mediaStreamUrl: "wss://example.com/stream",
  })
  assert.match(twiml, /Thank you for calling/)
  assert.match(twiml, /Stream/)

  const schemaHealth = fs.readFileSync(path.join(process.cwd(), "lib/voice/schema-health.ts"), "utf8")
  assert.match(schemaHealth, /voice_ai_receptionist_sessions/)
  assert.match(schemaHealth, /"v17"/)

  const migration = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20270614120000_voice_ai_inbound_receptionist_phase_4a.sql"),
    "utf8",
  )
  assert.match(migration, /voice_ai_receptionist_sessions/)
  assert.match(migration, /voice_ai_receptionist_events/)

  const workspace = fs.readFileSync(path.join(process.cwd(), "components/growth/growth-call-workspace.tsx"), "utf8")
  assert.match(workspace, /data-voice-ai-receptionist-qa-marker/)

  const receptionistSection = fs.readFileSync(
    path.join(process.cwd(), "components/growth/growth-call-workspace-ai-receptionist-section.tsx"),
    "utf8",
  )
  assert.match(receptionistSection, /VOICE_AI_RECEPTIONIST_QA_MARKER/)
  assert.match(receptionistSection, /ai-receptionist-takeover/)

  const readinessSection = fs.readFileSync(
    path.join(process.cwd(), "components/growth/growth-ai-receptionist-readiness-section.tsx"),
    "utf8",
  )
  assert.match(readinessSection, /Autonomous outbound disabled/)

  const routingResolver = fs.readFileSync(path.join(process.cwd(), "lib/voice/routing/routing-resolver.ts"), "utf8")
  assert.match(routingResolver, /isVoiceAiReceptionistEnabled/)

  const inboundHandler = fs.readFileSync(path.join(process.cwd(), "lib/voice/call-control/inbound-handler.ts"), "utf8")
  assert.match(inboundHandler, /startAiReceptionistSessionForCall/)
  assert.match(inboundHandler, /startAiReceptionistSessionForCall/)

  console.log("voice-ai-receptionist-phase-4a: all checks passed")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
