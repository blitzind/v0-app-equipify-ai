/**
 * Phase 5.4 — Multi-channel sequence orchestration validation.
 * Run: pnpm test:growth-multi-channel-sequence-orchestration
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  assertMultiChannelSequenceChannelsRegistered,
  isSequenceCadenceChannel,
  isSequenceTransportChannel,
  normalizeSequenceStepChannel,
  sequenceChannelLabel,
} from "../lib/growth/sequence-orchestration/sequence-channel-routing"
import { buildGrowthMultiChannelSequenceArchitectureAudit } from "../lib/growth/sequence-orchestration/sequence-orchestration-audit"
import {
  evaluateSequenceChannelSelectionRules,
  shouldPauseEnrollmentByChannelRules,
} from "../lib/growth/sequence-orchestration/sequence-channel-selection-rules"
import {
  isDraftReadyTransportSchedulerStep,
  isManualSequenceStepChannel,
} from "../lib/growth/sequence-enrollment/enrollment-step-progress"
import type { GrowthSequenceEnrollmentStep } from "../lib/growth/sequence-enrollment-types"
import type { GrowthSequenceTouch } from "../lib/growth/sequence-types"

const audit = buildGrowthMultiChannelSequenceArchitectureAudit()
console.log("\n=== Phase 5.4A Architecture Audit ===")
console.log(`QA marker: ${audit.qa_marker}`)
for (const item of audit.emailOnlyAssumptions) console.log(`  [was email-only] ${item}`)
console.log("Migration plan:")
for (const item of audit.migrationPlan) console.log(`  → ${item}`)

assertMultiChannelSequenceChannelsRegistered()
assert.equal(isSequenceTransportChannel("email"), true)
assert.equal(isSequenceTransportChannel("sms"), true)
assert.equal(isSequenceTransportChannel("manual_call"), false)
assert.equal(normalizeSequenceStepChannel("call"), "manual_call")
assert.equal(isSequenceCadenceChannel("call"), true)
assert.equal(sequenceChannelLabel("sms"), "SMS")

const multiChannelSteps: Array<{ order: number; channel: GrowthSequenceEnrollmentStep["channel"] }> = [
  { order: 1, channel: "email" },
  { order: 2, channel: "sms" },
  { order: 3, channel: "call" },
  { order: 4, channel: "email" },
  { order: 5, channel: "sms" },
]

console.log("\n=== Phase 5.4B Sample Sequence ===")
for (const step of multiChannelSteps) {
  const transport = isSequenceTransportChannel(step.channel)
  const cadence = isSequenceCadenceChannel(step.channel)
  console.log(
    `Step ${step.order} ${sequenceChannelLabel(step.channel)} → ${transport ? "transport+approval" : cadence ? "cadence task (operator)" : "other"}`,
  )
}

function mockStep(partial: Partial<GrowthSequenceEnrollmentStep> & Pick<GrowthSequenceEnrollmentStep, "stepOrder" | "channel">): GrowthSequenceEnrollmentStep {
  return {
    id: `step-${partial.stepOrder}`,
    enrollmentId: "enrollment-demo",
    leadId: "lead-demo",
    sequencePatternStepId: null,
    stepOrder: partial.stepOrder,
    channel: partial.channel,
    generationType: partial.channel === "email" ? "follow_up_email" : null,
    scheduledFor: new Date().toISOString(),
    status: partial.status ?? "pending",
    stepExecutionConfidence: null,
    outreachQueueId: null,
    generationId: partial.generationId ?? null,
    cadenceTaskId: null,
    instructions: partial.instructions ?? null,
    stepOutcome: null,
    skipReason: null,
    opportunityId: null,
    meetingId: null,
    dueAt: null,
    completedAt: null,
    failureReason: null,
  }
}

const smsDraftReady = mockStep({
  stepOrder: 2,
  channel: "sms",
  status: "draft_created",
  instructions: "Jordan — quick q on dispatch workflow. Worth a reply?",
})
assert.ok(isDraftReadyTransportSchedulerStep(smsDraftReady))
assert.ok(isManualSequenceStepChannel("call"))

console.log("\n=== Phase 5.4F Channel Selection Rules ===")
const coldTouches: GrowthSequenceTouch[] = [
  { occurredAt: new Date(Date.now() - 5 * 86400000).toISOString(), channel: "email", generationType: "cold_email" },
]
const smsEscalation = evaluateSequenceChannelSelectionRules({
  steps: multiChannelSteps.map((s) => mockStep({ stepOrder: s.order, channel: s.channel })),
  currentStep: mockStep({ stepOrder: 2, channel: "sms" }),
  touches: coldTouches,
})
console.log(`Email no-reply → SMS: ${smsEscalation.ruleCode} — ${smsEscalation.reason}`)
assert.equal(smsEscalation.ruleCode, "email_no_reply_escalate_sms")

const positiveSmsTouches: GrowthSequenceTouch[] = [
  { occurredAt: new Date().toISOString(), channel: "sms", generationType: null },
  { occurredAt: new Date().toISOString(), channel: "reply", generationType: null, signalKind: "positive_reply" },
]
const pauseDecision = evaluateSequenceChannelSelectionRules({
  steps: [mockStep({ stepOrder: 4, channel: "email" })],
  currentStep: mockStep({ stepOrder: 4, channel: "email" }),
  touches: positiveSmsTouches,
})
console.log(`Positive SMS reply → pause: ${pauseDecision.ruleCode} — ${pauseDecision.reason}`)
assert.ok(shouldPauseEnrollmentByChannelRules(pauseDecision))

const transportJobSource = readFileSync(
  resolve(process.cwd(), "lib/growth/sequences/execution/queue-sequence-step-transport-job.ts"),
  "utf8",
)
assert.match(transportJobSource, /stepChannel === "sms"/)
assert.match(transportJobSource, /buildSequenceExecutionSmsPayload/)
assert.match(transportJobSource, /channel: "sms"/)

const smsRunnerSource = readFileSync(
  resolve(process.cwd(), "lib/growth/sequences/execution/sequence-sms-runner.ts"),
  "utf8",
)
assert.match(smsRunnerSource, /sendSms/)
assert.match(smsRunnerSource, /human approval/i)

const jobRunnerSource = readFileSync(
  resolve(process.cwd(), "lib/growth/sequences/execution/sequence-job-runner.ts"),
  "utf8",
)
assert.match(jobRunnerSource, /runSequenceSmsExecutionJob/)
assert.match(jobRunnerSource, /email_sent/)

const cadenceSource = readFileSync(
  resolve(process.cwd(), "lib/growth/cadence/materialize-cadence-step.ts"),
  "utf8",
)
assert.match(cadenceSource, /call_task_queued/)
assert.match(cadenceSource, /cadenceCallQueueHref/)

const timelineSource = readFileSync(
  resolve(process.cwd(), "lib/growth/sequence-pattern-repository.ts"),
  "utf8",
)
assert.match(timelineSource, /sequence_enrollment_channel_events/)
assert.match(timelineSource, /sms_delivery_attempts/)

const migrationSource = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20270704120000_growth_multi_channel_sequence_orchestration.sql"),
  "utf8",
)
assert.match(migrationSource, /sequence_enrollment_channel_events/)
assert.match(migrationSource, /channel text not null default 'email'/)

console.log("\n=== Phase 5.4 Validation Summary ===")
console.log("Sequence: Email → SMS → Call → Email → SMS")
console.log("- Transport channels (email, sms): draft → pending_approval job → human approve → send")
console.log("- Call channel: cadence task → call queue href → operator completes (no auto-dial)")
console.log("- Unified timeline: sequence_enrollment_channel_events + touch timeline extensions")
console.log("\nPhase 5.4 multi-channel sequence orchestration validation passed")
