/**
 * GE-AIOS-PORTFOLIO-INTAKE-PENDING-STATE-1F — Local certification.
 * Run: pnpm test:ge-aios-portfolio-intake-pending-state-1f
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AIOS_PORTFOLIO_INTAKE_PENDING_STATE_1F_QA_MARKER,
  PORTFOLIO_INTAKE_IDEMPOTENCY_DESIGN,
  PORTFOLIO_INTAKE_LIFECYCLE_OWNERSHIP,
  PORTFOLIO_INTAKE_STATE_TRANSITIONS,
} from "../lib/growth/training/portfolio-intake-pending-state-1f"
import {
  isRunEligibleForIntakePromotion,
  PORTFOLIO_INTAKE_IDEMPOTENCY_DESIGN as INTAKE_IDEMPOTENCY,
} from "../lib/growth/prospect-search/prospect-search-datamoon-intake-lifecycle-1f"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

console.log(`[${GROWTH_AIOS_PORTFOLIO_INTAKE_PENDING_STATE_1F_QA_MARKER}] Intake pending state certification\n`)

const lifecycleSource = readSource(
  "lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-lifecycle-1a.ts",
)
const discoverySource = readSource("lib/growth/prospect-search/prospect-search-datamoon-discovery-1a.ts")
const portfolioSource = readSource("lib/growth/portfolio-manager/growth-autonomous-portfolio-discovery-1a.ts")

assert.match(lifecycleSource, /ACTIVE_STATUSES = new Set\(\["pending_build", "building"\]\)/)
assert.match(lifecycleSource, /markAutonomousRunIntakePending/)
assert.match(lifecycleSource, /markAutonomousRunIntakeCompleted/)
assert.match(lifecycleSource, /findLatestIntakePendingAutonomousProspectSearchDatamoonRun/)
console.log("  ✓ Durable intake metadata helpers on lifecycle module")

assert.match(discoverySource, /findLatestIntakePendingAutonomousProspectSearchDatamoonRun/)
assert.match(discoverySource, /resumeAutonomousProspectSearchDatamoonDiscoveryFromIntakePendingRun/)
assert.match(discoverySource, /markAutonomousRunIntakePending/)
const intakePendingBeforeStart = discoverySource.indexOf("findLatestIntakePendingAutonomousProspectSearchDatamoonRun")
const startNew = discoverySource.indexOf("startDatamoonAudienceImportRun")
assert.ok(intakePendingBeforeStart > 0 && intakePendingBeforeStart < startNew)
console.log("  ✓ Intake-pending lookup runs before startDatamoonAudienceImportRun")

assert.match(portfolioSource, /executeBulkPushToLeadInbox/)
assert.match(portfolioSource, /markAutonomousRunIntakePromotionStarted/)
assert.match(portfolioSource, /markAutonomousRunIntakeCompleted/)
assert.match(portfolioSource, /resume_intake_pending/)
assert.doesNotMatch(portfolioSource, /startDatamoonAudienceImportRun/)
console.log("  ✓ Portfolio Manager owns promotion — not Prospect Search provider start")

assert.equal(PORTFOLIO_INTAKE_LIFECYCLE_OWNERSHIP.pushFunction, "executeBulkPushToLeadInbox")
assert.ok(PORTFOLIO_INTAKE_STATE_TRANSITIONS.some((row) => row.to === "intake_pending"))
assert.ok(PORTFOLIO_INTAKE_STATE_TRANSITIONS.some((row) => row.to === "intake_completed"))
console.log("  ✓ State transition table includes intake_pending and intake_completed")

assert.equal(PORTFOLIO_INTAKE_IDEMPOTENCY_DESIGN.survivorPromotion, INTAKE_IDEMPOTENCY.survivorPromotion)
assert.ok(PORTFOLIO_INTAKE_IDEMPOTENCY_DESIGN.runTerminalization.includes("intake_completed"))
console.log("  ✓ Idempotency design documented")

assert.equal(
  isRunEligibleForIntakePromotion({
    runStatus: "completed",
    intake: { intake_completed: true },
  }),
  false,
)
assert.equal(
  isRunEligibleForIntakePromotion({
    runStatus: "completed",
    intake: {},
  }),
  true,
)
assert.equal(
  isRunEligibleForIntakePromotion({
    runStatus: "building",
    intake: {},
  }),
  false,
)
console.log("  ✓ Legacy completed runs eligible until intake_completed")

const auditSource = readSource("lib/growth/training/portfolio-intake-production-audit-1d.ts")
assert.match(auditSource, /waiting_for_scheduler/)
assert.match(auditSource, /INTAKE_PENDING_RESUME_TRACE/)
console.log("  ✓ 1D audit reclassifies eligible orphans as waiting_for_scheduler")

console.log(`\nPASS ${GROWTH_AIOS_PORTFOLIO_INTAKE_PENDING_STATE_1F_QA_MARKER}`)
console.log("Run pnpm probe:ge-aios-portfolio-intake-pending-state-1f for production evidence")
