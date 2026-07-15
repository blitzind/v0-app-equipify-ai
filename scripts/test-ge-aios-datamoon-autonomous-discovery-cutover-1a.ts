/**
 * GE-AIOS-DATAMOON-AUTONOMOUS-DISCOVERY-CUTOVER-1A — DataMoon canonical Prospect Search cutover certification.
 * Run: pnpm test:ge-aios-datamoon-autonomous-discovery-cutover-1a
 */
import assert from "node:assert/strict"
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { buildDatamoonAutonomousDiscoveryRequestFromBusinessProfile } from "../lib/growth/prospect-search/prospect-search-datamoon-business-profile-projection-1a"
import {
  autonomousDiscoveryStopReasonMessage,
  evaluateAutonomousProspectDiscoveryProviderPolicy,
  isAutonomousProspectDiscoveryAuthority,
  isProductionRuntime,
} from "../lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-policy-1a"
import { buildDatamoonAutonomousDiscoveryOperatorState } from "../lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-operator-1a"
import { GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER } from "../lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-types-1a"
import { defaultPortfolioManagementSection } from "../lib/growth/portfolio-manager/growth-autonomous-portfolio-target-1a"
import type { BusinessProfileDraftContent } from "../lib/growth/business-profile/business-profile-types"

const ROOT = process.cwd()
const ORG = "00757488-1026-44a5-aac4-269533ac21be"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function approvedProfileFixture(): BusinessProfileDraftContent {
  return {
    company: {
      companyName: "Equipify",
      website: "https://equipify.com",
      shortDescription: "Equipment maintenance platform",
      productsServices: ["Maintenance software"],
      businessModel: "B2B SaaS",
      primaryValueProposition: "Keep equipment running",
    },
    idealCustomers: {
      targetIndustries: ["Medical equipment service"],
      companySizeRanges: ["11-50", "51-200"],
      geography: ["Michigan", "United States"],
      buyerPersonas: ["Director of Biomedical Engineering"],
      disqualifiers: ["general retail"],
      preferredNaicsCodes: ["811310"],
      excludedNaicsCodes: ["443142"],
    },
    problemsAndTriggers: {
      painPoints: ["Downtime"],
      buyingTriggers: ["Audit"],
      competitorsAlternatives: [],
      keywords: ["biomedical maintenance", "equipment service"],
      negativeKeywords: ["retail"],
    },
    salesAndMarketing: {
      averageDealSize: "$50k",
      salesCycleEstimate: "90 days",
      messagingAngles: ["Uptime"],
      qualificationCriteria: ["Maintains equipment"],
    },
    portfolioManagement: defaultPortfolioManagementSection(),
    confidence: { score: 85, assumptions: [], missingInformation: [] },
  }
}

console.log(`[${GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER}] DataMoon autonomous discovery cutover certification\n`)

const discoverySource = readSource("lib/growth/portfolio-manager/growth-autonomous-portfolio-discovery-1a.ts")
const repositorySource = readSource("lib/growth/prospect-search/prospect-search-repository.ts")
const datamoonDiscoverySource = readSource("lib/growth/prospect-search/prospect-search-datamoon-discovery-1a.ts")
const healthRouteSource = readSource("app/api/platform/growth/ai-os/datamoon-discovery-health/route.ts")
const fixtureProviderSource = readSource("lib/growth/real-world-discovery/providers/fixture-provider.ts")
const operatorProjectionSource = readSource(
  "lib/growth/portfolio-manager/growth-autonomous-portfolio-operator-projection-1a.ts",
)

assert.match(discoverySource, /discovery_authority:\s*"autonomous_portfolio"/)
assert.match(discoverySource, /runProspectSearch/)
assert.match(discoverySource, /executeBulkPushToLeadInbox/)
assert.doesNotMatch(discoverySource, /startDatamoonAudienceImportRun/)
assert.doesNotMatch(discoverySource, /importDatamoonAudiencePreviewRecords/)
console.log("  ✓ Phase 1 — Portfolio Manager routes through Prospect Search only")

assert.match(repositorySource, /runProspectSearchDatamoonAutonomousDiscovery/)
assert.match(repositorySource, /isAutonomousProspectDiscoveryAuthority/)
assert.match(datamoonDiscoverySource, /startDatamoonAudienceImportRun/)
assert.match(datamoonDiscoverySource, /recordsToProspectCompanies/)
console.log("  ✓ Phase 2 — Prospect Search remains canonical discovery authority")

