/**
 * Regression checks for Sequence Safe Execution (Phase 2H).
 * Run: pnpm test:growth-sequence-safe-execution
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  evaluateSequenceApprovalGate,
  buildSequenceApprovalMetadata,
} from "../lib/growth/sequences/execution/sequence-approval-gate"
import {
  GROWTH_SEQUENCE_SAFE_EXECUTION_PRIVACY_NOTE,
  GROWTH_SEQUENCE_SAFE_EXECUTION_QA_MARKER,
  GROWTH_SEQUENCE_EXECUTION_JOB_STATUSES,
  GROWTH_SEQUENCE_EXECUTION_TIMELINE_EVENT_TYPES,
  maskSequenceExecutionLeadLabel,
  sequenceExecutionStatusLabel,
} from "../lib/growth/sequences/execution/sequence-execution-types"
import { GROWTH_SEQUENCE_SAFE_EXECUTION_SCHEMA_MIGRATION } from "../lib/growth/sequences/execution/sequence-execution-schema-health"

const UNSUBSCRIBE_PLACEHOLDER = "{{unsubscribe_link}}"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  assert.equal(GROWTH_SEQUENCE_SAFE_EXECUTION_QA_MARKER, "growth-sequence-safe-execution-v1")
  assert.match(GROWTH_SEQUENCE_SAFE_EXECUTION_PRIVACY_NOTE, /human approval/i)
  assert.equal(GROWTH_SEQUENCE_EXECUTION_JOB_STATUSES.length, 9)
  assert.equal(GROWTH_SEQUENCE_EXECUTION_TIMELINE_EVENT_TYPES.length, 6)

  const migration = readSource(`supabase/migrations/${GROWTH_SEQUENCE_SAFE_EXECUTION_SCHEMA_MIGRATION}`)
  assert.match(migration, /growth\.sequence_execution_jobs/)
  assert.match(migration, /growth\.sequence_execution_job_events/)
  assert.match(migration, /sequence_step_scheduled/)
  assert.match(migration, /sequence_step_approved/)
  assert.match(migration, /sequence_step_blocked/)
  assert.match(migration, /sequence_step_sent/)
  assert.match(migration, /sequence_step_failed/)
  assert.match(migration, /idx_growth_sequence_execution_jobs_active_step/)
  assert.match(migration, /service role only/)

  assert.equal(sequenceExecutionStatusLabel("pending_approval"), "pending approval")
  assert.equal(maskSequenceExecutionLeadLabel("abc12345-0000-0000-0000-000000000001", "Acme Corp"), "Acme Corp")
  assert.match(maskSequenceExecutionLeadLabel("abc12345-0000-0000-0000-000000000001"), /^Lead abc12345/)

  const pending = evaluateSequenceApprovalGate({
    job: { requiresHumanApproval: true, humanApprovedAt: null, humanApprovedBy: null },
  })
  assert.equal(pending.allowed, false)
  assert.equal(pending.code, "not_yet_approved")

  const approvedMissingConfirm = evaluateSequenceApprovalGate({
    job: {
      requiresHumanApproval: true,
      humanApprovedAt: new Date().toISOString(),
      humanApprovedBy: "user-1",
    },
    humanApproved: false,
    humanApprovalConfirmed: false,
  })
  assert.equal(approvedMissingConfirm.allowed, false)
  assert.equal(approvedMissingConfirm.code, "human_approval_confirmed_required")

  const approvedOk = evaluateSequenceApprovalGate({
    job: {
      requiresHumanApproval: true,
      humanApprovedAt: new Date().toISOString(),
      humanApprovedBy: "user-1",
    },
    humanApproved: true,
    humanApprovalConfirmed: true,
    approvedBy: "user-1",
  })
  assert.equal(approvedOk.allowed, true)

  const metadata = buildSequenceApprovalMetadata({ approvedBy: "user-1" })
  assert.equal(metadata.qa_marker, GROWTH_SEQUENCE_SAFE_EXECUTION_QA_MARKER)

  const plannerSource = readSource("lib/growth/sequences/execution/sequence-job-planner.ts")
  assert.match(plannerSource, /listDueSequenceSchedulerSteps/)
  assert.match(plannerSource, /findActiveSequenceExecutionJob/)
  assert.match(plannerSource, /pending_approval/)
  assert.doesNotMatch(plannerSource, /executeTransportSend/)

  const runnerSource = readSource("lib/growth/sequences/execution/sequence-job-runner.ts")
  assert.match(runnerSource, /assertSequenceRunApproval/)
  assert.match(runnerSource, /assertPreSendSuppressionAllowed/)
  assert.match(runnerSource, /executeTransportSend/)
  assert.match(runnerSource, /advanceGrowthSequenceEnrollmentAfterStep/)
  assert.match(runnerSource, /job_not_approved/)
  assert.match(runnerSource, /human_approved: true/)
  assert.match(runnerSource, /human_approval_confirmed: true/)
  const approveBlock = runnerSource.slice(
    runnerSource.indexOf("export async function approveSequenceExecutionJob"),
    runnerSource.indexOf("export async function skipSequenceExecutionJob"),
  )
  assert.doesNotMatch(approveBlock, /executeTransportSend/)

  const sendBuilderSource = readSource("lib/growth/sequences/execution/sequence-send-builder.ts")
  assert.match(sendBuilderSource, /applyOutboundEmailTracking/)
  assert.match(sendBuilderSource, new RegExp(UNSUBSCRIBE_PLACEHOLDER.replace(/[{}]/g, "\\$&")))
  assert.match(sendBuilderSource, /generation\.status !== "approved"/)

  const repositorySource = readSource("lib/growth/sequences/execution/sequence-job-repository.ts")
  assert.match(repositorySource, /findActiveSequenceExecutionJob/)
  assert.match(repositorySource, /tryLockSequenceExecutionJob/)
  assert.match(repositorySource, /listApprovedDueSequenceExecutionJobs/)
  assert.match(repositorySource, /maskSequenceExecutionLeadLabel/)

  const cronSource = readSource("app/api/cron/growth-sequence-safe-execute/route.ts")
  assert.match(cronSource, /CRON_SECRET/)
  assert.match(cronSource, /runApprovedDueSequenceExecutionJobs/)
  assert.doesNotMatch(cronSource, /approveSequenceExecutionJob/)

  const approveRouteSource = readSource(
    "app/api/platform/growth/sequences/execution/jobs/[jobId]/approve/route.ts",
  )
  assert.match(approveRouteSource, /requireGrowthEnginePlatformAccess/)
  assert.doesNotMatch(approveRouteSource, /executeTransportSend/)

  const runRouteSource = readSource("app/api/platform/growth/sequences/execution/jobs/[jobId]/run/route.ts")
  assert.match(runRouteSource, /humanApprovalConfirmed/)
  assert.match(runRouteSource, /requireGrowthEnginePlatformAccess/)

  const uiSource = readSource("components/growth/growth-sequence-safe-execution-dashboard.tsx")
  assert.match(uiSource, /Autonomous sequence sending is off/)
  assert.match(uiSource, /All sends require human approval/)
  assert.match(uiSource, /GROWTH_SEQUENCE_SAFE_EXECUTION_QA_MARKER/)
  assert.match(uiSource, /Due Jobs/)
  assert.match(uiSource, /Pending Approval/)
  assert.match(uiSource, /Sent 24h/)
  assert.doesNotMatch(uiSource, /api_key|secret|password/i)

  console.log("growth sequence safe execution tests passed")
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
