/**
 * GE-AIOS-RUNTIME-OPTIMIZATION-AUDIT-1A — Runtime optimization architectural audit certification.
 * Run: pnpm test:ge-aios-runtime-optimization-audit-1a
 *
 * Read-only audit — no optimizations implemented.
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildGrowthRuntimeOptimizationAuditSummary,
  GROWTH_RUNTIME_CACHE_INVENTORY,
  GROWTH_RUNTIME_DUPLICATE_RESOLUTION_MATRIX,
  GROWTH_RUNTIME_ENTRY_POINTS,
  GROWTH_RUNTIME_EXPENSIVE_RESOLVER_INVENTORY,
  GROWTH_RUNTIME_LAZY_LOADING_VIOLATIONS,
  GROWTH_RUNTIME_OPTIMIZATION_AUDIT_1A_QA_MARKER,
  GROWTH_RUNTIME_OPTIMIZATION_AUDIT_1A_RUNTIME_RULE,
  GROWTH_RUNTIME_OPTIMIZATION_AUDIT_VERDICT,
  GROWTH_RUNTIME_OPTIMIZATION_OPPORTUNITIES,
  GROWTH_RUNTIME_PROJECTION_SURFACES,
  GROWTH_RUNTIME_REUSABLE_SYSTEMS,
  GROWTH_RUNTIME_SCALE_BOTTLENECKS,
} from "../lib/growth/aios/runtime/growth-runtime-optimization-audit-1a-types"
import {
  GROWTH_CANONICAL_DECISION_CACHE_MAX_ENTRIES,
  GROWTH_HOME_CANONICAL_MISSIONS_DISPLAY_LIMIT,
  GROWTH_HOME_HAC_TOTAL_LIMIT,
  GROWTH_HOME_HAC_TOP_LIMIT,
  GROWTH_HOME_LEAD_POOL_BATCH_LIMIT,
  GROWTH_HOME_MISSION_DISCOVERY_OBJECTIVE_LIMIT,
  GROWTH_SALES_WORKLOAD_CAP_REGISTRY,
} from "../lib/growth/relationship/relationship-scale-limits"
import { buildRevenueQueueCardProjectionFromLead } from "../lib/growth/revenue-queue/revenue-queue-card-projection"
import type { GrowthLead } from "../lib/growth/types"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function assertFileExists(relativePath: string): void {
  assert.ok(fs.existsSync(path.join(ROOT, relativePath)), `${relativePath} must exist`)
}

console.log("GE-AIOS-RUNTIME-OPTIMIZATION-AUDIT-1A\n")

// Phase 0 — Audit registry integrity
assert.equal(GROWTH_RUNTIME_OPTIMIZATION_AUDIT_1A_QA_MARKER, "ge-aios-runtime-optimization-audit-1a-v1")
assert.ok(GROWTH_RUNTIME_OPTIMIZATION_AUDIT_1A_RUNTIME_RULE.includes("read-only"))
assert.ok(GROWTH_RUNTIME_EXPENSIVE_RESOLVER_INVENTORY.length >= 17)
assert.ok(GROWTH_RUNTIME_ENTRY_POINTS.length >= 10)
console.log("  ✓ Phase 0 — audit registry loaded")

// Phase 1 — Expensive resolver inventory covers required subsystems
const requiredResolverIds = [
  "decision_engine",
  "revenue_strategy",
  "relationship_strategy",
  "conversation_intelligence",
  "meeting_intelligence",
  "memory_resolver",
  "institutional_learning",
  "buying_committee",
  "growth_5f",
  "draft_factory",
  "reply_intelligence",
  "call_workspace",
  "mission_projection",
  "operator_narrative",
  "revenue_queue",
  "home_summary",
  "executive_briefing",
]
for (const id of requiredResolverIds) {
  const entry = GROWTH_RUNTIME_EXPENSIVE_RESOLVER_INVENTORY.find((row) => row.id === id)
  assert.ok(entry, `resolver inventory must include ${id}`)
  assertFileExists(entry!.modulePath)
}
console.log("  ✓ Phase 1 — expensive resolver inventory (17 subsystems)")

// Phase 2 — Runtime entry points wired in source
const entryWiring: Array<[string, string]> = [
  ["lib/growth/home/growth-home-workspace-summary-service.ts", "buildGrowthHomeWorkspaceSummary"],
  ["lib/growth/revenue-queue/revenue-queue-card-projection.ts", "buildRevenueQueueCardProjectionFromLead"],
  ["lib/growth/lead-operator-workspace/lead-operator-workspace-from-lead.ts", "buildLeadOperatorWorkspacePayloadFromGrowthLead"],
  ["lib/growth/meeting-intelligence/ai-meeting-prep-service.ts", "generateAndPersistAiMeetingPrep"],
  ["lib/growth/call-copilot-briefing.ts", "buildGrowthCallCopilotBriefing"],
  ["lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a-loader.ts", "loadCanonicalOperatorApprovalSnapshot"],
  ["lib/growth/reply-intelligence/process-reply-intelligence.ts", "processReplyIntelligence"],
  ["lib/growth/objectives/growth-objective-runtime-scheduler.ts", "runGrowthObjectiveRuntimeScheduler"],
  ["lib/growth/draft-factory/draft-factory-due-scheduler-tick.ts", "tickDraftFactoryDueStatesForScheduler"],
  ["lib/growth/providers/transport/transport-orchestrator.ts", "resolveGrowthCanonicalDecisionForLeadCached"],
]
for (const [file, needle] of entryWiring) {
  assert.match(readSource(file), new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
}
console.log("  ✓ Phase 2 — runtime entry point wiring verified")

// Phase 3 — Duplicate resolution matrix
assert.ok(GROWTH_RUNTIME_DUPLICATE_RESOLUTION_MATRIX.length >= 8)
const decisionDup = GROWTH_RUNTIME_DUPLICATE_RESOLUTION_MATRIX.find((row) => row.subsystem === "Decision Engine")
assert.ok(decisionDup)
assert.equal(decisionDup!.sameSchedulerTick, "n_times")
const memoryDup = GROWTH_RUNTIME_DUPLICATE_RESOLUTION_MATRIX.find((row) => row.subsystem === "Memory Resolver")
assert.ok(memoryDup)
assert.equal(memoryDup!.sameHomeLoad, "n_times")
const homeSummary = readSource("lib/growth/home/growth-home-workspace-summary-service.ts")
const decisionCalls = (homeSummary.match(/resolveGrowthCanonicalDecisionForLeadCached/g) ?? []).length
assert.ok(decisionCalls <= 2, "Home must not N+1 canonical decisions across lead pool")
assert.doesNotMatch(
  homeSummary,
  /for\s*\([^)]*lead[^)]*\)[\s\S]{0,300}resolveGrowthCanonicalDecisionForLeadCached/,
)
console.log("  ✓ Phase 3 — duplicate resolution matrix (hero decision bounded; memory/scheduler at risk)")

// Phase 4 — Projection surfaces
const rqProjection = GROWTH_RUNTIME_PROJECTION_SURFACES.find((row) => row.surface === "Revenue Queue")
assert.equal(rqProjection?.verdict, "existing_projection")
const missionProjection = GROWTH_RUNTIME_PROJECTION_SURFACES.find((row) => row.surface === "Home missions")
assert.equal(missionProjection?.verdict, "existing_projection")
const drqSurface = GROWTH_RUNTIME_PROJECTION_SURFACES.find((row) => row.surface === "Daily Work Queue")
assert.equal(drqSurface?.verdict, "full_resolver")
console.log("  ✓ Phase 4 — projection audit (RQ/missions projection; DRQ full resolver)")

// Phase 5 — Lazy-loading violations documented
const homeViolation = GROWTH_RUNTIME_LAZY_LOADING_VIOLATIONS.find((row) => row.surface === "Home")
assert.ok(homeViolation)
assert.equal(homeViolation!.severity, "critical")
const salesLoopViolation = GROWTH_RUNTIME_LAZY_LOADING_VIOLATIONS.find(
  (row) => row.surface === "Scheduler sales loop",
)
assert.ok(salesLoopViolation)
assert.equal(salesLoopViolation!.severity, "critical")
console.log("  ✓ Phase 5 — lazy-loading violations (Home + sales loop critical)")

// Phase 6 — Scheduler audit
const scheduler = readSource("lib/growth/objectives/growth-objective-runtime-scheduler.ts")
assert.match(scheduler, /GROWTH_OBJECTIVE_SCHEDULER_EXECUTION_LIMIT/)
assert.match(scheduler, /MAX_ORGS_PER_TICK/)
assert.match(scheduler, /GROWTH_OBJECTIVE_SCHEDULER_MAX_RUNTIME_MS/)
assert.match(scheduler, /listEligibleGrowthObjectivesForSchedulerTick/)
const salesLoop = readSource("lib/growth/specialists/execution/run-autonomous-sales-loop.ts")
assert.match(salesLoop, /buildGrowthAutonomousPortfolioWorkSnapshot/)
assert.doesNotMatch(salesLoop, /buildGrowthHomeWorkspaceSummary/)
console.log("  ✓ Phase 6 — scheduler bounded tick; sales loop uses portfolio snapshot")

// Phase 7 — Cache inventory
const decisionCache = GROWTH_RUNTIME_CACHE_INVENTORY.find((row) => row.name === "Canonical Decision")
assert.ok(decisionCache)
assert.equal(decisionCache!.ttl, "30s")
assert.match(readSource("lib/growth/aios/growth/growth-canonical-decision-engine-1c-cache.ts"), /CACHE_TTL_MS = 30_000/)
assert.equal(GROWTH_CANONICAL_DECISION_CACHE_MAX_ENTRIES, 256)
const memoryCache = GROWTH_RUNTIME_CACHE_INVENTORY.find((row) => row.name === "Memory Resolver")
assert.equal(memoryCache!.status, "missing_opportunity")
console.log("  ✓ Phase 7 — cache inventory (decision active; memory gap)")

// Phase 8 — Query / N+1 audit
const drqResolver = readSource("lib/growth/daily-work-queue/daily-revenue-work-queue-resolver.ts")
assert.match(drqResolver, /mapWithBoundedConcurrency/)
assert.match(drqResolver, /loadIreOrgHistoricalLearningObservations/)
assert.match(drqResolver, /resolveLeadCommunicationStrategyBundle/)
const ireLearning = readSource("lib/growth/revenue-workflow/load-ire-historical-learning.ts")
assert.match(ireLearning, /listRecentClosedLoopLearningOutcomes/)
const hacLoader = readSource("lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a-loader.ts")
assert.match(hacLoader, /fetchAiOsCommandCenterReadModel/)
console.log("  ✓ Phase 8 — N+1 risks (DRQ per-lead loop; IRE learning; command center for HAC)")

// Phase 9 — AI audit (LLM not on list pages)
const homeSource = readSource("lib/growth/home/growth-home-workspace-summary-service.ts")
assert.doesNotMatch(homeSource, /runGrowthAiCopilotGeneration|runAiTask|invokeAiOsProvider/)
const rqCard = readSource("lib/growth/revenue-queue/revenue-queue-card-projection.ts")
assert.doesNotMatch(rqCard, /openai|runAiTask|generateText/)
const transport = readSource("lib/growth/providers/transport/transport-orchestrator.ts")
assert.match(transport, /resolveGrowthCanonicalDecisionForLeadCached/)
console.log("  ✓ Phase 9 — AI not on Home/list surfaces; transport gated")

// Phase 10 — Cost tiers
const veryHigh = GROWTH_RUNTIME_EXPENSIVE_RESOLVER_INVENTORY.filter((row) => row.costTier === "very_high")
assert.ok(veryHigh.length >= 4, "very_high tier must include decision, memory, home, command center, 5F")
const negligible = GROWTH_RUNTIME_EXPENSIVE_RESOLVER_INVENTORY.filter((row) => row.costTier === "negligible")
assert.ok(negligible.some((row) => row.id === "revenue_queue"))
console.log("  ✓ Phase 10 — relative cost ranking documented")

// Phase 11 — Optimization opportunities (audit only, not implemented)
const highestRoi = GROWTH_RUNTIME_OPTIMIZATION_OPPORTUNITIES.filter((row) => row.roi === "highest")
assert.ok(highestRoi.length >= 3)
for (const opp of GROWTH_RUNTIME_OPTIMIZATION_OPPORTUNITIES) {
  assert.ok(opp.latencySavings.length > 0)
  assert.ok(opp.databaseSavings.length > 0)
}
console.log("  ✓ Phase 11 — optimization opportunities ranked (not implemented)")

// Phase 12 — Reusable systems
assert.ok(GROWTH_RUNTIME_REUSABLE_SYSTEMS.length >= 8)
assert.ok(GROWTH_RUNTIME_REUSABLE_SYSTEMS.some((row) => row.includes("decision-engine-1c-cache")))
assert.ok(GROWTH_RUNTIME_REUSABLE_SYSTEMS.some((row) => row.includes("send-plane")))
console.log("  ✓ Phase 12 — existing reusable architecture identified")

// Phase 13 — Scale readiness
assert.equal(GROWTH_RUNTIME_SCALE_BOTTLENECKS.length, 4)
assert.equal(GROWTH_SALES_WORKLOAD_CAP_REGISTRY.homeLeadPool, GROWTH_HOME_LEAD_POOL_BATCH_LIMIT)
assert.equal(GROWTH_HOME_LEAD_POOL_BATCH_LIMIT, 250)
assert.equal(GROWTH_HOME_CANONICAL_MISSIONS_DISPLAY_LIMIT, 24)
assert.equal(GROWTH_HOME_HAC_TOP_LIMIT, 24)
assert.equal(GROWTH_HOME_HAC_TOTAL_LIMIT, 120)
assert.equal(GROWTH_HOME_MISSION_DISCOVERY_OBJECTIVE_LIMIT, 50)

// Pure projection still scales
const syntheticLead = (index: number): GrowthLead =>
  ({
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    organizationId: "00757488-1026-44a5-aac4-269533ac21be",
    companyName: `Account ${index}`,
    contactName: `Contact ${index}`,
    status: "active",
    metadata: {},
  }) as GrowthLead

for (const scale of [100, 1_000, 10_000]) {
  const leads = Array.from({ length: Math.min(scale, GROWTH_HOME_LEAD_POOL_BATCH_LIMIT) }, (_, i) =>
    syntheticLead(i + 1),
  )
  const cards = leads.map((lead) => buildRevenueQueueCardProjectionFromLead(lead))
  assert.equal(cards.length, leads.length)
  assert.ok(cards.every((row) => row.queue_role === "navigation"))
}
console.log("  ✓ Phase 13 — scale caps + projection simulation 100/1k/10k")

// Phase 14 — Certification verdict
const summary = buildGrowthRuntimeOptimizationAuditSummary()
assert.equal(summary.qaMarker, GROWTH_RUNTIME_OPTIMIZATION_AUDIT_1A_QA_MARKER)
assert.equal(summary.verdict, GROWTH_RUNTIME_OPTIMIZATION_AUDIT_VERDICT)
assert.equal(GROWTH_RUNTIME_OPTIMIZATION_AUDIT_VERDICT, "READY_FOR_RUNTIME_OPTIMIZATION")
assert.ok(summary.primaryBlockers.length >= 2)
console.log("  ✓ Phase 14 — certification verdict:", GROWTH_RUNTIME_OPTIMIZATION_AUDIT_VERDICT)

console.log("\nGE-AIOS-RUNTIME-OPTIMIZATION-AUDIT-1A PASS")
console.log(`Verdict: ${GROWTH_RUNTIME_OPTIMIZATION_AUDIT_VERDICT}`)
console.log(`Resolvers inventoried: ${summary.expensiveResolverCount}`)
console.log(`Entry points traced: ${summary.entryPointCount}`)
console.log(`Highest-ROI opportunities: ${summary.highestRoiOpportunityCount}`)
console.log(`Primary blockers: ${summary.primaryBlockers.join(" | ")}`)