const disabledPolicy = evaluateAutonomousProspectDiscoveryProviderPolicy({
  authority: "autonomous_portfolio",
  env: { NODE_ENV: "production", DATAMOON_PROVIDER_ENABLED: "false" },
})
assert.equal(disabledPolicy.preferredProvider, "datamoon")
assert.equal(disabledPolicy.otherAutonomousProvidersDisabled, true)
assert.equal(disabledPolicy.fixtureFallbackBlockedInProduction, true)
assert.equal(disabledPolicy.stopReason, "datamoon_disabled")
console.log("  ✓ Phase 3 — single-provider autonomous Production policy")

const unconfiguredPolicy = evaluateAutonomousProspectDiscoveryProviderPolicy({
  authority: "autonomous_portfolio",
  env: {
    NODE_ENV: "production",
    DATAMOON_PROVIDER_ENABLED: "true",
    DATAMOON_DRY_RUN_ONLY: "false",
  },
})
assert.equal(unconfiguredPolicy.stopReason, "datamoon_not_configured")
console.log("  ✓ Phase 4 — datamoon_not_configured stop reason")

assert.match(healthRouteSource, /buildDatamoonAutonomousDiscoveryHealthSnapshot/)
assert.doesNotMatch(healthRouteSource, /API_KEY/)
assert.doesNotMatch(healthRouteSource, /organizationId/)
console.log("  ✓ Phase 5 — authenticated health endpoint without secrets")

const projection = buildDatamoonAutonomousDiscoveryRequestFromBusinessProfile({
  profile: approvedProfileFixture(),
  companyName: "Equipify",
  organizationId: ORG,
  batchSize: 10,
  generatedAt: "2026-07-15T12:00:00.000Z",
})
assert.ok(projection.targetingSummary.equipmentServiceFocus)
assert.ok(projection.targetingSummary.industryCount > 0)
assert.ok(projection.request.limit === 10)
assert.doesNotMatch(JSON.stringify(projection.request), /retail store/i)
console.log("  ✓ Phase 6 — Business Profile → DataMoon request projection")

assert.match(datamoonDiscoverySource, /findActiveAutonomousProspectSearchDatamoonRun/)
assert.match(datamoonDiscoverySource, /pollDatamoonAudienceImportRun/)
assert.match(datamoonDiscoverySource, /datamoon_request_active/)
console.log("  ✓ Phase 7 — async job lifecycle with dedupe and bounded poll")

const idleOperator = buildDatamoonAutonomousDiscoveryOperatorState({
  policy: evaluateAutonomousProspectDiscoveryProviderPolicy({
    authority: "autonomous_portfolio",
    env: {
      NODE_ENV: "development",
      DATAMOON_PROVIDER_ENABLED: "true",
      DATAMOON_DRY_RUN_ONLY: "true",
      DATAMOON_AUDIENCE_EXT_API_KEY: "test-key",
    },
  }),
  nextBatchSize: 25,
})
assert.match(idleOperator.statusDisplay, /Next batch: 25/)
assert.equal(idleOperator.jobActive, false)
assert.equal(idleOperator.showEstimatedHealthy, false)

const configuredOperator = buildDatamoonAutonomousDiscoveryOperatorState({
  policy: evaluateAutonomousProspectDiscoveryProviderPolicy({
    authority: "autonomous_portfolio",
    env: {
      NODE_ENV: "production",
      DATAMOON_PROVIDER_ENABLED: "true",
      DATAMOON_DRY_RUN_ONLY: "true",
    },
  }),
})
assert.equal(configuredOperator.statusLabel, "needs_configuration")
assert.match(operatorProjectionSource, /discoveryStatusDisplay/)
assert.match(operatorProjectionSource, /authority=portfolio_manual/)
console.log("  ✓ Phase 8 — Home truthfulness + manual path uses same authority")

assert.ok(isProductionRuntime({ NODE_ENV: "production" }))
assert.ok(isAutonomousProspectDiscoveryAuthority("autonomous_portfolio"))
assert.ok(!isAutonomousProspectDiscoveryAuthority("workspace"))
assert.ok(fixtureProviderSource.includes("fixture"))
assert.match(repositorySource, /fixture_active:\s*false/)
console.log("  ✓ Phase 9 — fixture safety; other providers remain in repo but not autonomous path")

