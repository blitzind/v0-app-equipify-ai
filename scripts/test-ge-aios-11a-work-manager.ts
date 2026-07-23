/**
 * GE-AIOS-11A — Ava Work Manager certification.
 * Run: pnpm test:ge-aios-11a-work-manager
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildAvaDailyBriefing } from "../lib/growth/ava-home/narrative/engine/build-ava-daily-briefing"
import { rankNextActions } from "../lib/growth/decision-engine"
import {
  buildDailyWorkPlan,
  detectWorkInterruptions,
  executeReadyWorkItems,
  GROWTH_WORK_MANAGER_QA_MARKER,
  nextBestActionsToWorkItems,
  prioritizeWorkItems,
  runWorkManager,
} from "../lib/growth/work-manager"
import { runDecisionEngine } from "../lib/growth/decision-engine/engine/run-decision-engine"
import { buildAvaHomeHero } from "../lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a"
import type { GrowthHomeAiOsUxViewModel } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import type { GrowthAvaResearchLoopSummary } from "../lib/growth/ava-home/growth-ava-research-orchestrator-types"

const PHASE = "GE-AIOS-11A" as const

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
  runId: "run-11a",
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

function main(): void {
  console.log(`[${PHASE}] Ava Work Manager certification`)

  assert.equal(GROWTH_WORK_MANAGER_QA_MARKER, "ge-aios-11a-work-manager-v1")

  const managerFiles = [
    "lib/growth/work-manager/index.ts",
    "lib/growth/work-manager/types.ts",
    "lib/growth/work-manager/context/build-work-context.ts",
    "lib/growth/work-manager/planner/build-daily-work-plan.ts",
    "lib/growth/work-manager/scheduler/prioritize-work-items.ts",
    "lib/growth/work-manager/manager/run-work-manager.ts",
    "lib/growth/work-manager/bridges/decision-engine-bridge.ts",
    "lib/growth/work-manager/bridges/narrative-bridge.ts",
  ]
  for (const file of managerFiles) {
    assert.ok(fs.existsSync(path.join(process.cwd(), file)), `${file} must exist`)
  }

  const input = {
    workspaceSummary: workspaceSummaryFixture(),
    waitingOnYou: [
      { id: "w1", label: "Approve outreach draft for ABC Medical", detail: "Ready", href: "/growth/leads/1", severity: 3 },
      { id: "w2", label: "Approve outreach draft for XYZ Equipment", detail: "Ready", href: "/growth/leads/2", severity: 2 },
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

  const resultA = runWorkManager(input)
  const resultB = runWorkManager(input)

  assert.deepEqual(
    resultA.work_plan.map((row) => row.work_item_id),
    resultB.work_plan.map((row) => row.work_item_id),
    "Work plan must be deterministic",
  )
  assert.ok(resultA.work_plan.length >= 3)
  assert.ok(resultA.operator_queue.length >= 2)
  assert.ok(resultA.active_work)

  const blockedItem = {
    id: "work:blocked-test",
    type: "outreach" as const,
    title: "Prepare outreach — Blocked Co",
    description: null,
    status: "planned" as const,
    priority: 70,
    source: "decision_engine" as const,
    created_at: input.generatedAt,
    updated_at: input.generatedAt,
    estimated_minutes: 20,
    estimated_revenue_impact: 80,
    requires_operator: false,
    can_execute_autonomously: false,
    depends_on: [],
    blocked_by: ["operator_approval"],
    next_action: null,
    decision_score: 70,
    confidence: 80,
    href: null,
    company_name: "Blocked Co",
    decision_source_id: "blocked-test",
  }

  const readyItem = {
    ...blockedItem,
    id: "work:ready-test",
    title: "Research company — Ready Co",
    type: "research" as const,
    blocked_by: [],
    requires_operator: false,
    can_execute_autonomously: true,
    decision_score: 65,
    decision_source_id: "ready-test",
  }

  const planWithBlocked = buildDailyWorkPlan({
    workItems: [blockedItem, readyItem],
    completedToday: [],
  })
  assert.ok(planWithBlocked.blocked.length >= 1)
  assert.ok(planWithBlocked.work_plan.some((row) => row.work_item_id === readyItem.id))

  const replyItem = {
    ...readyItem,
    id: "work:reply-test",
    type: "reply" as const,
    title: "Review 2 replies",
    decision_score: 95,
    requires_operator: true,
    can_execute_autonomously: false,
    decision_source_id: "reply-test",
  }
  const researchActive = { ...readyItem, id: "work:active", decision_score: 60 }
  const interruptions = detectWorkInterruptions([replyItem, researchActive], researchActive)
  assert.ok(interruptions.length >= 1)

  const decisionResult = runDecisionEngine(input)
  const workItems = nextBestActionsToWorkItems(decisionResult.next_best_actions, input.generatedAt)
  const reprioritized = prioritizeWorkItems(workItems)
  assert.deepEqual(
    reprioritized.map((row) => row.decision_score),
    [...reprioritized].sort((a, b) => b.decision_score - a.decision_score).map((row) => row.decision_score),
  )
  assert.ok(typeof rankNextActions === "function")

  const autonomy = executeReadyWorkItems(resultA)
  assert.equal(autonomy.executed, false)
  assert.equal(autonomy.reason, "autonomy_not_enabled")

  const briefing = buildAvaDailyBriefing({
    greeting: "Good morning, Mike.",
    hour: 9,
    workspaceSummary: input.workspaceSummary,
    accomplishments: input.accomplishments,
    waitingOnYou: input.waitingOnYou,
    dailyWorkQueue: input.dailyWorkQueue,
    timeline: input.timeline,
    pendingApprovalCount: input.workspaceSummary.kpis.approvalQueueCount,
  })
  assert.equal(briefing.work_manager_qa_marker, GROWTH_WORK_MANAGER_QA_MARKER)
  assert.ok(briefing.work_manager_result)
  assert.ok(
    briefing.daily_activity_narrative?.waiting_on_you.some((line) =>
      /opportunity packages ready for your review|packages are ready for your review|waiting for (your )?approval/i.test(
        line,
      ),
    ) ||
      briefing.story_blocks.some((block) =>
        /opportunity packages ready for your review|packages are ready for your review|waiting for (your )?approval|while that's pending|right now/i.test(
          block.text,
        ),
      ),
  )

  const narrativeSource = readSource("lib/growth/ava-home/narrative/engine/build-ava-daily-briefing.ts")
  assert.match(narrativeSource, /runWorkManager/)
  assert.doesNotMatch(narrativeSource, /runDecisionEngine/)

  const hero = buildAvaHomeHero({
    greeting: "Good morning, Mike.",
    hour: 9,
    employeeStatus: { kind: "working", label: "Working", activityLabel: "working" },
    aiOsUx: baseAiOsUx({
      approveItemsCount: 2,
      waitingOnYou: input.waitingOnYou,
      dailyWorkQueue: input.dailyWorkQueue,
    }),
    researchLoopSummary: researchSummary,
    accomplishments: [],
    repliesWaiting: 2,
    workspaceSummary: workspaceSummaryFixture(),
  })
  assert.ok(hero.workManager)
  assert.ok(hero.primaryDecision)

  const dashboardSource = readSource(
    "components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx",
  )
  assert.match(dashboardSource, /GrowthHomeAvaWorkSection/)
  assert.ok(
    dashboardSource.indexOf("<GrowthHomeAvaHeroSection") <
      dashboardSource.indexOf("<GrowthHomeAvaWorkSection"),
  )
  assert.ok(
    dashboardSource.indexOf("<GrowthHomeAvaWorkSection") <
      dashboardSource.indexOf("<GrowthHomeExecutiveSnapshotSection"),
  )

  const managerSource = readSource("lib/growth/work-manager/manager/run-work-manager.ts")
  assert.match(managerSource, /runDecisionEngine/)
  assert.doesNotMatch(managerSource, /rankNextActions|scoreDecisionCandidate/)
  assert.match(managerSource, /executeReadyWorkItems/)

  console.log(`[${PHASE}] PASS — Work Manager certified (local)`)
}

main()
