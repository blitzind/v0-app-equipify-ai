/**
 * GE-AIOS-HOME-RUNTIME-AUTHORITY-1B — deterministic runtime authority precedence tests.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { projectCanonicalOperatorProgress } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-progress-1a"
import type { GrowthCanonicalOperatorFocus } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-focus-1a-types"
import { GROWTH_HOME_MISSION_DISCOVERY_SNAPSHOT_18G_QA_MARKER } from "@/lib/growth/mission-center/growth-home-mission-discovery-snapshot"
import type { GrowthHomeMissionDiscoverySnapshot } from "@/lib/growth/mission-center/growth-home-mission-discovery-snapshot"
import { GROWTH_MISSION_PURPOSE_1A_QA_MARKER } from "@/lib/growth/mission-purpose/growth-mission-purpose-1a-types"
import type { GrowthProductionMissionAuthority } from "@/lib/growth/mission-purpose/growth-mission-purpose-1a-types"
import { GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types"
import type { GrowthPortfolioManagerOperatorProjection } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types"
import { buildGrowthHomeRuntimeTrustViewModel } from "@/lib/growth/home/growth-home-runtime-trust-presenter-1b"
import {
  resolveOperatorFocusPresentation,
  resolveRuntimeExecutionPresentation,
} from "@/lib/growth/home/growth-home-runtime-execution-presentation-1b"
import { GROWTH_HOME_RUNTIME_TRUST_1B_QA_MARKER } from "@/lib/growth/home/growth-home-runtime-trust-types-1b"
import { GROWTH_AVA_ACTIVATION_1C_QA_MARKER } from "@/lib/growth/ava-activation/growth-ava-activation-types-1c"
import { emptyCanonicalOperatorApprovalSnapshot } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a"
import { resolveCanonicalApprovalQueueCount } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a"
import {
  buildGrowthHomeExecutiveBriefingCertDashboard,
  synthesizeGrowthHomeExecutiveBriefing,
} from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer"
import { filterProductionCanonicalOperatorTask } from "@/lib/growth/mission-purpose/growth-mission-purpose-operator-filter-1a"
import type { GrowthMissionPurposeResolution } from "@/lib/growth/mission-purpose/growth-mission-purpose-1a-types"
import type { GrowthCanonicalOperatorTask } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a-types"
import type { AvaWorkItem } from "@/lib/growth/work-manager/types"

const PHASE = "GE-AIOS-HOME-RUNTIME-AUTHORITY-1B"

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8")
}

function workItem(partial: Partial<AvaWorkItem> & Pick<AvaWorkItem, "id" | "type" | "title">): AvaWorkItem {
  return {
    description: null,
    status: "working",
    priority: 80,
    source: "decision_engine",
    created_at: "2026-07-22T12:00:00.000Z",
    updated_at: "2026-07-22T12:00:00.000Z",
    estimated_minutes: 15,
    estimated_revenue_impact: null,
    requires_operator: false,
    can_execute_autonomously: true,
    depends_on: [],
    blocked_by: [],
    next_action: null,
    decision_score: 80,
    confidence: 0.8,
    href: "/growth/leads/test",
    company_name: "ABC Mechanical",
    decision_source_id: "decision:test",
    ...partial,
  }
}

function operatorFocus(companyName: string): GrowthCanonicalOperatorFocus {
  return {
    qaMarker: "ge-aios-operator-story-implementation-1a-v1",
    leadId: "lead-focus",
    companyName,
    source: "revenue_queue",
    title: `Open ${companyName}`,
    detail: null,
    href: `/growth/leads/lead-focus`,
    priorityRank: 4,
  }
}

function missionDiscovery(
  partial: Partial<GrowthHomeMissionDiscoverySnapshot>,
): GrowthHomeMissionDiscoverySnapshot {
  return {
    qaMarker: GROWTH_HOME_MISSION_DISCOVERY_SNAPSHOT_18G_QA_MARKER,
    missionId: "mission-1",
    lifecycleState: "finding_leads",
    activityLabel: "Running discovery",
    counters: {
      newCompaniesFound: 0,
      recordsImported: 0,
      researchingCount: 0,
      draftsPrepared: 0,
      pendingApprovals: 0,
    },
    searchSummary: "Industrial equipment buyers",
    audienceName: "Industrial equipment buyers",
    recordsImported: 0,
    newCompaniesFound: 0,
    leadPoolVisible: 12,
    leadPoolHasMore: true,
    pipelineLow: true,
    lastEventSummary: null,
    discoveryAction: "run_prospect_search",
    startupDiscoveryReady: true,
    ...partial,
  }
}

function portfolioOperator(
  partial: Partial<GrowthPortfolioManagerOperatorProjection> = {},
): GrowthPortfolioManagerOperatorProjection {
  return {
    qaMarker: GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER,
    targetActiveCompanies: 25,
    currentActiveCompanies: 8,
    minimumHealthyCompanies: 15,
    needsCount: 17,
    healthState: "needs_replenishment",
    healthLabel: "Portfolio needs more qualified companies.",
    discoveryRunning: true,
    discoveryRunningCount: 0,
    discoveryStatusDisplay: "Running DataMoon Discovery",
    nextBatchSize: 25,
    showEstimatedHealthy: false,
    researchRunning: false,
    researchRunningCount: 0,
    admissionsPending: 0,
    projectedCompletionLabel: null,
    manualFindOptions: [10, 25, 50, 100],
    ...partial,
  }
}

function productionAuthority(
  partial: Partial<GrowthProductionMissionAuthority> = {},
): GrowthProductionMissionAuthority {
  return {
    qaMarker: GROWTH_MISSION_PURPOSE_1A_QA_MARKER,
    title: "Equipify Growth Mission",
    objectiveStatement: "Maintain portfolio capacity.",
    portfolioBelowTarget: true,
    discoveryActive: true,
    operatorSummaryLines: ["Portfolio is below target, so I'm actively discovering new opportunities."],
    primaryFocus: "discovery",
    ...partial,
  }
}

assert.match(
  readSource("lib/growth/home/growth-home-runtime-execution-presentation-1b.ts"),
  /export function resolveRuntimeExecutionPresentation/,
)
assert.match(readSource("lib/growth/aios/operator-experience/growth-canonical-operator-progress-1a.ts"), /resolveRuntimeExecutionPresentation/)
assert.match(readSource("lib/growth/home/growth-home-runtime-trust-presenter-1b.ts"), /resolveRuntimeExecutionPresentation/)
assert.doesNotMatch(
  readSource("lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer.ts"),
  /pendingApprovals:\s*approveItemsCount/,
)

const slussFocus = operatorFocus("Sluss Padgett")

// 0. Runtime Authority 1B wiring must not reference undefined approval count locals.
{
  const approvalSnapshot = emptyCanonicalOperatorApprovalSnapshot()
  const briefing = synthesizeGrowthHomeExecutiveBriefing({
    dashboard: buildGrowthHomeExecutiveBriefingCertDashboard(),
    missionDiscovery: missionDiscovery({ discoveryAction: "run_prospect_search" }),
    portfolioBelowTarget: true,
    portfolioTargetCurrent: 8,
    portfolioTargetGoal: 25,
    portfolioOperator: portfolioOperator(),
    productionMissionAuthority: productionAuthority(),
    canonicalOperatorApproval: approvalSnapshot,
    canonicalOperatorFocus: slussFocus,
  })
  assert.equal(
    briefing.aiOsUx.approveItemsCount,
    resolveCanonicalApprovalQueueCount(approvalSnapshot, 0),
  )
}


// 1. Portfolio discovery active
{
  const runtime = resolveRuntimeExecutionPresentation({
    pendingApprovals: 0,
    portfolioOperator: portfolioOperator(),
    missionDiscovery: missionDiscovery({ discoveryAction: "run_prospect_search" }),
    productionMissionAuthority: productionAuthority(),
  })
  assert.equal(runtime.primaryMissionLabel, "Portfolio Replenishment")
  assert.match(runtime.currentActivityLabel ?? "", /Discovery|discovery|DataMoon/i)
  assert.equal(runtime.currentLeadCompanyName, null)
  assert.equal(runtime.currentActivityScope, "portfolio")
  assert.equal(runtime.showLeadPipeline, false)

  const focus = resolveOperatorFocusPresentation({ canonicalOperatorFocus: slussFocus })
  assert.equal(focus.operatorFocusCompanyName, "Sluss Padgett")

  const vm = buildGrowthHomeRuntimeTrustViewModel({
    server: {
      qaMarker: GROWTH_HOME_RUNTIME_TRUST_1B_QA_MARKER,
      generatedAt: new Date().toISOString(),
      killSwitches: { autonomy_enabled: true, autonomy_objective_mode_enabled: true },
      autonomyTickHealth: null,
      lastSchedulerRunAt: null,
      lastSchedulerOk: null,
      nextSchedulerEstimateAt: null,
    },
    salesOutcomes: null,
    activeWork: null,
    pendingApprovals: 0,
    setupIncomplete: false,
    canonicalOperatorFocus: slussFocus,
    portfolioOperator: portfolioOperator(),
    missionDiscovery: missionDiscovery({ discoveryAction: "run_prospect_search" }),
    productionMissionAuthority: productionAuthority(),
    activation: {
      qaMarker: GROWTH_AVA_ACTIVATION_1C_QA_MARKER,
      activated: true,
      activatedAt: "2026-07-20T12:00:00.000Z",
      autonomyEnabled: true,
      objectiveModeEnabled: true,
      readiness: { qaMarker: GROWTH_AVA_ACTIVATION_1C_QA_MARKER, ready: true, blockers: [] },
      employment: null,
    },
  })
  assert.equal(vm.primaryMissionLabel, "Portfolio Replenishment")
  assert.equal(vm.currentLeadCompanyName, null)
  assert.equal(vm.operatorFocusCompanyName, "Sluss Padgett")
  assert.notEqual(vm.primaryMissionLabel, vm.operatorFocusCompanyName)
}

// 2. Lead research
{
  const active = workItem({ id: "w1", type: "research", title: "Research ABC Mechanical" })
  const runtime = resolveRuntimeExecutionPresentation({
    pendingApprovals: 0,
    activeWork: active,
    activeClaim: {
      runId: "run-1",
      leadId: "lead-abc",
      companyName: "ABC Mechanical",
      claimedAt: "2026-07-22T12:00:00.000Z",
      status: "running",
    },
  })
  assert.equal(runtime.primaryMissionLabel, "Prospect Research")
  assert.equal(runtime.currentLeadCompanyName, "ABC Mechanical")
  assert.equal(runtime.currentActivityScope, "lead")
}

// 3. Draft Factory
{
  const runtime = resolveRuntimeExecutionPresentation({
    pendingApprovals: 0,
    activeWork: workItem({ id: "w2", type: "outreach", title: "Prepare outreach package" }),
  })
  assert.equal(runtime.primaryMissionLabel, "Draft Factory")
  assert.match(runtime.currentActivityLabel ?? "", /outreach/i)
  assert.equal(runtime.currentLeadCompanyName, "ABC Mechanical")
}

// 4. Operator approval
{
  const runtime = resolveRuntimeExecutionPresentation({
    pendingApprovals: 2,
    operatorApprovalCompanyName: "ABC Mechanical",
  })
  assert.equal(runtime.primaryMissionLabel, "Operator Review")
  assert.equal(runtime.currentActivityLabel, "Waiting for approval")
  assert.equal(runtime.currentLeadCompanyName, "ABC Mechanical")
  assert.equal(runtime.nextMilestoneLabel, "Review package")
}

// 5. Idle
{
  const runtime = resolveRuntimeExecutionPresentation({
    pendingApprovals: 0,
  })
  assert.equal(runtime.precedenceRank, 7)
  assert.equal(runtime.primaryMissionKind, "idle")
  assert.equal(runtime.currentActivityScope, "idle")
}

// 6. Revenue queue fallback affects operator focus only
{
  const runtime = resolveRuntimeExecutionPresentation({
    pendingApprovals: 0,
    portfolioOperator: portfolioOperator(),
    missionDiscovery: missionDiscovery({ discoveryAction: "run_prospect_search" }),
    productionMissionAuthority: productionAuthority(),
  })
  const focus = resolveOperatorFocusPresentation({ canonicalOperatorFocus: slussFocus })
  assert.equal(focus.operatorFocusCompanyName, "Sluss Padgett")
  assert.equal(runtime.currentLeadCompanyName, null)
  assert.equal(runtime.primaryMissionLabel, "Portfolio Replenishment")

  const progress = projectCanonicalOperatorProgress({
    missionDiscovery: missionDiscovery({ discoveryAction: "run_prospect_search" }),
    portfolioOperator: portfolioOperator(),
    productionMissionAuthority: productionAuthority(),
    focusLeadId: slussFocus.leadId,
  })
  assert.match(progress.activeLabel ?? "", /Discovery|discovery|DataMoon|Running/i)
}

{
  const operatorTask = (leadId: string): GrowthCanonicalOperatorTask => ({
    id: `task:${leadId}`,
    kind: "decision",
    title: "Review lead",
    detail: "Operator task",
    why: "Certification",
    whatHappensNext: "Continue",
    confidenceLabel: null,
    href: `/growth/leads/${leadId}`,
    companyName: "Test Co",
    leadId,
    draftCount: 0,
    packageCount: 0,
  })
  const purposeResolution = (purpose: GrowthMissionPurposeResolution["purpose"]): GrowthMissionPurposeResolution => ({
    qaMarker: GROWTH_MISSION_PURPOSE_1A_QA_MARKER,
    purpose,
    source: "explicit_metadata",
    reason: "test",
  })
  const certificationMap = new Map<string, GrowthMissionPurposeResolution>([
    ["lead-cert", purposeResolution("certification")],
  ])
  assert.equal(
    filterProductionCanonicalOperatorTask({
      task: operatorTask("lead-cert"),
      purposeByLeadId: certificationMap,
    }),
    null,
  )
  assert.notEqual(
    filterProductionCanonicalOperatorTask({
      task: operatorTask("lead-production"),
      purposeByLeadId: certificationMap,
    }),
    null,
  )
  assert.notEqual(
    filterProductionCanonicalOperatorTask({
      task: operatorTask("lead-missing-purpose"),
      purposeByLeadId: new Map(),
    }),
    null,
  )
  const operatorFilterSource = readSource("lib/growth/mission-purpose/growth-mission-purpose-operator-filter-1a.ts")
  assert.match(operatorFilterSource, /input\.purposeByLeadId\.get\(input\.task\.leadId\)/)
  assert.doesNotMatch(
    operatorFilterSource,
    /filterProductionCanonicalOperatorTask[\s\S]{0,220}[^.]purposeByLeadId\.get\(input\.task\.leadId\)/,
  )
}

console.log(`${PHASE} runtime authority precedence tests passed`)
