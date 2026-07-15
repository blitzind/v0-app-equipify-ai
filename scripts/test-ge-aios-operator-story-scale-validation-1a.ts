/**
 * GE-AIOS-OPERATOR-STORY-SCALE-VALIDATION-1A — Portfolio scale architecture certification.
 * Run: pnpm test:ge-aios-operator-story-scale-validation-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import type { GrowthHumanApprovalItem } from "../lib/growth/aios/approvals/growth-human-approval-center-types"
import { buildGrowthCanonicalNextBestDecision } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1a"
import type { GrowthCanonicalDecisionInput } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1a-input"
import { projectCanonicalDecisionOperatorCard } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1a-operator-card"
import {
  buildCanonicalDecisionSuppressionHints,
  computeGrowthCanonicalDecisionFreshness,
} from "../lib/growth/aios/growth/growth-canonical-decision-engine-1b-freshness"
import {
  GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1B_QA_MARKER,
  type GrowthCanonicalDecisionResolution,
} from "../lib/growth/aios/growth/growth-canonical-decision-engine-1b-types"
import {
  buildCanonicalActiveMissionsProjection,
  buildCanonicalMissionsFromApprovalSnapshot,
} from "../lib/growth/aios/missions/growth-canonical-mission-1a"
import {
  buildCanonicalOperatorApprovalSnapshot,
  buildCanonicalOperatorTask,
} from "../lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a"
import {
  buildCanonicalOperatorFocus,
} from "../lib/growth/aios/operator-experience/growth-canonical-operator-focus-1a"
import { projectCanonicalOperatorProgress } from "../lib/growth/aios/operator-experience/growth-canonical-operator-progress-1a"
import { AI_OS_DRAFT_FACTORY_CAPACITY } from "../lib/growth/draft-factory/draft-factory-types"
import {
  GROWTH_DRAFT_FACTORY_DUE_POOL_LIMIT,
  GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_MAX_ADVANCES_PER_ORG,
  GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_MAX_ORGS,
} from "../lib/growth/draft-factory/draft-factory-wake-event-types"
import {
  GROWTH_CANONICAL_DECISION_CACHE_MAX_ENTRIES,
  GROWTH_HOME_CANONICAL_MISSIONS_DISPLAY_LIMIT,
  GROWTH_HOME_HAC_TOTAL_LIMIT,
  GROWTH_HOME_HAC_TOP_LIMIT,
  GROWTH_HOME_LEAD_POOL_BATCH_LIMIT,
  GROWTH_HOME_MISSION_DISCOVERY_OBJECTIVE_LIMIT,
  GROWTH_RELATIONSHIP_MAX_BATCH_LIMIT,
  GROWTH_SALES_WORKLOAD_CAP_REGISTRY,
} from "../lib/growth/relationship/relationship-scale-limits"
import { buildRevenueQueueCardProjectionFromLead } from "../lib/growth/revenue-queue/revenue-queue-card-projection"
import type { GrowthLead } from "../lib/growth/types"

export const GE_AIOS_OPERATOR_STORY_SCALE_VALIDATION_1A_QA_MARKER =
  "ge-aios-operator-story-scale-validation-1a-v1" as const

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
    metadata: {},
  } as GrowthLead
}

function syntheticHacItem(leadId: string, index: number): GrowthHumanApprovalItem {
  return {
    id: `hac-${index}`,
    organizationId: ORG,
    source: "outreach_package",
    actionType: "approve_outreach_package",
    status: "needs_review",
    title: `Outreach package — Account ${index}`,
    summary: `Prepared for Account ${index}`,
    subjectType: "lead",
    subjectId: leadId,
    channel: "email",
    riskLevel: "medium",
    priorityScore: 90 - (index % 20),
    createdAt: "2026-07-14T10:00:00.000Z",
    route: `/growth/leads/${leadId}`,
    evidence: [],
    policy: { requiresHumanApproval: true, enforcementSource: "pilot", blockedReason: null },
  }
}

function decisionInput(leadId: string): GrowthCanonicalDecisionInput {
  return {
    organizationId: ORG,
    leadId,
    generatedAt: "2026-07-14T10:00:00.000Z",
    companyName: "Account",
    contactName: "Contact",
    memoryBundle: null,
    relationshipAssessment: null,
    revenueStrategy: "proceed",
    adaptiveEvolution: null,
    institutionalAdvice: null,
    committee: null,
    replyState: null,
    postCall: null,
    meeting: null,
    packageState: null,
    draftFactoryStatus: null,
    approvalState: null,
    sourceVersions: {
      memoryVersion: "none",
      relationshipVersion: null,
      revenueVersion: "proceed",
      packageVersion: null,
      meetingVersion: null,
      approvalVersion: null,
      materialEventId: null,
    },
  }
}

function toResolution(leadId: string): GrowthCanonicalDecisionResolution {
  const input = { ...decisionInput(leadId), leadId }
  const decision = buildGrowthCanonicalNextBestDecision(input)
  return {
    qaMarker: GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1B_QA_MARKER,
    organizationId: ORG,
    leadId,
    generatedAt: input.generatedAt,
    companyName: input.companyName,
    decision,
    operatorCard: projectCanonicalDecisionOperatorCard(decision),
    freshness: computeGrowthCanonicalDecisionFreshness({ decision, materialEventAt: input.generatedAt }),
    suppressionHints: buildCanonicalDecisionSuppressionHints(decision),
    inputDegraded: [],
  }
}

console.log("GE-AIOS-OPERATOR-STORY-SCALE-VALIDATION-1A\n")

// Phase 1 — Scale architecture registry
assert.equal(GROWTH_SALES_WORKLOAD_CAP_REGISTRY.homeLeadPool, 250)
assert.equal(GROWTH_SALES_WORKLOAD_CAP_REGISTRY.homeCanonicalMissionsDisplay, 24)
assert.equal(GROWTH_SALES_WORKLOAD_CAP_REGISTRY.homeMissionDiscoveryObjectives, 50)
assert.equal(GROWTH_HOME_LEAD_POOL_BATCH_LIMIT, GROWTH_RELATIONSHIP_MAX_BATCH_LIMIT / 2)
console.log("  ✓ Phase 1 — bounded account pool vs portfolio caps documented")

// Phase 2 — Portfolio ownership (static wiring)
const ownershipChecks: Array<[string, string]> = [
  ["lib/growth/home/growth-home-workspace-summary-service.ts", "buildCanonicalOperatorFocus"],
  ["lib/growth/home/growth-home-workspace-summary-service.ts", "createGrowthAiOsRuntimeContext"],
  ["lib/growth/home/growth-home-workspace-summary-service.ts", "projectCanonicalActiveMissionsForHome"],
  ["lib/growth/objectives/growth-objective-runtime-scheduler.ts", "tickAutonomousSalesLoopForScheduler"],
  ["lib/growth/objectives/growth-objective-runtime-scheduler.ts", "tickDraftFactoryDueStatesForScheduler"],
  ["lib/growth/daily-work-queue/daily-revenue-work-queue-resolver.ts", "buildDailyRevenueWorkQueue"],
  ["lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a-loader.ts", "fetchGrowthHumanApprovalCenterReadModel"],
]
for (const [file, needle] of ownershipChecks) {
  assert.match(readSource(file), new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
}
console.log("  ✓ Phase 2 — portfolio ownership matrix verified")

// Phase 3 — Bounded mission resolution
const homeSummary = readSource("lib/growth/home/growth-home-workspace-summary-service.ts")
assert.match(homeSummary, /heroContext\.getDecision\(\)/)
const decisionCalls = (homeSummary.match(/createGrowthAiOsRuntimeContext\(/g) ?? []).length
assert.equal(decisionCalls, 1, `Home should create exactly one hero Runtime Context, found ${decisionCalls}`)
assert.doesNotMatch(homeSummary, /for\s*\(.*leads.*\)[\s\S]{0,200}createGrowthAiOsRuntimeContext\(/)
console.log("  ✓ Phase 3 — Home does not N+1 canonical decisions across lead pool")

// Phase 12 — Scale simulation (100 / 1,000 / 10,000)
for (const scale of [100, 1_000, 10_000]) {
  const leads = Array.from({ length: scale }, (_, i) => syntheticLead(i + 1))
  const activeLeads = leads.filter((row) => row.status !== "archived")
  const pageLeads = activeLeads.slice(0, GROWTH_HOME_LEAD_POOL_BATCH_LIMIT)

  const hacItems = pageLeads
    .slice(0, Math.min(GROWTH_HOME_HAC_TOTAL_LIMIT, 120))
    .map((lead, index) => syntheticHacItem(lead.id, index))

  const approvalSnapshot = buildCanonicalOperatorApprovalSnapshot({ hacItems })
  assert.ok(approvalSnapshot.packages.length <= GROWTH_HOME_HAC_TOTAL_LIMIT)

  const missions = buildCanonicalMissionsFromApprovalSnapshot({
    organizationId: ORG,
    approvalSnapshot,
  })
  const uniqueLeadIds = new Set(missions.map((row) => row.leadId))
  assert.equal(uniqueLeadIds.size, missions.length, `${scale}: missions dedupe by leadId`)

  const projection = buildCanonicalActiveMissionsProjection({
    organizationId: ORG,
    missions,
  })
  assert.ok(projection.missions.length <= GROWTH_HOME_CANONICAL_MISSIONS_DISPLAY_LIMIT)
  assert.equal(
    projection.totalMissionCount,
    missions.length,
    `${scale}: totalMissionCount accurate`,
  )
  assert.equal(
    projection.overflowMissionCount,
    Math.max(0, missions.length - projection.missions.length),
  )

  const focus = buildCanonicalOperatorFocus({
    approvalSnapshot,
    missions: projection.missions,
    revenueQueueLeadId: pageLeads[0]?.id ?? null,
    leads: pageLeads.map((row) => ({ id: row.id, companyName: row.companyName })),
  })
  assert.ok(focus, `${scale}: primary focus resolves`)

  const progress = projectCanonicalOperatorProgress({
    dailyWorkQueue: pageLeads.slice(0, 8).map((row, index) => ({
      id: `queue-${index}`,
      label: row.companyName,
      companyName: row.companyName,
      leadId: row.id,
      detail: null,
      href: `/growth/leads/${row.id}`,
      priority: "normal" as const,
    })),
    focusLeadId: focus?.leadId ?? null,
  })
  assert.ok(progress.items.length <= 8, `${scale}: progress projection bounded`)

  const cards = pageLeads.map((lead) => buildRevenueQueueCardProjectionFromLead(lead))
  assert.equal(cards.length, pageLeads.length)
  assert.ok(cards.every((row) => row.queue_role === "navigation"))
}
console.log("  ✓ Phase 12 — 100 / 1,000 / 10,000 account simulation PASS")

// Scheduler / draft factory budgets
const scheduler = readSource("lib/growth/objectives/growth-objective-runtime-scheduler.ts")
assert.match(scheduler, /GROWTH_OBJECTIVE_SCHEDULER_EXECUTION_LIMIT/)
assert.match(scheduler, /GROWTH_OBJECTIVE_SCHEDULER_MAX_RUNTIME_MS/)
assert.equal(GROWTH_HOME_MISSION_DISCOVERY_OBJECTIVE_LIMIT, 50)
assert.equal(GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_MAX_ORGS, 20)
assert.equal(GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_MAX_ADVANCES_PER_ORG, 10)
assert.equal(GROWTH_DRAFT_FACTORY_DUE_POOL_LIMIT, 100)
assert.equal(AI_OS_DRAFT_FACTORY_CAPACITY.maxPackagesPerDay, 100)
console.log("  ✓ Phase 7/9 — scheduler and cost budgets verified")

// Decision cache bounded
assert.equal(GROWTH_CANONICAL_DECISION_CACHE_MAX_ENTRIES, 256)
assert.match(readSource("lib/growth/aios/growth/growth-canonical-decision-engine-1c-cache.ts"), /MAX_CACHE_ENTRIES = 256/)

// Query amplification audit
const drqResolver = readSource("lib/growth/daily-work-queue/daily-revenue-work-queue-resolver.ts")
assert.match(drqResolver, /mapWithBoundedConcurrency/)
assert.match(
  readSource("lib/growth/daily-work-queue/daily-revenue-work-queue-resolver.ts"),
  /GROWTH_DAILY_WORK_QUEUE_LEAD_BATCH_LIMIT|limit: input\?\.limit/,
)
const missionDiscovery = readSource("lib/growth/mission-center/growth-home-mission-discovery-loader.ts")
assert.match(missionDiscovery, /GROWTH_HOME_MISSION_DISCOVERY_OBJECTIVE_LIMIT/)
console.log("  ✓ Phase 6 — query amplification audit (bounded DRQ window; mission discovery capped)")

// Home loader budget
assert.match(
  readSource("lib/growth/home/growth-home-workspace-loader-budget.ts"),
  /GROWTH_HOME_WORKSPACE_LOADER_BUDGET_MS = 2_500/,
)

// HAC scale semantics
assert.equal(GROWTH_HOME_HAC_TOP_LIMIT, 24)
assert.equal(GROWTH_HOME_HAC_TOTAL_LIMIT, 120)

// Operator exception model — single collapsed task
const approval100 = buildCanonicalOperatorApprovalSnapshot({
  hacItems: Array.from({ length: 100 }, (_, i) =>
    syntheticHacItem(`00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`, i),
  ),
})
const task100 = buildCanonicalOperatorTask({ approvalSnapshot: approval100 })
assert.ok(task100, "one operator task summarizes many pending approvals")
assert.equal(approval100.outreachPackageCount, 100)
console.log("  ✓ Phase 10 — HAC scale: one operator task summarizes many packages")

// Mission scale semantics
const missionBuilder = readSource("lib/growth/aios/missions/growth-canonical-mission-1a.ts")
assert.doesNotMatch(missionBuilder, /insert\(|\.upsert\(|createMissionRecord/)
console.log("  ✓ Phase 11 — missions computed not stored")

// Portfolio vs account story
const missionsUi = readSource(
  "components/growth/workspace/executive-briefing/growth-home-canonical-missions-section.tsx",
)
assert.match(missionsUi, /overflowMissionCount|totalMissionCount|Showing/)
const revenueCard = readSource("components/growth/lead-operator/growth-lead-inbox-card.tsx")
assert.match(revenueCard, /navigation_cta_label|Open account/)
console.log("  ✓ Phase 5 — portfolio vs account story separation")

console.log(`\n${GE_AIOS_OPERATOR_STORY_SCALE_VALIDATION_1A_QA_MARKER}: PASS`)
