/**
 * Regression checks for sequence execution CTA wiring, View Lead routing, skip confirm, and restore.
 * Run: pnpm test:growth-sequence-execution-cta-restore
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  growthCrmLeadDetailHref,
  growthLeadDetailHref,
  growthSequenceExecutionHref,
} from "../lib/growth/sequence-enrollment/enrollment-navigation"
import {
  GROWTH_SEQUENCE_EXECUTION_FOCUS_JOB_EVENT,
  sequenceExecutionJobRowId,
} from "../lib/growth/sequence-enrollment/sequence-execution-job-focus"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

assert.match(
  growthSequenceExecutionHref({
    enrollmentId: "00000000-0000-4000-8000-000000000001",
    highlightJobId: "00000000-0000-4000-8000-000000000003",
  }),
  /highlightJobId=00000000-0000-4000-8000-000000000003/,
)

assert.match(growthCrmLeadDetailHref("lead-1"), /\/admin\/growth\/leads\/crm\?open=lead-1/)
assert.match(growthLeadDetailHref("lead-1", "growth.leads"), /\/crm\?open=lead-1/)
assert.match(growthLeadDetailHref("lead-1", "lead_inbox"), /\/admin\/growth\/leads\/lead-1/)
assert.equal(sequenceExecutionJobRowId("job-1"), "sequence-job-job-1")
assert.equal(GROWTH_SEQUENCE_EXECUTION_FOCUS_JOB_EVENT, "growth-sequence-execution-focus-job")

const executionContext = readSource("components/growth/growth-enrollment-execution-context.tsx")
assert.match(executionContext, /navigateToExecutionJob/)
assert.match(executionContext, /dispatchSequenceExecutionJobFocus/)
assert.match(executionContext, /scroll: false/)
assert.doesNotMatch(
  executionContext.slice(executionContext.indexOf("Ready for approval"), executionContext.indexOf("View approved job")),
  /asChild[\s\S]{0,120}Ready for approval/,
)

const dashboard = readSource("components/growth/growth-sequence-safe-execution-dashboard.tsx")
assert.match(dashboard, /scheduleSequenceExecutionJobFocus/)
assert.match(dashboard, /GROWTH_SEQUENCE_EXECUTION_FOCUS_JOB_EVENT/)
assert.match(dashboard, /window\.confirm/)
assert.match(dashboard, /Restore/)
assert.match(dashboard, /growthLeadDetailHref\(job\.leadId, "growth\.leads"\)/)
assert.match(dashboard, /data-sequence-action="approve"/)
assert.doesNotMatch(dashboard, /\/admin\/growth\/leads\/\$\{job\.leadId\}/)

const runner = readSource("lib/growth/sequences/execution/sequence-job-runner.ts")
assert.match(runner, /export async function restoreSequenceExecutionJob/)
assert.match(runner, /sequence_execution_job_restored/)
assert.match(runner, /invalid_status_for_restore/)
assert.match(runner, /delivery_attempt_exists/)
assert.match(runner, /active_job_exists/)
assert.match(runner, /status: "pending_approval"/)

const restoreRoute = readSource("app/api/platform/growth/sequences/execution/jobs/[jobId]/restore/route.ts")
assert.match(restoreRoute, /restoreSequenceExecutionJob/)

const repository = readSource("lib/growth/sequences/execution/sequence-job-repository.ts")
assert.match(repository, /listSequenceExecutionJobsForStep/)

console.log("growth sequence execution cta + restore tests passed")
