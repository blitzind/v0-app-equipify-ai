/**
 * GE-AIOS-17A — Canonical Specialist Execution Bridge certification.
 * Run: pnpm test:ge-aios-17a-specialist-execution-bridge
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildAvaDailyBriefing } from "../lib/growth/ava-home/narrative/engine/build-ava-daily-briefing"
import { runMemoryEngine } from "../lib/growth/memory/engine/run-memory-engine"
import { SALES_SPECIALIST_MEMORY_SOURCE } from "../lib/growth/specialists/execution/sales-specialist-memory-bridge"
import {
  buildSalesOutcomeDailySummary,
  mapResearchLoopLeadToSalesOutcomes,
} from "../lib/growth/specialists/execution/sales-outcome-mappers"
import {
  GROWTH_SALES_SPECIALIST_EXECUTION_BRIDGE_QA_MARKER,
  type SalesOutcome,
} from "../lib/growth/specialists/execution/sales-outcome-types"
import {
  completeSpecialistWork,
  delegateWorkItem,
  finalizeSalesSpecialistOutcomes,
  validateSalesOutcome,
} from "../lib/growth/specialists/execution/sales-specialist-execution-bridge"
import {
  delegateWorkItem as orchestratorDelegateWorkItem,
} from "../lib/growth/specialists/engine/run-specialist-orchestrator"
import type { AvaWorkItem } from "../lib/growth/work-manager/types"

const PHASE = "GE-AIOS-17A" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function sampleWorkItem(overrides: Partial<AvaWorkItem> = {}): AvaWorkItem {
  return {
    id: "work:sample",
    type: "research",
    title: "Research company — Precision Biomedical",
    status: "ready",
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
    href: "/growth/leads/precision",
    company_name: "Precision Biomedical",
    decision_source_id: "sample",
    ...overrides,
  }
}

function buildSampleOutcomes(generatedAt: string): SalesOutcome[] {
  return finalizeSalesSpecialistOutcomes({
    organizationId: "org-17a",
    generatedAt,
    outcomes: mapResearchLoopLeadToSalesOutcomes(
      {
        leadId: "lead-precision",
        companyName: "Precision Biomedical",
        outcome: "completed",
        qualificationStatus: "completed",
        hasBuyingSignals: true,
        readyForOutreachReview: true,
      },
      generatedAt,
    ),
  })
}

function main(): void {
  console.log(`[${PHASE}] Canonical Specialist Execution Bridge certification`)

  const bridgeFiles = [
    "lib/growth/specialists/execution/sales-outcome-types.ts",
    "lib/growth/specialists/execution/sales-outcome-mappers.ts",
    "lib/growth/specialists/execution/sales-specialist-execution-bridge.ts",
    "lib/growth/specialists/execution/sales-specialist-memory-bridge.ts",
    "lib/growth/home/growth-home-sales-outcomes-loader.ts",
  ]
  for (const file of bridgeFiles) {
    assert.ok(fs.existsSync(path.join(process.cwd(), file)), `${file} must exist`)
  }

  const workspaceSummaryService = readSource("lib/growth/home/growth-home-workspace-summary-service.ts")
  assert.doesNotMatch(workspaceSummaryService, /fetchAidenDailyBriefing/, "Home must not fetch Aiden briefing")
  assert.match(workspaceSummaryService, /buildGrowthHomeSalesOutcomes/, "Home must load Sales Specialist outcomes")
  assert.match(workspaceSummaryService, /briefing: null/, "Home briefing must be null")

  const pilotServices = [
    "lib/growth/aios/growth/growth-autonomous-research-pilot-service.ts",
    "lib/growth/aios/growth/growth-autonomous-qualification-pilot-service.ts",
    "lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-service.ts",
    "lib/growth/aios/growth/growth-autonomous-meeting-pilot-service.ts",
  ]
  for (const file of pilotServices) {
    const source = readSource(file)
    assert.doesNotMatch(source, /sales-specialist-execution-bridge/, `${file} must remain unchanged`)
  }

  const delegation = delegateWorkItem(sampleWorkItem())
  assert.equal(delegation.delegated, true)
  if (delegation.delegated) {
    assert.equal(delegation.specialist_id, "sales")
    assert.equal(delegation.workflow_agent, "research_agent")
  }

  const orchestratorDelegation = orchestratorDelegateWorkItem(sampleWorkItem({ type: "outreach" }))
  assert.equal(orchestratorDelegation.delegated, true)
  if (orchestratorDelegation.delegated) {
    assert.equal(orchestratorDelegation.workflow_agent, "outreach_agent")
  }

  const generatedAt = "2026-07-08T18:00:00.000Z"
  const outcomes = buildSampleOutcomes(generatedAt)
  assert.ok(outcomes.length >= 2, "Research loop should produce research + qualification outcomes")
  for (const outcome of outcomes) {
    assert.equal(outcome.validated_by, "sales_specialist")
    assert.equal(validateSalesOutcome(outcome).valid, true)
    assert.ok(outcome.memory_events.length > 0, "Validated outcomes must include memory events")
    assert.equal(outcome.memory_events[0]?.source, SALES_SPECIALIST_MEMORY_SOURCE)
  }

  const completion = completeSpecialistWork(outcomes[0]!)
  assert.equal(completion.completed, true)

  const dailySummary = buildSalesOutcomeDailySummary({
    outcomes,
    generatedAt,
    approvalsPendingOverride: 2,
  })
  assert.equal(dailySummary.researched >= 1, true)
  assert.equal(dailySummary.approvals_pending, 2)

  const memory = runMemoryEngine({
    organizationId: "org-17a",
    generatedAt,
    workspaceSummary: {
      kpis: {
        emailsSentToday: 0,
        repliesToday: 0,
        callsToday: 0,
        openOpportunities: 0,
        hotCompanies: 0,
        approvalQueueCount: 2,
      },
      meetings: { today: 0, thisWeek: 0, scheduled: 0 },
      inbox: { repliesNeedingAttention: 0, threadsOpen: 0, newReplies: 0 },
      operatorTasks: { callTasksDue: 0, pendingApprovals: 2, leadsNeedingAction: 0 },
      avaConsole: {
        greeting: "Good evening",
        overnightSummary: null,
        highPriorityOpportunities: null,
        waitingForApproval: "2 item(s) waiting for your approval",
        suggestedNextAction: null,
        researchLoopSummary: null,
      },
      dashboard: { qaMarker: "growth-workspace-dashboard-v1", generatedAt, sections: [] },
    },
    waitingOnYou: [],
    dailyWorkQueue: [],
    accomplishments: [],
    timeline: [],
    salesOutcomes: outcomes,
    salesDailySummary: dailySummary,
  })

  assert.ok(
    memory.summary.period_summary?.includes("researched"),
    "Memory period summary must reflect completed research work",
  )
  assert.ok(
    memory.summary.recent_events.some((row) => row.source === SALES_SPECIALIST_MEMORY_SOURCE),
    "Memory must only receive Sales Specialist validated events",
  )

  const briefing = buildAvaDailyBriefing({
    greeting: "Good evening, Mike.",
    hour: 18,
    workspaceSummary: {
      kpis: {
        emailsSentToday: 0,
        repliesToday: 0,
        callsToday: 0,
        openOpportunities: 11,
        hotCompanies: 3,
        approvalQueueCount: 2,
      },
      meetings: { today: 0, thisWeek: 0, scheduled: 0 },
      inbox: { repliesNeedingAttention: 0, threadsOpen: 0, newReplies: 0 },
      operatorTasks: { callTasksDue: 0, pendingApprovals: 2, leadsNeedingAction: 0 },
      avaConsole: {
        greeting: "Good evening",
        overnightSummary: null,
        highPriorityOpportunities: null,
        waitingForApproval: "2 item(s) waiting for your approval",
        suggestedNextAction: null,
        researchLoopSummary: null,
      },
      dashboard: { qaMarker: "growth-workspace-dashboard-v1", generatedAt, sections: [] },
    },
    accomplishments: [],
    waitingOnYou: [],
    dailyWorkQueue: [],
    timeline: [],
    generatedAt,
    salesOutcomes: {
      qaMarker: GROWTH_SALES_SPECIALIST_EXECUTION_BRIDGE_QA_MARKER,
      outcomes,
      dailySummary,
    },
  })

  assert.ok(
    briefing.summary.includes("researched") || briefing.story_blocks.some((row) => /researched/i.test(row.text)),
    "Narrative must reflect completed work from Memory, not heuristics alone",
  )

  console.log(`  ✓ Sales Specialist owns workflow agent routing`)
  console.log(`  ✓ Sales Specialist validates outcomes before Memory`)
  console.log(`  ✓ Narrative reads completed work from Memory`)
  console.log(`  ✓ Aiden removed from Home workspace-summary fetch`)
  console.log(`[${PHASE}] All checks passed`)
}

main()