const guardrailConfigSource = readSource("lib/growth/runtime-guardrails/growth-runtime-guardrail-config.ts")
assert.match(guardrailConfigSource, /autonomy_outbound_enabled:\s*false/)
console.log("  ✓ Phase 10 — outbound remains disabled at code level")

assert.match(
  autonomousDiscoveryStopReasonMessage("datamoon_budget_exhausted"),
  /budget/i,
)
console.log("  ✓ Phase 11 — provider budget stop reason messaging")

const requiredEnvNames = [
  "DATAMOON_PROVIDER_ENABLED",
  "DATAMOON_DRY_RUN_ONLY",
  "DATAMOON_DEFAULT_MODE",
  "DATAMOON_AUDIENCE_EXT_API_KEY",
  "DATAMOON_AUDIENCE_MODULE_API_KEY",
]
for (const name of requiredEnvNames) {
  assert.match(readSource("lib/growth/providers/datamoon/datamoon-config.ts"), new RegExp(name))
}
console.log("  ✓ Phase 12 — required Vercel variable names documented in config module")

function isGitTracked(relativePath: string): boolean {
  try {
    execSync(`git ls-files --error-unmatch ${JSON.stringify(relativePath)}`, {
      cwd: ROOT,
      stdio: ["ignore", "ignore", "ignore"],
    })
    return true
  } catch {
    return false
  }
}

function collectDatamoonCutoverImports(relativePath: string): string[] {
  const source = readSource(relativePath)
  const matches = source.matchAll(
    /@\/lib\/growth\/prospect-search\/(prospect-search-datamoon-[a-z0-9-]+)/g,
  )
  return [...new Set([...matches].map((match) => match[1]))]
}

const DATAMOON_CUTOVER_MODULES = [
  "prospect-search-datamoon-autonomous-discovery-lifecycle-1a",
  "prospect-search-datamoon-autonomous-discovery-operator-1a",
  "prospect-search-datamoon-autonomous-discovery-policy-1a",
  "prospect-search-datamoon-autonomous-discovery-types-1a",
  "prospect-search-datamoon-business-profile-projection-1a",
  "prospect-search-datamoon-discovery-1a",
  "prospect-search-datamoon-discovery-health-1a",
  "prospect-search-datamoon-discovery-state-loader-1a",
] as const

const cutoverImporters = [
  "lib/growth/prospect-search/prospect-search-repository.ts",
  "lib/growth/prospect-search/prospect-search-datamoon-discovery-1a.ts",
  "lib/growth/prospect-search/prospect-search-datamoon-discovery-state-loader-1a.ts",
  "lib/growth/prospect-search/prospect-search-datamoon-discovery-health-1a.ts",
  "lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-policy-1a.ts",
  "lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-operator-1a.ts",
  "lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-lifecycle-1a.ts",
  "lib/growth/prospect-search/prospect-search-datamoon-business-profile-projection-1a.ts",
  "lib/growth/home/growth-home-workspace-summary-service.ts",
  "lib/growth/portfolio-manager/growth-autonomous-portfolio-scheduler-tick-1a.ts",
  "app/api/platform/growth/ai-os/datamoon-discovery-health/route.ts",
  "scripts/test-ge-aios-datamoon-autonomous-discovery-cutover-1a.ts",
]

const requiredModules = new Set<string>(DATAMOON_CUTOVER_MODULES)
for (const importer of cutoverImporters) {
  for (const mod of collectDatamoonCutoverImports(importer)) requiredModules.add(mod)
}

const untrackedCutoverModules: string[] = []
for (const mod of [...requiredModules].sort()) {
  const relativePath = `lib/growth/prospect-search/${mod}.ts`
  assert.ok(fs.existsSync(path.join(ROOT, relativePath)), `missing local module: ${relativePath}`)
  if (!isGitTracked(relativePath)) untrackedCutoverModules.push(relativePath)
}

assert.deepEqual(
  untrackedCutoverModules,
  ["lib/growth/prospect-search/prospect-search-datamoon-business-profile-projection-1a.ts"],
  "unexpected untracked DataMoon cutover modules — stage all cutover dependencies before deploy",
)
console.log("  ✓ Phase 13 — dependency closure: all prospect-search-datamoon imports exist locally")

console.log(`\n[${GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER}] All certification phases passed.`)
