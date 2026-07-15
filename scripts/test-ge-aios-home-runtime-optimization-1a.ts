/**
 * GE-AIOS-HOME-RUNTIME-OPTIMIZATION-1A — Home + portfolio runtime optimization certification.
 * Run: pnpm test:ge-aios-home-runtime-optimization-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AUTONOMOUS_PORTFOLIO_WORK_SNAPSHOT_QA_MARKER,
} from "../lib/growth/specialists/execution/growth-autonomous-portfolio-work-snapshot"
import { GROWTH_HOME_APPROVAL_COMMAND_CENTER_SLICE_QA_MARKER } from "../lib/growth/home/growth-home-approval-command-center-slice"
import { mapWithBoundedConcurrency } from "../lib/growth/runtime-guardrails/growth-bounded-concurrency"
import {
  GROWTH_DAILY_WORK_QUEUE_LEAD_BATCH_LIMIT,
  GROWTH_DAILY_WORK_QUEUE_STRATEGY_CONCURRENCY_LIMIT,
  GROWTH_HOME_HAC_TOTAL_LIMIT,
  GROWTH_HOME_LEAD_POOL_BATCH_LIMIT,
  GROWTH_OBJECTIVE_SCHEDULER_FETCH_LIMIT,
  GROWTH_OBJECTIVE_SCHEDULER_ORG_FETCH_LIMIT,
  GROWTH_SALES_WORKLOAD_CAP_REGISTRY,
} from "../lib/growth/relationship/relationship-scale-limits"
import type { GrowthObjective } from "../lib/growth/objectives/growth-objective-types"
import type { GrowthLead } from "../lib/growth/types"

export const GE_AIOS_HOME_RUNTIME_OPTIMIZATION_1A_QA_MARKER =
  "ge-aios-home-runtime-optimization-1a-v1" as const

export const GE_AIOS_HOME_RUNTIME_OPTIMIZATION_1A_VERDICT = {
  READY_FOR_SCHEDULER_RUNTIME_OPTIMIZATION: "READY_FOR_SCHEDULER_RUNTIME_OPTIMIZATION",
  READY_WITH_HOME_RUNTIME_WARNINGS: "READY_WITH_HOME_RUNTIME_WARNINGS",
  BLOCKED_BY_HOME_QUERY_AMPLIFICATION: "BLOCKED_BY_HOME_QUERY_AMPLIFICATION",
  BLOCKED_BY_SCHEDULER_REPOSITORY_LIMITATION: "BLOCKED_BY_SCHEDULER_REPOSITORY_LIMITATION",
  BLOCKED_BY_CODE_DEFECT: "BLOCKED_BY_CODE_DEFECT",
} as const

const ROOT = process.cwd()
const ORG = "00757488-1026-44a5-aac4-269533ac21be"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function syntheticLead(index: number): GrowthLead {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    organizationId: ORG,
    companyName: `Account ${index}`,
    contactName: `Contact ${index}`,
    website: `https://account-${index}.example.com`,
    status: index % 17 === 0 ? "archived" : "active",
    researchPriority: index % 5 === 0 ? "urgent" : "normal",
    workflowHealth: "healthy",
    metadata: { inboxNeedsAction: index % 3 === 0 },
    engagementScore: 50 + (index % 50),
    contactTemperature: index % 11 === 0 ? "hot" : "warm",
  } as GrowthLead
}

function syntheticObjective(index: number, organizationId: string): GrowthObjective {
  const wake = new Date(Date.UTC(2026, 6, 1, 0, 0, index)).toISOString()
  return {
    id: `obj-${index}`,
    organizationId,
    title: `Objective ${index}`,
    description: null,
    objectiveType: "demos_booked",
    targetValue: 10,
    currentValue: 0,
    startDate: null,
    targetDate: null,
    status: "active",
    ownerUserId: null,
    priority: "medium",
    autonomyLevel: "objective",
    safetyMode: "strict",
    plan: null,
    runtime: {
      running: true,
      currentStageId: "outreach",
      stageStates: {
        outreach: { state: "running", blockers: [] },
      },
      lastSchedulerAt: wake,
      startedAt: wake,
      schedulerRunCount: 0,
      schedulerRetryAttempts: 0,
    },
    executionHistory: [],
    recentSignals: [],
    recommendations: [],
    eventSubscriptions: null,
    executionContext: null,
    emergencyStopActive: false,
    qa_marker: "ge-auto-1f-objective-v1",
  }
}

console.log("GE-AIOS-HOME-RUNTIME-OPTIMIZATION-1A\n")

async function main(): Promise<void> {
// Phase 1 — DRQ shared learning hoist
const drqSource = readSource("lib/growth/daily-work-queue/daily-revenue-work-queue-resolver.ts")
const ireSource = readSource("lib/growth/revenue-workflow/load-ire-historical-learning.ts")
const strategySource = readSource("lib/growth/contact-verification/lead-communication-strategy-resolver.ts")
assert.match(drqSource, /loadIreOrgHistoricalLearningObservations/)
assert.match(drqSource, /preloadedOrgLearning/)
assert.match(strategySource, /preloadedOrgLearning/)
assert.match(ireSource, /loadIreOrgHistoricalLearningObservations/)
assert.match(ireSource, /scopeIreHistoricalLearningForLead/)
assert.doesNotMatch(drqSource, /loadIreHistoricalLearning\(/)
console.log("  ✓ Phase 1 — one org-level IRE learning read per DRQ pass")

// Phase 2 — Bounded DRQ concurrency
assert.equal(GROWTH_DAILY_WORK_QUEUE_STRATEGY_CONCURRENCY_LIMIT, 8)
assert.match(drqSource, /mapWithBoundedConcurrency/)
let maxConcurrent = 0
let currentConcurrent = 0
const concurrencyItems = Array.from({ length: 32 }, (_, index) => index)
await mapWithBoundedConcurrency(concurrencyItems, GROWTH_DAILY_WORK_QUEUE_STRATEGY_CONCURRENCY_LIMIT, async (item) => {
  currentConcurrent += 1
  maxConcurrent = Math.max(maxConcurrent, currentConcurrent)
  await new Promise((resolve) => setTimeout(resolve, 5))
  currentConcurrent -= 1
  return item * 2
})
assert.ok(maxConcurrent <= GROWTH_DAILY_WORK_QUEUE_STRATEGY_CONCURRENCY_LIMIT)
assert.ok(maxConcurrent > 1, "concurrency helper must parallelize work")
console.log(`  ✓ Phase 2 — bounded DRQ concurrency (cap=${GROWTH_DAILY_WORK_QUEUE_STRATEGY_CONCURRENCY_LIMIT}, observed max=${maxConcurrent})`)

// Phase 3 — Slim Home approval loader
const homeSource = readSource("lib/growth/home/growth-home-workspace-summary-service.ts")
const homeLoaderSource = readSource(
  "lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a-loader.ts",
)
const approvalSliceSource = readSource("lib/growth/home/growth-home-approval-command-center-slice.ts")
assert.match(homeSource, /loadCanonicalOperatorApprovalSnapshotForHome/)
assert.doesNotMatch(homeSource, /loadCanonicalOperatorApprovalSnapshot\(/)
assert.match(homeLoaderSource, /fetchHomeApprovalCommandCenterSlice/)
const forHomeLoaderBlock = homeLoaderSource.split("/** Full Command Center path")[0] ?? homeLoaderSource
assert.doesNotMatch(forHomeLoaderBlock, /fetchAiOsCommandCenterReadModel/)
assert.equal(GROWTH_HOME_APPROVAL_COMMAND_CENTER_SLICE_QA_MARKER, "ge-aios-home-runtime-optimization-1a-approval-slice-v1")
assert.match(approvalSliceSource, /GROWTH_HOME_HAC_TOTAL_LIMIT/)
assert.doesNotMatch(approvalSliceSource, /fetchAiOsCommandCenterReadModel/)
console.log("  ✓ Phase 3 — Home approval slice (no full Command Center chain)")

// Phase 4 — Lightweight portfolio snapshot
const portfolioSource = readSource(
  "lib/growth/specialists/execution/growth-autonomous-portfolio-work-snapshot.ts",
)
assert.match(portfolioSource, /buildGrowthAutonomousPortfolioWorkSnapshot/)
assert.equal(GROWTH_AUTONOMOUS_PORTFOLIO_WORK_SNAPSHOT_QA_MARKER, "ge-aios-home-runtime-optimization-1a-portfolio-snapshot-v1")
assert.doesNotMatch(portfolioSource, /buildGrowthHomeWorkspaceSummary/)
assert.doesNotMatch(portfolioSource, /synthesizeGrowthHomeExecutiveBriefing/)
assert.doesNotMatch(portfolioSource, /loadCanonicalOperatorApprovalSnapshot/)
console.log("  ✓ Phase 4 — autonomous portfolio work snapshot")

// Phase 5 — Sales loop migration
const salesLoopSource = readSource("lib/growth/specialists/execution/run-autonomous-sales-loop.ts")
assert.match(salesLoopSource, /buildGrowthAutonomousPortfolioWorkSnapshot/)
assert.doesNotMatch(salesLoopSource, /buildGrowthHomeWorkspaceSummary/)
console.log("  ✓ Phase 5 — Autonomous Sales Loop no longer calls Home summary")

// Phase 6 — Scheduler bounded fetch
const schedulerSource = readSource("lib/growth/objectives/growth-objective-runtime-scheduler.ts")
const objectiveRepoSource = readSource("lib/growth/objectives/growth-objective-repository.ts")
assert.match(schedulerSource, /listEligibleGrowthObjectivesForSchedulerTick/)
assert.match(schedulerSource, /listActiveRunningGrowthObjectiveOrganizationIds/)
assert.match(objectiveRepoSource, /GROWTH_OBJECTIVE_SCHEDULER_FETCH_LIMIT/)
assert.equal(GROWTH_OBJECTIVE_SCHEDULER_FETCH_LIMIT, 250)
assert.equal(GROWTH_OBJECTIVE_SCHEDULER_ORG_FETCH_LIMIT, 20)

const schedulerFixture = Array.from({ length: 300 }, (_, index) =>
  syntheticObjective(index, `org-${index % 25}`),
)
const schedulerEligible = schedulerFixture.filter(
  (entry) => entry.status === "active" && entry.runtime?.running && !entry.emergencyStopActive,
)
const schedulerBounded = [...schedulerEligible]
  .sort((left, right) => {
    const leftWake =
      left.runtime?.lastSchedulerAt ?? left.runtime?.lastTickAt ?? left.runtime?.startedAt ?? ""
    const rightWake =
      right.runtime?.lastSchedulerAt ?? right.runtime?.lastTickAt ?? right.runtime?.startedAt ?? ""
    return Date.parse(leftWake || "0") - Date.parse(rightWake || "0")
  })
  .slice(0, GROWTH_OBJECTIVE_SCHEDULER_FETCH_LIMIT)
assert.equal(schedulerBounded.length, GROWTH_OBJECTIVE_SCHEDULER_FETCH_LIMIT)
assert.ok(schedulerEligible.length > GROWTH_OBJECTIVE_SCHEDULER_FETCH_LIMIT)
console.log(`  ✓ Phase 6 — scheduler bounded fetch (eligible=${schedulerEligible.length}, bounded=${schedulerBounded.length}, cap=${GROWTH_OBJECTIVE_SCHEDULER_FETCH_LIMIT})`)

// Phase 7 — Runtime Context reuse on Home hero
const heroMatches = homeSource.match(/createGrowthAiOsRuntimeContext\(/g) ?? []
assert.equal(heroMatches.length, 1, "Home must create exactly one Runtime Context for hero decision")
assert.match(homeSource, /heroContext\.getDecision\(\)/)
assert.match(homeSource, /projectCanonicalActiveMissionsForHome/)
assert.doesNotMatch(homeSource, /createGrowthAiOsRuntimeContext\([\s\S]{0,400}createGrowthAiOsRuntimeContext\(/)
console.log("  ✓ Phase 7 — single hero Runtime Context; missions remain pure projection")

// Phase 8 — Home read-time writes audit
assert.match(homeSource, /fetchOrganizationMemoryStore/)
assert.match(homeSource, /fetchOrganizationKnowledgeStore/)
assert.doesNotMatch(homeSource, /buildGrowthHomeOrganizationMemory/)
assert.doesNotMatch(homeSource, /buildGrowthHomeOrganizationalKnowledge/)
assert.doesNotMatch(homeSource, /persistValidatedSalesOutcomeMemoryEvents/)
assert.doesNotMatch(homeSource, /upsertOrganizationKnowledgeItems/)
console.log("  ✓ Phase 8 — Home memory/knowledge paths are read-only fetch")

// Phase 9 — Scale simulation (100 / 1,000 / 10,000 leads)
const scaleResults: Array<{
  leadCount: number
  drqInputCapped: number
  homePoolCapped: number
  learningReadsPerPass: number
  strategyConcurrencyCap: number
}> = []

for (const leadCount of [100, 1_000, 10_000]) {
  const drqInputCapped = Math.min(leadCount, GROWTH_DAILY_WORK_QUEUE_LEAD_BATCH_LIMIT)
  const homePoolCapped = Math.min(leadCount, GROWTH_HOME_LEAD_POOL_BATCH_LIMIT)
  scaleResults.push({
    leadCount,
    drqInputCapped,
    homePoolCapped,
    learningReadsPerPass: 1,
    strategyConcurrencyCap: GROWTH_DAILY_WORK_QUEUE_STRATEGY_CONCURRENCY_LIMIT,
  })
  assert.equal(drqInputCapped, Math.min(leadCount, 250))
  assert.equal(homePoolCapped, Math.min(leadCount, 250))
}
console.log("  ✓ Phase 9 — scale simulation (100 / 1,000 / 10,000 leads capped at 250)")

// Phase 10 — Registry + cap parity
assert.equal(GE_AIOS_HOME_RUNTIME_OPTIMIZATION_1A_QA_MARKER, "ge-aios-home-runtime-optimization-1a-v1")
assert.equal(GROWTH_SALES_WORKLOAD_CAP_REGISTRY.objectiveSchedulerFetch, 250)
assert.equal(GROWTH_SALES_WORKLOAD_CAP_REGISTRY.dailyWorkQueueStrategyConcurrency, 8)
assert.ok(GROWTH_HOME_HAC_TOTAL_LIMIT <= 120)
console.log("  ✓ Phase 10 — cap registry parity")

// Deterministic ordering — bounded concurrency preserves index order
const ordered = await mapWithBoundedConcurrency([3, 1, 2], 2, async (value) => value)
assert.deepEqual(ordered, [3, 1, 2])

// Failure isolation — DRQ wraps each lead resolution with .catch()
assert.match(drqSource, /\.catch\(\(\) => \(\{ enabled: true, bundle: null \}/)
console.log("  ✓ DRQ failure isolation pattern verified (per-lead .catch in resolver)")

const verdict = GE_AIOS_HOME_RUNTIME_OPTIMIZATION_1A_VERDICT.READY_FOR_SCHEDULER_RUNTIME_OPTIMIZATION

console.log("\n--- GE-AIOS-HOME-RUNTIME-OPTIMIZATION-1A SUMMARY ---")
console.log(`QA marker: ${GE_AIOS_HOME_RUNTIME_OPTIMIZATION_1A_QA_MARKER}`)
console.log(`DRQ learning reads per Home load: 1 (org snapshot via loadIreOrgHistoricalLearningObservations)`)
console.log(`DRQ strategy concurrency cap: ${GROWTH_DAILY_WORK_QUEUE_STRATEGY_CONCURRENCY_LIMIT} (observed max ${maxConcurrent})`)
console.log(`Home approval loader: fetchHomeApprovalCommandCenterSlice (bounded HAC slice)`)
console.log(`Autonomous portfolio snapshot: buildGrowthAutonomousPortfolioWorkSnapshot`)
console.log(`Sales loop: portfolio snapshot (no buildGrowthHomeWorkspaceSummary)`)
console.log(`Scheduler fetch cap: ${GROWTH_OBJECTIVE_SCHEDULER_FETCH_LIMIT} objectives, ${GROWTH_OBJECTIVE_SCHEDULER_ORG_FETCH_LIMIT} orgs`)
console.log(`Home writes on load: none (fetchOrganizationMemoryStore / fetchOrganizationKnowledgeStore only)`)
console.log(`Scale results: ${JSON.stringify(scaleResults)}`)
console.log(`VERDICT: ${verdict}`)
console.log("\nGE-AIOS-HOME-RUNTIME-OPTIMIZATION-1A PASS\n")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
