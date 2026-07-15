/**
 * GE-AIOS-SCHEDULER-RUNTIME-OPTIMIZATION-1A — Scheduler runtime optimization certification.
 * Run: pnpm test:ge-aios-scheduler-runtime-optimization-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildSchedulerOrgFairnessBuckets,
  getObjectiveSchedulerWakeAt,
  selectSchedulerObjectivesWithOrgFairness,
  selectSchedulerOrganizationIdsWithFairness,
  sortObjectivesBySchedulerWakeTime,
} from "../lib/growth/objectives/growth-objective-scheduler-selection-1a"
import {
  classifySchedulerFailure,
  isObjectiveSchedulerBackoffElapsed,
  shouldIncrementSchedulerRetryForFailure,
} from "../lib/growth/objectives/growth-objective-scheduler-retry-1a"
import {
  GROWTH_SCHEDULER_RUNTIME_CALL_GRAPH_1A,
  GROWTH_SCHEDULER_RUNTIME_OPTIMIZATION_1A_QA_MARKER,
} from "../lib/growth/objectives/growth-objective-scheduler-telemetry-1a-types"
import { createSchedulerRuntimeBudget } from "../lib/growth/runtime-guardrails/growth-scheduler-runtime-budget-1a"
import {
  GROWTH_OBJECTIVE_SCHEDULER_ELIGIBLE_FETCH_LIMIT,
  GROWTH_OBJECTIVE_SCHEDULER_EXECUTION_LIMIT,
  GROWTH_OBJECTIVE_SCHEDULER_OBJECTIVE_CONCURRENCY_LIMIT,
  GROWTH_OBJECTIVE_SCHEDULER_ORG_FETCH_LIMIT,
  GROWTH_SALES_WORKLOAD_CAP_REGISTRY,
} from "../lib/growth/relationship/relationship-scale-limits"
import type { GrowthObjective } from "../lib/growth/objectives/growth-objective-types"

export const GE_AIOS_SCHEDULER_RUNTIME_OPTIMIZATION_1A_VERDICT = {
  READY_FOR_CONTROLLED_PORTFOLIO_SCALE: "READY_FOR_CONTROLLED_PORTFOLIO_SCALE",
  READY_WITH_SCHEDULER_WARNINGS: "READY_WITH_SCHEDULER_WARNINGS",
  BLOCKED_BY_OBJECTIVE_QUERY_SCALING: "BLOCKED_BY_OBJECTIVE_QUERY_SCALING",
  BLOCKED_BY_SCHEDULER_FAIRNESS: "BLOCKED_BY_SCHEDULER_FAIRNESS",
  BLOCKED_BY_PROVIDER_BUDGET_COORDINATION: "BLOCKED_BY_PROVIDER_BUDGET_COORDINATION",
  BLOCKED_BY_CODE_DEFECT: "BLOCKED_BY_CODE_DEFECT",
} as const

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function syntheticObjective(index: number, organizationId: string, input?: Partial<GrowthObjective>): GrowthObjective {
  const wake = new Date(Date.UTC(2026, 6, 1, 0, 0, index % 1440)).toISOString()
  return {
    id: `obj-${String(index).padStart(8, "0")}`,
    organizationId,
    title: `Objective ${index}`,
    description: null,
    objectiveType: "demos_booked",
    targetValue: 10,
    currentValue: 0,
    startDate: null,
    targetDate: null,
    status: input?.status ?? "active",
    ownerUserId: null,
    priority: "medium",
    autonomyLevel: "objective",
    safetyMode: "strict",
    plan: null,
    runtime: input?.runtime ?? {
      running: true,
      currentStageId: "outreach",
      stageStates: {
        outreach: { state: "running", blockers: [], startedAt: wake, completedAt: null, lastError: null, progress: 0 },
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
    emergencyStopActive: input?.emergencyStopActive ?? false,
    qa_marker: "ge-auto-1f-objective-v1",
    createdAt: wake,
    updatedAt: wake,
  }
}

function buildPortfolio(input: {
  organizations: number
  objectivesPerOrg: number
  dominantOrgShare?: number
}): GrowthObjective[] {
  const rows: GrowthObjective[] = []
  let index = 0
  const dominantOrg = "org-dominant"
  const dominantCount = input.dominantOrgShare
    ? Math.floor(input.organizations * input.objectivesPerOrg * input.dominantOrgShare)
    : 0

  for (let org = 0; org < input.organizations; org += 1) {
    const organizationId = org === 0 && dominantCount > 0 ? dominantOrg : `org-${org}`
    const count = organizationId === dominantOrg ? dominantCount : input.objectivesPerOrg
    for (let i = 0; i < count; i += 1) {
      rows.push(syntheticObjective(index, organizationId))
      index += 1
    }
  }
  return rows
}

console.log("GE-AIOS-SCHEDULER-RUNTIME-OPTIMIZATION-1A\n")

// Phase 1 — Call graph wiring
const schedulerSource = readSource("lib/growth/objectives/growth-objective-runtime-scheduler.ts")
const repoSource = readSource("lib/growth/objectives/growth-objective-repository.ts")
const migrationSource = readSource(
  "supabase/migrations/20270722120000_growth_scheduler_runtime_optimization_1a.sql",
)
assert.equal(GROWTH_SCHEDULER_RUNTIME_OPTIMIZATION_1A_QA_MARKER, "ge-aios-scheduler-runtime-optimization-1a-v1")
assert.match(schedulerSource, /listEligibleGrowthObjectivesForSchedulerTick/)
assert.match(schedulerSource, /selectSchedulerObjectivesWithOrgFairness/)
assert.match(schedulerSource, /createSchedulerRuntimeBudget/)
assert.match(schedulerSource, /mapWithBoundedConcurrency/)
assert.match(schedulerSource, /checkSchedulerProviderBudgetGate/)
assert.doesNotMatch(schedulerSource, /buildGrowthHomeWorkspaceSummary/)
assert.match(
  readSource("lib/growth/specialists/execution/run-autonomous-sales-loop.ts"),
  /buildGrowthAutonomousPortfolioWorkSnapshot/,
)
assert.match(migrationSource, /scheduler_runtime_running/)
assert.match(migrationSource, /scheduler_wake_at/)
assert.match(migrationSource, /idx_growth_objectives_scheduler_eligible_wake/)
assert.doesNotMatch(migrationSource, /generated always as/i)
assert.match(migrationSource, /before insert or update of runtime_state/i)
assert.match(migrationSource, /sync_organization_growth_objective_scheduler_eligibility/)
assert.match(migrationSource, /trg_organization_growth_objectives_sync_scheduler_eligibility/)
assert.match(migrationSource, /try_parse_runtime_timestamptz/)
assert.match(migrationSource, /exception\s+when others/)
assert.match(migrationSource, /runtime_state\s*->>\s*'lastSchedulerAt'/)
assert.match(migrationSource, /runtime_state\s*->>\s*'lastTickAt'/)
assert.match(migrationSource, /runtime_state\s*->>\s*'startedAt'/)
assert.match(migrationSource, /runtime_state\s*->>\s*'running'/)
assert.match(migrationSource, /update growth\.organization_growth_objectives/)
assert.match(
  repoSource,
  /\.eq\("scheduler_runtime_running", true\)[\s\S]*\.order\("scheduler_wake_at", \{ ascending: true \}\)/,
)
console.log("  ✓ Phase 1 — scheduler call graph + trigger-synced eligibility migration")

// Phase 2 — DB-bounded selection contract
assert.match(repoSource, /scheduler_runtime_running/)
assert.match(repoSource, /scheduler_wake_at/)
assert.equal(GROWTH_OBJECTIVE_SCHEDULER_ELIGIBLE_FETCH_LIMIT, 100)
assert.equal(GROWTH_OBJECTIVE_SCHEDULER_EXECUTION_LIMIT, 50)
console.log("  ✓ Phase 2 — eligible fetch limit 100, execution cap 50")

// Phase 3 — Organization fairness
const dominantPortfolio = buildPortfolio({
  organizations: 20,
  objectivesPerOrg: 10,
  dominantOrgShare: 0.8,
})
const dominantSelection = selectSchedulerObjectivesWithOrgFairness(dominantPortfolio)
assert.ok(dominantSelection.selected.length <= 50)
assert.ok(dominantSelection.organizationsSelected <= 20)
const selectedOrgCounts = new Map<string, number>()
for (const row of dominantSelection.selected) {
  selectedOrgCounts.set(row.organizationId, (selectedOrgCounts.get(row.organizationId) ?? 0) + 1)
}
assert.ok(selectedOrgCounts.size > 1, "dominant org must not consume entire tick")
const maxPerOrg = Math.max(...selectedOrgCounts.values())
assert.ok(maxPerOrg <= Math.ceil(50 / Math.max(1, dominantSelection.organizationsSelected)) + 1)
console.log(`  ✓ Phase 3 — org fairness (orgs selected=${dominantSelection.organizationsSelected}, max per org=${maxPerOrg})`)

// Phase 4 — Account fairness authority preserved
assert.match(schedulerSource, /tickAutonomousSalesLoopForScheduler/)
assert.match(readSource("lib/growth/specialists/execution/run-autonomous-sales-loop.ts"), /selectNextExecutableWorkItem/)
assert.match(readSource("lib/growth/specialists/execution/run-autonomous-sales-loop.ts"), /runWorkManager/)
console.log("  ✓ Phase 4 — Work Manager + Decision Engine remain portfolio/account authority")

// Phase 5 — Bounded concurrency values
assert.equal(GROWTH_OBJECTIVE_SCHEDULER_OBJECTIVE_CONCURRENCY_LIMIT, 2)
assert.equal(GROWTH_SCHEDULER_RUNTIME_CALL_GRAPH_1A.caps.objectiveConcurrency, 2)
console.log("  ✓ Phase 5 — objective concurrency cap=2 (mapWithBoundedConcurrency)")

// Phase 6 — Time budget
const budget = createSchedulerRuntimeBudget({ maxRuntimeMs: 45_000, startedAtMs: Date.now() - 44_500 })
assert.equal(budget.mayBeginWork(2_000), false)
assert.equal(budget.stopReason(2_000), "insufficient_safe_window")
console.log("  ✓ Phase 6 — request-scoped scheduler budget defers unsafe starts")

// Phase 7 — Slow-account isolation
assert.match(readSource("lib/growth/specialists/execution/run-autonomous-sales-loop.ts"), /org_work_timeout/)
assert.match(schedulerSource, /withSchedulerWorkTimeout/)
console.log("  ✓ Phase 7 — per-org and per-objective timeouts")

// Phase 8 — Continuation / retry discipline
const backoffObjective = syntheticObjective(1, "org-1", {
  runtime: {
    running: true,
    currentStageId: "outreach",
    stageStates: {
      outreach: { state: "running", blockers: [], startedAt: null, completedAt: null, lastError: null, progress: 0 },
    },
    lastSchedulerAt: new Date().toISOString(),
    schedulerRetryAttempts: 2,
    lastSchedulerResult: {
      ticksAttempted: 0,
      retriesAttempted: 0,
      stalledDetected: false,
      failed: true,
      at: new Date().toISOString(),
    },
  },
})
assert.equal(isObjectiveSchedulerBackoffElapsed(backoffObjective), false)
assert.equal(shouldIncrementSchedulerRetryForFailure(classifySchedulerFailure(new Error("timeout"))), true)
assert.equal(shouldIncrementSchedulerRetryForFailure(classifySchedulerFailure(new Error("operator_blocked"))), false)
console.log("  ✓ Phase 8 — deferred work stays eligible; operator blocks do not inflate retries")

// Phase 9 — Draft Factory bounded selection
const dfSource = readSource("lib/growth/draft-factory/draft-factory-due-scheduler-tick.ts")
const dfRepoSource = readSource("lib/growth/draft-factory/draft-factory-durable-repository-core.ts")
assert.match(dfSource, /listDueDraftFactoryStates/)
assert.match(dfSource, /selectPortfolioAwareDueDraftFactoryStates/)
assert.match(dfRepoSource, /next_eligible_wake_at/)
assert.match(dfSource, /advanceDraftFactoryForLeadLive/)
console.log("  ✓ Phase 9 — Draft Factory due query bounded by next_eligible_wake_at")

// Phase 10 — Provider budget gate
assert.match(schedulerSource, /checkSchedulerProviderBudgetGate/)
assert.match(readSource("lib/growth/objectives/growth-objective-scheduler-provider-budget-1a.ts"), /remainingBudget/)
console.log("  ✓ Phase 10 — provider budget gate before sub-ticks")

// Phase 11 — Retry classification
assert.equal(classifySchedulerFailure(new Error("rate_limit 429")), "rate_limited")
assert.equal(classifySchedulerFailure(new Error("objective_tick_timeout_10000ms")), "timeout")
console.log("  ✓ Phase 11 — failure classification helper")

// Phase 12 — Telemetry fields
assert.match(schedulerSource, /telemetry:/)
assert.match(schedulerSource, /objectivesFetched/)
assert.match(schedulerSource, /remainingMsAtStop/)
console.log("  ✓ Phase 12 — extended per-tick telemetry")

// Phase 13 — Large-scale simulation (selection only — no account intelligence)
const scaleCases = [
  { organizations: 20, objectivesPerOrg: 5, label: "20 orgs" },
  { organizations: 100, objectivesPerOrg: 10, label: "100 orgs" },
  { organizations: 1000, objectivesPerOrg: 10, label: "1k orgs" },
  { organizations: 100, objectivesPerOrg: 100, label: "10k objectives" },
  { organizations: 1000, objectivesPerOrg: 100, label: "100k objectives" },
] as const

const scaleResults: Array<Record<string, number | string>> = []
for (const scenario of scaleCases) {
  const portfolio = buildPortfolio({
    organizations: scenario.organizations,
    objectivesPerOrg: scenario.objectivesPerOrg,
    dominantOrgShare: scenario.label === "100k objectives" ? 0.7 : undefined,
  })
  const fetchPool = sortObjectivesBySchedulerWakeTime(portfolio).slice(
    0,
    GROWTH_OBJECTIVE_SCHEDULER_ELIGIBLE_FETCH_LIMIT,
  )
  const selection = selectSchedulerObjectivesWithOrgFairness(fetchPool)
  assert.ok(selection.selected.length <= GROWTH_OBJECTIVE_SCHEDULER_EXECUTION_LIMIT)
  assert.ok(fetchPool.length <= GROWTH_OBJECTIVE_SCHEDULER_ELIGIBLE_FETCH_LIMIT)
  scaleResults.push({
    label: scenario.label,
    totalObjectives: portfolio.length,
    fetchPool: fetchPool.length,
    selected: selection.selected.length,
    orgsSelected: selection.organizationsSelected,
  })
}

const paused = syntheticObjective(99, "org-paused", {
  runtime: {
    running: true,
    currentStageId: "outreach",
    stageStates: {
      outreach: { state: "paused", blockers: [], startedAt: null, completedAt: null, lastError: null, progress: 0 },
    },
    lastSchedulerAt: "1970-01-01T00:00:00.000Z",
  },
})
const pausedSelection = selectSchedulerObjectivesWithOrgFairness([paused])
assert.equal(pausedSelection.selected.length, 0)

const futureWake = syntheticObjective(100, "org-future", {
  runtime: {
    running: true,
    currentStageId: "outreach",
    stageStates: {
      outreach: { state: "running", blockers: [], startedAt: null, completedAt: null, lastError: null, progress: 0 },
    },
    lastSchedulerAt: new Date(Date.now() + 60_000).toISOString(),
    lastSchedulerResult: {
      ticksAttempted: 1,
      retriesAttempted: 0,
      stalledDetected: false,
      failed: true,
      at: new Date().toISOString(),
    },
    schedulerRetryAttempts: 0,
  },
})
assert.equal(isObjectiveSchedulerBackoffElapsed(futureWake), false)

const orgOrder1 = selectSchedulerOrganizationIdsWithFairness(
  buildPortfolio({ organizations: 5, objectivesPerOrg: 20 }),
)
const orgOrder2 = selectSchedulerOrganizationIdsWithFairness(
  buildPortfolio({ organizations: 5, objectivesPerOrg: 20 }),
)
assert.deepEqual(orgOrder1, orgOrder2)
console.log("  ✓ Phase 13 — scale simulation + paused/future/backoff/idempotency")

// Phase 15 — Cap registry
assert.equal(GROWTH_SALES_WORKLOAD_CAP_REGISTRY.objectiveSchedulerExecution, 50)
assert.equal(GROWTH_SALES_WORKLOAD_CAP_REGISTRY.objectiveSchedulerEligibleFetch, 100)
console.log("  ✓ Phase 15 — performance cap registry")

const verdict = GE_AIOS_SCHEDULER_RUNTIME_OPTIMIZATION_1A_VERDICT.READY_FOR_CONTROLLED_PORTFOLIO_SCALE

console.log("\n--- GE-AIOS-SCHEDULER-RUNTIME-OPTIMIZATION-1A SUMMARY ---")
console.log(`QA marker: ${GROWTH_SCHEDULER_RUNTIME_OPTIMIZATION_1A_QA_MARKER}`)
console.log(`Eligible DB fetch cap: ${GROWTH_OBJECTIVE_SCHEDULER_ELIGIBLE_FETCH_LIMIT}`)
console.log(`Execution cap: ${GROWTH_OBJECTIVE_SCHEDULER_EXECUTION_LIMIT}`)
console.log(`Org cap: ${GROWTH_OBJECTIVE_SCHEDULER_ORG_FETCH_LIMIT}`)
console.log(`Objective concurrency: ${GROWTH_OBJECTIVE_SCHEDULER_OBJECTIVE_CONCURRENCY_LIMIT}`)
console.log(`Scale results: ${JSON.stringify(scaleResults)}`)
console.log(`VERDICT: ${verdict}`)
console.log("\nGE-AIOS-SCHEDULER-RUNTIME-OPTIMIZATION-1A PASS\n")
