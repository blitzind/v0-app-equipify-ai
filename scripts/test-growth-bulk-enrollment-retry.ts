/**
 * Bulk enrollment retry / existing enrollment regression checks.
 * Run: pnpm test:growth-bulk-enrollment-retry
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  classifyBulkEnrollmentResult,
  isBulkEnrollmentSchedulerEligible,
  pickBulkEnrollmentPrimaryEnrollmentId,
  resolveBulkEnrollmentViewId,
  suggestBulkEnrollmentAction,
  summarizeEnrollmentStepContext,
} from "../lib/growth/sequence-enrollment/bulk-enrollment-result-ui"
import type { BulkSequenceEnrollmentResult } from "../lib/growth/sequence-enrollment/bulk-sequence-enrollment-types"
import { GROWTH_SEQUENCE_BULK_ENROLL_QA_MARKER } from "../lib/growth/sequence-enrollment/bulk-sequence-enrollment-types"

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

const alreadyActive = baseResult({
  skippedAlreadyEnrolled: [
    {
      leadId: "lead-1",
      leadLabel: "Acme",
      enrollmentId: "enr-active",
      enrollmentStatus: "active",
      schedulerEligible: true,
      code: "already_enrolled",
      reason: "Lead is already enrolled in this sequence.",
      suggestedAction: "view_enrollment",
      currentStepSummary: "Step 1 · pending",
    },
  ],
})

const alreadyActiveUi = classifyBulkEnrollmentResult(alreadyActive)
assert.equal(alreadyActiveUi.title, "Already enrolled")
assert.equal(alreadyActiveUi.showViewEnrollment, true)
assert.equal(alreadyActiveUi.showSchedulerCta, true)
assert.equal(pickBulkEnrollmentPrimaryEnrollmentId(alreadyActive), "enr-active")

const draftBlockedByActive = baseResult({
  skippedAlreadyEnrolled: [
    {
      leadId: "lead-1",
      leadLabel: "Acme",
      enrollmentId: "enr-active",
      conflictingEnrollmentId: "enr-active",
      enrollmentStatus: "active",
      code: "active_enrollment",
      reason: "Another sequence enrollment is blocking this action — continue from the existing enrollment.",
      suggestedAction: "view_enrollment",
    },
  ],
})

assert.equal(classifyBulkEnrollmentResult(draftBlockedByActive).variant, "success")
assert.equal(resolveBulkEnrollmentViewId(draftBlockedByActive.skippedAlreadyEnrolled[0]), "enr-active")

const confirmedDraft = baseResult({
  enrolled: [
    {
      leadId: "lead-1",
      enrollmentId: "enr-1",
      code: "confirmed_existing_draft",
      enrollmentStatus: "active",
      schedulerEligible: true,
    },
  ],
})
assert.equal(classifyBulkEnrollmentResult(confirmedDraft).showSchedulerCta, true)

const blockedWithView = baseResult({
  skippedBlocked: [
    {
      leadId: "lead-1",
      enrollmentId: "enr-other",
      code: "active_enrollment",
      reason: "Lead already has a sequence enrollment on a different pattern.",
      suggestedAction: "view_enrollment",
    },
  ],
})
assert.equal(classifyBulkEnrollmentResult(blockedWithView).showViewEnrollment, true)
assert.equal(classifyBulkEnrollmentResult(blockedWithView).variant, "success")

assert.equal(suggestBulkEnrollmentAction("paused"), "resume_enrollment")
assert.equal(suggestBulkEnrollmentAction("draft"), "cancel_draft")
assert.equal(isBulkEnrollmentSchedulerEligible("active"), true)
assert.equal(isBulkEnrollmentSchedulerEligible("draft"), false)
assert.match(
  summarizeEnrollmentStepContext(
    { status: "draft", currentStepOrder: 0, pauseReason: null } as never,
    [],
  ) ?? "",
  /Draft enrollment/i,
)

const bulkService = readSource("lib/growth/sequence-enrollment/bulk-sequence-enrollment.ts")
assert.match(bulkService, /handleSamePatternExistingEnrollment/)
assert.match(bulkService, /buildActiveEnrollmentConflictOutcome/)
assert.match(bulkService, /enrichBulkSequenceEnrollmentOutcome/)
assert.match(bulkService, /bucket: "skippedAlreadyEnrolled"/)
assert.doesNotMatch(bulkService, /Could not confirm existing draft enrollment/)

const preflight = readSource("lib/growth/sequence-enrollment/sequence-enrollment-preflight.ts")
assert.match(preflight, /excludeEnrollmentId/)

const orchestrator = readSource("lib/growth/sequence-enrollment/sequence-enrollment-orchestrator.ts")
assert.match(orchestrator, /excludeEnrollmentId: enrollment.id/)

const dialog = readSource("components/growth/growth-bulk-sequence-enrollment-dialog.tsx")
assert.match(dialog, /resolveBulkEnrollmentViewId/)
assert.match(dialog, /Resume enrollment/)
assert.match(dialog, /Cancel draft/)
assert.match(dialog, /renderContinuableBlockedRow/)

console.log("growth bulk enrollment retry tests passed")
