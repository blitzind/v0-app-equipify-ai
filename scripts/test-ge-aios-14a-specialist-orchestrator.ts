/**
 * GE-AIOS-14A — Ava Specialist Orchestration certification.
 * Run: pnpm test:ge-aios-14a-specialist-orchestrator
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildAvaDailyBriefing } from "../lib/growth/ava-home/narrative/engine/build-ava-daily-briefing"
import {
  AVA_SPECIALIST_REGISTRY,
  GROWTH_SPECIALIST_ORCHESTRATOR_QA_MARKER,
  MARKETING_SPECIALIST,
  SALES_SPECIALIST,
  buildSpecialistNarrativeLines,
  completeSpecialistWork,
  delegateWorkItem,
  handoffBetweenSpecialists,
  routeWorkItem,
  runSpecialistOrchestrator,
} from "../lib/growth/specialists"
import { runWorkManager } from "../lib/growth/work-manager/manager/run-work-manager"
import type { AvaWorkItem } from "../lib/growth/work-manager/types"
import { buildAvaHomeHero } from "../lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a"
import type { GrowthHomeAiOsUxViewModel } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import type { GrowthAvaResearchLoopSummary } from "../lib/growth/ava-home/growth-ava-research-orchestrator-types"

const PHASE = "GE-AIOS-14A" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function baseAiOsUx(overrides: Partial<GrowthHomeAiOsUxViewModel> = {}): GrowthHomeAiOsUxViewModel {
  return {
    qaMarker: "growth-ge-aios-ux-1a-ai-os-home-experience-v1",
    hero: {} as never,
    waitingOnYou: [],
    waitingOnYouOverflow: 0,
    approveItemsHref: "/growth/approvals",
    approveItemsCount: 0,
    liveStatus: null,
    dailyWorkQueueBuckets: null,
    dailyWorkQueue: [],
    throughput: [],
    mailboxDomainHealth: null,
    autonomousReadiness: null,
    ...overrides,
  }
}

const researchSummary: GrowthAvaResearchLoopSummary = {
  qaMarker: "ge-aios-6b-ava-research-orchestrator-v1",
  runId: "run-14a",
  completedAt: new Date().toISOString(),
  companiesReviewed: 22,
  researchCompleted: 22,
  buyingSignalsVerified: 3,
  readyForOutreachReview: 1,
  qualificationCompleted: 3,
  qualificationSkipped: 0,
  qualificationFailed: 0,
  narrative: "Ava reviewed 22 companies.",
  leadResults: [
    {
      leadId: "lead-precision",
      companyName: "Precision Biomedical",
      outcome: "completed",
      readyForOutreachReview: true,
      hasBuyingSignals: true,
      qualificationStatus: "completed",
    },
  ],
  transportBlocked: true,
  humanApprovalRequired: true,
  outboundOccurred: false,
}

function workspaceSummaryFixture() {
  return {
    kpis: {
      emailsSentToday: 0,
      repliesToday: 2,
      callsToday: 0,
      openOpportunities: 2,
      hotCompanies: 3,
      approvalQueueCount: 2,
    },
    meetings: { today: 1, thisWeek: 2, scheduled: 2 },
    inbox: { repliesNeedingAttention: 2, threadsOpen: 1, newReplies: 2 },
    operatorTasks: { callTasksDue: 0, pendingApprovals: 2, leadsNeedingAction: 4 },
    avaConsole: {
      greeting: "Good morning, Mike.",
      overnightSummary: null,
      highPriorityOpportunities: null,
      waitingForApproval: null,
      suggestedNextAction: "Continue researching medical equipment companies",
      researchLoopSummary: researchSummary,
    },
    dashboard: {
      generatedAt: new Date().toISOString(),
      briefing: null,
      sections: [],
      operatorActionCards: [],
      dailyRevenueWorkQueueEnabled: false,
      dailyRevenueWorkQueue: null,
      dailyRevenueWorkQueueDisplay: null,
    },
  }
}

function sampleWorkItem(overrides: Partial<AvaWorkItem>): AvaWorkItem {
  return {
    id: "work:sample",
    type: "research",
    title: "Research company — Precision Biomedical",
    description: null,
    status: "planned",
    priority: 80,
    source: "decision_engine",
    created_at: "2026-07-08T12:00:00.000Z",
    updated_at: "2026-07-08T12:00:00.000Z",
    estimated_minutes: 20,
    estimated_revenue_impact: 70,
    requires_operator: false,
    can_execute_autonomously: true,
    depends_on: [],
    blocked_by: [],
    next_action: null,
    decision_score: 80,
    confidence: 82,
    href: null,
    company_name: "Precision Biomedical",
    decision_source_id: "sample",
    ...overrides,
  }
}

function main(): void {
  console.log(`[${PHASE}] Ava Specialist Orchestration certification`)

  assert.equal(GROWTH_SPECIALIST_ORCHESTRATOR_QA_MARKER, "ge-aios-14a-specialist-orchestrator-v1")
  assert.equal(AVA_SPECIALIST_REGISTRY.length, 5)

  const specialistFiles = [
    "lib/growth/specialists/types.ts",
    "lib/growth/specialists/index.ts",
    "lib/growth/specialists/registry/specialist-registry.ts",
    "lib/growth/specialists/router/route-work-item.ts",
    "lib/growth/specialists/specialists/sales-specialist.ts",
    "lib/growth/specialists/specialists/marketing-specialist.ts",
    "lib/growth/specialists/specialists/customer-success-specialist.ts",
    "lib/growth/specialists/specialists/service-specialist.ts",
    "lib/growth/specialists/specialists/finance-specialist.ts",
    "lib/growth/specialists/bridges/work-manager-bridge.ts",
    "lib/growth/specialists/bridges/narrative-bridge.ts",
    "lib/growth/specialists/engine/run-specialist-orchestrator.ts",
    "components/growth/workspace/executive-briefing/growth-home-ava-specialist-team-section.tsx",
  ]
  for (const file of specialistFiles) {
    assert.ok(fs.existsSync(path.join(process.cwd(), file)), `${file} must exist`)
  }

  const futureHooks = [delegateWorkItem(), completeSpecialistWork(), handoffBetweenSpecialists()]
  for (const hook of futureHooks) {
    assert.equal(Object.values(hook)[0], false)
    assert.equal(Object.values(hook)[1], "planning_only")
  }

  const researchRoute = routeWorkItem(sampleWorkItem({ type: "research" }))
  const marketingRoute = routeWorkItem(
    sampleWorkItem({ type: "mission", title: "Campaign planning — Q3 audience strategy" }),
  )
  const financeRoute = routeWorkItem(
    sampleWorkItem({ type: "mission", title: "Invoice follow-up — overdue payment" }),
  )

  assert.equal(researchRoute.specialist_id, "sales")
  assert.equal(marketingRoute.specialist_id, "marketing")
  assert.equal(financeRoute.specialist_id, "finance")

  const routeA = routeWorkItem(sampleWorkItem({ id: "work:a", type: "qualification" }))
  const routeB = routeWorkItem(sampleWorkItem({ id: "work:a", type: "qualification" }))
  assert.deepEqual(routeA, routeB, "Routing must be deterministic")

  assert.equal(SALES_SPECIALIST.stub, false)
  assert.equal(MARKETING_SPECIALIST.stub, true)

  const orchestrator = runSpecialistOrchestrator({
    workItems: [
      sampleWorkItem({ id: "work:1", type: "research" }),
      sampleWorkItem({ id: "work:2", type: "mission", title: "Campaign planning — LinkedIn" }),
    ],
  })
  assert.ok(orchestrator.assignments.every((row) => row.specialist_id))
  assert.ok(orchestrator.routed_work_items.every((row) => row.assigned_specialist && row.routing_reason))

  const input = {
    workspaceSummary: workspaceSummaryFixture(),
    waitingOnYou: [
      { id: "w1", label: "Approve outreach draft for ABC Medical", detail: "Ready", href: "/growth/leads/1", severity: 3 },
    ],
    dailyWorkQueue: [
      {
        id: "q1",
        priority: "high" as const,
        companyName: "Precision Biomedical",
        actionLabel: "Prepare outreach",
        href: "/growth/leads/precision",
        confidencePercent: 88,
        confidenceLabel: "High",
        requiresHumanApproval: true,
      },
    ],
    accomplishments: [],
    timeline: [],
    generatedAt: "2026-07-08T12:00:00.000Z",
  }

  const workResult = runWorkManager(input)
  assert.equal(workResult.specialist_orchestrator_qa_marker, GROWTH_SPECIALIST_ORCHESTRATOR_QA_MARKER)
  assert.ok(workResult.specialist_orchestrator_result)
  assert.ok(workResult.all_work_items.some((row) => row.assigned_specialist === "sales"))

  const briefing = buildAvaDailyBriefing({
    greeting: "Good morning, Mike.",
    hour: 9,
    workspaceSummary: input.workspaceSummary,
    accomplishments: input.accomplishments,
    waitingOnYou: input.waitingOnYou,
    dailyWorkQueue: input.dailyWorkQueue,
    timeline: input.timeline,
    generatedAt: input.generatedAt,
  })
  assert.equal(briefing.specialist_orchestrator_qa_marker, GROWTH_SPECIALIST_ORCHESTRATOR_QA_MARKER)
  assert.ok(briefing.specialist_orchestrator_result)
  assert.ok(
    briefing.story_blocks.some((block) => /Sales Specialist|asked my|specialist/i.test(block.text)) ||
      buildSpecialistNarrativeLines(briefing.specialist_orchestrator_result).length > 0,
  )

  const narrativeSource = readSource("lib/growth/ava-home/narrative/engine/build-ava-daily-briefing.ts")
  assert.match(narrativeSource, /buildSpecialistStoryBlocks/)
  assert.doesNotMatch(narrativeSource, /runDecisionEngine/)

  const workManagerSource = readSource("lib/growth/work-manager/manager/run-work-manager.ts")
  assert.match(workManagerSource, /orchestrateWorkManagerResult/)
  assert.match(workManagerSource, /runDecisionEngine/)

  const orchestratorSource = readSource("lib/growth/specialists/engine/run-specialist-orchestrator.ts")
  assert.doesNotMatch(orchestratorSource, /openai|anthropic|generateText|llm/i)
  assert.doesNotMatch(orchestratorSource, /fetch\(|executeReadyWorkItems|sendEmail/)

  const hero = buildAvaHomeHero({
    greeting: "Good morning, Mike.",
    hour: 9,
    employeeStatus: { kind: "working", label: "Working", activityLabel: "working" },
    aiOsUx: baseAiOsUx({
      approveItemsCount: 1,
      waitingOnYou: input.waitingOnYou,
      dailyWorkQueue: input.dailyWorkQueue,
    }),
    researchLoopSummary: researchSummary,
    accomplishments: [],
    repliesWaiting: 2,
    workspaceSummary: workspaceSummaryFixture(),
  })
  assert.ok(hero.specialistOrchestrator)
  assert.equal(hero.specialistOrchestrator?.qaMarker, GROWTH_SPECIALIST_ORCHESTRATOR_QA_MARKER)

  const dashboardSource = readSource(
    "components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx",
  )
  assert.match(dashboardSource, /GrowthHomeAvaSpecialistTeamSection/)
  assert.match(dashboardSource, /AVA_SPECIALIST_MY_TEAM_TITLE|specialistOrchestrator/)
  assert.ok(
    dashboardSource.indexOf("<GrowthHomeAvaMemorySection") <
      dashboardSource.indexOf("<GrowthHomeAvaSpecialistTeamSection"),
  )
  assert.ok(
    dashboardSource.indexOf("<GrowthHomeAvaSpecialistTeamSection") <
      dashboardSource.indexOf("<GrowthHomeExecutiveSnapshotSection"),
  )

  const uiSource = readSource(
    "components/growth/workspace/executive-briefing/growth-home-ava-specialist-team-section.tsx",
  )
  assert.match(uiSource, /AVA_SPECIALIST_MY_TEAM_TITLE/)
  assert.match(uiSource, /team_status/)

  const migrationDir = path.join(process.cwd(), "supabase/migrations")
  const specialistMigrations = fs
    .readdirSync(migrationDir)
    .filter((name) => name.includes("specialist_orchestrator") || name.includes("ava-specialist"))
  assert.equal(specialistMigrations.length, 0, "14A must not add schema migrations")

  console.log(`[${PHASE}] PASS — Specialist Orchestrator certified (local)`)
}

main()
