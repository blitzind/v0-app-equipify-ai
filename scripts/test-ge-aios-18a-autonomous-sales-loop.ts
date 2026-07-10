/**
 * GE-AIOS-18A — Autonomous Sales Execution Loop certification.
 * Run: pnpm test:ge-aios-18a-autonomous-sales-loop
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildAvaDailyActivityNarrative,
  buildAvaDailyBriefing,
} from "../lib/growth/ava-home/narrative"
import { runMemoryEngine } from "../lib/growth/memory/engine/run-memory-engine"
import { continueCurrentPhase } from "../lib/growth/operating-rhythm/engine/run-operating-rhythm"
import {
  delegateWorkItem,
  finalizeSalesSpecialistOutcomes,
} from "../lib/growth/specialists/execution/sales-specialist-execution-bridge"
import {
  AUTONOMOUS_SALES_LOOP_DEFAULT_MAX_ITERATIONS,
  GROWTH_AUTONOMOUS_SALES_LOOP_QA_MARKER,
} from "../lib/growth/specialists/execution/autonomous-sales-loop-types"
import { extractLeadIdFromWorkItem } from "../lib/growth/specialists/execution/extract-lead-id-from-work-item"
import { mapResearchLoopLeadToSalesOutcomes } from "../lib/growth/specialists/execution/sales-outcome-mappers"
import { selectNextExecutableWorkItem } from "../lib/growth/specialists/execution/select-next-executable-work-item"
import {
  executeReadyWorkItems,
  runWorkManager,
} from "../lib/growth/work-manager/manager/run-work-manager"
import type { AvaWorkItem } from "../lib/growth/work-manager/types"
import { buildGrowthHomeExecutiveBriefingCertFixture, buildGrowthHomeExecutiveBriefingCertDashboard } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer"

const PHASE = "GE-AIOS-18A" as const
const LEAD_A = "11111111-1111-4111-8111-111111111111"
const LEAD_B = "22222222-2222-4222-8222-222222222222"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function sampleWorkItem(overrides: Partial<AvaWorkItem> = {}): AvaWorkItem {
  return {
    id: "work:research-1",
    type: "research",
    title: "Research company — Northstar Medical",
    description: null,
    status: "ready",
    priority: 90,
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
    decision_score: 88,
    confidence: 82,
    href: `/growth/leads/${LEAD_A}`,
    company_name: "Northstar Medical",
    decision_source_id: LEAD_A,
    ...overrides,
  }
}

function baseWorkManagerInput() {
  const fixture = buildGrowthHomeExecutiveBriefingCertFixture()
  return {
    workspaceSummary: {
      kpis: {
        emailsSentToday: 0,
        repliesToday: 1,
        callsToday: 0,
        openOpportunities: 8,
        hotCompanies: 3,
        approvalQueueCount: 1,
      },
      meetings: { today: 0, thisWeek: 0, scheduled: 0 },
      inbox: { repliesNeedingAttention: 1, threadsOpen: 1, newReplies: 1 },
      operatorTasks: { callTasksDue: 0, pendingApprovals: 1, leadsNeedingAction: 0 },
      avaConsole: {
        greeting: "Good morning",
        overnightSummary: null,
        highPriorityOpportunities: null,
        waitingForApproval: "1 item waiting for your approval",
        suggestedNextAction: "Research Northstar Medical",
        researchLoopSummary: null,
      },
      dashboard: buildGrowthHomeExecutiveBriefingCertDashboard(),
      leadPool: {
        visible_count: 42,
        has_more: true,
        degraded: false,
        relationship_snapshot_count: 10,
      },
    },
    waitingOnYou: fixture.aiOsUx.waitingOnYou,
    dailyWorkQueue: fixture.aiOsUx.dailyWorkQueue,
    accomplishments: fixture.accomplishments,
    timeline: fixture.timeline,
    generatedAt: "2026-07-08T14:00:00.000Z",
  }
}

function main(): void {
  console.log(`[${PHASE}] Autonomous Sales Execution Loop certification`)

  const loopFiles = [
    "lib/growth/specialists/execution/autonomous-sales-loop-types.ts",
    "lib/growth/specialists/execution/extract-lead-id-from-work-item.ts",
    "lib/growth/specialists/execution/execute-sales-workflow-agent.ts",
    "lib/growth/specialists/execution/run-autonomous-sales-loop.ts",
  ]
  for (const file of loopFiles) {
    assert.ok(fs.existsSync(path.join(process.cwd(), file)), `${file} must exist`)
  }

  const cronDir = path.join(process.cwd(), "app/api/cron")
  const cronRoutes = fs
    .readdirSync(cronDir)
    .filter((entry) => fs.existsSync(path.join(cronDir, entry, "route.ts")))
  assert.doesNotMatch(
    cronRoutes.join("\n"),
    /autonomous-sales|sales-loop|sales-specialist-loop/i,
    "Must not add duplicate sales loop cron route",
  )

  const schedulerSource = readSource("lib/growth/objectives/growth-objective-runtime-scheduler.ts")
  assert.match(
    schedulerSource,
    /tickAutonomousSalesLoopForScheduler/,
    "Objective runtime scheduler must tick autonomous sales loop",
  )
  assert.match(schedulerSource, /autonomousSalesLoop/, "Scheduler result must include autonomousSalesLoop")

  const workManagerSource = readSource("lib/growth/work-manager/manager/run-work-manager.ts")
  assert.match(workManagerSource, /executeReadyWorkItems/, "Work Manager must expose executeReadyWorkItems")
  assert.match(workManagerSource, /loopResult/, "executeReadyWorkItems must accept loopResult passthrough")

  const operatingRhythmSource = readSource("lib/growth/operating-rhythm/engine/run-operating-rhythm.ts")
  assert.match(operatingRhythmSource, /continueCurrentPhase/, "Operating Rhythm must expose continueCurrentPhase")
  assert.match(operatingRhythmSource, /sales_loop_executed/, "Operating Rhythm must accept sales loop result")

  const executeAgentSource = readSource("lib/growth/specialists/execution/execute-sales-workflow-agent.ts")
  assert.match(executeAgentSource, /executeGrowthLeadProspectResearch/)
  assert.doesNotMatch(executeAgentSource, /runAutonomousResearchManualRefresh/)
  assert.match(executeAgentSource, /runAutonomousQualificationManualEvaluation/)
  assert.match(executeAgentSource, /runAutonomousOutreachPreparationManualRequest/)
  assert.match(executeAgentSource, /runAutonomousMeetingPilotCycle/)
  assert.doesNotMatch(executeAgentSource, /new DecisionEngine|runDecisionEngine\(/)

  const loopSource = readSource("lib/growth/specialists/execution/run-autonomous-sales-loop.ts")
  assert.match(loopSource, /runWorkManager/)
  assert.match(loopSource, /runMemoryEngine/)
  assert.match(loopSource, /persistValidatedSalesOutcomeMemoryEvents/)
  assert.match(loopSource, /buildGrowthHomeOrganizationalKnowledge/)
  assert.match(loopSource, /delegateWorkItem/)
  assert.doesNotMatch(loopSource, /createScheduler|setInterval|node-cron/)

  const workspaceSummarySource = readSource("lib/growth/home/growth-home-workspace-summary-service.ts")
  assert.match(workspaceSummarySource, /buildGrowthHomeSalesOutcomes/)
  assert.match(workspaceSummarySource, /briefing: null/)
  assert.doesNotMatch(
    workspaceSummarySource,
    /runAutonomousSalesLoop|executeReadyWorkItems/,
    "Home workspace summary must remain read-only aggregator",
  )

  assert.equal(
    extractLeadIdFromWorkItem(sampleWorkItem()),
    LEAD_A,
    "Lead id must extract from href/decision_source_id",
  )
  assert.equal(
    extractLeadIdFromWorkItem(sampleWorkItem({ href: null, decision_source_id: "not-a-uuid" })),
    null,
    "Invalid lead ids must not be extracted",
  )

  const delegation = delegateWorkItem(sampleWorkItem())
  assert.equal(delegation.delegated, true)
  if (delegation.delegated) {
    assert.equal(delegation.workflow_agent, "research_agent")
  }

  const disabledExecution = executeReadyWorkItems(runWorkManager(baseWorkManagerInput()))
  assert.equal(disabledExecution.executed, false)
  if (!disabledExecution.executed) {
    assert.equal(disabledExecution.reason, "autonomy_not_enabled")
  }

  const enabledExecution = executeReadyWorkItems(runWorkManager(baseWorkManagerInput()), {
    loopResult: {
      executed: true,
      reason: "loop_completed",
      iterations: 2,
      outcomes_completed: 1,
      qa_marker: GROWTH_AUTONOMOUS_SALES_LOOP_QA_MARKER,
    },
  })
  assert.equal(enabledExecution.executed, true)

  const planningPhase = continueCurrentPhase()
  assert.equal(planningPhase.continued, false)
  const executedPhase = continueCurrentPhase({
    loopResult: {
      continued: true,
      reason: "sales_loop_executed",
      qa_marker: GROWTH_AUTONOMOUS_SALES_LOOP_QA_MARKER,
      iterations: 1,
      outcomes_completed: 1,
    },
  })
  assert.equal(executedPhase.continued, true)

  const generatedAt = "2026-07-08T14:30:00.000Z"
  const outcomes = finalizeSalesSpecialistOutcomes({
    organizationId: "org-18a",
    generatedAt,
    outcomes: mapResearchLoopLeadToSalesOutcomes(
      {
        leadId: LEAD_A,
        companyName: "Northstar Medical",
        outcome: "completed",
        qualificationStatus: "completed",
        hasBuyingSignals: true,
        readyForOutreachReview: true,
      },
      generatedAt,
    ),
  })
  assert.ok(outcomes.length > 0, "Sales outcomes must validate")
  assert.ok(outcomes[0]?.memory_events.length > 0, "Every completion must attach memory events")

  const baseInput = baseWorkManagerInput()
  const beforeMemory = runMemoryEngine({
    organizationId: "org-18a",
    generatedAt,
    ...baseInput,
    salesOutcomes: [],
  })
  const afterInput = {
    ...baseInput,
    workspaceSummary: {
      ...baseInput.workspaceSummary,
      inbox: { repliesNeedingAttention: 2, threadsOpen: 2, newReplies: 2 },
      kpis: {
        ...baseInput.workspaceSummary.kpis,
        repliesToday: 2,
      },
    },
    dailyWorkQueue: [
      {
        id: "queue-reply",
        companyName: "Acme Medical",
        actionLabel: "Respond to reply",
        reason: "Customer replied overnight",
        href: "/growth/leads/lead-reply",
        priority: "high",
        requiresHumanApproval: false,
        confidencePercent: 92,
      },
      ...baseInput.dailyWorkQueue,
    ],
  }

  const afterMemory = runMemoryEngine({
    organizationId: "org-18a",
    generatedAt,
    ...afterInput,
    salesOutcomes: outcomes,
  })
  assert.ok(
    (afterMemory.summary.recent_events?.length ?? 0) >= (beforeMemory.summary.recent_events?.length ?? 0),
    "Memory must update after completion",
  )

  const beforeWork = runWorkManager({
    ...baseInput,
    memorySummary: beforeMemory.summary,
  })
  const afterWork = runWorkManager({
    ...afterInput,
    memorySummary: afterMemory.summary,
  })
  assert.ok(beforeWork.all_work_items.length > 0, "Decision engine must produce work items")
  const beforePlan = beforeWork.work_plan.map((row) => row.work_item_id).join("|")
  const afterPlan = afterWork.work_plan.map((row) => row.work_item_id).join("|")
  assert.notEqual(
    beforePlan,
    afterPlan,
    "Queue must reprioritize after memory update and new reply signal",
  )

  const salesDailySummary = {
    qaMarker: "ge-aios-17a-specialist-execution-bridge-v1" as const,
    generatedAt,
    researched: 1,
    qualified: 0,
    strong_opportunities: 1,
    outreach_prepared: 0,
    meetings_prepared: 0,
    approvals_pending: 0,
  }

  const briefing = buildAvaDailyBriefing({
    greeting: "Good morning",
    hour: 9,
    organizationId: "org-18a",
    generatedAt,
    ...baseInput,
    salesOutcomes: {
      qaMarker: "ge-aios-17a-specialist-execution-bridge-v1",
      outcomes,
      dailySummary: salesDailySummary,
    },
    persistedMemoryStore: afterMemory.store,
  })
  assert.match(
    briefing.daily_activity_narrative.summary,
    /researched 1 company/i,
    "Narrative must reflect completed sales work from outcomes/memory",
  )
  assert.doesNotMatch(
    readSource("lib/growth/ava-home/narrative/engine/build-ava-daily-activity-narrative.ts"),
    /Math\.random|heuristicStory|fakeProgress/i,
    "Daily activity narrative must not use heuristics",
  )

  const narrative = buildAvaDailyActivityNarrative({
    memorySummary: afterMemory.summary,
    salesDailySummary,
    workResult: afterWork,
    operatingRhythm: briefing.operating_rhythm,
    hour: 9,
  })
  assert.ok(narrative.lines.length > 0, "Narrative lines must originate from canonical stack")

  const selectable = selectNextExecutableWorkItem(afterWork)
  assert.ok(selectable, "Autonomous loop must select highest-value executable work")
  assert.equal(selectable?.can_execute_autonomously, true)

  const secondCandidate = selectNextExecutableWorkItem({
    ...afterWork,
    active_work: sampleWorkItem({
      id: "work:qualification-1",
      type: "qualification",
      title: "Qualify company — Summit Devices",
      href: `/growth/leads/${LEAD_B}`,
      decision_source_id: LEAD_B,
      decision_score: 70,
      priority: 70,
    }),
  })
  assert.ok(secondCandidate, "Loop must continue selecting work when active item changes")

  assert.equal(AUTONOMOUS_SALES_LOOP_DEFAULT_MAX_ITERATIONS, 5)

  console.log(`[${PHASE}] PASS — Autonomous Sales Execution Loop certified`)
}

main()
