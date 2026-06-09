/**
 * Execution-3 controlled transport structure certification.
 * Run: pnpm test:execution-3-controlled-transport
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  EXECUTION_3_COMPANY_PREFIX,
  EXECUTION_3_QA_MARKER,
  HENRY_SCHEIN_JOB_ID,
  HENRY_SCHEIN_LEAD_ID,
  buildExecution3ControlledTransportEvidence,
} from "../lib/growth/qa/execution-3-controlled-transport-evidence"

const PRODUCTION_CERT = "scripts/certify-execution-3-controlled-transport-production.ts"
const EVIDENCE = "lib/growth/qa/execution-3-controlled-transport-evidence.ts"
const JOB_RUNNER = "lib/growth/sequences/execution/sequence-job-runner.ts"
const TRANSPORT = "lib/growth/providers/transport/transport-orchestrator.ts"

for (const relativePath of [PRODUCTION_CERT, EVIDENCE, JOB_RUNNER, TRANSPORT]) {
  assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  console.log(`  ✓ file.${relativePath}`)
}

const productionCert = fs.readFileSync(path.join(process.cwd(), PRODUCTION_CERT), "utf8")
const jobRunner = fs.readFileSync(path.join(process.cwd(), JOB_RUNNER), "utf8")

assert.match(productionCert, /HENRY_SCHEIN_LEAD_ID/)
assert.match(productionCert, /HENRY_SCHEIN_JOB_ID/)
assert.match(productionCert, /Refusing to run Execution-3 against Henry Schein/)
assert.match(productionCert, /EXECUTION_3_COMPANY_PREFIX/)
assert.match(productionCert, /runSequenceExecutionJob/)
assert.match(productionCert, /already_sent/)
assert.doesNotMatch(productionCert, new RegExp(`runSequenceExecutionJob\\([^)]*${HENRY_SCHEIN_JOB_ID}`))
assert.match(jobRunner, /already_sent/)
console.log("  ✓ production cert excludes Henry Schein send path")

const passEvidence = buildExecution3ControlledTransportEvidence({
  snapshot: {
    lead: { id: "lead-1", contact_email: "qa@internal.test" },
    enrollment: { id: "enroll-1", status: "active" },
    steps: [{ id: "step-1", step_order: 1, status: "sent", channel: "email", generation_id: "gen-1" }],
    jobs: [
      {
        id: "job-1",
        sequence_step_id: "step-1",
        status: "sent",
        delivery_attempt_id: "del-1",
        human_approved_at: "2026-01-01T00:00:00.000Z",
      },
    ],
    jobEvents: [{ event_type: "job_sent" }],
    deliveryAttempts: [
      {
        id: "del-1",
        status: "sent",
        provider_message_id: "gmail-msg-123",
        metadata: { tracking: { pixel_url: "https://track.example/p.gif" }, provider_thread_id: "thread-abc" },
      },
    ],
    transportEvents: [{ id: "ta-1" }],
    sender: { id: "sender-1", email_address: "sender@equipify.io" },
    provider: { id: "prov-1", provider_name: "Gmail Native", provider_family: "gmail" },
    mailbox: { id: "mb-1", status: "connected" },
    timelineEvents: [],
    inboxMessages: [{ id: "msg-1", direction: "outbound", thread_id: "inbox-thread-1" }],
    replyIngestionEvents: [],
    inboxSyncRuns: [{ status: "completed" }],
    outboundReplies: [],
    replyWorkflowActions: [],
    growthNotifications: [],
    leadMemory: null,
  },
  duplicateExecute: {
    first_run: { ok: true, status: "sent" },
    second_run: { ok: true, status: "sent", message: "already_sent" },
    idempotent: true,
    batch_rerun: { sent: 0 },
    sent_delivery_attempt_count: 1,
  },
  henryScheinJob: { status: "approved", delivery_attempt_id: null },
  inboxThreadIds: ["inbox-thread-1"],
  trackingDisabled: false,
})

assert.equal(passEvidence.qa_marker, EXECUTION_3_QA_MARKER)
assert.equal(passEvidence.result, "PASS")
assert.equal(passEvidence.transport.message_id, "gmail-msg-123")
assert.equal(passEvidence.safety.exactly_one_send, true)
console.log("  ✓ evidence builder PASS path")

const baseSnapshot = {
  lead: { id: "lead-1", contact_email: "qa@internal.test" },
  enrollment: { id: "enroll-1", status: "active" },
  steps: [{ id: "step-1", step_order: 1, status: "sent", channel: "email", generation_id: "gen-1" }],
  jobs: [
    {
      id: "job-1",
      sequence_step_id: "step-1",
      status: "sent",
      delivery_attempt_id: "del-1",
      human_approved_at: "2026-01-01T00:00:00.000Z",
    },
  ],
  jobEvents: [{ event_type: "job_sent" }],
  deliveryAttempts: [
    {
      id: "del-1",
      status: "sent",
      provider_message_id: "gmail-msg-123",
      metadata: { tracking: { pixel_url: "https://track.example/p.gif" }, provider_thread_id: "thread-abc" },
    },
  ],
  transportEvents: [{ id: "ta-1" }],
  sender: { id: "sender-1", email_address: "sender@equipify.io" },
  provider: { id: "prov-1", provider_name: "Gmail Native", provider_family: "gmail" },
  mailbox: { id: "mb-1", status: "connected" },
  timelineEvents: [],
  inboxMessages: [],
  replyIngestionEvents: [],
  inboxSyncRuns: [{ status: "completed" }],
  outboundReplies: [],
  replyWorkflowActions: [],
  growthNotifications: [],
  leadMemory: null,
}

const partialEvidence = buildExecution3ControlledTransportEvidence({
  snapshot: baseSnapshot,
  duplicateExecute: {
    first_run: { ok: true, status: "sent" },
    second_run: { ok: true, status: "sent", message: "already_sent" },
    idempotent: true,
    batch_rerun: { sent: 0 },
    sent_delivery_attempt_count: 1,
  },
  henryScheinJob: { status: "approved", delivery_attempt_id: null },
  inboxThreadIds: [],
  trackingDisabled: false,
})
assert.equal(partialEvidence.result, "PASS_PARTIAL")
console.log("  ✓ evidence builder PASS_PARTIAL when inbox missing")

console.log("\nExecution-3 controlled transport structure certification passed.")
