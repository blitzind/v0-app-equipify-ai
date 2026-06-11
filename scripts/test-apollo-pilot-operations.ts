/**
 * Apollo Pilot Operations — Phase 12 certification.
 * Run: pnpm test:apollo-pilot-operations
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

import {
  assertApolloPilotCohortCompanyUnique,
  buildApolloPilotCohortTimestamps,
  isApolloPilotCohortProcessingAllowed,
  resolveApolloPilotCohortStatusAfterAction,
} from "../lib/growth/apollo/apollo-pilot-cohort-state"
import { buildApolloPilotChannelAttributionMetrics } from "../lib/growth/apollo/apollo-pilot-channel-attribution-calculator"
import { buildApolloPilotContentPerformanceMetrics } from "../lib/growth/apollo/apollo-pilot-content-performance-calculator"
import { buildApolloPilotFunnelMetrics } from "../lib/growth/apollo/apollo-pilot-funnel-calculator"
import { buildApolloPilotOperatorAnalytics } from "../lib/growth/apollo/apollo-pilot-operator-analytics-calculator"
import { buildApolloPilotReadinessPayload } from "../lib/growth/apollo/apollo-pilot-readiness"
import { buildApolloPilotRoiMetrics } from "../lib/growth/apollo/apollo-pilot-roi-calculator"
import { APOLLO_PILOT_OPERATIONS_QA_MARKER } from "../lib/growth/apollo/apollo-pilot-types"

const ROOT = process.cwd()

const REQUIRED_FILES = [
  "supabase/migrations/20270824120000_growth_engine_apollo_pilot_operations.sql",
  "lib/growth/apollo/apollo-pilot-types.ts",
  "lib/growth/apollo/apollo-pilot-cohort-state.ts",
  "lib/growth/apollo/apollo-pilot-funnel-calculator.ts",
  "lib/growth/apollo/apollo-pilot-channel-attribution-calculator.ts",
  "lib/growth/apollo/apollo-pilot-content-performance-calculator.ts",
  "lib/growth/apollo/apollo-pilot-operator-analytics-calculator.ts",
  "lib/growth/apollo/apollo-pilot-roi-calculator.ts",
  "lib/growth/apollo/apollo-pilot-readiness.ts",
  "lib/growth/apollo/apollo-pilot-route.ts",
  "app/api/platform/growth/apollo-pilot/readiness/route.ts",
  "app/api/platform/growth/apollo-pilot/cohorts/route.ts",
  "app/api/platform/growth/apollo-pilot/cohorts/[id]/route.ts",
  "app/api/platform/growth/apollo-pilot/cohorts/[id]/actions/route.ts",
  "app/api/platform/growth/apollo-pilot/cohorts/[id]/funnel/route.ts",
  "app/api/platform/growth/apollo-pilot/cohorts/[id]/channels/route.ts",
  "app/api/platform/growth/apollo-pilot/cohorts/[id]/content/route.ts",
  "app/api/platform/growth/apollo-pilot/cohorts/[id]/operators/route.ts",
  "app/api/platform/growth/apollo-pilot/cohorts/[id]/roi/route.ts",
  "components/growth/apollo-pilot-operations-panel.tsx",
]

const FORBIDDEN_SIDE_EFFECT_IMPORTS = [
  "queueSequenceStepTransportJob",
  "runSequenceExecutionJob",
  "insertGrowthOutreachQueueItem",
  "sendEmail",
  "sendSms",
  "bulkEnrollLeadsInGrowthSequence",
  "enrollLeadInSequence",
]

for (const relativePath of REQUIRED_FILES) {
  assert.ok(fs.existsSync(path.join(ROOT, relativePath)), `missing file: ${relativePath}`)
  console.log(`  ✓ file.${relativePath}`)
}

const routeSource = fs.readFileSync(path.join(ROOT, "lib/growth/apollo/apollo-pilot-route.ts"), "utf8")
for (const forbidden of FORBIDDEN_SIDE_EFFECT_IMPORTS) {
  assert.equal(routeSource.includes(forbidden), false, `forbidden import usage: ${forbidden}`)
}
console.log("  ✓ no outreach side-effect imports in pilot route")

const migrationSource = fs.readFileSync(
  path.join(ROOT, "supabase/migrations/20270824120000_growth_engine_apollo_pilot_operations.sql"),
  "utf8",
)
assert.match(migrationSource, /apollo_pilot_cohorts/)
assert.match(migrationSource, /apollo_pilot_cohort_companies/)
assert.match(migrationSource, /apollo_pilot_cohort_companies_unique/)
console.log("  ✓ migration schema")

assert.equal(APOLLO_PILOT_OPERATIONS_QA_MARKER, "apollo-pilot-operations-v12")

const readiness = buildApolloPilotReadinessPayload({ migration_present: true })
assert.equal(readiness.ready, true)
assert.ok(readiness.certified_pipeline.length >= 8)
console.log("  ✓ readiness payload")

assert.equal(assertApolloPilotCohortCompanyUnique(["a"], "a").ok, false)
assert.equal(assertApolloPilotCohortCompanyUnique(["a"], "b").ok, true)
console.log("  ✓ duplicate company prevention")

assert.equal(resolveApolloPilotCohortStatusAfterAction("draft", "activate"), "active")
assert.equal(resolveApolloPilotCohortStatusAfterAction("active", "pause"), "paused")
assert.equal(resolveApolloPilotCohortStatusAfterAction("paused", "resume"), "active")
assert.equal(resolveApolloPilotCohortStatusAfterAction("active", "complete"), "completed")
assert.equal(resolveApolloPilotCohortStatusAfterAction("draft", "cancel"), "cancelled")
assert.equal(resolveApolloPilotCohortStatusAfterAction("completed", "activate"), null)
console.log("  ✓ status transitions")

assert.equal(isApolloPilotCohortProcessingAllowed("active"), true)
assert.equal(isApolloPilotCohortProcessingAllowed("paused"), false)
assert.equal(isApolloPilotCohortProcessingAllowed("cancelled"), false)
const pauseTimestamps = buildApolloPilotCohortTimestamps("active", "paused", "2026-06-11T00:00:00.000Z")
assert.equal(pauseTimestamps.paused_at, "2026-06-11T00:00:00.000Z")
console.log("  ✓ pause/cancel processing gates")

const funnel = buildApolloPilotFunnelMetrics({
  cohort_id: "cohort-1",
  counts: {
    companies: 25,
    contacts: 120,
    qualified: 80,
    enrolled: 60,
    draft_approved: 50,
    job_approved: 40,
    sent: 35,
    replied: 10,
    meeting: 4,
    opportunity: 2,
    revenue: 1,
  },
})
assert.equal(funnel.stages[0]?.count, 25)
assert.ok(funnel.stages[1]!.stage_conversion_pct != null)
console.log("  ✓ funnel calculations")

const channels = buildApolloPilotChannelAttributionMetrics({
  cohort_id: "cohort-1",
  events: [
    { channel: "email", event_type: "meeting", first_touch_channel: "email", last_touch_channel: "sms" },
    { channel: "email", event_type: "reply" },
  ],
})
assert.ok(channels.channels.length > 0)
console.log("  ✓ channel attribution calculations")

const content = buildApolloPilotContentPerformanceMetrics({
  cohort_id: "cohort-1",
  sends: [
    { channel: "email", variant_key: "opening_pain_first", replied: true },
    { channel: "email", variant_key: "opening_pain_first" },
  ],
})
assert.equal(content.rows[0]?.reply_rate_pct, 50)
console.log("  ✓ content performance calculations")

const operators = buildApolloPilotOperatorAnalytics({
  cohort_id: "cohort-1",
  reviews: [
    { review_type: "draft", outcome: "approved", created_at: "2026-06-10T10:00:00.000Z", resolved_at: "2026-06-10T10:30:00.000Z" },
    { review_type: "draft", outcome: "rejected", created_at: "2026-06-10T11:00:00.000Z", resolved_at: "2026-06-10T11:05:00.000Z" },
    { review_type: "job", outcome: "approved", created_at: "2026-06-10T12:00:00.000Z", resolved_at: "2026-06-10T12:10:00.000Z" },
  ],
  computed_at: "2026-06-10T13:00:00.000Z",
})
assert.equal(operators.draft_approval_pct, 50)
assert.equal(operators.job_approval_pct, 100)
console.log("  ✓ operator analytics calculations")

const roi = buildApolloPilotRoiMetrics({
  cohort_id: "cohort-1",
  counts: {
    companies: 25,
    contacts: 100,
    verified_emails: 80,
    sequence_ready_contacts: 60,
    enrollments: 40,
    meetings: 5,
    opportunities: 2,
    customers: 1,
    apollo_credits_consumed: 500,
    estimated_credit_cost_usd: 250,
    revenue_attributed: 10000,
  },
})
assert.ok(roi.estimates.some((e) => e.metric_key === "cost_per_meeting" && e.value === 50))
console.log("  ✓ ROI calculations")

console.log("\nApollo Pilot Operations — Phase 12 certification PASSED")
