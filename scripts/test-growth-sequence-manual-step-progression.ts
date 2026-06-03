/**
 * Regression checks for manual sequence step progression.
 * Run: pnpm test:growth-sequence-manual-step-progression
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  enrollmentHasPriorIncompleteSteps,
  isManualStepAwaitingCompletion,
  pickInProgressEnrollmentStep,
} from "../lib/growth/sequence-enrollment/enrollment-step-progress"
import type { GrowthSequenceEnrollmentStep } from "../lib/growth/sequence-enrollment-types"

function step(partial: Partial<GrowthSequenceEnrollmentStep> & Pick<GrowthSequenceEnrollmentStep, "stepOrder" | "status" | "channel">): GrowthSequenceEnrollmentStep {
  return {
    id: `step-${partial.stepOrder}`,
    enrollmentId: "enrollment-1",
    leadId: "lead-1",
    stepOrder: partial.stepOrder,
    status: partial.status,
    channel: partial.channel,
    generationType: null,
    generationId: null,
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
  }
}

const manualQueued = step({ stepOrder: 1, status: "queued", channel: "manual_call", cadenceTaskId: "task-1" })
const emailPending = step({ stepOrder: 2, status: "pending", channel: "email", scheduledFor: "2026-01-01T00:00:00.000Z" })

assert.equal(pickInProgressEnrollmentStep([manualQueued, emailPending], 0)?.id, manualQueued.id)
assert.equal(isManualStepAwaitingCompletion(manualQueued), true)
assert.equal(isManualStepAwaitingCompletion(emailPending), false)
assert.equal(enrollmentHasPriorIncompleteSteps([manualQueued, emailPending], emailPending), true)

const orchestratorSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/sequence-enrollment/sequence-enrollment-orchestrator.ts"),
  "utf8",
)
assert.match(orchestratorSource, /completeGrowthCadenceTask/)
assert.match(orchestratorSource, /skipGrowthCadenceTask/)

const detailSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-pattern-enrollment-detail.tsx"),
  "utf8",
)
assert.match(detailSource, /Manual Step Actions/)
assert.match(detailSource, /postStepAction/)

const schedulerSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/sequence-enrollment/run-sequence-scheduler.ts"),
  "utf8",
)
assert.match(schedulerSource, /enrollmentHasPriorIncompleteSteps/)

const qaSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/sequence-enrollment/qa-acceleration.ts"),
  "utf8",
)
assert.match(qaSource, /manual_step_in_progress/)
assert.match(qaSource, /pickInProgressEnrollmentStep/)

console.log("growth sequence manual step progression tests passed")
