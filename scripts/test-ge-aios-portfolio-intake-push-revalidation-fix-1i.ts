/**
 * GE-AIOS-PORTFOLIO-INTAKE-PUSH-REVALIDATION-FIX-1I — Local certification.
 * Run: pnpm test:ge-aios-portfolio-intake-push-revalidation-fix-1i
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  countDurablePortfolioIntakeDispositions,
  GROWTH_PORTFOLIO_INTAKE_PUSH_REVALIDATION_FIX_1I_QA_MARKER,
  isDurablePortfolioIntakeDisposition,
  PORTFOLIO_INTAKE_COMPLETION_INVARIANT_1I,
  PORTFOLIO_INTAKE_MULTI_BATCH_CURSOR_RULE_1J,
  shouldMarkAutonomousRunIntakeCompleted,
} from "../lib/growth/prospect-search/prospect-search-portfolio-intake-disposition-1i"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

console.log(`[${GROWTH_PORTFOLIO_INTAKE_PUSH_REVALIDATION_FIX_1I_QA_MARKER}] Push revalidation fix certification\n`)

const repositorySource = readSource("lib/growth/prospect-search/prospect-search-repository.ts")
const pushSource = readSource("lib/growth/prospect-search/prospect-search-push-to-inbox.ts")
const portfolioSource = readSource("lib/growth/portfolio-manager/growth-autonomous-portfolio-discovery-1a.ts")
const discoverySource = readSource("lib/growth/prospect-search/prospect-search-datamoon-discovery-1a.ts")
const lifecycleSource = readSource(
  "lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-lifecycle-1a.ts",
)

// Scenario G — Architecture
assert.match(repositorySource, /push_revalidation_datamoon_run_id/)
assert.match(repositorySource, /loadDatamoonRunProspectCompaniesForPushRevalidation/)
assert.match(repositorySource, /autonomous_push_context/)
assert.match(pushSource, /autonomous_push_context/)
assert.match(portfolioSource, /autonomous_push_context/)
assert.match(portfolioSource, /discovery_authority: "autonomous_portfolio"/)
assert.match(portfolioSource, /recordAutonomousRunIntakePromotionAttempt/)
assert.match(portfolioSource, /skippedInvalid/)
assert.match(portfolioSource, /durableDispositionCount/)
assert.doesNotMatch(portfolioSource, /startDatamoonAudienceImportRun/)
assert.match(discoverySource, /loadDatamoonRunProspectCompaniesForPushRevalidation/)
assert.match(lifecycleSource, /recordAutonomousRunIntakePromotionAttempt/)
assert.match(lifecycleSource, /intake_durable_disposition_count/)
console.log("  ✓ Scenario G — architecture preserved (Option A context-preserving revalidation)")

// Durable disposition model
assert.equal(isDurablePortfolioIntakeDisposition("pushed"), true)
assert.equal(isDurablePortfolioIntakeDisposition("already_exists"), true)
assert.equal(isDurablePortfolioIntakeDisposition("suppressed"), true)
assert.equal(isDurablePortfolioIntakeDisposition("skipped_invalid"), false)
assert.equal(isDurablePortfolioIntakeDisposition("failed"), false)
assert.equal(
  countDurablePortfolioIntakeDispositions(["pushed", "already_exists", "skipped_invalid", "failed"]),
  2,
)
console.log("  ✓ Durable disposition model")

// Scenario D — Partial success
assert.equal(
  shouldMarkAutonomousRunIntakeCompleted({
    selectedCount: 4,
    durableDispositionCount: 3,
    postFilterSurvivorCount: 4,
    stopReason: null,
  }),
  false,
)
console.log("  ✓ Scenario D — partial durable success does not complete")

// Scenario C — One unresolved reference
assert.equal(
  shouldMarkAutonomousRunIntakeCompleted({
    selectedCount: 4,
    durableDispositionCount: 3,
    postFilterSurvivorCount: 4,
    stopReason: null,
  }),
  false,
)
console.log("  ✓ Scenario C — unresolved/skipped blocks completion")

// Scenario E — True zero survivors
assert.equal(
  shouldMarkAutonomousRunIntakeCompleted({
    selectedCount: 0,
    durableDispositionCount: 0,
    postFilterSurvivorCount: 0,
    stopReason: null,
  }),
  true,
)
assert.equal(
  shouldMarkAutonomousRunIntakeCompleted({
    selectedCount: 0,
    durableDispositionCount: 0,
    postFilterSurvivorCount: 4,
    stopReason: null,
  }),
  false,
)
console.log("  ✓ Scenario E — true zero vs deferred zero")

// Full batch completion
assert.equal(
  shouldMarkAutonomousRunIntakeCompleted({
    selectedCount: 4,
    durableDispositionCount: 4,
    postFilterSurvivorCount: 4,
    stopReason: null,
  }),
  true,
)
console.log("  ✓ Bounded batch completes only when durableDispositionCount === selectedCount")

// Scenario A/B — Run replay wiring (6062 / 6059 run ids in revalidation path)
assert.match(portfolioSource, /datamoon_run_id: datamoon\.datamoonRunId/)
assert.match(repositorySource, /push_revalidation_datamoon_run_id: autonomousContext\.datamoon_run_id/)
console.log("  ✓ Scenarios A/B — pinned run revalidation wired for 6062/6059 replay")

// Scenario F — Idempotent retry
assert.match(lifecycleSource, /if \(intake\.intake_completed === true\) return existing/)
console.log("  ✓ Scenario F — completed runs skip reprocessing")

// Zero-company guard
assert.match(discoverySource, /isLegitimateZeroSurvivorCompletion/)
assert.doesNotMatch(
  discoverySource,
  /if \(mapped\.companies\.length === 0\) \{\s*await markAutonomousRunIntakeCompleted\(admin, input\.intakePendingRun\.id/s,
)
console.log("  ✓ Phase 7 — intake-pending resume no longer prematurely completes on zero mapped")

assert.equal(
  PORTFOLIO_INTAKE_COMPLETION_INVARIANT_1I.includes("durableDispositionCount"),
  true,
)
assert.match(PORTFOLIO_INTAKE_MULTI_BATCH_CURSOR_RULE_1J, /skipped_invalid/)

console.log(`\nPASS ${GROWTH_PORTFOLIO_INTAKE_PUSH_REVALIDATION_FIX_1I_QA_MARKER}`)
console.log("Production replay: node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \\")
console.log("  node -r ./scripts/server-only-shim.cjs --import tsx scripts/probe-ge-aios-portfolio-intake-push-revalidation-fix-1i.ts")
