/**
 * Regression checks for Growth Engine sequence scheduler (slice 6.16A).
 * Run: pnpm test:growth-sequence-scheduler
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildSequenceSchedulerIdempotencyKey,
  GROWTH_SEQUENCE_SCHEDULER_DEFAULT_BATCH_SIZE,
  GROWTH_SEQUENCE_SCHEDULER_QA_MARKER,
} from "../lib/growth/sequence-enrollment/sequence-scheduler-types"

assert.equal(GROWTH_SEQUENCE_SCHEDULER_QA_MARKER, "growth-sequence-scheduler-v1")
assert.equal(GROWTH_SEQUENCE_SCHEDULER_DEFAULT_BATCH_SIZE, 25)

const idempotencyKey = buildSequenceSchedulerIdempotencyKey("enrollment-1", "step-1")
assert.match(idempotencyKey, /^sequence-scheduler:enrollment-1:step-1$/)

const schedulerSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/sequence-enrollment/run-sequence-scheduler.ts"),
  "utf8",
)
assert.match(schedulerSource, /pending_approval/)
assert.match(schedulerSource, /dryRun/)
assert.match(schedulerSource, /runGrowthAiCopilotGeneration/)
assert.match(schedulerSource, /schedulerIdempotencyKey/)
assert.match(schedulerSource, /skippedSuppressed/)
assert.match(schedulerSource, /skippedAlreadyQueued/)
assert.match(schedulerSource, /emitGrowthLeadSequenceStepDueTimeline/)
assert.match(schedulerSource, /emitGrowthLeadSequenceStepSkippedTimeline/)
assert.doesNotMatch(schedulerSource, /executeGrowthOutreachQueueItem/)
assert.match(schedulerSource, /queueSequenceStepTransportJob/)
assert.match(schedulerSource, /isGrowthOutboundStandaloneMode/)
assert.match(schedulerSource, /sequence_scheduler_outbound_mode/)

const executeRouteSource = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/outreach/queue/[queueId]/execute/route.ts"),
  "utf8",
)
assert.match(executeRouteSource, /approved.*scheduled/s)

const cronSource = fs.readFileSync(
  path.join(process.cwd(), "app/api/cron/growth-sequence-scheduler/route.ts"),
  "utf8",
)
assert.match(cronSource, /runGrowthCronJob/)
assert.match(cronSource, /runGrowthSequenceScheduler/)

const platformRouteSource = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/sequences/scheduler/run/route.ts"),
  "utf8",
)
assert.match(platformRouteSource, /requireGrowthEnginePlatformAccess/)

const repositorySource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/sequence-enrollment/sequence-scheduler-repository.ts"),
  "utf8",
)
assert.match(repositorySource, /listDueSequenceSchedulerSteps/)
assert.match(repositorySource, /insertGrowthSequenceSchedulerRun/)

const migrationSource = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270223120000_growth_engine_sequence_scheduler.sql"),
  "utf8",
)
assert.match(migrationSource, /sequence_scheduler_runs/)
assert.match(migrationSource, /sequence_step_due/)
assert.match(migrationSource, /idx_outreach_queue_sequence_step_active/)

const uiSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-sequence-execution-dashboard.tsx"),
  "utf8",
)
assert.match(uiSource, /GROWTH_SEQUENCE_SCHEDULER_QA_MARKER/)
assert.match(uiSource, /Dry Run/)

console.log("growth sequence scheduler tests passed")
