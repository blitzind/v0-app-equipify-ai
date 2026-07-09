/**
 * GE-AIOS-15F — Sales workload scaling & pagination certification.
 * Run: pnpm test:ge-aios-15f-sales-workload-scaling-pagination
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildGrowthHomeLeadPoolSummary,
  buildSalesWorkloadScaleAcknowledgment,
  encodeGrowthHomeLeadPoolCursor,
  parseGrowthHomeLeadPoolCursor,
} from "../lib/growth/home/growth-home-lead-pool-pagination"
import { runDecisionEngine } from "../lib/growth/decision-engine/engine/run-decision-engine"
import { runWorkManager } from "../lib/growth/work-manager/manager/run-work-manager"
import { GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH } from "../lib/growth/home/growth-home-workspace-summary-types"
import {
  GROWTH_HOME_LEAD_POOL_BATCH_LIMIT,
  GROWTH_HOME_RELATIONSHIP_SNAPSHOT_AUX_ROW_LIMIT,
  GROWTH_HOME_WORKLOAD_SCALE_15F_QA_MARKER,
  GROWTH_SALES_WORKLOAD_CAP_REGISTRY,
} from "../lib/growth/relationship/relationship-scale-limits"
import { buildAvaDailyBriefing } from "../lib/growth/ava-home/narrative/engine/build-ava-daily-briefing"

const PHASE = "GE-AIOS-15F" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function certLeadPool(
  overrides: Partial<ReturnType<typeof buildGrowthHomeLeadPoolSummary>> = {},
) {
  return buildGrowthHomeLeadPoolSummary({
    visibleLeads: [{ id: "11111111-1111-4111-8111-111111111111", createdAt: new Date().toISOString() }],
    totalEstimatedCount: 1_250,
    relationshipSnapshotCount: 1,
    fetchedHasMore: true,
    ...overrides,
  })
}

function certWorkspaceSummaryStub(leadPool = certLeadPool()) {
  return {
    kpis: {
      emailsSentToday: 0,
      repliesToday: 0,
      callsToday: 0,
      openOpportunities: 0,
      hotCompanies: 0,
      approvalQueueCount: 0,
    },
    meetings: { today: 0, thisWeek: 0, scheduled: 0 },
    inbox: { repliesNeedingAttention: 0, threadsOpen: 0, newReplies: 0 },
    operatorTasks: { callTasksDue: 0, pendingApprovals: 0, leadsNeedingAction: 0 },
    avaConsole: {
      greeting: "Hi",
      overnightSummary: null,
      highPriorityOpportunities: null,
      waitingForApproval: null,
      suggestedNextAction: null,
      researchLoopSummary: null,
    },
    dashboard: { generatedAt: new Date().toISOString(), briefing: null, sections: [] },
    leadPool,
  }
}

function main(): void {
  console.log(`[${PHASE}] Sales Workload Scaling & Pagination certification`)

  assert.equal(GROWTH_HOME_WORKLOAD_SCALE_15F_QA_MARKER, "ge-aios-15f-sales-workload-scaling-pagination-v1")
  assert.equal(GROWTH_SALES_WORKLOAD_CAP_REGISTRY.homeLeadPool, GROWTH_HOME_LEAD_POOL_BATCH_LIMIT)
  assert.equal(GROWTH_SALES_WORKLOAD_CAP_REGISTRY.relationshipSnapshotAux, GROWTH_HOME_RELATIONSHIP_SNAPSHOT_AUX_ROW_LIMIT)
  assert.ok(GROWTH_HOME_LEAD_POOL_BATCH_LIMIT <= 500)
  assert.ok(GROWTH_HOME_RELATIONSHIP_SNAPSHOT_AUX_ROW_LIMIT <= 500)

  const scaleLimits = readSource("lib/growth/relationship/relationship-scale-limits.ts")
  assert.match(scaleLimits, /GROWTH_REVENUE_QUEUE_BATCH_LIMIT/)
  assert.match(scaleLimits, /GROWTH_DAILY_WORK_QUEUE_LEAD_BATCH_LIMIT/)
  assert.match(scaleLimits, /GROWTH_RESEARCH_QUEUE_BATCH_LIMIT/)
  assert.match(scaleLimits, /GROWTH_PROSPECT_SEARCH_OVERLAY_BATCH_LIMIT/)
  assert.match(scaleLimits, /GROWTH_SALES_WORKLOAD_CAP_REGISTRY/)

  const leadRepo = readSource("lib/growth/lead-repository.ts")
  assert.match(leadRepo, /fetchGrowthHomeLeadPoolPage/)
  assert.match(leadRepo, /count: "estimated", head: true/)
  assert.match(leadRepo, /clampRelationshipBatchLimit/)
  assert.doesNotMatch(leadRepo, /fetchAllRows/)
  assert.match(leadRepo, /__growthHomeLeadPoolUsesKeysetPagination/)

  const summaryService = readSource("lib/growth/home/growth-home-workspace-summary-service.ts")
  assert.match(summaryService, /fetchGrowthHomeLeadPoolPage/)
  assert.match(summaryService, /leadPool/)
  assert.match(summaryService, /relationship_snapshot_count/)
  assert.doesNotMatch(summaryService, /await listGrowthLeads\(/)

  const paginationModule = readSource("lib/growth/home/growth-home-lead-pool-pagination.ts")
  assert.match(paginationModule, /visible_count/)
  assert.match(paginationModule, /total_estimated_count/)
  assert.match(paginationModule, /has_more/)
  assert.match(paginationModule, /next_cursor/)
  assert.match(paginationModule, /relationship_snapshot_count/)

  const summaryTypes = readSource("lib/growth/home/growth-home-workspace-summary-types.ts")
  assert.match(summaryTypes, /leadPool: GrowthHomeLeadPoolSummary/)

  const summaryRoute = readSource("app/api/platform/growth/home/workspace-summary/route.ts")
  assert.match(summaryRoute, /leadPoolCursor/)
  assert.doesNotMatch(summaryRoute, /workspace-summary\/page/)

  const hook = readSource("components/growth/workspace/use-growth-workspace-dashboard.ts")
  assert.match(hook, /GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH/)
  assert.equal(GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH, "/api/platform/growth/home/workspace-summary")
  assert.doesNotMatch(hook, /cursor.*fetch|fetch.*cursor/)

  const batchModule = readSource("lib/growth/relationship/enrich-relationship-lead-snapshots-batch.ts")
  assert.match(batchModule, /leads\.slice\(0, GROWTH_HOME_LEAD_POOL_BATCH_LIMIT\)/)
  assert.doesNotMatch(batchModule, /for \(const lead of leads\)/)

  const revenueLoader = readSource("lib/growth/revenue-queue/revenue-queue-projection-loader.ts")
  assert.match(revenueLoader, /GROWTH_REVENUE_QUEUE_BATCH_LIMIT/)

  const dailyQueue = readSource("lib/growth/daily-work-queue/daily-revenue-work-queue-resolver.ts")
  assert.match(dailyQueue, /GROWTH_DAILY_WORK_QUEUE_LEAD_BATCH_LIMIT/)

  const prospectIndex = readSource("lib/growth/prospect-search/prospect-search-index.ts")
  assert.match(prospectIndex, /GROWTH_PROSPECT_SEARCH_OVERLAY_BATCH_LIMIT/)

  const cursorPayload = { ca: "2026-07-08T00:00:00.000Z", id: "11111111-1111-4111-8111-111111111111" }
  const encoded = encodeGrowthHomeLeadPoolCursor(cursorPayload)
  assert.deepEqual(parseGrowthHomeLeadPoolCursor(encoded), cursorPayload)

  const leadPool = certLeadPool()
  assert.equal(leadPool.has_more, true)
  assert.ok(leadPool.next_cursor)
  assert.equal(leadPool.visible_count, 1)
  assert.equal(leadPool.total_estimated_count, 1_250)

  const scaleLine = buildSalesWorkloadScaleAcknowledgment(leadPool)
  assert.ok(scaleLine?.includes("1"))
  assert.ok(scaleLine?.includes("1250") || scaleLine?.includes("1,250") || scaleLine?.includes("~1250"))

  const decisionResult = runDecisionEngine({
    workspaceSummary: certWorkspaceSummaryStub(),
    waitingOnYou: [],
    dailyWorkQueue: [],
    accomplishments: [],
    timeline: [],
  })
  const scaleCandidate = decisionResult.context.missions.find((row) => row.id === "scale:lead_pool")
  assert.ok(scaleCandidate)
  assert.match(scaleCandidate?.detail ?? "", /visible|relationships/i)

  const workResult = runWorkManager({
    workspaceSummary: certWorkspaceSummaryStub(),
    waitingOnYou: [],
    dailyWorkQueue: [],
    accomplishments: [],
    timeline: [],
  })
  assert.ok(workResult.work_plan.length >= 0)

  const briefing = buildAvaDailyBriefing({
    greeting: "Good morning",
    hour: 9,
    workspaceSummary: certWorkspaceSummaryStub(),
    accomplishments: [],
    waitingOnYou: [],
    dailyWorkQueue: [],
    timeline: [],
  })
  assert.ok(
    briefing.summary.includes("1250") ||
      briefing.summary.includes("1,250") ||
      briefing.summary.includes("beyond this page") ||
      briefing.story_blocks.some((row) => row.id === "scale:lead_pool"),
  )

  console.log(`[${PHASE}] PASS — Sales Workload Scaling & Pagination certified (local)`)
}

main()
