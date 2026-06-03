/**
 * Regression checks for Growth Engine reply-flow QA harness.
 * Run: pnpm test:growth-reply-flow-harness
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_REPLY_FLOW_CHECK_LABELS,
  GROWTH_REPLY_FLOW_QA_MARKER,
} from "../lib/growth/qa/reply-flow-harness-types"
import {
  buildGrowthReplyFlowReport,
  formatGrowthReplyFlowReport,
} from "../lib/growth/qa/reply-flow-report"
import { isSequenceStepDueForScheduler } from "../lib/growth/sequence-enrollment/enrollment-step-progress"
import type { GrowthSequenceEnrollmentStep } from "../lib/growth/sequence-enrollment-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

assert.equal(GROWTH_REPLY_FLOW_QA_MARKER, "growth-reply-flow-qa-v1")
assert.equal(GROWTH_REPLY_FLOW_CHECK_LABELS.length, 17)

const harnessSource = readSource("lib/growth/qa/reply-flow-harness.ts")
assert.match(harnessSource, /createGrowthReplyFlowLead/)
assert.match(harnessSource, /enrollGrowthReplyFlowLead/)
assert.match(harnessSource, /runGrowthReplyFlowScheduler/)
assert.match(harnessSource, /approveGrowthReplyFlowStepOne/)
assert.match(harnessSource, /executeGrowthReplyFlowApprovedJobs/)
assert.match(harnessSource, /inspectGrowthReplyFlowLead/)
assert.match(harnessSource, /runGrowthReplyFlowHarness/)
assert.match(harnessSource, /qaForceGrowthEnrollmentStepDueNow/)
assert.match(harnessSource, /accelerateGrowthReplyFlowEnrollmentStepOne/)
assert.match(harnessSource, /actions\.qaAcceleration/)

function harnessStep(
  partial: Partial<GrowthSequenceEnrollmentStep> &
    Pick<GrowthSequenceEnrollmentStep, "status" | "channel">,
): GrowthSequenceEnrollmentStep {
  return {
    id: "step-1",
    enrollmentId: "enroll-1",
    leadId: "lead-1",
    sequencePatternStepId: "pattern-step-1",
    stepOrder: 1,
    generationType: "cold_email",
    scheduledFor: null,
    stepExecutionConfidence: 50,
    outreachQueueId: null,
    cadenceTaskId: null,
    generationId: null,
    instructions: null,
    stepOutcome: null,
    skipReason: null,
    opportunityId: null,
    meetingId: null,
    dueAt: null,
    completedAt: null,
    failureReason: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...partial,
  }
}

const futureScheduledPending = harnessStep({
  status: "pending",
  channel: "email",
  scheduledFor: "2099-06-04T13:00:00.000Z",
  generationId: null,
})
assert.equal(isSequenceStepDueForScheduler(futureScheduledPending), false)

const acceleratedPending = harnessStep({
  status: "pending",
  channel: "email",
  scheduledFor: new Date(Date.now() - 60_000).toISOString(),
  generationId: null,
})
assert.equal(isSequenceStepDueForScheduler(acceleratedPending), true)

const reportSource = readSource("lib/growth/qa/reply-flow-report.ts")
assert.match(reportSource, /buildGrowthReplyFlowReport/)
assert.match(reportSource, /formatGrowthReplyFlowReport/)
assert.match(reportSource, /GROWTH_REPLY_FLOW_CHECK_LABELS/)
assert.match(harnessSource, /bulkEnrollLeadsInGrowthSequence/)
assert.match(harnessSource, /runApprovedDueSequenceExecutionJobs/)
assert.match(harnessSource, /fetchLeadMemoryProfileView/)
assert.match(harnessSource, /inbox_threads/)
assert.match(harnessSource, /thread_id/)
assert.match(reportSource, /Reply Intelligence Processed/)
assert.match(reportSource, /Sequence Paused On Reply/)
assert.match(harnessSource, /outbound_replies/)
assert.match(harnessSource, /reply_workflow_actions/)

const cliSource = readSource("scripts/qa-growth-reply-flow.ts")
assert.match(cliSource, /qa:growth-reply-flow/)
assert.match(cliSource, /assertGrowthProductionEnvReady/)
assert.match(cliSource, /reply-flow-env-bootstrap/)
assert.match(cliSource, /vercel env run -e production/)
assert.match(cliSource, /runGrowthReplyFlowHarness/)
assert.match(cliSource, /formatGrowthReplyFlowReport/)
assert.match(cliSource, /--step/)
assert.match(cliSource, /--inspect-only/)
assert.match(cliSource, /--fresh/)
assert.match(cliSource, /--skip-execute/)

const packageJson = readSource("package.json")
assert.match(packageJson, /"qa:growth-reply-flow"/)
assert.match(packageJson, /"test:growth-reply-flow-harness"/)

const passReport = buildGrowthReplyFlowReport(
  {
    lead: { id: "lead-1", status: "new", contactEmail: "qa@example.com" },
    enrollment: { id: "enroll-1", status: "active", sequence_pattern_id: "pattern-1" },
    steps: [{ id: "step-1", step_order: 1, channel: "email", status: "scheduled" }],
    jobs: [
      {
        id: "job-1",
        lead_id: "lead-1",
        sequence_enrollment_id: "enroll-1",
        sequence_step_id: "step-1",
        status: "sent",
        delivery_attempt_id: "attempt-1",
        human_approved_at: new Date().toISOString(),
        sender_account_id: "sender-1",
        provider_id: "provider-1",
      },
    ],
    jobEvents: [{ event_type: "solo_approval_used", job_id: "job-1" }],
    deliveryAttempts: [
      {
        id: "attempt-1",
        lead_id: "lead-1",
        status: "sent",
        provider_message_id: "gmail-msg-123",
        metadata: { to: "qa@example.com", provider_thread_id: "thread-1" },
        sender_account_id: "sender-1",
        provider_id: "provider-1",
      },
    ],
    transportEvents: [{ delivery_attempt_id: "attempt-1", event_type: "transport_sent" }],
    sender: { id: "sender-1", email_address: "sender@equipify.ai", status: "active" },
    provider: { id: "provider-1", provider_family: "google", provider_name: "Google Workspace" },
    mailbox: { id: "mailbox-1", sender_account_id: "sender-1", status: "connected" },
    timelineEvents: [{ id: "timeline-1" }],
    inboxMessages: [],
    replyIngestionEvents: [],
    inboxSyncRuns: [{ status: "completed" }],
    outboundReplies: [],
    replyWorkflowActions: [],
    growthNotifications: [],
    leadMemory: {
      profile: { id: "mem-1", updatedAt: new Date().toISOString() } as never,
      relationshipContext: null,
      events: [],
      objections: [],
      preferences: [],
      committeeMembers: [],
      summarySnapshots: [],
    },
  },
  { actions: { step: "all" } },
)

assert.equal(passReport.overall, "PASS")
assert.equal(passReport.checks.length, 17)
assert.ok(passReport.checks.every((check) => check.pass))
assert.equal(passReport.ids.leadId, "lead-1")
assert.equal(passReport.transport.gmailMessageId, "gmail-msg-123")
assert.equal(passReport.missingRecords.length, 0)
assert.equal(passReport.fkIssues.length, 0)

const failReport = buildGrowthReplyFlowReport(
  {
    lead: null,
    enrollment: null,
    steps: [],
    jobs: [],
    jobEvents: [],
    deliveryAttempts: [],
    transportEvents: [],
    sender: null,
    provider: null,
    mailbox: null,
    timelineEvents: [],
    inboxMessages: [],
    replyIngestionEvents: [],
    inboxSyncRuns: [],
    outboundReplies: [],
    replyWorkflowActions: [],
    growthNotifications: [],
    leadMemory: null,
  },
  { requireReply: true, actions: { step: "inspect" } },
)

assert.equal(failReport.overall, "FAIL")
assert.ok(failReport.missingRecords.length > 0)
assert.ok(failReport.checks.some((check) => !check.pass))

const formatted = formatGrowthReplyFlowReport(passReport)
assert.match(formatted, /GROWTH REPLY FLOW QA — PASS/)
assert.match(formatted, /Lead Created/)
assert.match(formatted, /Transport Sent/)
assert.match(formatted, /leadId: lead-1/)

const replyViaProcessingStatus = buildGrowthReplyFlowReport(
  {
    lead: { id: "lead-2", contact_email: "wikus@example.com" },
    enrollment: null,
    steps: [],
    jobs: [],
    jobEvents: [],
    deliveryAttempts: [],
    transportEvents: [],
    sender: null,
    provider: null,
    mailbox: null,
    timelineEvents: [],
    inboxMessages: [],
    replyIngestionEvents: [{ processing_status: "processed", lead_id: "lead-2" }],
    inboxSyncRuns: [{ status: "completed" }],
    outboundReplies: [],
    replyWorkflowActions: [],
    growthNotifications: [],
    leadMemory: null,
  },
  { requireReply: true },
)
assert.equal(
  replyViaProcessingStatus.checks.find((c) => c.label === "Reply Received")?.pass,
  true,
)

console.log("growth reply flow harness tests passed")
