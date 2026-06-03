/**
 * Bulk enrollment result + scheduler CTA regression checks.
 * Run: pnpm test:growth-bulk-enrollment-result-ui
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildBulkEnrollmentSchedulerExecutionHref,
  classifyBulkEnrollmentResult,
  explainSchedulerNoJobsPlanned,
  schedulerPlannedExecutionJobs,
} from "../lib/growth/sequence-enrollment/bulk-enrollment-result-ui"
import type { BulkSequenceEnrollmentResult } from "../lib/growth/sequence-enrollment/bulk-sequence-enrollment-types"
import { GROWTH_SEQUENCE_BULK_ENROLL_QA_MARKER } from "../lib/growth/sequence-enrollment/bulk-sequence-enrollment-types"
import type { GrowthSequenceSchedulerRunResult } from "../lib/growth/sequence-enrollment/sequence-scheduler-types"
import { GROWTH_SEQUENCE_SCHEDULER_QA_MARKER } from "../lib/growth/sequence-enrollment/sequence-scheduler-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function baseResult(
  overrides: Partial<BulkSequenceEnrollmentResult> = {},
): BulkSequenceEnrollmentResult {
  return {
    qaMarker: GROWTH_SEQUENCE_BULK_ENROLL_QA_MARKER,
    sequencePatternId: "00000000-0000-4000-8000-000000000001",
    dryRun: false,
    startImmediately: true,
    scheduledStartAt: null,
    requested: 1,
    enrolled: [],
    skippedAlreadyEnrolled: [],
    skippedBlocked: [],
    failed: [],
    ...overrides,
  }
}

function baseSchedulerResult(
  overrides: Partial<GrowthSequenceSchedulerRunResult> = {},
): GrowthSequenceSchedulerRunResult {
  return {
    scanned: 0,
    due: 0,
    queued: 0,
    skippedSuppressed: 0,
    skippedAlreadyQueued: 0,
    skippedMissingDraft: 0,
    skippedTransportNotConfigured: 0,
    skippedNoSender: 0,
    failed: 0,
    dryRun: false,
    providerWarning: false,
    qaMarker: GROWTH_SEQUENCE_SCHEDULER_QA_MARKER,
    runId: null,
    ...overrides,
  }
}

const allFailedResult = baseResult({
  failed: [{ leadId: "lead-1", leadLabel: "Acme", code: "enrollment_failed", reason: "Could not enroll lead." }],
})
const allFailed = classifyBulkEnrollmentResult(allFailedResult)
assert.equal(allFailed.variant, "failure")
assert.equal(allFailed.title, "No leads enrolled")
assert.equal(allFailed.showSchedulerCta, false)
assert.equal(allFailed.showViewEnrollment, false)

const mixed = classifyBulkEnrollmentResult(
  baseResult({
    enrolled: [{ leadId: "lead-1", enrollmentId: "enr-1", leadLabel: "Acme", schedulerEligible: true }],
    failed: [{ leadId: "lead-2", leadLabel: "Beta", code: "enrollment_failed", reason: "Could not enroll lead." }],
  }),
)
assert.equal(mixed.variant, "warning")
assert.equal(mixed.title, "Enrollment processed with issues")
assert.equal(mixed.showSchedulerCta, true)
assert.equal(mixed.showViewEnrollment, true)

const successResult = baseResult({
  enrolled: [{ leadId: "lead-1", enrollmentId: "enr-1", leadLabel: "Acme", schedulerEligible: true }],
})
const success = classifyBulkEnrollmentResult(successResult)
assert.equal(success.variant, "success")
assert.equal(success.title, "Enrollment complete")
assert.equal(success.showSchedulerCta, true)
assert.equal(success.showViewEnrollment, true)

const schedulerHref = buildBulkEnrollmentSchedulerExecutionHref({
  schedulerResult: baseSchedulerResult({ executionJobsPlanned: 1, queued: 1 }),
  enrollmentId: "enr-1",
  leadId: "lead-1",
  sequencePatternId: "pat-1",
  enrollmentDetail: {
    enrollment: {
      id: "enr-1",
      sequencePatternId: "pat-1",
      status: "active",
    },
    leadId: "lead-1",
    executionJobs: [{ id: "job-1", status: "pending_approval" }],
  } as never,
})
assert.match(schedulerHref ?? "", /\/admin\/growth\/sequences\/execution/)
assert.match(schedulerHref ?? "", /highlightJobId=job-1/)

assert.equal(
  buildBulkEnrollmentSchedulerExecutionHref({
    schedulerResult: baseSchedulerResult({ queued: 0, executionJobsPlanned: 0 }),
    enrollmentId: "enr-1",
  }),
  null,
)

assert.equal(schedulerPlannedExecutionJobs(baseSchedulerResult({ queued: 1 })), true)
assert.equal(schedulerPlannedExecutionJobs(baseSchedulerResult({ queued: 0 })), false)

const noJobsExplanation = explainSchedulerNoJobsPlanned({
  schedulerResult: baseSchedulerResult({ scanned: 0, due: 0 }),
  bulkResult: successResult,
  enrollmentDetail: {
    enrollment: { status: "active" },
  } as never,
})
assert.match(noJobsExplanation.join(" "), /0 due steps/i)

const failedBatchExplanation = explainSchedulerNoJobsPlanned({
  schedulerResult: baseSchedulerResult(),
  bulkResult: allFailedResult,
})
assert.match(failedBatchExplanation[0], /Enrollment failed for every selected lead/i)

const bulkDialog = readSource("components/growth/growth-bulk-sequence-enrollment-dialog.tsx")
assert.match(bulkDialog, /classifyBulkEnrollmentResult/)
assert.match(bulkDialog, /buildBulkEnrollmentSchedulerExecutionHref/)
assert.match(bulkDialog, /explainSchedulerNoJobsPlanned/)
assert.match(bulkDialog, /router\.push\(executionHref\)/)
assert.match(bulkDialog, /schedulerNoJobsExplanation/)
assert.match(bulkDialog, /resultUi\.showSchedulerCta/)
assert.match(bulkDialog, /Failed to enroll/)
assert.doesNotMatch(bulkDialog, /showSuccess/)

const bulkService = readSource("lib/growth/sequence-enrollment/bulk-sequence-enrollment.ts")
assert.match(bulkService, /leadLabelFromLead/)
assert.match(bulkService, /leadLabel: label/)

console.log("growth bulk enrollment result ui tests passed")
