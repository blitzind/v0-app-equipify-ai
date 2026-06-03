/**
 * QA acceleration controls for pattern enrollments.
 * Run: pnpm test:growth-qa-acceleration
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  formatQaAccelerationBlockReason,
  GROWTH_QA_ACCELERATION_QA_MARKER,
  GROWTH_QA_ACCELERATION_TIMELINE_EVENT_TYPES,
} from "../lib/growth/sequence-enrollment/qa-acceleration-types"
import {
  formatGrowthSchedulerStepFailureMessage,
  GROWTH_SCHEDULER_AI_GENERATION_FAILURE_CODES,
  normalizeGrowthSchedulerAiGenerationFailureCode,
  pickSchedulerStepFailureForEnrollment,
} from "../lib/growth/sequence-enrollment/scheduler-step-failure-types"
import { GROWTH_LEAD_TIMELINE_EVENT_TYPES } from "../lib/growth/timeline-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

const QA_ACCELERATION_MIGRATION_SUFFIX = "growth_qa_acceleration_timeline_events.sql"

function findQaAccelerationMigrationRelativePath(): string {
  const migrationsDir = path.join(process.cwd(), "supabase/migrations")
  const matches = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(QA_ACCELERATION_MIGRATION_SUFFIX))
    .sort()

  assert.equal(
    matches.length,
    1,
    `Expected exactly one QA acceleration migration (*${QA_ACCELERATION_MIGRATION_SUFFIX}); found: ${matches.join(", ") || "none"}`,
  )

  return path.join("supabase/migrations", matches[0]!)
}

assert.equal(GROWTH_QA_ACCELERATION_QA_MARKER, "growth-qa-acceleration-v1")
assert.equal(GROWTH_QA_ACCELERATION_TIMELINE_EVENT_TYPES.length, 3)

for (const eventType of GROWTH_QA_ACCELERATION_TIMELINE_EVENT_TYPES) {
  assert.ok(
    GROWTH_LEAD_TIMELINE_EVENT_TYPES.includes(eventType),
    `${eventType} missing from timeline types`,
  )
}

const migrationSource = readSource(findQaAccelerationMigrationRelativePath())
for (const eventType of GROWTH_QA_ACCELERATION_TIMELINE_EVENT_TYPES) {
  assert.match(migrationSource, new RegExp(`'${eventType}'`))
}

const qaSource = readSource("lib/growth/sequence-enrollment/qa-acceleration.ts")
assert.match(qaSource, /runGrowthOutreachPreflight/)
assert.match(qaSource, /from "@\/lib\/growth\/outreach\/outreach-preflight"/)
assert.match(qaSource, /qaScheduleGrowthEnrollmentStepNow/)
assert.match(qaSource, /qaForceGrowthEnrollmentStepDueNow/)
assert.match(qaSource, /qaRunGrowthEnrollmentSchedulerNow/)
assert.match(qaSource, /pickSchedulerStepFailureForEnrollment/)
assert.match(qaSource, /schedulerResult\.stepFailures/)
assert.match(qaSource, /blockReasonDetail/)
const stepFailurePickIdx = qaSource.indexOf("pickSchedulerStepFailureForEnrollment")
const stepNotEligibleIdx = qaSource.indexOf('blockReason = "step_not_eligible"')
assert.ok(
  stepFailurePickIdx !== -1 && stepNotEligibleIdx !== -1 && stepFailurePickIdx < stepNotEligibleIdx,
  "QA scheduler must resolve stepFailures before falling back to step_not_eligible",
)
assert.match(qaSource, /emitGrowthLeadQaScheduleStepNowTimeline/)
assert.match(qaSource, /emitGrowthLeadQaForceDueNowTimeline/)
assert.match(qaSource, /emitGrowthLeadQaSchedulerRunTimeline/)
assert.match(qaSource, /bypassBusinessHoursStepId/)
assert.doesNotMatch(qaSource, /humanApprovedAt/)
assert.doesNotMatch(qaSource, /executeGrowthOutreachQueueItem/)

const schedulerSource = readSource("lib/growth/sequence-enrollment/run-sequence-scheduler.ts")
assert.match(schedulerSource, /qaBypassBusinessHours/)
assert.match(schedulerSource, /respectBusinessHours: !qaBypassBusinessHours/)
assert.match(schedulerSource, /stepFailures/)

const transportQueueSource = readSource("lib/growth/sequences/execution/queue-sequence-step-transport-job.ts")
assert.match(transportQueueSource, /sequence_scheduler_ai_generation_failed/)
assert.match(transportQueueSource, /providerHealth/)
assert.match(transportQueueSource, /runGrowthAiCopilotGeneration/)

const accessSource = readSource("lib/growth/access.ts")
assert.match(accessSource, /requireGrowthQaAccelerationAccess/)
assert.match(accessSource, /isGrowthQaAccelerationEnabled/)

const configSource = readSource("lib/growth/sequence-enrollment/qa-acceleration-config.ts")
assert.match(configSource, /GROWTH_ENABLE_QA_ACCELERATION/)
assert.match(configSource, /isGrowthProductionRuntime/)

const detailUiSource = readSource("components/growth/growth-pattern-enrollment-detail.tsx")
assert.match(detailUiSource, /QA Tools/)
assert.match(detailUiSource, /Schedule Step Now/)
assert.match(detailUiSource, /Make Step Due Now/)
assert.match(detailUiSource, /qaAccelerationEnabled/)
assert.match(detailUiSource, /Enrollment History/)

const scheduleRouteSource = readSource(
  "app/api/platform/growth/sequences/enrollments/[enrollmentId]/qa/schedule-step-now/route.ts",
)
assert.match(scheduleRouteSource, /requireGrowthQaAccelerationAccess/)

const forceRouteSource = readSource(
  "app/api/platform/growth/sequences/enrollments/[enrollmentId]/qa/force-due-now/route.ts",
)
assert.match(forceRouteSource, /qaForceGrowthEnrollmentStepDueNow/)

const runRouteSource = readSource(
  "app/api/platform/growth/sequences/enrollments/[enrollmentId]/qa/run-scheduler/route.ts",
)
assert.match(runRouteSource, /qaRunGrowthEnrollmentSchedulerNow/)
assert.match(qaSource, /executionHref/)

const envExample = readSource(".env.local.example")
assert.match(envExample, /GROWTH_ENABLE_QA_ACCELERATION/)

assert.equal(
  formatQaAccelerationBlockReason("no_enabled_delivery_route"),
  "No enabled delivery route.",
)
assert.equal(formatQaAccelerationBlockReason("sender_pending"), "Sender account is pending activation.")
assert.equal(
  formatQaAccelerationBlockReason("outside_business_hours"),
  "The step is not due yet — use Make Step Due Now to bypass business hours.",
)

assert.equal(GROWTH_SCHEDULER_AI_GENERATION_FAILURE_CODES.length, 9)
assert.equal(
  normalizeGrowthSchedulerAiGenerationFailureCode({
    code: "ai_not_configured",
    message: "GROWTH_ENGINE_AI_ORG_ID is not configured.",
  }),
  "ai_org_missing_or_invalid",
)
assert.equal(
  formatGrowthSchedulerStepFailureMessage({
    code: "ai_not_configured",
    message: "GROWTH_ENGINE_AI_ORG_ID is not configured.",
  }),
  "GROWTH_ENGINE_AI_ORG_ID is missing or not a valid UUID — draft generation cannot run. (GROWTH_ENGINE_AI_ORG_ID is not configured.)",
)
assert.match(
  formatQaAccelerationBlockReason("ai_provider_unavailable"),
  /AI provider is unavailable/,
)
assert.match(
  formatQaAccelerationBlockReason("personalization_failed"),
  /personalization failed/i,
)
assert.match(
  formatQaAccelerationBlockReason("generation_insert_failed"),
  /could not be saved/i,
)
assert.match(
  formatQaAccelerationBlockReason("unknown_generation_error"),
  /unknown reason/i,
)

const aiFailure = pickSchedulerStepFailureForEnrollment({
  stepFailures: [
    {
      enrollmentId: "enroll-1",
      stepId: "step-1",
      leadId: "lead-1",
      code: "ai_not_configured",
      message: "GROWTH_ENGINE_AI_ORG_ID is not configured.",
      phase: "ai_generation",
      generationType: "cold_email",
    },
  ],
  enrollmentId: "enroll-1",
  stepId: "step-1",
})
assert.ok(aiFailure)
assert.equal(aiFailure?.code, "ai_not_configured")
assert.equal(
  formatGrowthSchedulerStepFailureMessage(aiFailure!),
  "GROWTH_ENGINE_AI_ORG_ID is missing or not a valid UUID — draft generation cannot run. (GROWTH_ENGINE_AI_ORG_ID is not configured.)",
)
assert.notEqual(
  formatGrowthSchedulerStepFailureMessage(aiFailure!),
  formatQaAccelerationBlockReason("step_not_eligible"),
  "AI generation failure must not surface as step_not_eligible",
)

console.log("growth qa acceleration tests passed")
