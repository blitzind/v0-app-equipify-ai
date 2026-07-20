/**
 * GE-AIOS-LIVE-3A — Home mission projection certification (local).
 *
 * Run:
 *   pnpm test:ge-aios-live-3a-home-mission-projection
 */
import assert from "node:assert/strict"
import { projectCanonicalOperatorProgress } from "../lib/growth/aios/operator-experience/growth-canonical-operator-progress-1a"
import { projectSupervisedSalesProgressNarrative } from "../lib/growth/aios/operator-experience/growth-supervised-sales-progress-narrative-1b"
import { buildNarrativeIntelligenceOpeningLine } from "../lib/growth/ava-home/narrative/engine/growth-home-narrative-intelligence-18f"
import { buildAvaDailyActivityNarrative } from "../lib/growth/ava-home/narrative/engine/build-ava-daily-activity-narrative"
import {
  GROWTH_AUTONOMOUS_LEAD_DISCOVERY_18G_QA_MARKER,
  resolveHomeOperatorEmployeeStatusFromMission,
} from "../lib/growth/mission-center/growth-autonomous-lead-discovery-18g"
import type { GrowthHomeMissionDiscoverySnapshot } from "../lib/growth/mission-center/growth-home-mission-discovery-snapshot"
import { GROWTH_OPERATING_RHYTHM_QA_MARKER } from "../lib/growth/operating-rhythm/types"
import { GROWTH_WORK_MANAGER_QA_MARKER } from "../lib/growth/work-manager/types"
import { emptyCanonicalOperatorApprovalSnapshot } from "../lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a"
import { synthesizeGrowthHomeExecutiveBriefing } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer"
import { buildGrowthHomeExecutiveBriefingCertDashboard } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer"
import { buildAvaHomeHero } from "../lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a"

const PHASE = "GE-AIOS-LIVE-3A" as const

function emptyWorkManager() {
  return {
    qaMarker: GROWTH_WORK_MANAGER_QA_MARKER,
    active_work: null,
    work_plan: [],
    operator_queue: [],
    blocked: [],
    completed_today: [],
    deferred: [],
    interruptions: [],
    all_work_items: [],
  }
}

function emptyRhythm() {
  return {
    qaMarker: GROWTH_OPERATING_RHYTHM_QA_MARKER,
    current_phase: "research_cycle" as const,
    completed_phases: [],
    next_phase: null,
    active_cycle: null,
    today_plan: [],
    phase_timeline: [],
    interruptions: [],
    waiting_on_operator: [],
    end_of_day_summary: null,
  }
}

