/**
 * Regression checks for manual sequence step progression and draft_created planning.
 * Run: pnpm test:growth-sequence-manual-step-progression
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  enrollmentHasPriorIncompleteSteps,
  isDraftReadyEmailSchedulerStep,
  isManualStepAwaitingCompletion,
  isSequenceStepDueForScheduler,
  pickInProgressEnrollmentStep,
} from "../lib/growth/sequence-enrollment/enrollment-step-progress"
import type { GrowthSequenceEnrollmentStep } from "../lib/growth/sequence-enrollment-types"

function step(
  partial: Partial<GrowthSequenceEnrollmentStep> &
    Pick<GrowthSequenceEnrollmentStep, "stepOrder" | "status" | "channel">,
): GrowthSequenceEnrollmentStep {
  return {
    id: `step-${partial.stepOrder}`,
    enrollmentId: "enrollment-1",
    leadId: "lead-1",
    stepOrder: partial.stepOrder,
    status: partial.status,
    channel: partial.channel,
    generationType: null,
    generationId: partial.generationId ?? null,
    outreachQueueId: null,
    cadenceTaskId: partial.cadenceTaskId ?? null,
    meetingId: null,
    opportunityId: null,
    scheduledFor: partial.scheduledFor ?? null,
    dueAt: null,
    instructions: null,
    stepOutcome: null,
    skipReason: null,
    stepExecutionConfidence: null,
    completedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    sequencePatternStepId: "pattern-step-1",
  }
}

const manualQueued = step({ stepOrder: 1, status: "queued", channel: "manual_call", cadenceTaskId: "task-1" })
const emailPendingFuture = step({
  stepOrder: 2,
  status: "pending",
  channel: "email",
  scheduledFor: "2099-01-01T00:00:00.000Z",
})

assert.equal(pickInProgressEnrollmentStep([manualQueued, emailPendingFuture], 0)?.id, manualQueued.id)
assert.equal(isManualStepAwaitingCompletion(manualQueued), true)
assert.equal(isManualStepAwaitingCompletion(emailPendingFuture), false)
assert.equal(enrollmentHasPriorIncompleteSteps([manualQueued, emailPendingFuture], emailPendingFuture), true)

const emailDraftFuture = step({
  stepOrder: 2,
  status: "draft_created",
  channel: "email",
  generationId: "gen-1",
  scheduledFor: "2099-01-01T00:00:00.000Z",
})

assert.equal(isDraftReadyEmailSchedulerStep(emailDraftFuture), true)
assert.equal(isSequenceStepDueForScheduler(emailDraftFuture), true)
assert.equal(isSequenceStepDueForScheduler(emailPendingFuture), false)

const orchestratorSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/sequence-enrollment/sequence-enrollment-orchestrator.ts"),
  "utf8",
)
assert.match(orchestratorSource, /completeGrowthCadenceTask/)
assert.match(orchestratorSource, /skipGrowthCadenceTask/)
assert.match(orchestratorSource, /queueSequenceStepTransportJob/)

const schedulerRepoSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/sequence-enrollment/sequence-scheduler-repository.ts"),
  "utf8",
)
assert.match(schedulerRepoSource, /isSequenceStepDueForScheduler/)
assert.doesNotMatch(schedulerRepoSource, /\.not\("scheduled_for", "is", null\)/)

const schedulerSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/sequence-enrollment/run-sequence-scheduler.ts"),
  "utf8",
)
assert.match(schedulerSource, /isDraftReadyEmailSchedulerStep/)
assert.match(schedulerSource, /executionJobsPlanned/)

const detailSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-pattern-enrollment-detail.tsx"),
  "utf8",
)
assert.match(detailSource, /Manual Step Actions/)
assert.match(detailSource, /postStepAction/)

console.log("growth sequence manual step progression tests passed")
