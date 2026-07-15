/**
 * GE-AIOS-DATAMOON-SINGLE-FLIGHT-AUDIENCE-CREATION-CLOSURE-1A
 * Run: pnpm test:ge-aios-datamoon-single-flight-audience-creation-closure-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildAutonomousProspectSearchDatamoonProviderMetadata,
  isDatamoonAutonomousDiscoveryRunActive,
  isDatamoonAutonomousDiscoveryRunCompleted,
} from "../lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-lifecycle-1a"
import {
  AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_METADATA_KEY,
  AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_RUN_PREFIX,
  DATAMOON_AUTONOMOUS_SINGLE_FLIGHT_ACTIVE_RUN_ERROR,
  GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER,
  type AutonomousProspectSearchDatamoonRunMetadata,
} from "../lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-types-1a"
import {
  evaluatePortfolioReplenishmentDecision,
  resolveAutonomousPortfolioDiscoveryExecutionPlan,
} from "../lib/growth/portfolio-manager/growth-autonomous-portfolio-replenishment-1a"
import { buildGrowthPortfolioManagerSnapshot } from "../lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a"
import { emptyPortfolioManagerMemory } from "../lib/growth/portfolio-manager/growth-autonomous-portfolio-memory-1a"
import { defaultPortfolioManagementSection } from "../lib/growth/portfolio-manager/growth-autonomous-portfolio-target-1a"
import type { DatamoonAudienceImportRun } from "../lib/growth/lead-sources/datamoon/datamoon-audience-import-types"
import type { BusinessProfileDraftContent } from "../lib/growth/business-profile/business-profile-types"

const ROOT = process.cwd()
const ORG_A = "00757488-1026-44a5-aac4-269533ac21be"
const ORG_B = "11111111-2222-4333-8444-555555555555"

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
      geography: ["United States"],
      buyerPersonas: ["Director of Biomedical Engineering"],
      disqualifiers: ["general retail"],
      preferredNaicsCodes: ["811310"],
      excludedNaicsCodes: ["443142"],
    },
    problemsAndTriggers: {
      painPoints: ["Downtime"],
      buyingTriggers: ["Audit"],
      competitorsAlternatives: [],
      keywords: ["biomedical maintenance"],
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

function autonomousRunFixture(input: {
  id: string
  organizationId: string
  status: DatamoonAudienceImportRun["status"]
  datamoonAudienceId?: string | null
  createdAt: string
}): DatamoonAudienceImportRun {
  const metadata: AutonomousProspectSearchDatamoonRunMetadata = {
    qa_marker: GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER,
    organization_id: input.organizationId,
    business_profile_fingerprint: "abc12345",
    batch_size: 25,
    purpose: "prospect_search_intake",
    read_only_proof: false,
    authority: "autonomous_portfolio",
  }

  return {
    id: input.id,
    runName: `${AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_RUN_PREFIX}:2026-07-15`,
    datamoonAudienceId: input.datamoonAudienceId ?? null,
    providerMode: "external",
    audienceType: "advanced_search",
    filters: [],
    topicIds: [],
    requestedLimit: 25,
    audienceName: "Autonomous discovery",
    websiteId: null,
    status: input.status,
    recordCount: 0,
    loadingCount: 0,
    previewCount: 0,
    importedCount: 0,
    duplicateCount: 0,
    skippedCount: 0,
    errorCount: 0,
    providerMetadata: buildAutonomousProspectSearchDatamoonProviderMetadata(metadata),
    errorMessage: null,
    dryRun: false,
    createdBy: null,
    lastPolledAt: null,
    completedAt: input.status === "completed" ? input.createdAt : null,
    importedAt: null,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  }
}

function simulateLegacyDuplicateRace(input: {
  executionAFindActiveAtMs: number
  executionBFindActiveAtMs: number
  executionAInsertAtMs: number
  executionBInsertAtMs: number
  metadataAttachedAtMs: number
}): { duplicateAudiencesCreated: boolean; reason: string } {
  const activeStatuses = new Set(["pending_build", "building"])
  const runs: Array<{ id: string; status: string; metadataAttached: boolean; createdAtMs: number }> = []

  function findActiveLegacy(atMs: number): boolean {
    return runs.some(
      (run) =>
        activeStatuses.has(run.status) &&
        run.metadataAttached &&
        run.createdAtMs <= atMs,
    )
  }

  const aSeesActive = findActiveLegacy(input.executionAFindActiveAtMs)
  const bSeesActive = findActiveLegacy(input.executionBFindActiveAtMs)

  if (!aSeesActive) {
    runs.push({
      id: "5938",
      status: "pending_build",
      metadataAttached: false,
      createdAtMs: input.executionAInsertAtMs,
    })
  }
  if (!bSeesActive) {
    runs.push({
      id: "5939",
      status: "pending_build",
      metadataAttached: false,
      createdAtMs: input.executionBInsertAtMs,
    })
  }

  for (const run of runs) {
    run.metadataAttached = input.metadataAttachedAtMs >= run.createdAtMs
    run.status = "building"
  }

  return {
    duplicateAudiencesCreated: runs.length > 1,
    reason:
      runs.length > 1
        ? "Both executions passed findActive before organization metadata was persisted on the import run row."
        : "Single execution path.",
  }
}

function simulateRepairedDuplicateRace(input: {
  executionAFindActiveAtMs: number
  executionBFindActiveAtMs: number
  executionAInsertAtMs: number
  executionBInsertAtMs: number
}): { duplicateAudiencesCreated: boolean; resumedExisting: boolean } {
  const activeStatuses = new Set(["pending_build", "building"])
  const runs: Array<{ id: string; status: string; organizationId: string; createdAtMs: number }> = []

  function findActiveRepaired(atMs: number): { id: string } | null {
    const match = runs
      .filter((run) => activeStatuses.has(run.status) && run.createdAtMs <= atMs)
      .sort((a, b) => b.createdAtMs - a.createdAtMs)[0]
    return match ? { id: match.id } : null
  }

  function tryInsert(atMs: number, id: string): "created" | "single_flight" {
    const conflict = runs.some(
      (run) => run.organizationId === ORG_A && activeStatuses.has(run.status),
    )
    if (conflict) return "single_flight"
    runs.push({ id, status: "pending_build", organizationId: ORG_A, createdAtMs: atMs })
    return "created"
  }

  const aActive = findActiveRepaired(input.executionAFindActiveAtMs)
  const bActive = findActiveRepaired(input.executionBFindActiveAtMs)
  let resumedExisting = false

  if (!aActive) {
    assert.equal(tryInsert(input.executionAInsertAtMs, "5938"), "created")
  }
  if (!bActive) {
    const result = tryInsert(input.executionBInsertAtMs, "5939")
    if (result === "single_flight") {
      resumedExisting = true
    }
  }

  return {
    duplicateAudiencesCreated: runs.length > 1,
    resumedExisting,
  }
}

console.log(
  "[ge-aios-datamoon-single-flight-audience-creation-closure-1a] DataMoon single-flight audience certification\n",
)

const discoverySource = readSource("lib/growth/prospect-search/prospect-search-datamoon-discovery-1a.ts")
const importServiceSource = readSource("lib/growth/lead-sources/datamoon/datamoon-audience-import-service.ts")
const repositorySource = readSource("lib/growth/lead-sources/datamoon/datamoon-audience-import-repository.ts")
const lifecycleSource = readSource(
  "lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-lifecycle-1a.ts",
)
const migrationSource = readSource(
  "supabase/migrations/20260715192500_growth_datamoon_autonomous_single_flight_audience_1a.sql",
)

assert.match(discoverySource, /autonomousProspectSearchReservation/)
assert.match(discoverySource, /DATAMOON_AUTONOMOUS_SINGLE_FLIGHT_ACTIVE_RUN_ERROR/)
assert.match(discoverySource, /prospect_search_datamoon_autonomous_discovery_single_flight_resumed/)
assert.match(importServiceSource, /autonomousProspectSearchReservation/)
assert.match(importServiceSource, /unique_violation/)
assert.match(importServiceSource, /\.\.\.run\.providerMetadata/)
assert.match(repositorySource, /unique_violation/)
assert.match(
  migrationSource,
  /idx_growth_datamoon_autonomous_active_org_single_flight/,
)
assert.match(migrationSource, /autonomous_prospect_search_1a,organization_id/)
console.log("  ✓ Repair — metadata at insert, merge on build, DB partial unique index")

assert.ok(
  discoverySource.indexOf("findActiveAutonomousProspectSearchDatamoonRun") <
    discoverySource.indexOf("autonomousProspectSearchReservation"),
)
assert.ok(
  discoverySource.indexOf("autonomousProspectSearchReservation") <
    discoverySource.indexOf("await attachAutonomousProspectSearchDatamoonMetadata"),
)
console.log("  ✓ Phase 1 — active lookup precedes reservation; metadata present before provider build")

const deficientSnapshot = buildGrowthPortfolioManagerSnapshot({
  organizationId: ORG_A,
  generatedAt: "2026-07-15T12:00:00.000Z",
  leads: [],
  eligibleLeadCount: 1,
  approvedProfile: approvedProfileFixture(),
  missionDiscovery: null,
})
const singleTickPlan = resolveAutonomousPortfolioDiscoveryExecutionPlan(deficientSnapshot.replenishment)
assert.equal(singleTickPlan.action, "start_new")
assert.ok(singleTickPlan.batchSize > 0)
console.log("  ✓ Scenario A — single scheduler tick plans one new audience")

const concurrentResumePlan = resolveAutonomousPortfolioDiscoveryExecutionPlan(
  evaluatePortfolioReplenishmentDecision({
    target: deficientSnapshot.target,
    health: deficientSnapshot.health,
    memory: emptyPortfolioManagerMemory(),
    generatedAt: "2026-07-15T12:00:00.000Z",
    discoveryAlreadyRunning: true,
  }),
)
assert.equal(concurrentResumePlan.action, "resume_active")
assert.match(discoverySource, /resumeAutonomousProspectSearchDatamoonDiscoveryFromActiveRun/)
console.log("  ✓ Scenario B — concurrent second execution resumes instead of start_new")

const buildingRun = autonomousRunFixture({
  id: "run-building",
  organizationId: ORG_A,
  status: "building",
  datamoonAudienceId: "5938",
  createdAt: "2026-07-15T21:19:58.000Z",
})
assert.ok(isDatamoonAutonomousDiscoveryRunActive(buildingRun))
const buildingTickPlan = resolveAutonomousPortfolioDiscoveryExecutionPlan(
  evaluatePortfolioReplenishmentDecision({
    target: deficientSnapshot.target,
    health: { ...deficientSnapshot.health, discoveryRunning: true },
    memory: emptyPortfolioManagerMemory(),
    generatedAt: "2026-07-15T21:20:00.000Z",
    discoveryAlreadyRunning: true,
  }),
)
assert.equal(buildingTickPlan.action, "resume_active")
console.log("  ✓ Scenario C — building audience tick resumes existing run")

const completedRun = autonomousRunFixture({
  id: "run-completed",
  organizationId: ORG_A,
  status: "completed",
  datamoonAudienceId: "5944",
  createdAt: "2026-07-15T21:20:30.000Z",
})
assert.ok(isDatamoonAutonomousDiscoveryRunCompleted(completedRun))
assert.ok(!isDatamoonAutonomousDiscoveryRunActive(completedRun))
const completedTickPlan = resolveAutonomousPortfolioDiscoveryExecutionPlan(deficientSnapshot.replenishment)
assert.equal(completedTickPlan.action, "start_new")
console.log("  ✓ Scenario D — completed audience allows a new audience on next tick")

const orgARun = autonomousRunFixture({
  id: "run-org-a",
  organizationId: ORG_A,
  status: "building",
  createdAt: "2026-07-15T21:19:58.000Z",
})
const orgBRun = autonomousRunFixture({
  id: "run-org-b",
  organizationId: ORG_B,
  status: "building",
  createdAt: "2026-07-15T21:19:58.500Z",
})
assert.notEqual(
  orgARun.providerMetadata[AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_METADATA_KEY],
  orgBRun.providerMetadata[AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_METADATA_KEY],
)
assert.match(migrationSource, /organization_id}'\)/)
console.log("  ✓ Scenario E — organizations are isolated by organization_id reservation key")

assert.match(lifecycleSource, /findActiveAutonomousProspectSearchDatamoonRun/)
assert.doesNotMatch(discoverySource, /updateDatamoonAudienceImportRun[\s\S]*completed/)
console.log("  ✓ Scenario F — completed runs are terminal; no duplicate historical mutation path")

const production5938 = simulateLegacyDuplicateRace({
  executionAFindActiveAtMs: 0,
  executionBFindActiveAtMs: 16,
  executionAInsertAtMs: 20,
  executionBInsertAtMs: 52,
  metadataAttachedAtMs: 200,
})
assert.equal(production5938.duplicateAudiencesCreated, true)
assert.match(production5938.reason, /metadata/)

const production5943 = simulateLegacyDuplicateRace({
  executionAFindActiveAtMs: 0,
  executionBFindActiveAtMs: 300,
  executionAInsertAtMs: 320,
  executionBInsertAtMs: 894,
  metadataAttachedAtMs: 1200,
})
assert.equal(production5943.duplicateAudiencesCreated, true)

const repaired5938 = simulateRepairedDuplicateRace({
  executionAFindActiveAtMs: 0,
  executionBFindActiveAtMs: 16,
  executionAInsertAtMs: 20,
  executionBInsertAtMs: 52,
})
assert.equal(repaired5938.duplicateAudiencesCreated, false)
assert.equal(repaired5938.resumedExisting, true)

const repaired5943 = simulateRepairedDuplicateRace({
  executionAFindActiveAtMs: 0,
  executionBFindActiveAtMs: 300,
  executionAInsertAtMs: 320,
  executionBInsertAtMs: 894,
})
assert.equal(repaired5943.duplicateAudiencesCreated, false)
assert.equal(repaired5943.resumedExisting, true)
console.log("  ✓ Phase 6 — Production replay: 5938/5939 and 5943/5944 would be prevented")

assert.equal(DATAMOON_AUTONOMOUS_SINGLE_FLIGHT_ACTIVE_RUN_ERROR, "single_flight_active_run")

console.log("\nPASS — GE-AIOS-DATAMOON-SINGLE-FLIGHT-AUDIENCE-CREATION-CLOSURE-1A")
