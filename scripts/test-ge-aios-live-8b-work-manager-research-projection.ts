/**
 * GE-AIOS-LIVE-8B — Work Manager review research projection (local architecture cert).
 *
 * Run: node -r ./scripts/server-only-shim.cjs --import tsx scripts/test-ge-aios-live-8b-work-manager-research-projection.ts
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildDecisionContext } from "../lib/growth/decision-engine/context/build-decision-context"
import { GE_AIOS_LIVE_8B_WORK_MANAGER_RESEARCH_PROJECTION_QA_MARKER } from "../lib/growth/research/growth-revenue-queue-research-selection"
import {
  buildPortfolioEligibilityContext,
  filterPortfolioEligibleWorkItems,
} from "../lib/growth/portfolio-eligibility/growth-portfolio-eligibility-1a"
import { nextBestActionsToWorkItems } from "../lib/growth/work-manager/bridges/decision-engine-bridge"
import { rankNextActions } from "../lib/growth/decision-engine/ranking/rank-next-actions"
import { flattenDecisionCandidates } from "../lib/growth/decision-engine/context/build-decision-context"
import { isExecutableWorkItem } from "../lib/growth/work-manager/state/work-item-state"
import { extractLeadIdFromWorkItem } from "../lib/growth/specialists/execution/extract-lead-id-from-work-item"
import { selectNextExecutableWorkItem } from "../lib/growth/specialists/execution/select-next-executable-work-item"
import { buildDailyWorkPlan } from "../lib/growth/work-manager/planner/build-daily-work-plan"
import type { GrowthLead } from "../lib/growth/types"

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")
const selectionSource = fs.readFileSync(
  path.join(root, "lib/growth/research/growth-revenue-queue-research-selection.ts"),
  "utf8",
)
const decisionContextSource = fs.readFileSync(
  path.join(root, "lib/growth/decision-engine/context/build-decision-context.ts"),
  "utf8",
)
const orchestratorSource = fs.readFileSync(
  path.join(root, "lib/growth/ava-home/growth-ava-research-orchestrator-service.ts"),
  "utf8",
)

console.log("GE-AIOS-LIVE-8B — Work Manager research projection cert\n")

assert.equal(
  GE_AIOS_LIVE_8B_WORK_MANAGER_RESEARCH_PROJECTION_QA_MARKER,
  "ge-aios-live-8b-work-manager-research-projection-v1",
)
console.log("  ✓ LIVE-8B QA marker constant")

assert.match(selectionSource, /selectRevenueQueueReviewResearchCandidates/)
assert.match(selectionSource, /resolveLeadAdmissionStateFromMetadata\(lead\.metadata\) !== "review"/)
assert.match(selectionSource, /shouldAutoQueueLeadResearch\(lead\)/)
assert.match(selectionSource, /GROWTH_AVA_RESEARCH_QUEUE_SECTIONS/)
console.log("  ✓ shared revenue queue selection mirrors Ava section ordering with review filter")

assert.match(decisionContextSource, /buildReviewResearchProjectionCandidates/)
assert.match(decisionContextSource, /selectRevenueQueueReviewResearchCandidates/)
assert.match(orchestratorSource, /export \{ selectRevenueQueueResearchCandidates \}/)
console.log("  ✓ decision engine + orchestrator wired to shared selection module")

const ORG = "00757488-1026-44a5-aac4-269533ac21be"
const reviewLeadId = "797ffc30-654b-4288-be8c-106c7238e353"
const acceptedLeadId = "6d9220f0-2960-468c-b4be-5d7595d292c3"

function leadFixture(overrides: Partial<GrowthLead> & Pick<GrowthLead, "id" | "companyName">): GrowthLead {
  return {
    organizationId: ORG,
    contactName: "Fixture Contact",
    website: "https://example.com",
    status: "active",
    researchPriority: "normal",
    workflowHealth: "healthy",
    metadata: { admission_state: "review", admission_reasons: ["pending_operational_keyword_validation"] },
    engagementScore: 50,
    contactTemperature: "warm",
    archivedAt: null,
    lastProspectResearchedAt: null,
    latestProspectResearchRunId: null,
    lastResearchedAt: null,
    latestResearchRunId: null,
    ...overrides,
  } as GrowthLead
}

const portfolioLeads = [
  leadFixture({ id: reviewLeadId, companyName: "sunflex" }),
  leadFixture({
    id: acceptedLeadId,
    companyName: "Block Imaging",
    metadata: { admission_state: "accepted" },
    lastProspectResearchedAt: "2026-07-20T00:00:00.000Z",
    latestProspectResearchRunId: "run-existing",
  }),
]

const eligibility = buildPortfolioEligibilityContext(ORG, portfolioLeads)
assert.equal(eligibility.eligibleCount, 1)
assert.ok(eligibility.reviewResearchProjectionCount >= 1)
assert.ok(eligibility.reviewResearchProjectionLeadIds.has(reviewLeadId))
assert.equal(eligibility.reviewResearchProjectionLeadIds.has(acceptedLeadId), false)
console.log("  ✓ portfolio eligibility preserves eligibleLeadIds and adds review projection set")

const context = buildDecisionContext({
  workspaceSummary: {
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
      greeting: "",
      overnightSummary: null,
      highPriorityOpportunities: null,
      waitingForApproval: null,
      suggestedNextAction: null,
      researchLoopSummary: null,
    },
    dashboard: {
      generatedAt: "2026-07-21T00:00:00.000Z",
      briefing: null,
      sections: [],
      operatorActionCards: [],
      dailyRevenueWorkQueueEnabled: false,
      dailyRevenueWorkQueue: null,
      dailyRevenueWorkQueueDisplay: null,
    },
    leadPool: { visible_count: 2, has_more: true, total_estimated_count: 10 },
    missionDiscovery: null,
  },
  waitingOnYou: [],
  dailyWorkQueue: [],
  accomplishments: [],
  timeline: [],
  portfolioEligibility: eligibility,
  portfolioLeads,
})

const candidates = flattenDecisionCandidates(context)
const reviewResearchCandidates = candidates.filter(
  (row) => row.kind === "research_company" && row.href?.includes(reviewLeadId),
)
assert.ok(reviewResearchCandidates.length >= 1)
console.log("  ✓ review research-eligible lead projected as research_company candidate")

const ranked = rankNextActions(candidates, context)
const workItems = filterPortfolioEligibleWorkItems(
  nextBestActionsToWorkItems(ranked.slice(0, 12), new Date().toISOString()),
  eligibility,
)
const researchWorkItems = workItems.filter((item) => item.type === "research")
assert.ok(researchWorkItems.length >= 1)
assert.ok(researchWorkItems.some((item) => extractLeadIdFromWorkItem(item) === reviewLeadId))
console.log("  ✓ review research work items survive portfolio eligibility filter")

const plan = buildDailyWorkPlan({ workItems, completedToday: [] })
const nextExecutable = selectNextExecutableWorkItem({
  ...plan,
  qaMarker: "ge-aios-11a-work-manager-v1",
  completed_today: [],
  specialist_orchestrator_qa_marker: null,
  specialist_orchestrator_result: null,
})
assert.ok(nextExecutable)
assert.equal(nextExecutable.type, "research")
assert.equal(extractLeadIdFromWorkItem(nextExecutable), reviewLeadId)
assert.notEqual(nextExecutable.id, "work:scale:lead_pool")
console.log("  ✓ lead-scoped research ranks above scale:lead_pool")

const duplicateLeadIds = new Set<string>()
for (const item of researchWorkItems) {
  const leadId = extractLeadIdFromWorkItem(item)
  if (!leadId) continue
  assert.equal(duplicateLeadIds.has(leadId), false, `duplicate research work item for ${leadId}`)
  duplicateLeadIds.add(leadId)
}
console.log("  ✓ no duplicate lead-scoped research work items in fixture")

console.log("\nGE-AIOS-LIVE-8B local architecture cert passed.")
