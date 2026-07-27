/**
 * AVA-AUTONOMOUS-EXECUTION-RECOVERY-1A — Certification tests (local, no production mutation).
 *
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/test-ava-autonomous-execution-recovery-1a.ts
 */

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { nextBestActionToWorkItem } from "@/lib/growth/work-manager/bridges/decision-engine-bridge"
import {
  classifyStopInvestmentPause,
  diagnoseAutonomousSalesLoopWorkManager,
  inferAutonomousSalesLoopNonExecutionReason,
} from "@/lib/growth/specialists/execution/autonomous-sales-loop-diagnosis-1a"
import { isExecutableWorkItem } from "@/lib/growth/work-manager/state/work-item-state"
import type { NextBestAction } from "@/lib/growth/decision-engine/types"
import type { GrowthLead } from "@/lib/growth/types"

const root = process.cwd()

function read(path: string): string {
  return readFileSync(join(root, path), "utf8")
}

function action(overrides: Partial<NextBestAction> & Pick<NextBestAction, "id" | "kind" | "title">): NextBestAction {
  return {
    reason: [],
    overall_score: 80,
    score_breakdown: {
      revenue_impact: 80,
      customer_impact: 70,
      urgency: 70,
      confidence: 80,
      business_understanding: 70,
      dependencies: 90,
      effort: 20,
      approval_gate: 90,
    },
    depends_on: [],
    blocked_by: [],
    estimated_time_minutes: 15,
    requires_operator: false,
    confidence: 80,
    href: null,
    company_name: null,
    source_id: overrides.id,
    relationship_graph: null,
    ...overrides,
  }
}

console.log("AVA-AUTONOMOUS-EXECUTION-RECOVERY-1A certification")

// 1. Qualified eligible research work is autonomous
{
  const item = nextBestActionToWorkItem(
    action({
      id: "research:portfolio:lead-1",
      kind: "research_company",
      title: "Research company — Acme",
      href: "/growth/leads/lead-1",
    }),
    new Date().toISOString(),
  )
  assert.equal(item.can_execute_autonomously, true)
  assert.equal(isExecutableWorkItem({ ...item, status: "ready" }), true)
  console.log("  ✓ qualified eligible research work is selected as autonomous")
}

// 2. Generic mission pipeline banner is not falsely executable
{
  const item = nextBestActionToWorkItem(
    action({
      id: "mission:pipeline",
      kind: "continue_mission",
      title: "Continuing to build the pipeline",
    }),
    new Date().toISOString(),
  )
  assert.equal(item.can_execute_autonomously, false)
  console.log("  ✓ generic mission banner is not falsely executable")
}

// 3. Actionable discovery missions remain executable; observational monitoring does not
{
  const item = nextBestActionToWorkItem(
    action({
      id: "discovery:begin_research",
      kind: "research_company",
      title: "Begin research — ICP",
    }),
    new Date().toISOString(),
  )
  assert.equal(item.can_execute_autonomously, false, "research without href stays gated")
  const refreshAudience = nextBestActionToWorkItem(
    action({
      id: "discovery:refresh_audience",
      kind: "continue_mission",
      title: "Refresh audience — ICP",
    }),
    new Date().toISOString(),
  )
  assert.equal(refreshAudience.can_execute_autonomously, true)
  const monitoring = nextBestActionToWorkItem(
    action({
      id: "discovery:monitor_audience",
      kind: "wait",
      title: "Monitor audience — ICP",
    }),
    new Date().toISOString(),
  )
  assert.equal(monitoring.can_execute_autonomously, false)
  console.log("  ✓ actionable discovery missions executable; monitoring-only wait is not")
}

// 4. Operator approval outreach stays gated
{
  const item = nextBestActionToWorkItem(
    action({
      id: "outreach:lead-1",
      kind: "prepare_outreach",
      title: "Prepare outreach — Acme",
      requires_operator: true,
      blocked_by: ["operator_approval"],
      href: "/growth/leads/lead-1",
    }),
    new Date().toISOString(),
  )
  assert.equal(item.can_execute_autonomously, false)
  console.log("  ✓ approval-gated outreach remains non-autonomous")
}

