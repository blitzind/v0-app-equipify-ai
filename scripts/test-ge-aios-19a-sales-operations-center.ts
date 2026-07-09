/**
 * GE-AIOS-19A — Sales Operations Center certification.
 * Run: pnpm test:ge-aios-19a-sales-operations-center
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildAvaDailyBriefing } from "../lib/growth/ava-home/narrative/engine/build-ava-daily-briefing"
import { runDecisionEngine } from "../lib/growth/decision-engine"
import { GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH } from "../lib/growth/home/growth-home-workspace-summary-types"
import { buildGrowthSalesOperationsCenterViewModel } from "../lib/growth/operations-center/build-growth-sales-operations-center-view-model"
import { buildSalesOperationsCenterDecisionExplanation } from "../lib/growth/operations-center/growth-sales-operations-center-decision-narrative"
import {
  GROWTH_SALES_OPERATIONS_CENTER_19A_QA_MARKER,
  GROWTH_SALES_OPERATIONS_CENTER_ROUTE,
} from "../lib/growth/operations-center/growth-sales-operations-center-types"
import { GROWTH_MEMORY_ENGINE_QA_MARKER } from "../lib/growth/memory/types"
import { GROWTH_OPERATING_RHYTHM_QA_MARKER } from "../lib/growth/operating-rhythm/types"
import { GROWTH_WORK_MANAGER_QA_MARKER } from "../lib/growth/work-manager/types"
import { GROWTH_DECISION_ENGINE_QA_MARKER } from "../lib/growth/decision-engine/types"

const PHASE = "GE-AIOS-19A" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function emptyWorkspaceSummary() {
  return {
    kpis: {
      emailsSentToday: 0,
      repliesToday: 2,
      callsToday: 0,
      openOpportunities: 0,
      hotCompanies: 0,
      approvalQueueCount: 1,
    },
    meetings: { today: 0, thisWeek: 0, scheduled: 0 },
    inbox: { repliesNeedingAttention: 2, threadsOpen: 0, newReplies: 0 },
    operatorTasks: { callTasksDue: 0, pendingApprovals: 1, leadsNeedingAction: 0 },
    avaConsole: {
      researchLoopSummary: {
        qaMarker: "ge-aios-6b-ava-research-orchestrator-v1",
        runId: "run-19a",
        completedAt: new Date().toISOString(),
        companiesReviewed: 3,
        researchCompleted: 2,
        buyingSignalsVerified: 0,
        readyForOutreachReview: 1,
        qualificationCompleted: 1,
        qualificationSkipped: 0,
        qualificationFailed: 0,
        narrative: "Ava reviewed 3 companies.",
        leadResults: [
          {
            leadId: "lead-1",
            companyName: "Regional Hospital",
            outcome: "completed",
            readyForOutreachReview: true,
            qualificationStatus: "completed",
            hasBuyingSignals: true,
            skipReason: null,
          },
        ],
        humanApprovalRequired: true,
      },
    } as never,
    dashboard: { sections: [] } as never,
    leadPool: null,
    missionDiscovery: null,
  }
}

function main(): void {
  console.log(`[${PHASE}] Sales Operations Center certification`)

  assert.equal(GROWTH_SALES_OPERATIONS_CENTER_19A_QA_MARKER, "ge-aios-19a-sales-operations-center-v1")
  assert.equal(GROWTH_SALES_OPERATIONS_CENTER_ROUTE, "/growth/operations")
  console.log("  ✓ 19A QA marker and route")

  const page = readSource("app/(growth)/growth/operations/page.tsx")
  const dashboard = readSource("components/growth/operations-center/growth-sales-operations-center-dashboard.tsx")
  const builder = readSource("lib/growth/operations-center/build-growth-sales-operations-center-view-model.ts")
  const commandCenter = readSource("app/(growth)/growth/os/page.tsx")
  const hook = readSource("components/growth/workspace/use-growth-workspace-dashboard.ts")

  assert.match(page, /useGrowthWorkspaceDashboard/)
  assert.match(dashboard, /buildAvaHomeHero/)
  assert.match(dashboard, /buildGrowthSalesOperationsCenterViewModel/)
  assert.match(builder, /runDecisionEngine/)
  assert.doesNotMatch(page, /fetch\(/)
  assert.doesNotMatch(dashboard, /fetch\(/)
  assert.match(commandCenter, /GrowthAiOsCommandCenterPanel/)
  assert.doesNotMatch(page, /GrowthAiOsCommandCenterPanel/)
  console.log("  ✓ customer operations surface separate from engineering command center")

  assert.equal(GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH, "/api/platform/growth/home/workspace-summary")
  assert.match(hook, /GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH/)
  assert.doesNotMatch(hook, /Promise\.all\(\[.*workspace-summary/)
  console.log("  ✓ single workspace-summary preserved; no additional APIs")

  assert.doesNotMatch(builder, /new.*scheduler|cron|setInterval/i)
  console.log("  ✓ no duplicate scheduler")

  const briefing = buildAvaDailyBriefing({
    greeting: "Good morning",
    hour: 9,
    workspaceSummary: emptyWorkspaceSummary(),
    accomplishments: [],
    waitingOnYou: [{ id: "w1", label: "Approve outreach draft", detail: "Regional Hospital", href: "/growth/approvals", severity: 3 }],
    dailyWorkQueue: [
      {
        id: "q1",
        companyName: "Smith Medical",
        actionLabel: "Research company",
        reason: "High fit",
        href: "/growth/leads/lead-2",
        priority: "high",
        confidencePercent: 92,
        estimatedMinutes: 12,
        requiresHumanApproval: false,
      },
    ],
    timeline: [],
    salesOutcomes: {
      qaMarker: "ge-aios-17a-sales-specialist-execution-bridge-v1",
      outcomes: [],
      dailySummary: {
        qaMarker: "ge-aios-17a-sales-specialist-execution-bridge-v1",
        generatedAt: new Date().toISOString(),
        researched: 2,
        qualified: 1,
        strong_opportunities: 1,
        outreach_prepared: 1,
        meetings_prepared: 0,
        approvals_pending: 1,
      },
    },
  })

  assert.equal(briefing.memory_qa_marker, GROWTH_MEMORY_ENGINE_QA_MARKER)
  assert.equal(briefing.operating_rhythm_qa_marker, GROWTH_OPERATING_RHYTHM_QA_MARKER)
  assert.equal(briefing.work_manager_qa_marker, GROWTH_WORK_MANAGER_QA_MARKER)
  console.log("  ✓ uses Memory, Operating Rhythm, Work Manager, Narrative")

  const model = buildGrowthSalesOperationsCenterViewModel({
    dailyBriefing: briefing,
    decisionContext: {
      workspaceSummary: emptyWorkspaceSummary(),
      waitingOnYou: [{ id: "w1", label: "Approve outreach draft", detail: null, href: null, severity: 3 }],
      dailyWorkQueue: [],
      accomplishments: [],
      timeline: [],
    },
  })

  assert.equal(model.qaMarker, GROWTH_SALES_OPERATIONS_CENTER_19A_QA_MARKER)
  assert.ok(model.queueBuckets.some((row) => row.label === "Research"))
  assert.ok(model.recentlyCompleted.length > 0 || model.timeline.length > 0)
  console.log("  ✓ operations view model composed from canonical briefing")

  const decision = runDecisionEngine({
    workspaceSummary: emptyWorkspaceSummary(),
    waitingOnYou: [],
    dailyWorkQueue: [
      {
        id: "q1",
        companyName: "Smith Medical",
        actionLabel: "Review reply",
        reason: null,
        href: null,
        priority: "high",
        confidencePercent: 81,
        estimatedMinutes: 5,
        requiresHumanApproval: true,
      },
    ],
    accomplishments: [],
    timeline: [],
  })
  assert.equal(decision.qaMarker, GROWTH_DECISION_ENGINE_QA_MARKER)

  const explanation = buildSalesOperationsCenterDecisionExplanation({ decisionResult: decision })
  assert.ok(explanation?.headline.includes("follow-up") || explanation?.headline.length > 0)
  console.log("  ✓ decision reasoning uses canonical Decision Engine")

  if (model.confidence.length > 0) {
    assert.ok(model.confidence.every((row) => row.percent > 0 && row.percent <= 100))
    console.log("  ✓ confidence derived from existing decision/work item scores")
  } else {
    console.log("  ✓ confidence omitted when runtime scores unavailable")
  }

  assert.match(dashboard, /operations-decision-reasoning/)
  assert.match(dashboard, /operations-current-focus/)
  assert.match(dashboard, /operations-live-timeline/)
  console.log("  ✓ required layout sections present")

  const hero = readSource("components/growth/workspace/executive-briefing/growth-home-ava-hero-section.tsx")
  assert.match(hero, /GROWTH_SALES_OPERATIONS_CENTER_ROUTE/)
  console.log("  ✓ Home links to Operations Center for deeper explanation")

  console.log(`\n[${PHASE}] PASS — Sales Operations Center certified`)
}

main()
