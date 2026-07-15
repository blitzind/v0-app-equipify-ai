/**
 * GE-AIOS-AUTONOMOUS-PORTFOLIO-MANAGER-1A — Autonomous portfolio manager certification.
 * Run: pnpm test:ge-aios-autonomous-portfolio-manager-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildGrowthPortfolioManagerSnapshot,
  GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER,
} from "../lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a"
import {
  DEFAULT_PORTFOLIO_MAXIMUM_DAILY_DISCOVERY,
  DEFAULT_PORTFOLIO_MAXIMUM_CONCURRENT_RESEARCH,
  DEFAULT_PORTFOLIO_MAXIMUM_QUEUED_ADMISSIONS,
  DEFAULT_PORTFOLIO_MINIMUM_HEALTHY_COMPANIES,
  DEFAULT_PORTFOLIO_REPLENISH_BATCH_SIZE,
  DEFAULT_PORTFOLIO_TARGET_ACTIVE_COMPANIES,
} from "../lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types"
import {
  buildProspectSearchFiltersFromBusinessProfile,
  buildProspectSearchQueryFromBusinessProfile,
} from "../lib/growth/portfolio-manager/growth-autonomous-portfolio-discovery-1a"
import {
  buildManualProspectSearchDiscoverHref,
  GROWTH_PORTFOLIO_MANAGER_MANUAL_FIND_OPTIONS,
} from "../lib/growth/portfolio-manager/growth-autonomous-portfolio-operator-projection-1a"
import {
  emptyPortfolioManagerMemory,
  recordPortfolioDiscoveryMemory,
} from "../lib/growth/portfolio-manager/growth-autonomous-portfolio-memory-1a"
import { evaluatePortfolioReplenishmentDecision } from "../lib/growth/portfolio-manager/growth-autonomous-portfolio-replenishment-1a"
import {
  defaultPortfolioManagementSection,
  resolvePortfolioTargetFromBusinessProfile,
} from "../lib/growth/portfolio-manager/growth-autonomous-portfolio-target-1a"
import type { BusinessProfileDraftContent } from "../lib/growth/business-profile/business-profile-types"
import type { GrowthLead } from "../lib/growth/types"

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

function leadFixture(overrides: Partial<GrowthLead> & Pick<GrowthLead, "id">): GrowthLead {
  return {
    organizationId: ORG,
    companyName: "Fixture Co",
    contactName: "Contact",
    website: "https://fixture.example",
    status: "active",
    researchPriority: "normal",
    workflowHealth: "healthy",
    metadata: { admission_state: "accepted" },
    engagementScore: 50,
    contactTemperature: "warm",
    archivedAt: null,
    ...overrides,
  } as GrowthLead
}

console.log(`[${GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER}] Autonomous portfolio manager certification\n`)

const targetSource = readSource("lib/growth/portfolio-manager/growth-autonomous-portfolio-target-1a.ts")
const healthSource = readSource("lib/growth/portfolio-manager/growth-autonomous-portfolio-health-1a.ts")
const discoverySource = readSource("lib/growth/portfolio-manager/growth-autonomous-portfolio-discovery-1a.ts")
const schedulerSource = readSource("lib/growth/objectives/growth-objective-runtime-scheduler.ts")
const snapshotSource = readSource("lib/growth/specialists/execution/growth-autonomous-portfolio-work-snapshot.ts")
const profileTypes = readSource("lib/growth/business-profile/business-profile-types.ts")
const outboundSource = readSource("lib/growth/outbound/process-event.ts")

assert.match(profileTypes, /portfolioManagement\?: BusinessProfilePortfolioManagementSection/)
assert.match(targetSource, /resolvePortfolioTargetFromBusinessProfile/)
assert.match(healthSource, /buildPortfolioHealthReadModel/)
assert.match(discoverySource, /runProspectSearch/)
assert.match(discoverySource, /executeBulkPushToLeadInbox/)
assert.match(discoverySource, /discover_external/)
assert.match(schedulerSource, /tickAutonomousPortfolioManagerForScheduler/)
assert.match(snapshotSource, /buildGrowthPortfolioManagerSnapshot/)
assert.match(snapshotSource, /loadGrowthHomeMissionDiscoverySnapshot/)
assert.doesNotMatch(discoverySource, /startDatamoonAudienceImportRun/)
console.log("  ✓ Phase 1 — portfolio target owned by Business Profile; Prospect Search reused")

const defaults = resolvePortfolioTargetFromBusinessProfile(null)
assert.equal(defaults.targetActiveCompanies, DEFAULT_PORTFOLIO_TARGET_ACTIVE_COMPANIES)
assert.equal(defaults.minimumHealthyCompanies, DEFAULT_PORTFOLIO_MINIMUM_HEALTHY_COMPANIES)
assert.equal(defaults.replenishBatchSize, DEFAULT_PORTFOLIO_REPLENISH_BATCH_SIZE)
assert.equal(defaults.maximumDailyDiscovery, DEFAULT_PORTFOLIO_MAXIMUM_DAILY_DISCOVERY)
assert.equal(defaults.source, "defaults")

const configured = resolvePortfolioTargetFromBusinessProfile({
  portfolioManagement: {
    ...defaultPortfolioManagementSection(),
    targetActiveCompanies: 200,
    minimumHealthyCompanies: 80,
  },
})
assert.equal(configured.targetActiveCompanies, 200)
assert.equal(configured.minimumHealthyCompanies, 80)
assert.equal(configured.source, "business_profile")
console.log("  ✓ Phase 2 — canonical portfolio target defaults + profile overrides")

const healthyLeads = Array.from({ length: 50 }, (_, index) =>
  leadFixture({ id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}` }),
)
const healthySnapshot = buildGrowthPortfolioManagerSnapshot({
  organizationId: ORG,
  generatedAt: "2026-07-15T12:00:00.000Z",
  leads: healthyLeads,
  eligibleLeadCount: 50,
  approvedProfile: approvedProfileFixture(),
  missionDiscovery: null,
})
assert.equal(healthySnapshot.health.healthState, "healthy")
assert.equal(healthySnapshot.replenishment.shouldReplenish, false)
assert.equal(healthySnapshot.marketIntelligence, null)
console.log("  ✓ Phase 3 — portfolio healthy state")

const lowSnapshot = buildGrowthPortfolioManagerSnapshot({
  organizationId: ORG,
  generatedAt: "2026-07-15T12:00:00.000Z",
  leads: [leadFixture({ id: "00000000-0000-4000-8000-000000000001" })],
  eligibleLeadCount: 18,
  approvedProfile: approvedProfileFixture(),
  missionDiscovery: null,
})
assert.equal(lowSnapshot.health.healthState, "needs_replenishment")
assert.equal(lowSnapshot.replenishment.shouldReplenish, true)
assert.equal(lowSnapshot.replenishment.batchSize, DEFAULT_PORTFOLIO_REPLENISH_BATCH_SIZE)
assert.notEqual(lowSnapshot.replenishment.batchSize, 82)
console.log("  ✓ Phase 4 — replenish starts automatically in bounded batches")

const duplicateBlocked = evaluatePortfolioReplenishmentDecision({
  target: lowSnapshot.target,
  health: { ...lowSnapshot.health, discoveryRunning: true },
  memory: emptyPortfolioManagerMemory(),
  generatedAt: "2026-07-15T12:00:00.000Z",
  discoveryAlreadyRunning: true,
})
assert.equal(duplicateBlocked.shouldReplenish, false)
assert.equal(duplicateBlocked.duplicateDiscoveryPrevented, true)
console.log("  ✓ Phase 5 — no duplicate discovery while one is running")

const profile = approvedProfileFixture()
const query = buildProspectSearchQueryFromBusinessProfile(profile, "Equipify")
const filters = buildProspectSearchFiltersFromBusinessProfile(profile)
assert.match(query, /Medical equipment service|biomedical/i)
assert.ok(filters.naics_codes?.includes("811310"))
assert.ok(filters.excluded_naics_codes?.includes("443142"))
console.log("  ✓ Phase 6 — Business Profile → Prospect Search inputs")

const memory = recordPortfolioDiscoveryMemory({
  memory: emptyPortfolioManagerMemory(),
  generatedAt: "2026-07-15T12:00:00.000Z",
  discoveredCount: 25,
  qualityScore: 80,
  admissionRate: 0.72,
})
assert.equal(memory.lastDiscoveryCount, 25)
assert.equal(memory.discoveriesToday, 25)
console.log("  ✓ Phase 7 — portfolio memory via org memory preferences")

assert.equal(lowSnapshot.operator.targetActiveCompanies, 100)
assert.equal(lowSnapshot.operator.currentActiveCompanies, 18)
assert.match(lowSnapshot.operator.healthLabel, /needs more qualified companies/i)
assert.deepEqual([...GROWTH_PORTFOLIO_MANAGER_MANUAL_FIND_OPTIONS], [10, 25, 50, 100])
assert.match(buildManualProspectSearchDiscoverHref(25), /prospect-search\/discover\?limit=25/)
console.log("  ✓ Phase 8 — operator projection + manual Find overrides")

const dailyLimitMemory = recordPortfolioDiscoveryMemory({
  memory: {
    ...emptyPortfolioManagerMemory(),
    discoveriesToday: DEFAULT_PORTFOLIO_MAXIMUM_DAILY_DISCOVERY,
    discoveriesTodayDate: "2026-07-15",
  },
  generatedAt: "2026-07-15T14:00:00.000Z",
  discoveredCount: 0,
})
const dailyBlocked = evaluatePortfolioReplenishmentDecision({
  target: lowSnapshot.target,
  health: lowSnapshot.health,
  memory: dailyLimitMemory,
  generatedAt: "2026-07-15T14:00:00.000Z",
})
assert.equal(dailyBlocked.blockedByDailyLimit, true)
assert.equal(dailyBlocked.shouldReplenish, false)
console.log("  ✓ Phase 9 — respects daily discovery limits")

const researchBlocked = evaluatePortfolioReplenishmentDecision({
  target: lowSnapshot.target,
  health: {
    ...lowSnapshot.health,
    counts: { ...lowSnapshot.health.counts, researching: DEFAULT_PORTFOLIO_MAXIMUM_CONCURRENT_RESEARCH },
  },
  memory: emptyPortfolioManagerMemory(),
  generatedAt: "2026-07-15T12:00:00.000Z",
})
assert.equal(researchBlocked.blockedByResearchLimit, true)
console.log("  ✓ Phase 10 — respects concurrent research limits")

const queueBlocked = evaluatePortfolioReplenishmentDecision({
  target: lowSnapshot.target,
  health: {
    ...lowSnapshot.health,
    admissionsPending: DEFAULT_PORTFOLIO_MAXIMUM_QUEUED_ADMISSIONS,
  },
  memory: emptyPortfolioManagerMemory(),
  generatedAt: "2026-07-15T12:00:00.000Z",
})
assert.equal(queueBlocked.blockedByQueueLimit, true)
console.log("  ✓ Phase 11 — respects queued admission limits")

assert.match(discoverySource, /upsertOrganizationMemoryPreferences/)
assert.doesNotMatch(discoverySource, /CREATE TABLE/)
console.log("  ✓ Phase 12 — no duplicate persistence layer")

assert.match(readSource("components/growth/workspace/executive-briefing/growth-home-portfolio-manager-section.tsx"), /GrowthHomePortfolioManagerSection/)
assert.match(readSource("lib/growth/home/growth-home-workspace-summary-service.ts"), /portfolioManager/)
console.log("  ✓ Phase 13 — Home portfolio section wired")

assert.doesNotMatch(outboundSource, /portfolio-manager/)
console.log("  ✓ Phase 14 — no outbound changes in portfolio manager path")

const portfolioManagerModules = [
  "lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a.ts",
  "lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types.ts",
  "lib/growth/portfolio-manager/growth-autonomous-portfolio-scheduler-tick-1a.ts",
  "lib/growth/portfolio-manager/growth-autonomous-portfolio-discovery-1a.ts",
  "lib/growth/portfolio-manager/growth-autonomous-portfolio-operator-projection-1a.ts",
]
for (const modulePath of portfolioManagerModules) {
  assert.doesNotMatch(
    readSource(modulePath),
    /@\/lib\/growth\/market-intelligence\//,
    `${modulePath} must not import deferred Market Intelligence modules`,
  )
}
assert.doesNotMatch(
  readSource("components/growth/workspace/executive-briefing/growth-home-portfolio-manager-section.tsx"),
  /@\/lib\/growth\/market-intelligence\//,
)
assert.doesNotMatch(
  readSource("lib/growth/objectives/growth-objective-runtime-scheduler.ts"),
  /tickMarketIntelligenceLoopForScheduler|@\/lib\/growth\/market-intelligence\//,
)
console.log("  ✓ Phase 15 — Portfolio Manager decoupled from Market Intelligence")

console.log(`\n[${GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER}] READY_FOR_AUTONOMOUS_PORTFOLIO_MANAGEMENT`)
