/**
 * GE-AIOS-PORTFOLIO-INTAKE-ORPHAN-ROOT-CAUSE-1E — Local certification (diagnostic-only).
 * Run: pnpm test:ge-aios-portfolio-intake-orphan-root-cause-1e
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AIOS_PORTFOLIO_INTAKE_ORPHAN_ROOT_CAUSE_1E_QA_MARKER,
  PORTFOLIO_INTAKE_ARCHITECTURAL_INTENT_VERDICT,
  PORTFOLIO_INTAKE_IMPLEMENTED_STATE_MACHINE,
  PORTFOLIO_INTAKE_INTENDED_CALL_CHAIN,
  PORTFOLIO_INTAKE_MISSING_TRANSITION,
  PORTFOLIO_INTAKE_PROMOTION_OWNER,
  PORTFOLIO_INTAKE_RECOMMENDED_FIX,
} from "../lib/growth/training/portfolio-intake-orphan-root-cause-1e"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

console.log(`[${GROWTH_AIOS_PORTFOLIO_INTAKE_ORPHAN_ROOT_CAUSE_1E_QA_MARKER}] Orphan root cause certification\n`)

const discoverySource = readSource("lib/growth/portfolio-manager/growth-autonomous-portfolio-discovery-1a.ts")
const lifecycleSource = readSource(
  "lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-lifecycle-1a.ts",
)
const datamoonDiscoverySource = readSource("lib/growth/prospect-search/prospect-search-datamoon-discovery-1a.ts")
const replenishmentSource = readSource("lib/growth/portfolio-manager/growth-autonomous-portfolio-replenishment-1a.ts")
const cutoverTest = readSource("scripts/test-ge-aios-datamoon-autonomous-discovery-cutover-1a.ts")

assert.match(discoverySource, /executeBulkPushToLeadInbox/)
assert.match(discoverySource, /if \(datamoon\.datamoonJobActive\)/)
console.log("  ✓ Promotion owner is runAutonomousPortfolioDiscoveryBatch")

assert.match(lifecycleSource, /ACTIVE_STATUSES = new Set\(\["pending_build", "building"\]\)/)
assert.match(lifecycleSource, /findLatestAutonomousProspectSearchDatamoonRun/)
console.log("  ✓ Lifecycle ACTIVE_STATUSES excludes completed")

assert.match(datamoonDiscoverySource, /findActiveAutonomousProspectSearchDatamoonRun/)
assert.match(datamoonDiscoverySource, /resumeAutonomousProspectSearchDatamoonDiscoveryFromActiveRun/)
assert.match(datamoonDiscoverySource, /isDatamoonAutonomousDiscoveryRunCompleted/)
assert.doesNotMatch(
  datamoonDiscoverySource,
  /findLatestAutonomousProspectSearchDatamoonRun[\s\S]*executeBulkPushToLeadInbox/,
)
console.log("  ✓ Promotion path uses findActive only — not findLatest")

assert.match(replenishmentSource, /shouldResumeActiveDiscovery = duplicateDiscoveryPrevented/)
assert.match(replenishmentSource, /action: "resume_active"/)
console.log("  ✓ resume_active tied to discoveryAlreadyRunning (jobActive)")

assert.match(cutoverTest, /Phase 14C/)
assert.match(cutoverTest, /completed poll continues through intake/)
assert.match(cutoverTest, /Phase 14B/)
console.log("  ✓ Cutover tests document poll→intake intent")

assert.equal(PORTFOLIO_INTAKE_ARCHITECTURAL_INTENT_VERDICT.answer, "A")
assert.ok(PORTFOLIO_INTAKE_INTENDED_CALL_CHAIN.length >= 10)
assert.equal(PORTFOLIO_INTAKE_MISSING_TRANSITION.id, "completed_to_intake_pending")

const completedState = PORTFOLIO_INTAKE_IMPLEMENTED_STATE_MACHINE.find((row) => row.state === "completed")
assert.ok(completedState?.notes?.includes("findActive returns null"))
console.log("  ✓ Missing transition documented in state machine")

assert.equal(PORTFOLIO_INTAKE_PROMOTION_OWNER.pushFunction, "executeBulkPushToLeadInbox")
assert.ok(PORTFOLIO_INTAKE_RECOMMENDED_FIX.recommendedImplementationMilestone.includes("1F"))
console.log("  ✓ Recommended fix is intake_pending state — not blind ACTIVE_STATUSES expansion")

const evidenceSource = readSource("lib/growth/training/portfolio-intake-orphan-root-cause-evidence-1e.ts")
assert.match(evidenceSource, /loadPortfolioIntakeOrphanRuntimeTrace/)
assert.doesNotMatch(evidenceSource, /executeBulkPushToLeadInbox/)
console.log("  ✓ Evidence module is read-only diagnostic")

console.log(`\nPASS ${GROWTH_AIOS_PORTFOLIO_INTAKE_ORPHAN_ROOT_CAUSE_1E_QA_MARKER}`)
console.log("Run pnpm probe:ge-aios-portfolio-intake-orphan-root-cause-1e for production trace")