function productionFindingLeadsMission(): GrowthHomeMissionDiscoverySnapshot {
  return {
    qaMarker: "ge-aios-18g-mission-discovery-snapshot-v1",
    missionId: "91eecd92-b6c4-4c3e-8fb3-eefc499e9cf6",
    lifecycleState: "finding_leads",
    activityLabel: "Finding leads",
    counters: {
      draftsPrepared: 0,
      recordsImported: 0,
      pendingApprovals: 0,
      researchingCount: 0,
      newCompaniesFound: 0,
    },
    searchSummary: "Equipify supported service verticals audience",
    audienceName: "Equipify supported service verticals audience",
    recordsImported: 0,
    newCompaniesFound: 0,
    leadPoolVisible: 0,
    leadPoolHasMore: false,
    pipelineLow: true,
    lastEventSummary: "Monitoring Datamoon audience.",
    discoveryAction: "run_prospect_search",
    startupDiscoveryReady: true,
  }
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Home mission projection certification`)
  assert.equal(GROWTH_AUTONOMOUS_LEAD_DISCOVERY_18G_QA_MARKER.length > 0, true)

  const missionDiscovery = productionFindingLeadsMission()

  const missionStatus = resolveHomeOperatorEmployeeStatusFromMission({
    missionDiscovery,
    pendingApprovalCount: 0,
    portfolioBelowTarget: true,
  })
  assert.equal(missionStatus?.label, "Finding Leads")
  assert.notEqual(missionStatus?.kind, "idle")
  console.log("  ✓ Mission lifecycle drives hero employee status")

  const dashboard = buildGrowthHomeExecutiveBriefingCertDashboard()
  const missionBriefing = synthesizeGrowthHomeExecutiveBriefing({
    dashboard,
    missionDiscovery,
    portfolioBelowTarget: true,
    canonicalOperatorApproval: emptyCanonicalOperatorApprovalSnapshot(),
  })
  assert.equal(missionBriefing.employeeStatus.label, "Finding Leads")
  assert.notEqual(missionBriefing.employeeStatus.kind, "idle")
  console.log("  ✓ Executive briefing employee status prefers mission over dashboard idle")

  const narrative = buildAvaDailyActivityNarrative({
    memorySummary: null,
    workResult: emptyWorkManager(),
    operatingRhythm: emptyRhythm(),
    hour: 10,
    missionDiscovery,
  })
  assert.equal(narrative.focus, "discovery")
  assert.ok(narrative.working_now.length > 0)
  assert.doesNotMatch(narrative.working_now.join(" "), /getting oriented/i)
  console.log("  ✓ Daily activity narrative surfaces finding-leads work")

  const opening = buildNarrativeIntelligenceOpeningLine({
    focus: narrative.focus,
    discoveryTarget: missionDiscovery.audienceName,
  })
  assert.match(opening, /building your pipeline/i)
  assert.doesNotMatch(opening, /getting oriented/i)
  console.log("  ✓ Opening line uses discovery narrative when mission is active")

  const supervised = projectSupervisedSalesProgressNarrative({ missionDiscovery })
  assert.equal(supervised.primaryStage, "discovering")
  assert.doesNotMatch(supervised.headline, /Nothing needs your attention/i)
  console.log("  ✓ Supervised sales progress prefers discovering over idle copy")

  const progress = projectCanonicalOperatorProgress({
    missionDiscovery,
    portfolioTargetCurrent: 2,
    portfolioTargetGoal: 100,
  })
  assert.ok(progress.items.length > 0)
  assert.doesNotMatch(progress.items[0]?.label ?? "", /Nothing needs your attention/i)
  console.log("  ✓ Progress projection includes mission work when queue is empty")

  const hero = buildAvaHomeHero({
    greeting: "Good morning",
    hour: 10,
    employeeStatus: missionBriefing.employeeStatus,
    aiOsUx: missionBriefing.aiOsUx,
    researchLoopSummary: null,
    accomplishments: [],
    repliesWaiting: 0,
    workspaceSummary: {
      kpis: [],
      meetings: { thisWeek: 0, nextMeetingLabel: null },
      inbox: { newReplies: 0, positiveInterest: 0 },
      operatorTasks: { leadsNeedingAction: 0 },
      avaConsole: {
        greeting: "Good morning",
        overnightSummary: null,
        highPriorityOpportunities: null,
        waitingForApproval: null,
        suggestedNextAction: null,
        researchLoopSummary: null,
      },
      dashboard,
      relationshipSnapshots: { byLeadId: {}, meta: { enriched: 0, degraded: false } },
      leadPool: null,
      missionDiscovery,
      portfolioLeads: [],
      eligibleLeadCount: 0,
      businessObjectiveLeadership: null,
    },
  })
  assert.equal(hero.statusLabel, "Finding Leads")
  assert.notEqual(hero.statusKind, "idle")
  assert.equal(hero.supervisedSalesProgress?.primaryStage, "discovering")
  console.log("  ✓ Home hero projection reflects active production mission")

  const trueIdleStatus = resolveHomeOperatorEmployeeStatusFromMission({
    missionDiscovery: null,
    pendingApprovalCount: 0,
    portfolioBelowTarget: false,
  })
  assert.equal(trueIdleStatus, null)
  console.log("  ✓ True idle remains available when no mission work exists")

  console.log(`[${PHASE}] PASS`)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
