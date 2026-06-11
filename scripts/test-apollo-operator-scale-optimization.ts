/**
 * Apollo Operator Scale & Workflow Optimization — Phase 13 certification.
 * Run: pnpm test:apollo-operator-scale-optimization
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

import { buildApolloOperatorApprovalQualityReport } from "../lib/growth/apollo/apollo-operator-approval-quality"
import { buildApolloOperatorApprovalSimulationReport } from "../lib/growth/apollo/apollo-operator-approval-simulation"
import { detectApolloOperatorBottlenecks } from "../lib/growth/apollo/apollo-operator-bottleneck-detector"
import { buildApolloOperatorConfidenceCalibrationReport } from "../lib/growth/apollo/apollo-operator-confidence-calibration"
import {
  classifyApolloDraftRegenerationReason,
  buildApolloDraftRegenerationAnalytics,
} from "../lib/growth/apollo/apollo-operator-regeneration-analytics"
import { buildApolloOperationalReadinessScore } from "../lib/growth/apollo/apollo-operator-readiness-score"
import {
  mapEnrollmentRowToQueueItem,
  mapSequenceExecutionRowToQueueItem,
} from "../lib/growth/apollo/apollo-operator-queue-mapper"
import { buildApolloOperatorScaleForecast } from "../lib/growth/apollo/apollo-operator-scale-forecast"
import { buildApolloOperatorScaleReport } from "../lib/growth/apollo/apollo-operator-scale-report"
import { APOLLO_OPERATOR_SCALE_QA_MARKER } from "../lib/growth/apollo/apollo-operator-scale-types"
import { buildApolloOperatorThroughputReport } from "../lib/growth/apollo/apollo-operator-throughput-calculator"

const ROOT = process.cwd()

const REQUIRED_FILES = [
  "lib/growth/apollo/apollo-operator-scale-types.ts",
  "lib/growth/apollo/apollo-operator-queue-mapper.ts",
  "lib/growth/apollo/apollo-operator-throughput-calculator.ts",
  "lib/growth/apollo/apollo-operator-approval-quality.ts",
  "lib/growth/apollo/apollo-operator-confidence-calibration.ts",
  "lib/growth/apollo/apollo-operator-bottleneck-detector.ts",
  "lib/growth/apollo/apollo-operator-regeneration-analytics.ts",
  "lib/growth/apollo/apollo-operator-approval-simulation.ts",
  "lib/growth/apollo/apollo-operator-readiness-score.ts",
  "lib/growth/apollo/apollo-operator-scale-forecast.ts",
  "lib/growth/apollo/apollo-operator-scale-report.ts",
  "lib/growth/apollo/apollo-operator-scale-route.ts",
  "app/api/platform/growth/apollo-operator-scale/readiness/route.ts",
  "app/api/platform/growth/apollo-operator-scale/report/route.ts",
  "components/growth/apollo-operator-scale-panel.tsx",
]

const FORBIDDEN = [
  "autoApprove",
  "auto_approve",
  "queueSequenceStepTransportJob",
  "runSequenceExecutionJob",
  "sendEmail",
  "sendSms",
]

for (const relativePath of REQUIRED_FILES) {
  assert.ok(fs.existsSync(path.join(ROOT, relativePath)), `missing: ${relativePath}`)
  console.log(`  ✓ file.${relativePath}`)
}

const routeSource = fs.readFileSync(path.join(ROOT, "lib/growth/apollo/apollo-operator-scale-route.ts"), "utf8")
for (const term of FORBIDDEN) {
  assert.equal(routeSource.includes(term), false, `forbidden in route: ${term}`)
}
const simSource = fs.readFileSync(
  path.join(ROOT, "lib/growth/apollo/apollo-operator-approval-simulation.ts"),
  "utf8",
)
assert.match(simSource, /simulation_only: true/)
console.log("  ✓ no auto-approval or send side effects")

const enrollmentItem = mapEnrollmentRowToQueueItem({
  id: "e1",
  status: "enrollment_approved",
  created_at: "2026-06-01T10:00:00.000Z",
  enrollment_approved_at: "2026-06-01T11:00:00.000Z",
  qualification_score: 85,
  metadata: {},
})
assert.equal(enrollmentItem.outcome, "approved")
assert.equal(enrollmentItem.confidence_score, 85)

const regenItem = mapSequenceExecutionRowToQueueItem({
  id: "s1",
  status: "draft_regenerated",
  created_at: "2026-06-05T10:00:00.000Z",
  draft_rejection_note: "CTA too weak for this account",
  operator_summary: { confidence_score: 92 },
  metadata: {},
})
assert.equal(regenItem.outcome, "regenerated")
assert.equal(classifyApolloDraftRegenerationReason(regenItem.regeneration_note), "cta_weak")
console.log("  ✓ queue mapping and regeneration classification")

const fixtures = [
  enrollmentItem,
  regenItem,
  mapEnrollmentRowToQueueItem({
    id: "e2",
    status: "pending_enrollment_approval",
    created_at: "2026-06-10T08:00:00.000Z",
    qualification_score: 96,
    metadata: {},
  }),
  mapEnrollmentRowToQueueItem({
    id: "e3",
    status: "enrollment_rejected",
    created_at: "2026-06-09T08:00:00.000Z",
    enrollment_approved_at: "2026-06-09T09:00:00.000Z",
    qualification_score: 94,
    enrollment_rejection_note: "not a fit",
    metadata: {},
  }),
]

const throughput = buildApolloOperatorThroughputReport(fixtures, "2026-06-11T12:00:00.000Z")
assert.ok(throughput.some((row) => row.stage === "enrollment"))
console.log("  ✓ throughput metrics")

const quality = buildApolloOperatorApprovalQualityReport(fixtures)
assert.ok(quality.find((row) => row.stage === "enrollment")!.approve_pct > 0)
console.log("  ✓ approval quality metrics")

const calibration = buildApolloOperatorConfidenceCalibrationReport(fixtures)
assert.ok(calibration[0]!.automation_accuracy_score >= 0)
console.log("  ✓ confidence calibration")

const bottlenecks = detectApolloOperatorBottlenecks(fixtures, {
  now: "2026-06-11T12:00:00.000Z",
})
assert.ok(bottlenecks.oldest_items.length >= 0)
console.log("  ✓ bottleneck detection")

const regeneration = buildApolloDraftRegenerationAnalytics(fixtures)
assert.ok(regeneration.some((row) => row.category === "cta_weak"))
console.log("  ✓ regeneration analytics")

const simulations = buildApolloOperatorApprovalSimulationReport(fixtures)
assert.equal(simulations.length, 3)
assert.equal(simulations.every((s) => s.simulation_only), true)
console.log("  ✓ approval simulation (simulation only)")

const readiness = buildApolloOperationalReadinessScore({
  throughput,
  approval_quality: quality,
  bottlenecks,
  meeting_conversion_pct: 12,
})
assert.ok(readiness.score >= 0 && readiness.score <= 100)
assert.ok(["experimental", "pilot_ready", "production_ready", "scale_ready"].includes(readiness.level))
console.log("  ✓ readiness scoring")

const forecasts = buildApolloOperatorScaleForecast({ throughput, bottlenecks })
assert.equal(forecasts.length, 4)
assert.ok(forecasts.some((row) => row.target_companies === 250))
console.log("  ✓ scale forecasting")

const report = buildApolloOperatorScaleReport(fixtures, { baseline_companies: 1 })
assert.equal(report.qa_marker, APOLLO_OPERATOR_SCALE_QA_MARKER)
assert.ok(report.verdict.capacity_at_25_companies >= 0)
assert.ok(report.recommendations.length > 0)
console.log("  ✓ full scale report")

console.log("\nApollo Operator Scale Optimization — Phase 13 certification PASSED")
