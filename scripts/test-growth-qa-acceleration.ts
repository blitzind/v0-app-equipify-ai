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
import { GROWTH_LEAD_TIMELINE_EVENT_TYPES } from "../lib/growth/timeline-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

assert.equal(GROWTH_QA_ACCELERATION_QA_MARKER, "growth-qa-acceleration-v1")
assert.equal(GROWTH_QA_ACCELERATION_TIMELINE_EVENT_TYPES.length, 3)

for (const eventType of GROWTH_QA_ACCELERATION_TIMELINE_EVENT_TYPES) {
  assert.ok(
    GROWTH_LEAD_TIMELINE_EVENT_TYPES.includes(eventType),
    `${eventType} missing from timeline types`,
  )
}

const migrationSource = readSource(
  "supabase/migrations/20270604120000_growth_qa_acceleration_timeline_events.sql",
)
for (const eventType of GROWTH_QA_ACCELERATION_TIMELINE_EVENT_TYPES) {
  assert.match(migrationSource, new RegExp(`'${eventType}'`))
}

const qaSource = readSource("lib/growth/sequence-enrollment/qa-acceleration.ts")
assert.match(qaSource, /qaScheduleGrowthEnrollmentStepNow/)
assert.match(qaSource, /qaForceGrowthEnrollmentStepDueNow/)
assert.match(qaSource, /qaRunGrowthEnrollmentSchedulerNow/)
assert.match(qaSource, /emitGrowthLeadQaScheduleStepNowTimeline/)
assert.match(qaSource, /emitGrowthLeadQaForceDueNowTimeline/)
assert.match(qaSource, /emitGrowthLeadQaSchedulerRunTimeline/)
assert.match(qaSource, /bypassBusinessHoursStepId/)
assert.doesNotMatch(qaSource, /humanApprovedAt/)
assert.doesNotMatch(qaSource, /executeGrowthOutreachQueueItem/)

const schedulerSource = readSource("lib/growth/sequence-enrollment/run-sequence-scheduler.ts")
assert.match(schedulerSource, /qaBypassBusinessHours/)
assert.match(schedulerSource, /respectBusinessHours: !qaBypassBusinessHours/)

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
  formatQaAccelerationBlockReason("transport_not_configured"),
  "Outbound transport is not configured.",
)
assert.equal(
  formatQaAccelerationBlockReason("outside_business_hours"),
  "The step is not due yet — use Make Step Due Now to bypass business hours.",
)

console.log("growth qa acceleration tests passed")
