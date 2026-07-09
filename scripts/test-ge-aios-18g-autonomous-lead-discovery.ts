/**
 * GE-AIOS-18G — Autonomous Lead Discovery certification.
 * Run: pnpm test:ge-aios-18g-autonomous-lead-discovery
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildAvaDailyActivityNarrative,
  buildAvaDailyBriefing,
  buildDailyActivityWorkingNowLines,
} from "../lib/growth/ava-home/narrative"
import { buildNarrativeIntelligenceOpeningLine } from "../lib/growth/ava-home/narrative/engine/growth-home-narrative-intelligence-18f"
import {
  flattenDecisionCandidates,
  runDecisionEngine,
} from "../lib/growth/decision-engine"
import {
  GROWTH_AUTONOMOUS_LEAD_DISCOVERY_18G_QA_MARKER,
  buildLeadDiscoveryWorkingNowLine,
} from "../lib/growth/mission-center/growth-autonomous-lead-discovery-18g"
import {
  GROWTH_HOME_MISSION_DISCOVERY_SNAPSHOT_18G_QA_MARKER,
  buildGrowthHomeMissionDiscoverySnapshot,
  resolveAutonomousLeadDiscoveryAction,
} from "../lib/growth/mission-center/growth-home-mission-discovery-snapshot"
import { isMissionRuntimeOrchestrationReady } from "../lib/growth/mission-center/growth-mission-runtime-orchestration-readiness"
import {
  createDefaultMissionRuntimeState,
  GROWTH_AVA_MISSION_RUNTIME_1A_QA_MARKER,
} from "../lib/growth/mission-center/growth-mission-runtime-types"
import { GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH } from "../lib/growth/home/growth-home-workspace-summary-types"
import { GROWTH_OPERATING_RHYTHM_QA_MARKER } from "../lib/growth/operating-rhythm/types"
import { GROWTH_WORK_MANAGER_QA_MARKER } from "../lib/growth/work-manager/types"
import { GROWTH_AVA_LAUNCH_MISSION_DEFAULT_OBJECTIVE_TYPE } from "../lib/growth/workspace/executive-briefing/growth-home-launch-mission-setup-1a"
import { buildAvaHomeHero } from "../lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a"
import type { GrowthObjective } from "../lib/growth/objectives/growth-objective-types"
import type { GrowthHomeMissionDiscoverySnapshot } from "../lib/growth/mission-center/growth-home-mission-discovery-snapshot"

const PHASE = "GE-AIOS-18G" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function baseObjective(overrides: Partial<GrowthObjective> = {}): GrowthObjective {
  return {
    id: "mission-1",
    organizationId: "org-1",
    title: "Book demos",
    status: "active",
    objectiveType: GROWTH_AVA_LAUNCH_MISSION_DEFAULT_OBJECTIVE_TYPE,
    runtime: {
      running: true,
      currentStageId: "discover",
      stageStates: {
        launch: { state: "in_progress", updatedAt: new Date().toISOString() },
      },
    } as GrowthObjective["runtime"],
    executionContext: {
      qa_marker: "growth-objective-execution-context-v1",
      version: 1,
      stages: {},
      recoveredAt: null,
      missionRuntime: createDefaultMissionRuntimeState({
        approved: true,
        lifecycleState: "finding_leads",
        datamoon: {
          lastRunId: null,
          importRequestJson: '{"filters":[{"field":"industry","value":"hospitals"}]}',
          lastPollAt: null,
          lastImportedCount: 0,
          audienceName: "hospitals",
          searchSummary: "hospitals in Texas",
          keepMonitoring: true,
        },
      }),
    },
    ...overrides,
  }
}

function discoverySnapshot(overrides: Partial<GrowthHomeMissionDiscoverySnapshot> = {}): GrowthHomeMissionDiscoverySnapshot {
  return {
    qaMarker: GROWTH_HOME_MISSION_DISCOVERY_SNAPSHOT_18G_QA_MARKER,
    missionId: "mission-1",
    lifecycleState: "finding_leads",
    activityLabel: "Finding leads",
    counters: {
      newCompaniesFound: 50,
      recordsImported: 0,
      researchingCount: 0,
      draftsPrepared: 0,
      pendingApprovals: 0,
    },
    searchSummary: "hospitals in Texas",
    audienceName: "hospitals",
    recordsImported: 0,
    newCompaniesFound: 50,
    leadPoolVisible: 12,
    leadPoolHasMore: false,
    pipelineLow: true,
    lastEventSummary: "Searching Datamoon audience",
    discoveryAction: "run_prospect_search",
    startupDiscoveryReady: true,
    ...overrides,
  }
}

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

function emptyWorkspaceSummary(missionDiscovery: GrowthHomeMissionDiscoverySnapshot | null) {
  return {
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
    avaConsole: { researchLoopSummary: null } as never,
    dashboard: { sections: [] } as never,
    leadPool: {
      visible_count: 12,
      has_more: false,
      total_estimated_count: 12,
      page: 1,
      page_size: 25,
    },
    missionDiscovery,
  }
}

function main(): void {
  console.log(`[${PHASE}] Autonomous Lead Discovery certification`)

  assert.equal(GROWTH_AUTONOMOUS_LEAD_DISCOVERY_18G_QA_MARKER, "ge-aios-18g-autonomous-lead-discovery-v1")
  assert.equal(GROWTH_HOME_MISSION_DISCOVERY_SNAPSHOT_18G_QA_MARKER, "ge-aios-18g-mission-discovery-snapshot-v1")
  console.log("  ✓ 18G QA markers")

  const orchestrator = readSource("lib/growth/mission-center/growth-mission-runtime-orchestrator.ts")
  const scheduler = readSource("lib/growth/objectives/growth-objective-runtime-scheduler.ts")
  const bindService = readSource("lib/growth/mission-center/growth-mission-find-leads-binding-service.ts")
  const summaryService = readSource("lib/growth/home/growth-home-workspace-summary-service.ts")
  const decisionContext = readSource("lib/growth/decision-engine/context/build-decision-context.ts")
  const narrative = readSource("lib/growth/ava-home/narrative/engine/build-ava-daily-activity-narrative.ts")

  assert.match(orchestrator, /isMissionRuntimeOrchestrationReady/)
  assert.match(orchestrator, /orchestrateDatamoonMonitoring/)
  assert.match(orchestrator, /isFirstDiscoveryRun/)
  assert.match(scheduler, /isMissionRuntimeOrchestrationReady/)
  assert.match(bindService, /runGrowthMissionRuntimeOrchestration/)
  assert.match(summaryService, /loadGrowthHomeMissionDiscoverySnapshot/)
  assert.match(summaryService, /missionDiscovery/)
  assert.match(decisionContext, /buildLeadDiscoveryCandidates/)
  assert.match(narrative, /buildLeadDiscoveryWorkingNowLine/)
  console.log("  ✓ startup completion launches discovery via existing orchestration")

  assert.doesNotMatch(orchestrator, /new.*scheduler/i)
  assert.doesNotMatch(readSource("lib/growth/prospect-search/prospect-search-index.ts"), /duplicate/i)
  console.log("  ✓ no duplicate search engine or scheduler")

  const objective = baseObjective()
  assert.equal(isMissionRuntimeOrchestrationReady(objective), true)
  const launchIncomplete = baseObjective({
    runtime: {
      running: true,
      currentStageId: "discover",
      stageStates: { launch: { state: "in_progress", updatedAt: new Date().toISOString() } },
    } as GrowthObjective["runtime"],
    executionContext: {
      qa_marker: "growth-objective-execution-context-v1",
      version: 1,
      stages: {},
      recoveredAt: null,
      missionRuntime: createDefaultMissionRuntimeState({ approved: false }),
    },
  })
  assert.equal(isMissionRuntimeOrchestrationReady(launchIncomplete), false)
  console.log("  ✓ existing Mission reused with orchestration readiness gate")

  assert.equal(
    resolveAutonomousLeadDiscoveryAction({
      lifecycleState: "finding_leads",
      recordsImported: 0,
      newCompaniesFound: 0,
      leadPoolVisible: 0,
      leadPoolHasMore: false,
      pipelineLow: false,
      hasBoundSearch: true,
      researchingCount: 0,
      pendingApprovals: 0,
    }),
    "run_prospect_search",
  )
  assert.equal(
    resolveAutonomousLeadDiscoveryAction({
      lifecycleState: "monitoring",
      recordsImported: 40,
      newCompaniesFound: 10,
      leadPoolVisible: 20,
      leadPoolHasMore: false,
      pipelineLow: true,
      hasBoundSearch: true,
      researchingCount: 0,
      pendingApprovals: 0,
    }),
    "refresh_audience",
  )
  assert.equal(
    resolveAutonomousLeadDiscoveryAction({
      lifecycleState: "researching",
      recordsImported: 40,
      newCompaniesFound: 10,
      leadPoolVisible: 40,
      leadPoolHasMore: true,
      pipelineLow: false,
      hasBoundSearch: true,
      researchingCount: 5,
      pendingApprovals: 0,
    }),
    "begin_research",
  )
  console.log("  ✓ decision rules for discovery chain")

  const snapshot = buildGrowthHomeMissionDiscoverySnapshot({
    objectives: [objective],
    leadPool: { visible_count: 12, has_more: false, total_estimated_count: 12, page: 1, page_size: 25 },
  })
  assert.ok(snapshot)
  assert.equal(snapshot?.discoveryAction, "run_prospect_search")
  assert.equal(snapshot?.startupDiscoveryReady, true)
  console.log("  ✓ existing Datamoon + Prospect Search snapshot reused")

  const pipelineLine = buildLeadDiscoveryWorkingNowLine(
    discoverySnapshot({ newCompaniesFound: 0, counters: { ...discoverySnapshot().counters, newCompaniesFound: 0 } }),
  )
  assert.match(pipelineLine ?? "", /nearly exhausted our current pipeline/i)
  assert.match(pipelineLine ?? "", /hospitals/i)

  const activeSearchLine = buildLeadDiscoveryWorkingNowLine(discoverySnapshot())
  assert.match(activeSearchLine ?? "", /finding|searching/i)
  console.log("  ✓ Home reflects discovery work instead of idle waiting")

  const workingNow = buildDailyActivityWorkingNowLines({
    workResult: emptyWorkManager(),
    operatingRhythm: emptyRhythm(),
    missionDiscovery: discoverySnapshot(),
  })
  assert.ok(workingNow.some((line) => /nearly exhausted|searching|finding/i.test(line)))
  assert.ok(!workingNow.some((line) => /^I'm waiting/i.test(line)))
  console.log("  ✓ working_now narrative driven by mission discovery")

  const activityNarrative = buildAvaDailyActivityNarrative({
    memorySummary: null,
    workResult: emptyWorkManager(),
    operatingRhythm: emptyRhythm(),
    hour: 9,
    missionDiscovery: discoverySnapshot(),
  })
  assert.equal(activityNarrative.focus, "discovery")
  assert.ok(activityNarrative.working_now.length > 0)
  assert.ok(!activityNarrative.waiting_on_you.some((line) => /Nothing needs your approval/i.test(line)))
  console.log("  ✓ narrative intelligence discovery focus")

  const opening = buildNarrativeIntelligenceOpeningLine({
    focus: "discovery",
    discoveryTarget: "hospitals",
  })
  assert.match(opening, /building your pipeline/i)
  assert.match(opening, /hospitals/i)
  console.log("  ✓ discovery opening line")

  const decision = runDecisionEngine({
    workspaceSummary: emptyWorkspaceSummary(discoverySnapshot()),
    waitingOnYou: [],
    dailyWorkQueue: [],
    accomplishments: [],
    timeline: [],
  })
  const candidates = flattenDecisionCandidates(decision.context)
  assert.ok(candidates.some((row) => row.id === "discovery:prospect_search"))
  assert.ok(!candidates.some((row) => row.id === "wait:idle"))
  console.log("  ✓ existing Decision Engine reused for discovery")

  const briefing = buildAvaDailyBriefing({
    greeting: "Good morning",
    hour: 9,
    workspaceSummary: emptyWorkspaceSummary(discoverySnapshot()),
    accomplishments: [],
    waitingOnYou: [],
    dailyWorkQueue: [],
    timeline: [],
  })
  assert.ok((briefing.daily_activity_narrative?.working_now.length ?? 0) > 0)
  assert.equal(briefing.work_manager_qa_marker, GROWTH_WORK_MANAGER_QA_MARKER)
  console.log("  ✓ existing Work Manager reused")

  const hero = buildAvaHomeHero({
    greeting: "Good morning",
    hour: 9,
    employeeStatus: { kind: "researching", label: "Finding leads" },
    aiOsUx: {
      qaMarker: "growth-ge-aios-ux-1a-ai-os-home-experience-v1",
      hero: {} as never,
      waitingOnYou: [],
      waitingOnYouOverflow: 0,
      approveItemsCount: 0,
      approveItemsHref: null,
      liveStatus: null,
      dailyWorkQueueBuckets: null,
      dailyWorkQueue: [],
      throughput: [],
      mailboxDomainHealth: null,
      autonomousReadiness: null,
    },
    researchLoopSummary: null,
    accomplishments: [],
    repliesWaiting: 0,
    workspaceSummary: emptyWorkspaceSummary(discoverySnapshot()),
  })
  assert.equal(hero.dailyActivityNarrative?.focus, "discovery")
  assert.match(hero.discoveryNarrativeTarget ?? "", /hospitals/i)
  console.log("  ✓ hero consumes mission discovery snapshot")

  const refreshSnapshot = discoverySnapshot({
    discoveryAction: "refresh_audience",
    pipelineLow: true,
    leadPoolHasMore: false,
  })
  const refreshDecision = runDecisionEngine({
    workspaceSummary: emptyWorkspaceSummary(refreshSnapshot),
    waitingOnYou: [],
    dailyWorkQueue: [],
    accomplishments: [],
    timeline: [],
  })
  assert.ok(
    flattenDecisionCandidates(refreshDecision.context).some((row) => row.id === "discovery:refresh_audience"),
  )
  console.log("  ✓ continuous audience replenishment decision")

  assert.equal(GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH, "/api/platform/growth/home/workspace-summary")
  const dashboard = readSource(
    "components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx",
  )
  assert.match(dashboard, /missionDiscovery/)
  assert.doesNotMatch(dashboard, /fetch\([^)]*mission-discovery/i)
  console.log("  ✓ single workspace-summary fetch preserved")

  console.log(`\n[${PHASE}] PASS — Autonomous Lead Discovery certified`)
}

main()
