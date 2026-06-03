/**
 * Phase 1.3 — standalone sequence planning via growth-sequence-scheduler cron (no separate plan cron).
 * Run: pnpm test:growth-standalone-sequence-planning
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_SEQUENCE_SCHEDULER_CRON_ROUTE,
  GROWTH_SEQUENCE_SCHEDULER_QA_MARKER,
} from "../lib/growth/sequence-enrollment/sequence-scheduler-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

assert.equal(GROWTH_SEQUENCE_SCHEDULER_CRON_ROUTE, "growth-sequence-scheduler")

const vercelJson = readSource("vercel.json")
assert.match(vercelJson, /"path": "\/api\/cron\/growth-sequence-scheduler"/)
assert.doesNotMatch(vercelJson, /growth-sequence-plan/)

const schedulerSource = readSource("lib/growth/sequence-enrollment/run-sequence-scheduler.ts")
assert.match(schedulerSource, /sequence_scheduler_standalone_planning_completed/)
assert.match(schedulerSource, /standalonePlanningAutomated: standaloneMode/)
assert.match(schedulerSource, /planningPlane: standaloneMode \? "sequence_execution_jobs"/)
assert.match(schedulerSource, /skippedTransportNotConfigured/)
assert.match(schedulerSource, /skippedNoSender/)
assert.match(schedulerSource, /transport_not_configured/)
assert.match(schedulerSource, /no_sender_route/)
assert.match(schedulerSource, /GROWTH_SEQUENCE_SCHEDULER_CRON_ROUTE/)
assert.match(schedulerSource, /manualPlanRequired: !standaloneMode/)

const cronSource = readSource("app/api/cron/growth-sequence-scheduler/route.ts")
assert.match(cronSource, /runGrowthSequenceScheduler/)
assert.match(cronSource, /sequence_execution_jobs/)

const planRouteSource = readSource("app/api/platform/growth/sequences/execution/plan/route.ts")
assert.match(planRouteSource, /isGrowthOutboundStandaloneMode/)
assert.match(planRouteSource, /runGrowthSequenceScheduler/)
assert.match(planRouteSource, /delegatedToScheduler/)

const plannerSource = readSource("lib/growth/sequences/execution/sequence-job-planner.ts")
assert.match(plannerSource, /standalone_mode_uses_scheduler/)
assert.match(plannerSource, /isGrowthOutboundStandaloneMode/)

const transportQueueSource = readSource(
  "lib/growth/sequences/execution/queue-sequence-step-transport-job.ts",
)
assert.match(transportQueueSource, /status: "pending_approval"/)
assert.match(transportQueueSource, /findActiveSequenceExecutionJob/)
assert.doesNotMatch(transportQueueSource, /insertGrowthOutreachQueueItem/)

const safeExecuteSource = readSource("app/api/cron/growth-sequence-safe-execute/route.ts")
assert.match(safeExecuteSource, /runApprovedDueSequenceExecutionJobs/)

const safeDashboardSource = readSource(
  "lib/growth/sequences/execution/sequence-execution-dashboard.ts",
)
assert.match(safeDashboardSource, /fetchGrowthSequenceSchedulerStatus/)
assert.match(safeDashboardSource, /standalonePlanningAutomated/)

const safeUiSource = readSource("components/growth/growth-sequence-safe-execution-dashboard.tsx")
assert.match(safeUiSource, /Cron auto-plans jobs/)
assert.match(safeUiSource, /Run scheduler now/)

const executionUiSource = readSource("components/growth/growth-sequence-execution-dashboard.tsx")
assert.match(executionUiSource, /GROWTH_SEQUENCE_SCHEDULER_QA_MARKER/)
assert.match(executionUiSource, /Auto-plans execution jobs/)

console.log("growth standalone sequence planning tests passed")
