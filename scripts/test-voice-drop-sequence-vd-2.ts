/**
 * Voice Drop sequence integration — VD-2 certification harness.
 * Run: pnpm test:voice-drop-sequence-vd-2
 *
 * No live Twilio calls or database writes during this script.
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  assertMultiChannelSequenceChannelsRegistered,
  isSequenceTransportChannel,
  sequenceChannelLabel,
} from "../lib/growth/sequence-orchestration/sequence-channel-routing"
import { isDraftReadyTransportSchedulerStep } from "../lib/growth/sequence-enrollment/enrollment-step-progress"
import type { GrowthSequenceEnrollmentStep } from "../lib/growth/sequence-enrollment-types"
import { GROWTH_SEQUENCE_CHANNEL_EVENT_KINDS } from "../lib/growth/sequence-orchestration/sequence-multi-channel-state-types"
import { GROWTH_LEAD_TIMELINE_EVENT_TYPES } from "../lib/growth/timeline-types"
import { GROWTH_SEQUENCE_TRANSPORT_CHANNELS } from "../lib/growth/sequences/execution/sequence-execution-types"
import {
  GROWTH_SEQUENCE_VOICE_DROP_VD_2_QA_MARKER,
  validateGrowthSequenceVoiceDropStepDraft,
} from "../lib/growth/sequences/sequence-voice-drop-step-types"
import { evaluateVoiceDropTwilioQueueGate } from "../lib/voice/voice-drops/twilio-voice-drop-gates"
import { VOICE_DROP_APPROVAL_REQUIRED } from "../lib/voice/voice-drops/types"

const REQUIRED_FILES = [
  "supabase/migrations/20270808120000_growth_voice_drop_sequence_vd_2.sql",
  "lib/growth/sequences/execution/sequence-voice-drop-send-builder.ts",
  "lib/growth/sequences/execution/sequence-voice-drop-runner.ts",
  "lib/growth/sequences/execution/sequence-voice-drop-timeline.ts",
  "lib/growth/sequences/execution/sequence-voice-drop-webhook-timeline.ts",
  "lib/growth/sequences/sequence-voice-drop-step-types.ts",
]

const REQUIRED_EXPORTS: Array<{ file: string; pattern: RegExp }> = [
  {
    file: "lib/growth/sequences/execution/sequence-voice-drop-runner.ts",
    pattern: /export async function runSequenceVoiceDropExecutionJob/,
  },
  {
    file: "lib/growth/sequences/execution/sequence-voice-drop-send-builder.ts",
    pattern: /export async function buildSequenceExecutionVoiceDropPayload/,
  },
  {
    file: "lib/growth/sequences/execution/sequence-voice-drop-timeline.ts",
    pattern: /export async function emitSequenceVoiceDropTimelineEvent/,
  },
  {
    file: "lib/growth/sequences/execution/queue-sequence-step-transport-job.ts",
    pattern: /stepChannel === "voice_drop"/,
  },
  {
    file: "lib/growth/sequences/execution/sequence-job-runner.ts",
    pattern: /locked\.channel === "voice_drop"/,
  },
]

assert.equal(GROWTH_SEQUENCE_VOICE_DROP_VD_2_QA_MARKER, "growth-sequence-voice-drop-vd-2")
assert.equal(VOICE_DROP_APPROVAL_REQUIRED, true)
assert.deepEqual([...GROWTH_SEQUENCE_TRANSPORT_CHANNELS], ["email", "sms", "voice_drop"])

for (const relativePath of REQUIRED_FILES) {
  assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing required file: ${relativePath}`)
}

for (const entry of REQUIRED_EXPORTS) {
  const source = fs.readFileSync(path.join(process.cwd(), entry.file), "utf8")
  assert.match(source, entry.pattern, `Missing export/pattern in ${entry.file}`)
}

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270808120000_growth_voice_drop_sequence_vd_2.sql"),
  "utf8",
)
assert.match(migration, /voice_drop/)
assert.match(migration, /voice_drop_campaign_id/)

console.log("\n=== VD-2 Sequence Channel Audit ===")
assertMultiChannelSequenceChannelsRegistered()
assert.equal(isSequenceTransportChannel("voice_drop"), true)
assert.equal(isSequenceTransportChannel("manual_call"), false)
assert.equal(sequenceChannelLabel("voice_drop"), "Voice Drop")

const draftValidation = validateGrowthSequenceVoiceDropStepDraft({
  stepOrder: 2,
  channel: "voice_drop",
  delayDaysMin: 2,
  delayDaysMax: 4,
  voiceDropCampaignId: "11111111-1111-4111-8111-111111111111",
  notes: "Day 3 voice drop touch",
})
assert.equal(draftValidation.ok, true)

const missingCampaign = validateGrowthSequenceVoiceDropStepDraft({
  stepOrder: 2,
  channel: "voice_drop",
  delayDaysMin: 2,
  delayDaysMax: 4,
  voiceDropCampaignId: "",
})
assert.equal(missingCampaign.ok, false)
if (!missingCampaign.ok) assert.equal(missingCampaign.code, "voice_drop_campaign_required")

function mockVoiceDropStep(
  partial: Partial<GrowthSequenceEnrollmentStep> & Pick<GrowthSequenceEnrollmentStep, "stepOrder">,
): GrowthSequenceEnrollmentStep {
  return {
    id: `step-${partial.stepOrder}`,
    enrollmentId: "enrollment-demo",
    leadId: "lead-demo",
    sequencePatternStepId: "pattern-step",
    stepOrder: partial.stepOrder,
    channel: partial.channel ?? "voice_drop",
    generationType: null,
    scheduledFor: new Date().toISOString(),
    status: partial.status ?? "draft_created",
    stepExecutionConfidence: 80,
    outreachQueueId: null,
    cadenceTaskId: null,
    generationId: null,
    instructions: partial.instructions ?? null,
    voiceDropCampaignId:
      partial.voiceDropCampaignId !== undefined
        ? partial.voiceDropCampaignId
        : "11111111-1111-4111-8111-111111111111",
    stepOutcome: null,
    skipReason: null,
    opportunityId: null,
    meetingId: null,
    dueAt: null,
    completedAt: null,
    failureReason: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

assert.ok(isDraftReadyTransportSchedulerStep(mockVoiceDropStep({ stepOrder: 2 })))
assert.ok(!isDraftReadyTransportSchedulerStep(mockVoiceDropStep({ stepOrder: 2, voiceDropCampaignId: null })))

console.log("\n=== VD-2 Safety Gates ===")
const disabledGate = evaluateVoiceDropTwilioQueueGate({ voiceDropEnabled: false })
assert.equal(disabledGate.allowed, false)
if (!disabledGate.allowed) assert.equal(disabledGate.reason, "voice_drop_disabled")

const uncertifiedGate = evaluateVoiceDropTwilioQueueGate({
  voiceDropEnabled: true,
  twilioCredentialsConfigured: true,
  fromNumberConfigured: true,
  twilioOutboundCertified: false,
})
assert.equal(uncertifiedGate.allowed, false)
if (!uncertifiedGate.allowed) assert.equal(uncertifiedGate.reason, "twilio_outbound_not_certified")

const certifiedGate = evaluateVoiceDropTwilioQueueGate({
  voiceDropEnabled: true,
  twilioCredentialsConfigured: true,
  fromNumberConfigured: true,
  twilioOutboundCertified: true,
})
assert.equal(certifiedGate.allowed, true)

console.log("\n=== VD-2 Timeline + Intelligence ===")
for (const eventType of [
  "voice_drop_queued",
  "voice_drop_attempted",
  "voice_drop_delivered",
  "voice_drop_failed",
  "voice_drop_answered",
] as const) {
  assert.ok(
    (GROWTH_LEAD_TIMELINE_EVENT_TYPES as readonly string[]).includes(eventType),
    `Missing timeline event ${eventType}`,
  )
}

assert.ok((GROWTH_SEQUENCE_CHANNEL_EVENT_KINDS as readonly string[]).includes("voice_drop_delivered"))
assert.ok((GROWTH_SEQUENCE_CHANNEL_EVENT_KINDS as readonly string[]).includes("voice_drop_answered"))

const dashboardSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/sequences/execution/sequence-execution-dashboard.ts"),
  "utf8",
)
assert.match(dashboardSource, /voiceDropsQueued/)
assert.match(dashboardSource, /voiceDropsDelivered/)
assert.match(dashboardSource, /voiceDropsFailed/)

const runnerSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/sequences/execution/sequence-voice-drop-runner.ts"),
  "utf8",
)
assert.match(runnerSource, /addVoiceDropRecipient/)
assert.match(runnerSource, /appendVoiceDropDeliveryAttempt/)
assert.match(runnerSource, /evaluateAndAuditCompliance/)

const sendBuilderSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/sequences/execution/sequence-voice-drop-send-builder.ts"),
  "utf8",
)
assert.match(sendBuilderSource, /VOICE_DROP_APPROVAL_REQUIRED/)
assert.match(sendBuilderSource, /evaluateVoiceDropTwilioQueueGate/)

console.log("\nVD-2 voice drop sequence integration certification passed")