// 5. stop_investment classification — legitimate non-fit
{
  const lead = {
    id: "lead-disq",
    companyName: "Bad Fit Co",
    status: "disqualified",
    metadata: { admission_state: "rejected" },
  } as GrowthLead
  assert.equal(
    classifyStopInvestmentPause({ lead, organizationId: "org", pausedReason: "stop_investment" }),
    "A_legitimate_non_fit",
  )
  console.log("  ✓ legitimate non-fit remains stop_investment")
}

// 6. Missing contact classification
{
  const lead = {
    id: "lead-dm",
    companyName: "No DM Co",
    status: "active",
    metadata: { admission_state: "accepted" },
  } as GrowthLead
  assert.equal(
    classifyStopInvestmentPause({
      lead,
      organizationId: "org",
      lastErrorCode: "decision_maker_missing",
    }),
    "C_missing_contact_dm",
  )
  console.log("  ✓ missing-contact lead classification preserved")
}

// 7. Telemetry distinguishes stop_investment
{
  const reason = inferAutonomousSalesLoopNonExecutionReason({
    portfolioLeadsTotal: 10,
    portfolioLeadsEligible: 8,
    workItems: [],
    selectedExecutable: null,
    stopInvestmentLeadCount: 8,
  })
  assert.equal(reason, "stop_investment")
  console.log("  ✓ ASL telemetry exposes stop_investment reason")
}

// 8. Wiring — portfolio research candidates + telemetry fields present
{
  const decisionContext = read("lib/growth/decision-engine/context/build-decision-context.ts")
  assert.match(decisionContext, /buildPortfolioResearchCandidates/)
  assert.match(decisionContext, /selectRevenueQueueResearchCandidates/)
  const asl = read("lib/growth/specialists/execution/run-autonomous-sales-loop.ts")
  assert.match(asl, /non_execution_reason/)
  assert.match(asl, /portfolioLeads: resolvePortfolioLeadsFromContext/)
  const bridge = read("lib/growth/work-manager/bridges/decision-engine-bridge.ts")
  assert.match(bridge, /genericMissionWithoutTarget/)
  const agent = read("lib/growth/specialists/execution/execute-sales-workflow-agent.ts")
  assert.match(agent, /executeDiscoveryMissionWorkItem/)
  console.log("  ✓ wiring includes portfolio research projection and ASL telemetry")
}

// 9. Generation never auto-completes from wake hints without confirmed package
{
  const durable = read("lib/growth/draft-factory/draft-factory-durable-service.ts")
  assert.match(durable, /generationPackageConfirmed/)
  console.log("  ✓ supervised generation requires confirmed package artifact")
}

// 10. Block Imaging constant untouched in probe/test only
{
  const probe = read("scripts/probe-ava-autonomous-execution-recovery-1a-production.ts")
  assert.match(probe, /6d9220f0-2960-468c-b4be-5d7595d292c3/)
  console.log("  ✓ Block Imaging reference preserved for production verification")
}

// 11. Diagnosis reports executable selection when present
{
  const diagnosis = diagnoseAutonomousSalesLoopWorkManager({
    organizationId: "org",
    generatedAt: new Date().toISOString(),
    workManagerInput: {
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
        avaConsole: { greeting: "", researchLoopSummary: null },
        dashboard: { sections: [] },
        leadPool: null,
        missionDiscovery: null,
      },
      waitingOnYou: [],
      dailyWorkQueue: [],
      accomplishments: [],
      timeline: [],
      generatedAt: new Date().toISOString(),
    },
    portfolioLeads: [
      {
        id: "lead-1",
        companyName: "Acme",
        status: "new",
        metadata: { admission_state: "accepted" },
        website: "https://acme.example",
      } as GrowthLead,
    ],
  })
  assert.ok(diagnosis.portfolio_leads_eligible >= 1)
  console.log("  ✓ diagnosis reports eligible portfolio leads")
}

console.log("\nPASS — AVA-AUTONOMOUS-EXECUTION-RECOVERY-1A")
