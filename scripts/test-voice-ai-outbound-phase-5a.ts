/**
 * Voice AI outbound — Phase 5A regression checks.
 * Run: pnpm test:voice-ai-outbound-phase-5a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  canApplyOutboundApproval,
  canInitiateOutboundSession,
  canOperatorTakeover,
  applyOutboundApprovalTransition,
} from "../lib/voice/ai-outbound/approval-workflow"
import {
  createInitialOutboundFsmState,
  detectOptOutIntent,
  detectVoicemailSignal,
  transitionOutboundFsm,
} from "../lib/voice/ai-outbound/conversation-state-machine"
import {
  buildOutboundAiDisclosure,
  buildOutboundOptOutTerminationMessage,
  buildOutboundSilenceFallback,
  buildVoicemailScript,
  sanitizeOutboundResponse,
} from "../lib/voice/ai-outbound/guardrails"
import { evaluateOutboundEscalation } from "../lib/voice/ai-outbound/escalation-handler"
import {
  classifyUrgency,
  isOutboundQualificationComplete,
} from "../lib/voice/ai-outbound/qualification-flows"
import {
  buildSchedulingPrompt,
  detectSchedulingIntent,
  requiresHumanSchedulingConfirmation,
} from "../lib/voice/ai-outbound/scheduling-orchestration"
import { deterministicOutboundProvider } from "../lib/voice/ai-outbound/deterministic-provider"
import { generateOutboundResponseWithTimeout, stubOutboundProvider } from "../lib/voice/ai-outbound/provider-registry"
import { analyzeVoicemailSignal } from "../lib/voice/ai-outbound/voicemail-handler"
import {
  buildOutboundApprovalQueueSnapshot,
  buildOutboundWorkspaceSnapshot,
} from "../lib/voice/ai-outbound/snapshot-builder"
import {
  VOICE_AI_OUTBOUND_APPROVAL_REQUIRED,
  VOICE_AI_OUTBOUND_AUTONOMOUS_COLD_CALLING_DISABLED,
  VOICE_AI_OUTBOUND_AUTONOMOUS_OUTBOUND_DISABLED,
  VOICE_AI_OUTBOUND_BOUNDED_CONVERSATION_ONLY,
  VOICE_AI_OUTBOUND_MAX_ACTIVE_SESSIONS_PER_ORG,
  VOICE_AI_OUTBOUND_MAX_CONCURRENT_INITIATIONS,
  VOICE_AI_OUTBOUND_MAX_RESPONSE_CHARS,
  VOICE_AI_OUTBOUND_MAX_RETRY_ATTEMPTS,
  VOICE_AI_OUTBOUND_PROVIDER_TIMEOUT_MS,
  VOICE_AI_OUTBOUND_QA_MARKER,
  VOICE_AI_OUTBOUND_WORKFLOW_TYPES,
} from "../lib/voice/ai-outbound/types"
import { VOICE_SCHEMA_MIGRATION_ID, VOICE_SCHEMA_PROBE_VERSION } from "../lib/voice/schema-health"

assert.equal(VOICE_AI_OUTBOUND_QA_MARKER, "voice-ai-outbound-v1")
assert.equal(VOICE_SCHEMA_PROBE_VERSION, "v20")
assert.equal(VOICE_SCHEMA_MIGRATION_ID, "20270620120000_voice_multichannel_intelligence_phase_6a")
assert.equal(VOICE_AI_OUTBOUND_AUTONOMOUS_OUTBOUND_DISABLED, true)
assert.equal(VOICE_AI_OUTBOUND_AUTONOMOUS_COLD_CALLING_DISABLED, true)
assert.equal(VOICE_AI_OUTBOUND_APPROVAL_REQUIRED, true)
assert.equal(VOICE_AI_OUTBOUND_BOUNDED_CONVERSATION_ONLY, true)
assert.equal(VOICE_AI_OUTBOUND_MAX_ACTIVE_SESSIONS_PER_ORG, 4)
assert.equal(VOICE_AI_OUTBOUND_MAX_CONCURRENT_INITIATIONS, 2)
assert.equal(VOICE_AI_OUTBOUND_MAX_RETRY_ATTEMPTS, 2)
assert.equal(VOICE_AI_OUTBOUND_PROVIDER_TIMEOUT_MS, 2000)
assert.ok(VOICE_AI_OUTBOUND_WORKFLOW_TYPES.includes("missed_call_callback"))
assert.ok(VOICE_AI_OUTBOUND_WORKFLOW_TYPES.includes("operator_assisted_callback"))

// Approval workflow — no autonomous initiation
assert.equal(canApplyOutboundApproval("approve", "pending_operator_approval"), true)
assert.equal(canApplyOutboundApproval("approve", "active"), false)
assert.equal(canInitiateOutboundSession("queued"), true)
assert.equal(canInitiateOutboundSession("pending_operator_approval"), false)
assert.equal(canOperatorTakeover("active"), true)
assert.equal(canOperatorTakeover("completed"), false)

const approved = applyOutboundApprovalTransition("approve")
assert.equal(approved?.status, "queued")
assert.equal(approved?.supervisionMode, "operator_supervised")

// FSM — approval → opening → active
let fsm = createInitialOutboundFsmState(false)
assert.equal(fsm.phase, "approval_pending")
assert.equal(fsm.status, "pending_operator_approval")

fsm = transitionOutboundFsm({
  current: fsm,
  calleeText: "Hello",
  workflowType: "missed_call_callback",
  operatorJoined: false,
  operatorApproved: true,
  complianceBlocked: false,
  providerFailed: false,
  silenceDetected: false,
  interruptionDetected: false,
})
assert.equal(fsm.phase, "opening")

fsm = transitionOutboundFsm({
  current: fsm,
  calleeText: "Yes, now works",
  workflowType: "missed_call_callback",
  operatorJoined: false,
  operatorApproved: true,
  complianceBlocked: false,
  providerFailed: false,
  silenceDetected: false,
  interruptionDetected: false,
})
assert.equal(fsm.phase, "callback_offer")
assert.equal(fsm.status, "active")

// Opt-out termination
const optOutFsm = transitionOutboundFsm({
  current: fsm,
  calleeText: "Stop calling me, take me off your list",
  workflowType: "missed_call_callback",
  operatorJoined: false,
  operatorApproved: true,
  complianceBlocked: false,
  providerFailed: false,
  silenceDetected: false,
  interruptionDetected: false,
})
assert.equal(optOutFsm.optOutDetected, true)
assert.equal(optOutFsm.phase, "terminated")
assert.equal(detectOptOutIntent("do not call"), true)

// Voicemail detection
assert.equal(detectVoicemailSignal("Please leave a message after the tone"), true)
const vm = analyzeVoicemailSignal({
  calleeText: "You have reached voicemail",
  organizationName: "Equipify",
  callbackNumber: "+14155550100",
  workflowType: "voicemail_followup",
})
assert.equal(vm.detected, true)
assert.ok(vm.script?.includes("Equipify"))

// Escalation
const escalation = evaluateOutboundEscalation({
  confusionCount: 3,
  frustrationCount: 0,
  providerFailed: false,
  guardrailEscalate: false,
  operatorRequested: false,
  schedulingComplex: false,
  confusionThreshold: 3,
  frustrationThreshold: 2,
})
assert.equal(escalation.shouldEscalate, true)
assert.equal(escalation.reason, "confusion_threshold")

// Scheduling — no autonomous booking
assert.equal(detectSchedulingIntent("Can we reschedule for tomorrow?"), "reschedule")
assert.equal(requiresHumanSchedulingConfirmation("reschedule"), true)
assert.ok(buildSchedulingPrompt("appointment_confirmation", "confirm").includes("team member"))

// Qualification
assert.equal(classifyUrgency("This is urgent, equipment is down today"), "high")

// Guardrails
const sanitized = sanitizeOutboundResponse(
  "I booked your appointment and guarantee the lowest price with legal advice.",
)
assert.ok(sanitized.violations.length > 0)
assert.ok(sanitized.text.length <= VOICE_AI_OUTBOUND_MAX_RESPONSE_CHARS + 3)

assert.ok(buildOutboundAiDisclosure("Equipify").includes("Equipify"))
assert.ok(buildVoicemailScript({ organizationName: "Equipify", callbackNumber: null, workflowLabel: "test" }).includes("not an urgent"))
assert.ok(buildOutboundSilenceFallback().includes("team member"))
assert.ok(buildOutboundOptOutTerminationMessage().includes("will not contact"))

// Provider
async function providerTests() {
  const det = await deterministicOutboundProvider.generateResponse({
    organizationId: "org-1",
    sessionId: "sess-1",
    phoneNumber: "+14155550199",
    calleeText: "",
    phase: "opening",
    workflowType: "missed_call_callback",
    organizationName: "Equipify",
    messagePreview: null,
    qualificationPrompt: null,
    schedulingPrompt: null,
    voicemailMode: false,
  })
  assert.ok(det.spokenText.length > 0)
  assert.equal(det.providerId, "deterministic")

  const stub = await generateOutboundResponseWithTimeout(stubOutboundProvider, {
    organizationId: "org-1",
    sessionId: "sess-1",
    phoneNumber: "+14155550199",
    calleeText: "Hello",
    phase: "opening",
    workflowType: "qualification_callback",
    organizationName: null,
    messagePreview: null,
    qualificationPrompt: null,
    schedulingPrompt: null,
    voicemailMode: false,
  })
  assert.ok(stub.spokenText.length > 0)
}
void providerTests()

// Snapshots
const queue = buildOutboundApprovalQueueSnapshot({ pendingSessions: [], blockedCount: 0 })
assert.equal(queue.qaMarker, "voice-ai-outbound-v1")
assert.ok(queue.message.includes("approval"))

const workspace = buildOutboundWorkspaceSnapshot({
  activeSessions: [],
  recentEvents: [],
  pendingApprovalCount: 0,
})
assert.equal(workspace.autonomousOutboundDisabled, true)
assert.equal(workspace.approvalRequired, true)

// Migration file exists
const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20270617120000_voice_ai_outbound_phase_5a.sql",
)
assert.ok(fs.existsSync(migrationPath))
assert.ok(fs.readFileSync(migrationPath, "utf8").includes("voice_ai_outbound_sessions"))
assert.ok(fs.readFileSync(migrationPath, "utf8").includes("voice_ai_outbound_events"))

// API routes exist
const routes = [
  "app/api/platform/growth/voice/ai-outbound/readiness/route.ts",
  "app/api/platform/growth/voice/ai-outbound/approval-queue/route.ts",
  "app/api/platform/growth/voice/ai-outbound/sessions/route.ts",
  "app/api/platform/growth/voice/ai-outbound/sessions/[sessionId]/route.ts",
]
for (const route of routes) {
  assert.ok(fs.existsSync(path.join(process.cwd(), route)), `Missing route: ${route}`)
}

// UI components
assert.ok(fs.existsSync(path.join(process.cwd(), "components/growth/growth-ai-outbound-readiness-section.tsx")))
assert.ok(fs.existsSync(path.join(process.cwd(), "components/growth/growth-ai-outbound-approval-panel.tsx")))

console.log("voice-ai-outbound-phase-5a: all checks passed")
