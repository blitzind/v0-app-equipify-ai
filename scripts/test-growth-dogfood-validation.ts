/**
 * Regression checks for Growth Engine dogfood validation (slice 6.26A).
 * Run: pnpm test:growth-dogfood-validation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  computeOverallReadiness,
  confidenceForScorecard,
  GROWTH_DOGFOOD_SUBSYSTEMS,
  GROWTH_DOGFOOD_VALIDATION_QA_MARKER,
  isReadyForBlitzUsage,
  readinessPercentForStatus,
  buildGrowthDogfoodScorecard,
} from "../lib/growth/dogfood/dogfood-types"
import { GROWTH_NOTIFICATION_TYPES } from "../lib/growth/notifications/notification-types"

assert.equal(GROWTH_DOGFOOD_VALIDATION_QA_MARKER, "dogfood-validation-v1")
assert.equal(GROWTH_DOGFOOD_SUBSYSTEMS.length, 6)

const dogfoodTypesSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/dogfood/dogfood-types.ts"),
  "utf8",
)
assert.match(dogfoodTypesSource, /Native Gmail \/ Microsoft delivery/)
assert.doesNotMatch(dogfoodTypesSource, /Lemlist delivery/)

assert.equal(readinessPercentForStatus("validated"), 100)
assert.equal(readinessPercentForStatus("warning"), 75)
assert.equal(readinessPercentForStatus("testing"), 50)
assert.equal(readinessPercentForStatus("failed"), 0)
assert.equal(readinessPercentForStatus("not_tested"), 0)

assert.equal(
  confidenceForScorecard({ status: "validated", openIssueCount: 0, criticalIssueCount: 0 }),
  100,
)
assert.ok(
  confidenceForScorecard({ status: "validated", openIssueCount: 2, criticalIssueCount: 1 }) < 100,
)

const scorecard = buildGrowthDogfoodScorecard({
  latestRuns: new Map([
    [
      "import",
      { status: "validated", runAt: new Date().toISOString(), ownerUserId: null, confidence: 95 },
    ],
    [
      "outbound",
      { status: "warning", runAt: new Date().toISOString(), ownerUserId: null, confidence: 70 },
    ],
  ]),
  issueCounts: new Map([
    ["import", { open: 0, critical: 0 }],
    ["outbound", { open: 1, critical: 0 }],
    ["pipeline", { open: 1, critical: 1 }],
  ]),
})

assert.equal(scorecard.length, 6)
assert.equal(scorecard.find((e) => e.subsystem === "import")?.status, "validated")
assert.equal(scorecard.find((e) => e.subsystem === "pipeline")?.status, "not_tested")

const overall = computeOverallReadiness(scorecard)
assert.ok(overall >= 0 && overall <= 100)

assert.equal(
  isReadyForBlitzUsage({
    scorecard: GROWTH_DOGFOOD_SUBSYSTEMS.map((subsystem) => ({
      status: subsystem === "pipeline" ? "failed" : "validated",
    })),
    criticalBlockers: 0,
  }),
  false,
)

assert.equal(
  isReadyForBlitzUsage({
    scorecard: GROWTH_DOGFOOD_SUBSYSTEMS.map(() => ({ status: "validated" as const })),
    criticalBlockers: 0,
  }),
  true,
)

assert.equal(
  isReadyForBlitzUsage({
    scorecard: GROWTH_DOGFOOD_SUBSYSTEMS.map(() => ({ status: "validated" as const })),
    criticalBlockers: 1,
  }),
  false,
)

for (const type of ["dogfood_failure", "dogfood_blocker", "validation_complete"] as const) {
  assert.ok(GROWTH_NOTIFICATION_TYPES.includes(type))
}

const migrationSource = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270302120000_growth_engine_dogfood_validation.sql"),
  "utf8",
)
assert.match(migrationSource, /create table if not exists growth\.dogfood_validation_runs/)
assert.match(migrationSource, /create table if not exists growth\.dogfood_issues/)
assert.match(migrationSource, /idx_growth_dogfood_runs_subsystem_run/)

const mutateSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/dogfood/mutate-dogfood-validation.ts"),
  "utf8",
)
assert.match(mutateSource, /recordGrowthDogfoodValidationRun/)
assert.match(mutateSource, /dogfood_failure/)
assert.match(mutateSource, /dogfood_blocker/)
assert.doesNotMatch(mutateSource, /auto.?fix/i)

const uiSource = fs.readFileSync(path.join(process.cwd(), "components/growth/growth-dogfood-validation-dashboard.tsx"), "utf8")
assert.match(uiSource, /Human validation only/)
assert.match(uiSource, /Record run/)

const routeSource = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/dogfood/dashboard/route.ts"),
  "utf8",
)
assert.match(routeSource, /requireGrowthEnginePlatformAccess/)

console.log("growth-dogfood-validation: all checks passed")
