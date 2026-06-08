/**
 * Voice drop Twilio provider — VD-1B certification & observability harness.
 * Run: pnpm test:voice-drop-twilio-vd-1b
 *
 * No live Twilio calls are placed during this script.
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  setVoiceDropTwilioCallCreateOverrideForTests,
} from "../lib/voice/voice-drops/twilio-voice-drop-client"
import { twilioVoiceDropProvider } from "../lib/voice/voice-drops/twilio-voice-drop-provider"
import {
  evaluateVoiceDropTwilioQueueGate,
  VOICE_DROP_TWILIO_VD_1B_QA_MARKER,
} from "../lib/voice/voice-drops/twilio-voice-drop-gates"
import {
  mapTwilioTerminalCallStatusToFailureReason,
  planVoiceDropStatusWebhookUpdate,
} from "../lib/voice/voice-drops/twilio-voice-drop-status-mapping"
import { resolveVoiceDropTwimlDeliveryContext } from "../lib/voice/voice-drops/twilio-voice-drop-twiml-context"
import {
  buildVoiceDropOutboundTwiml,
  mapVoiceDropAnsweredByToDeliveryOutcome,
} from "../lib/voice/voice-drops/twilio-voice-drop-twiml"
import { mapDeliveryAttemptToEvidenceView } from "../lib/voice/voice-drops/voice-drop-delivery-evidence-types"
import {
  VOICE_DROP_APPROVAL_REQUIRED,
  VOICE_DROP_AUTONOMOUS_OUTBOUND_DISABLED,
} from "../lib/voice/voice-drops/types"

const REQUIRED_FILES = [
  "lib/voice/voice-drops/twilio-voice-drop-gates.ts",
  "lib/voice/voice-drops/twilio-voice-drop-status-mapping.ts",
  "lib/voice/voice-drops/twilio-voice-drop-twiml-context.ts",
  "lib/voice/voice-drops/voice-drop-delivery-evidence-types.ts",
  "lib/voice/voice-drops/voice-drop-delivery-evidence-service.ts",
  "app/api/voice/webhooks/twilio/voice-drop/twiml/route.ts",
  "app/api/voice/webhooks/twilio/voice-drop/status/route.ts",
  "components/growth/growth-voice-drop-delivery-evidence-panel.tsx",
]

const REQUIRED_EXPORTS: Array<{ file: string; pattern: RegExp }> = [
  { file: "lib/voice/voice-drops/twilio-voice-drop-gates.ts", pattern: /export function evaluateVoiceDropTwilioQueueGate/ },
  { file: "lib/voice/voice-drops/twilio-voice-drop-status-mapping.ts", pattern: /export function planVoiceDropStatusWebhookUpdate/ },
  { file: "lib/voice/voice-drops/twilio-voice-drop-twiml-context.ts", pattern: /export function resolveVoiceDropTwimlDeliveryContext/ },
  { file: "lib/voice/voice-drops/voice-drop-delivery-evidence-service.ts", pattern: /export async function fetchVoiceDropCampaignDeliveryEvidence/ },
  { file: "lib/voice/voice-drops/twilio-voice-drop-client.ts", pattern: /export function setVoiceDropTwilioCallCreateOverrideForTests/ },
]

assert.equal(VOICE_DROP_TWILIO_VD_1B_QA_MARKER, "voice-drop-twilio-vd-1b")
assert.equal(VOICE_DROP_AUTONOMOUS_OUTBOUND_DISABLED, true)
assert.equal(VOICE_DROP_APPROVAL_REQUIRED, true)

for (const relativePath of REQUIRED_FILES) {
  assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing required file: ${relativePath}`)
}

for (const entry of REQUIRED_EXPORTS) {
  const source = fs.readFileSync(path.join(process.cwd(), entry.file), "utf8")
  assert.match(source, entry.pattern, `Missing export in ${entry.file}`)
}

const telemetry = fs.readFileSync(path.join(process.cwd(), "lib/voice/telemetry.ts"), "utf8")
assert.match(telemetry, /voice_drop_provider_blocked/)
assert.match(telemetry, /voice_drop_status_persisted/)
assert.match(telemetry, /voice_drop_status_persist_failed/)

const providerSource = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/voice-drops/twilio-voice-drop-provider.ts"),
  "utf8",
)
assert.match(providerSource, /evaluateVoiceDropTwilioQueueGate/)
assert.match(providerSource, /voice_drop_provider_call_created/)

// --- TwiML context certification ---
const machineContext = resolveVoiceDropTwimlDeliveryContext({
  recipient: { campaignId: "camp", renderedMessagePreview: "Hello from Equipify." },
  campaign: { messageTemplate: "Fallback", voiceId: "Polly.Joanna" },
  answeredBy: "machine_end_beep",
})
assert.equal(machineContext.ok, true)
if (machineContext.ok) {
  assert.match(machineContext.body, /<Say/)
  assert.match(machineContext.body, /Hello from Equipify/)
}

const humanContext = resolveVoiceDropTwimlDeliveryContext({
  recipient: { campaignId: "camp", renderedMessagePreview: "Should not play" },
  campaign: { messageTemplate: "Fallback", voiceId: null },
  answeredBy: "human",
})
assert.equal(humanContext.ok, true)
if (humanContext.ok) {
  assert.doesNotMatch(humanContext.body, /Should not play/)
  assert.match(humanContext.body, /<Hangup\/>/)
}

const unknownContext = resolveVoiceDropTwimlDeliveryContext({
  recipient: { campaignId: "camp", renderedMessagePreview: "Msg" },
  campaign: { messageTemplate: "Msg", voiceId: null },
  answeredBy: "unknown",
})
assert.equal(unknownContext.ok, true)
if (unknownContext.ok) assert.match(unknownContext.body, /<Hangup\/>/)

assert.equal(resolveVoiceDropTwimlDeliveryContext({
  recipient: null,
  campaign: { messageTemplate: "x", voiceId: null },
  answeredBy: "machine_end_beep",
}).ok, false)

assert.equal(resolveVoiceDropTwimlDeliveryContext({
  recipient: { campaignId: "c", renderedMessagePreview: null },
  campaign: null,
  answeredBy: "machine_end_beep",
}).ok, false)

const emptyTemplate = resolveVoiceDropTwimlDeliveryContext({
  recipient: { campaignId: "c", renderedMessagePreview: "   " },
  campaign: { messageTemplate: "   ", voiceId: null },
  answeredBy: "machine_end_beep",
})
assert.equal(emptyTemplate.ok, false)
if (!emptyTemplate.ok) assert.equal(emptyTemplate.error, "empty_message_template")

const audioContext = resolveVoiceDropTwimlDeliveryContext({
  recipient: { campaignId: "c", renderedMessagePreview: "ignored" },
  campaign: { messageTemplate: "ignored", voiceId: "https://cdn.example.com/drop.mp3" },
  answeredBy: "machine_end_beep",
})
assert.equal(audioContext.ok, true)
if (audioContext.ok) assert.match(audioContext.body, /<Play>https:\/\/cdn\.example\.com\/drop\.mp3<\/Play>/)

// --- Status callback mapping certification ---
const nowIso = "2026-06-08T12:00:00.000Z"
const deliveredPlan = planVoiceDropStatusWebhookUpdate({
  payload: { CallSid: "CA123", CallStatus: "completed", AnsweredBy: "machine_end_beep", CallDuration: "12" },
  existingAttemptMetadata: { startedAt: "2026-06-08T11:59:50.000Z", evidenceText: "queued" },
  nowIso,
})
assert.equal(deliveredPlan.kind, "finalized")
if (deliveredPlan.kind === "finalized") {
  assert.equal(deliveredPlan.attemptPatch.status, "delivered")
  assert.equal(deliveredPlan.recipientPatch.status, "delivered")
  assert.equal(deliveredPlan.attemptPatch.metadata.answeredBy, "machine_end_beep")
  assert.ok(deliveredPlan.attemptPatch.metadata.rawCallbackPayload)
}

const humanCompletePlan = planVoiceDropStatusWebhookUpdate({
  payload: { CallSid: "CA124", CallStatus: "completed", AnsweredBy: "human" },
  existingAttemptMetadata: {},
  nowIso,
})
assert.equal(humanCompletePlan.kind, "finalized")
if (humanCompletePlan.kind === "finalized") {
  assert.equal(humanCompletePlan.attemptPatch.status, "failed")
  assert.equal(humanCompletePlan.attemptPatch.failureReason, "human_answered_no_voicemail_drop")
}

for (const callStatus of ["busy", "no-answer", "canceled", "failed"] as const) {
  const plan = planVoiceDropStatusWebhookUpdate({
    payload: {
      CallSid: `CA_${callStatus}`,
      CallStatus: callStatus,
      ErrorCode: callStatus === "failed" ? "32014" : null,
    },
    existingAttemptMetadata: {},
    nowIso,
  })
  assert.equal(plan.kind, "interim")
  if (plan.kind === "interim") {
    assert.equal(plan.attemptPatch.status, "failed")
    assert.equal(plan.recipientPatch?.status, "failed")
  }
}

const networkFailureReason = mapTwilioTerminalCallStatusToFailureReason({
  callStatus: "failed",
  errorCode: "32014",
  errorMessage: "Call blocked by carrier",
})
assert.equal(networkFailureReason, "twilio_failed_32014")

const evidenceView = mapDeliveryAttemptToEvidenceView({
  id: "attempt-1",
  organizationId: "org",
  campaignId: "camp",
  recipientId: "rec",
  provider: "twilio",
  providerDeliveryId: "CA999",
  status: "delivered",
  failureReason: null,
  deliveredAt: nowIso,
  durationSeconds: 12,
  costAmount: null,
  metadata: {
    answeredBy: "machine_end_beep",
    callStatus: "completed",
    startedAt: "2026-06-08T11:59:50.000Z",
    completedAt: nowIso,
    rawCallbackPayload: { CallSid: "CA999", CallStatus: "completed" },
    evidenceText: "Twilio outbound call created",
  },
  createdAt: "2026-06-08T11:59:50.000Z",
})
assert.equal(evidenceView.providerDeliveryId, "CA999")
assert.equal(evidenceView.answeredBy, "machine_end_beep")
assert.equal(evidenceView.hasRawCallbackPayload, true)

async function main() {
  const priorEnabled = process.env.VOICE_DROP_ENABLED
  const priorCertified = process.env.VOICE_DROP_TWILIO_OUTBOUND_CERTIFIED
  const priorSid = process.env.TWILIO_ACCOUNT_SID
  const priorToken = process.env.TWILIO_AUTH_TOKEN
  const priorFrom = process.env.TWILIO_VOICE_FROM_NUMBER

  let mockCallCount = 0
  setVoiceDropTwilioCallCreateOverrideForTests(async () => {
    mockCallCount += 1
    return { ok: true, callSid: "CA_MOCK_VD_1B", status: "queued" }
  })

  process.env.VOICE_DROP_ENABLED = "false"
  const disabledGate = evaluateVoiceDropTwilioQueueGate()
  assert.equal(disabledGate.allowed, false)
  if (!disabledGate.allowed) assert.equal(disabledGate.reason, "voice_drop_disabled")

  process.env.VOICE_DROP_ENABLED = "true"
  process.env.TWILIO_ACCOUNT_SID = ""
  process.env.TWILIO_AUTH_TOKEN = ""
  const missingCredsGate = evaluateVoiceDropTwilioQueueGate()
  assert.equal(missingCredsGate.allowed, false)
  if (!missingCredsGate.allowed) assert.equal(missingCredsGate.reason, "twilio_not_configured")

  process.env.TWILIO_ACCOUNT_SID = "ACtest"
  process.env.TWILIO_AUTH_TOKEN = "token"
  process.env.TWILIO_VOICE_FROM_NUMBER = ""
  process.env.TWILIO_PHONE_NUMBER = ""
  const missingFromGate = evaluateVoiceDropTwilioQueueGate()
  assert.equal(missingFromGate.allowed, false)
  if (!missingFromGate.allowed) assert.equal(missingFromGate.reason, "from_number_missing")

  process.env.TWILIO_VOICE_FROM_NUMBER = "+15551234567"
  process.env.VOICE_DROP_TWILIO_OUTBOUND_CERTIFIED = "false"
  const uncertifiedGate = evaluateVoiceDropTwilioQueueGate()
  assert.equal(uncertifiedGate.allowed, false)
  if (!uncertifiedGate.allowed) assert.equal(uncertifiedGate.reason, "twilio_outbound_not_certified")

  process.env.VOICE_DROP_TWILIO_OUTBOUND_CERTIFIED = "true"
  const certifiedGate = evaluateVoiceDropTwilioQueueGate()
  assert.equal(certifiedGate.allowed, true)

  process.env.VOICE_DROP_TWILIO_OUTBOUND_CERTIFIED = "false"
  const blocked = await twilioVoiceDropProvider.queueDelivery({
    organizationId: "org",
    campaignId: "camp",
    recipientId: "rec",
    phoneNumber: "+14155550199",
    renderedMessage: "Test",
  })
  assert.equal(blocked.status, "failed")
  assert.equal(blocked.failureReason, "twilio_outbound_not_certified")
  assert.equal(mockCallCount, 0)

  process.env.VOICE_DROP_TWILIO_OUTBOUND_CERTIFIED = "true"
  const created = await twilioVoiceDropProvider.queueDelivery({
    organizationId: "org",
    campaignId: "camp",
    recipientId: "rec",
    phoneNumber: "+14155550199",
    renderedMessage: "Test",
  })
  assert.equal(created.status, "queued")
  assert.equal(created.providerDeliveryId, "CA_MOCK_VD_1B")
  assert.equal(mockCallCount, 1)

  setVoiceDropTwilioCallCreateOverrideForTests(null)
  process.env.VOICE_DROP_ENABLED = priorEnabled
  process.env.VOICE_DROP_TWILIO_OUTBOUND_CERTIFIED = priorCertified
  process.env.TWILIO_ACCOUNT_SID = priorSid
  process.env.TWILIO_AUTH_TOKEN = priorToken
  process.env.TWILIO_VOICE_FROM_NUMBER = priorFrom

  const uiPanel = fs.readFileSync(
    path.join(process.cwd(), "components/growth/growth-voice-drop-campaigns-panel.tsx"),
    "utf8",
  )
  assert.match(uiPanel, /voice-drop-delivery-evidence/)
  assert.match(uiPanel, /GrowthVoiceDropDeliveryEvidencePanel/)

  const amdDelivered = mapVoiceDropAnsweredByToDeliveryOutcome("machine_end_beep")
  assert.equal(amdDelivered.delivered, true)

  const twiml = buildVoiceDropOutboundTwiml({
    answeredBy: "machine_end_beep",
    message: "Certification message",
    voiceId: "Polly.Joanna",
  })
  assert.match(twiml, /Certification message/)

  console.log("voice-drop-twilio-vd-1b: all certification checks passed")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
