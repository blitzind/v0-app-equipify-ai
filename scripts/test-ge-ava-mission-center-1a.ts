/**
 * GE-AVA-MISSION-CENTER-1A — Unified Mission Center certification.
 * Run: pnpm test:ge-ava-mission-center-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createDefaultAvaDatamoonAudienceDraft } from "../lib/growth/ava-home/datamoon/ava-datamoon-sourcing-workbench-types"
import {
  GROWTH_AVA_MISSION_CENTER_1A_QA_MARKER,
  GROWTH_MISSION_CENTER_ACTIVE_MISSIONS_TITLE,
  GROWTH_MISSION_CENTER_API_PATH,
  GROWTH_MISSION_CENTER_RULE,
  mapRuntimeStageToPresentationStage,
  synthesizeGrowthMissionCenter,
} from "../lib/growth/mission-center"
import { GROWTH_OBJECTIVE_STAGE_IDS } from "../lib/growth/objectives/growth-objective-types"

const PHASE = "GE-AVA-MISSION-CENTER-1A" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function minimalDashboard() {
  return {
    generatedAt: new Date().toISOString(),
    briefing: null,
    sections: [],
    operatorActionCards: [],
    dailyRevenueWorkQueueEnabled: false,
    dailyRevenueWorkQueue: null,
    dailyRevenueWorkQueueDisplay: null,
  } as import("../lib/growth/workspace/growth-workspace-dashboard-types").GrowthWorkspaceDashboardViewModel
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Unified Mission Center certification`)

  assert.equal(GROWTH_AVA_MISSION_CENTER_1A_QA_MARKER, "ge-ava-mission-center-1a-v1")
  assert.equal(GROWTH_MISSION_CENTER_ACTIVE_MISSIONS_TITLE, "Ava's Active Missions")
  assert.equal(GROWTH_MISSION_CENTER_API_PATH, "/api/platform/growth/mission-center")
  assert.match(GROWTH_MISSION_CENTER_RULE, /no new runtime/)

  assert.equal(mapRuntimeStageToPresentationStage("discover"), "lead_discovery")
  assert.equal(mapRuntimeStageToPresentationStage("research"), "research")
  assert.equal(mapRuntimeStageToPresentationStage("generate_assets"), "outreach_preparation")
  assert.equal(mapRuntimeStageToPresentationStage("launch"), "execution")

  for (const stageId of GROWTH_OBJECTIVE_STAGE_IDS) {
    const mapped = mapRuntimeStageToPresentationStage(stageId)
    assert.ok(mapped, `stage ${stageId} must map to presentation stage`)
  }

  const blocked = synthesizeGrowthMissionCenter({
    dashboard: minimalDashboard(),
    businessProfileApproved: false,
    objectiveDashboard: {
      qa_marker: "growth-objective-ge-auto-2g-v1",
      runtime_qa_marker: "growth-objective-ge-auto-2g-v1",
      objectives: [
        {
          id: "obj-1",
          organizationId: "org-1",
          title: "Acquire New Customers",
          description: null,
          objectiveType: "customers_acquired",
          targetValue: 10,
          currentValue: 3,
          startDate: null,
          targetDate: null,
          status: "active",
          ownerUserId: null,
          priority: "high",
          autonomyLevel: "objective",
          safetyMode: "strict",
          plan: null,
          runtime: {
            qa_marker: "growth-objective-ge-auto-2g-v1",
            currentStageId: "research",
            stageStates: {} as never,
            startedAt: new Date().toISOString(),
            lastTickAt: new Date().toISOString(),
            stoppedAt: null,
            estimatedCompletionDate: null,
            running: true,
          },
          executionHistory: [],
          recentSignals: [],
          recommendations: [],
          eventSubscriptions: null,
          executionContext: null,
          emergencyStopActive: false,
          qa_marker: "growth-objective-ge-auto-2g-v1",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      activeCount: 1,
      pausedCount: 0,
      runningCount: 1,
      totalTarget: 10,
      totalProgress: 3,
      emergencyStopActive: false,
      objectiveModeEnabled: false,
    },
  })

  assert.equal(blocked.readOnly, true)
  assert.equal(blocked.activeMissions.length, 1)
  assert.equal(blocked.activeMissions[0]?.businessProfileBlocked, true)
  assert.match(blocked.activeMissions[0]?.blockedReason ?? "", /business first/i)
  assert.equal(blocked.activeMissions[0]?.presentationStage, "business_profile")

  const service = readSource("lib/growth/mission-center/growth-mission-center-service.ts")
  assert.match(service, /loadGrowthObjectiveDashboard/)
  assert.match(service, /fetchAiOsCommandCenterReadModel/)
  assert.match(service, /fetchBusinessProfileWorkspaceState/)
  assert.match(service, /extractGrowthRevenueDirectorSnapshot/)
  assert.doesNotMatch(service, /tickGrowthObjectiveRuntime|createGrowthObjectiveWithPlan|runExecutiveMissionPlanningTick/)

  const synthesizer = readSource("lib/growth/mission-center/growth-mission-center-synthesizer.ts")
  assert.match(synthesizer, /buildActiveRevenueMissions/)
  assert.match(synthesizer, /computeObjectiveDashboardProgress|objectiveProgressPercent/)
  assert.doesNotMatch(synthesizer, /buildGrowthMetaRecommenderReadModel|planGrowthObjective/)

  const route = readSource("app/api/platform/growth/mission-center/route.ts")
  assert.match(route, /loadGrowthMissionCenterSources/)
  assert.doesNotMatch(route, /POST|PATCH|DELETE/)

  const dashboard = readSource(
    "components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx",
  )
  assert.match(dashboard, /GrowthHomeMissionCenterSection/)
  assert.doesNotMatch(dashboard, /GrowthHomeActiveRevenueMissionsSection/)

  const homeSection = readSource(
    "components/growth/workspace/executive-briefing/growth-home-mission-center-section.tsx",
  )
  assert.match(homeSection, /data-qa-section="home-mission-center"/)
  assert.match(homeSection, /synthesizeGrowthMissionCenter/)
  assert.match(homeSection, /GrowthMissionCenterDetailDrawer/)
  assert.doesNotMatch(homeSection, /handleBuildAudience|import_all_previewed|sendEmail/)

  const findLeads = readSource(
    "components/growth/workspace/executive-briefing/growth-home-datamoon-sourcing-workbench-section.tsx",
  )
  assert.match(findLeads, /GROWTH_HOME_FIND_LEADS_TITLE/)
  assert.match(findLeads, /buildMissionBindFindLeadsApiPath/)
  assert.doesNotMatch(findLeads, /synthesizeGrowthMissionCenter|GrowthMissionCenterDetailDrawer/)

  assert.doesNotMatch(createDefaultAvaDatamoonAudienceDraft().audienceName, /GrowthObjective/)

  console.log(`[${PHASE}] PASS — Unified Mission Center certified (local)`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
