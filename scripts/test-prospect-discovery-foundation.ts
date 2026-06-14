/**
 * Phase GS-2A — Natural Language Prospect Discovery Foundation certification.
 *
 * Local: pnpm test:prospect-discovery-foundation
 * Production: pnpm test:prospect-discovery-foundation:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  PROSPECT_DISCOVERY_EXECUTE_CONFIRM,
  PROSPECT_DISCOVERY_QA_MARKER,
  buildProspectDiscoveryReadinessPayload,
  buildProspectSearchPlan,
  buildProspectSearchSuggestions,
  executeProspectDiscoveryFoundationCertification,
  normalizeProspectSearchIntent,
  parseProspectSearchIntent,
} from "../lib/growth/prospect-discovery"

function runLocalRegression(): void {
  console.log(`\n=== GS-2A local regression (${PROSPECT_DISCOVERY_QA_MARKER}) ===\n`)

  assert.equal(PROSPECT_DISCOVERY_QA_MARKER, "growth-prospect-discovery-gs2a-v1")
  console.log("  ✓ QA marker")

  const requiredFiles = [
    "lib/growth/prospect-discovery/prospect-search-intent-types.ts",
    "lib/growth/prospect-discovery/prospect-search-parser.ts",
    "lib/growth/prospect-discovery/prospect-search-plan-builder.ts",
    "lib/growth/prospect-discovery/prospect-search-normalizer.ts",
    "lib/growth/prospect-discovery/prospect-search-suggestions.ts",
    "lib/growth/prospect-discovery/prospect-search-certification.ts",
    "lib/growth/prospect-discovery/index.ts",
    "app/api/platform/growth/prospect-discovery/parse/route.ts",
    "app/api/platform/growth/prospect-discovery/plan/route.ts",
    "app/api/platform/growth/prospect-discovery/suggestions/route.ts",
    "components/growth/prospect-search/natural-language-discovery-panel.tsx",
  ]
  for (const relativePath of requiredFiles) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ GS-2A module files exist")

  const biomedical = parseProspectSearchIntent(
    "Find independent biomedical service companies in the southeast with 10-100 employees servicing hospitals.",
  )
  assert.ok(biomedical.industries.some((i) => /biomedical/i.test(i)))
  assert.ok(biomedical.locations.length >= 3)
  assert.ok(biomedical.employee_ranges.some((r) => r.includes("10-100")))
  assert.ok(biomedical.keywords.some((k) => /hospital/i.test(k)))
  console.log("  ✓ industry, location, employee extraction")

  const manufacturing = parseProspectSearchIntent(
    "Find manufacturing service companies that use Salesforce and recently raised funding.",
  )
  assert.ok(manufacturing.technologies.includes("Salesforce"))
  assert.ok(manufacturing.signals.includes("funding"))
  console.log("  ✓ technology and signal extraction")

  const vague = parseProspectSearchIntent("Find biomedical companies")
  assert.ok(vague.ambiguities.length > 0)
  console.log("  ✓ ambiguity detection")

  const suggestions = buildProspectSearchSuggestions({ query: "Biomedical companies" })
  assert.ok(suggestions.suggestions.length >= 3)
  console.log("  ✓ suggestions generation")

  const plan = buildProspectSearchPlan(biomedical)
  assert.ok(plan.discovery_providers.length >= 3)
  assert.equal(plan.search_execution_enabled, false)
  assert.equal(plan.requires_human_review, true)
  assert.ok(["low", "medium", "high"].includes(plan.estimated_result_quality))
  console.log("  ✓ search plan generation and quality estimation")

  const normalized = normalizeProspectSearchIntent(biomedical)
  assert.ok(normalized.prospect_search_filters.industry)
  assert.ok(normalized.prospect_search_filters.location)
  console.log("  ✓ normalizer maps GrowthProspectSearchFilters")

  const readiness = buildProspectDiscoveryReadinessPayload()
  assert.equal(readiness.execute_confirm, PROSPECT_DISCOVERY_EXECUTE_CONFIRM)
  assert.equal(readiness.search_execution_enabled, false)
  console.log("  ✓ readiness payload — no search execution")

  const parseRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/prospect-discovery/parse/route.ts"),
    "utf8",
  )
  assert.ok(!parseRoute.includes("runProspectSearch"))
  assert.ok(!parseRoute.includes("runRealWorldCompanyDiscovery"))
  assert.ok(parseRoute.includes("search_execution_enabled: false"))
  console.log("  ✓ parse API is planning-only")

  const planRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/prospect-discovery/plan/route.ts"),
    "utf8",
  )
  assert.ok(!planRoute.includes("enroll"))
  assert.ok(!planRoute.includes("executeOutreach"))
  console.log("  ✓ plan API is planning-only")

  console.log("\n  Local regression: PASS\n")
}

function runProductionCertification(): Record<string, unknown> {
  process.env.VERCEL_ENV = process.env.VERCEL_ENV ?? "production"
  return executeProspectDiscoveryFoundationCertification()
}

async function main(): Promise<void> {
  const productionOnly = process.argv.includes("--production")
  runLocalRegression()

  if (!productionOnly) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          local_only: true,
          qa_marker: PROSPECT_DISCOVERY_QA_MARKER,
          hint: "Run pnpm test:prospect-discovery-foundation:production for production certification",
        },
        null,
        2,
      ),
    )
    return
  }

  console.log(`\n=== GS-2A production certification (${PROSPECT_DISCOVERY_QA_MARKER}) ===\n`)
  const report = runProductionCertification()
  console.log(JSON.stringify(report, null, 2))
  if (!report.ok) process.exit(1)
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
  process.exit(1)
})
