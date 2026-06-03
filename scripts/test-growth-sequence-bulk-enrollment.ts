/**
 * Phase 1.4 — bulk sequence enrollment regression checks.
 * Run: pnpm test:growth-sequence-bulk-enrollment
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_SEQUENCE_BULK_ENROLL_MAX_LEADS,
  GROWTH_SEQUENCE_BULK_ENROLL_QA_MARKER,
} from "../lib/growth/sequence-enrollment/bulk-sequence-enrollment-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

assert.equal(GROWTH_SEQUENCE_BULK_ENROLL_QA_MARKER, "growth-sequence-bulk-enroll-v1")
assert.equal(GROWTH_SEQUENCE_BULK_ENROLL_MAX_LEADS, 100)

const bulkServiceSource = readSource("lib/growth/sequence-enrollment/bulk-sequence-enrollment.ts")
assert.match(bulkServiceSource, /createGrowthSequenceEnrollmentDraft/)
assert.match(bulkServiceSource, /confirmGrowthSequenceEnrollment/)
assert.match(bulkServiceSource, /runSequenceEnrollmentPreflight/)
assert.match(bulkServiceSource, /skippedAlreadyEnrolled/)
assert.match(bulkServiceSource, /skippedBlocked/)
assert.match(bulkServiceSource, /already_enrolled/)
assert.match(bulkServiceSource, /confirmed_existing_draft/)
assert.match(bulkServiceSource, /dry_run_would_enroll/)
assert.match(bulkServiceSource, /sequence_bulk_enrollment_completed/)
assert.doesNotMatch(bulkServiceSource, /insertGrowthOutreachQueueItem/)

const orchestratorSource = readSource("lib/growth/sequence-enrollment/sequence-enrollment-orchestrator.ts")
assert.match(orchestratorSource, /scheduledStartAt/)
assert.match(orchestratorSource, /ownerUserId/)
assert.match(
  orchestratorSource,
  /import \{ listGrowthSequencePatterns \} from "@\/lib\/growth\/sequence-pattern-repository"/,
  "orchestrator must import listGrowthSequencePatterns",
)

const repositorySource = readSource("lib/growth/sequence-enrollment/sequence-enrollment-repository.ts")
assert.match(repositorySource, /fetchGrowthSequenceEnrollmentForLeadAndPattern/)

const bulkRouteSource = readSource("app/api/platform/growth/sequences/enroll/bulk/route.ts")
assert.match(bulkRouteSource, /GROWTH_SEQUENCE_BULK_ENROLL_MAX_LEADS/)
assert.match(bulkRouteSource, /batch_limit_exceeded/)
assert.match(bulkRouteSource, /bulkEnrollLeadsInGrowthSequence/)
assert.match(bulkRouteSource, /sequencePatternId/)
assert.match(bulkRouteSource, /sequenceTemplateId is not supported/)

const schedulerSource = readSource("lib/growth/sequence-enrollment/run-sequence-scheduler.ts")
assert.match(schedulerSource, /queueSequenceStepTransportJob/)
assert.match(schedulerSource, /queueSequenceStepOutreach/)

const transportQueueSource = readSource(
  "lib/growth/sequences/execution/queue-sequence-step-transport-job.ts",
)
assert.match(transportQueueSource, /status: "pending_approval"/)

const uiSource = readSource("components/growth/growth-bulk-sequence-enrollment-dialog.tsx")
assert.match(uiSource, /sequences\/enroll\/bulk/)
assert.match(uiSource, /Preview/)
assert.match(uiSource, /GROWTH_SEQUENCE_BULK_ENROLL_MAX_LEADS/)

const tableSource = readSource("components/growth/growth-leads-table.tsx")
assert.match(tableSource, /GrowthBulkSequenceEnrollmentDialog/)
assert.match(tableSource, /Enroll in Sequence/)

assert.match(schedulerSource, /queueSequenceStepTransportJob/)
assert.match(schedulerSource, /queueSequenceStepOutreach/)

console.log("growth sequence bulk enrollment tests passed")
