/**
 * GE-AVA-MISSION-RUNTIME-1B — Find Leads mission binding certification.
 * Run: pnpm test:ge-ava-mission-runtime-1b-find-leads-binding
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AVA_MISSION_RUNTIME_1B_QA_MARKER,
  buildLeadDiscoveryDetailItems,
  selectDefaultFindLeadsMissionId,
} from "../lib/growth/mission-center/growth-mission-find-leads-binding-display"
import { buildMissionDetailSections } from "../lib/growth/mission-center/growth-mission-center-detail-sections"
import { createDefaultMissionRuntimeState } from "../lib/growth/mission-center/growth-mission-runtime-types"
import { synthesizeGrowthMissionCenter } from "../lib/growth/mission-center/growth-mission-center-synthesizer"
import {
  GROWTH_HOME_FIND_LEADS_MISSION_BINDING_TITLE,
  GROWTH_AVA_MISSION_RUNTIME_1B_FIND_LEADS_BINDING_QA_MARKER,
} from "../lib/growth/ava-home/datamoon/growth-home-datamoon-sourcing-api-contract"

const PHASE = "GE-AVA-MISSION-RUNTIME-1B" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function listCorePaths(): string[] {
  const roots = ["app/(core)", "lib/core", "components/core"]
  const hits: string[] = []
  for (const root of roots) {
    const full = path.join(process.cwd(), root)
    if (fs.existsSync(full)) hits.push(root)
  }
  return hits
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Find Leads mission binding certification`)

  assert.equal(GROWTH_AVA_MISSION_RUNTIME_1B_QA_MARKER, "ge-ava-mission-runtime-1b-v1")
  assert.match(GROWTH_HOME_FIND_LEADS_MISSION_BINDING_TITLE, /Attach this search to a mission/)

  const route = readSource("app/api/platform/growth/mission-center/[missionId]/bind-find-leads/route.ts")
  assert.match(route, /approvedByUser/)
  assert.match(route, /bindFindLeadsSearchToMission/)
  assert.doesNotMatch(route, /startDatamoonAudienceImportRun|importDatamoonAudiencePreviewRecords|buildAudience|fetchAudience/)
  assert.doesNotMatch(route, /sendEmail|enrollSequence|launchCampaign|outboundExecution/i)

  const service = readSource("lib/growth/mission-center/growth-mission-find-leads-binding-service.ts")
  assert.match(service, /approvedByUser/)
  assert.match(service, /mission_org_mismatch/)
  assert.match(service, /bindMissionDatamoonImportRequest/)
  assert.doesNotMatch(service, /startDatamoonAudienceImportRun|importDatamoonAudiencePreviewRecords|buildAudience|fetchAudience/)
  assert.doesNotMatch(service, /sendEmail|enrollSequence|launchCampaign|outboundExecution/i)

  const workbench = readSource(
    "components/growth/workspace/executive-briefing/growth-home-datamoon-sourcing-workbench-section.tsx",
  )
  assert.match(workbench, /GrowthHomeFindLeadsMissionBindingCard/)
  assert.match(workbench, /buildMissionBindFindLeadsApiPath/)
  assert.match(workbench, /selectedMissionId && keepMonitoring/)
  assert.match(workbench, /GROWTH_HOME_DATAMOON_RUNS_API_PATH/)

  const bindingCard = readSource(
    "components/growth/workspace/executive-briefing/growth-home-find-leads-mission-binding-card.tsx",
  )
  assert.match(bindingCard, /data-qa-section="find-leads-mission-binding"/)
  assert.match(bindingCard, /GROWTH_AVA_MISSION_RUNTIME_1B_FIND_LEADS_BINDING_QA_MARKER/)

  const detailSections = readSource("lib/growth/mission-center/growth-mission-center-detail-sections.ts")
  assert.match(detailSections, /buildLeadDiscoveryDetailItems/)
  assert.match(detailSections, /formatMissionFindLeadsMonitoringStatus/)

  const defaultMission = selectDefaultFindLeadsMissionId([
    { id: "obj-2", title: "Pipeline", status: "active", objectiveType: "pipeline_value", runtime: { running: true } },
    { id: "obj-1", title: "Acquire", status: "active", objectiveType: "customers_acquired", runtime: { running: true } },
  ])
  assert.equal(defaultMission, "obj-1")

  const bindingItems = buildLeadDiscoveryDetailItems({
    lastRunId: "run-12345678",
    importRequestJson: "{}",
    lastPollAt: null,
    lastImportedCount: 0,
    searchSummary: "Roofing companies in Florida",
    audienceName: "Florida roofing",
    keepMonitoring: true,
    refreshCadence: "daily",
    boundAt: "2026-07-06T12:00:00.000Z",
  })
  assert.ok(bindingItems.some((item) => item.includes("Roofing companies in Florida")))
  assert.ok(bindingItems.some((item) => item.includes("Monitoring: daily")))

  const sections = buildMissionDetailSections({
    objective: {
      id: "obj-bind-1",
      organizationId: "org-1",
      title: "Acquire New Customers",
      description: null,
      objectiveType: "customers_acquired",
      targetValue: 10,
      currentValue: 0,
      startDate: null,
      targetDate: null,
      status: "active",
      ownerUserId: "user-1",
      priority: "high",
      autonomyLevel: "objective",
      safetyMode: "strict",
      plan: null,
      runtime: {
        qa_marker: "growth-objective-ge-auto-2g-v1",
        currentStageId: "monitor",
        running: true,
        startedAt: new Date().toISOString(),
        lastTickAt: new Date().toISOString(),
        lastSignalAt: null,
        lastSchedulerAt: null,
        schedulerRunCount: 0,
        schedulerRetryAttempts: 0,
        stalledSince: null,
        lastSchedulerResult: null,
        stageStates: {},
      },
      executionContext: {
        qa_marker: "growth-objective-ge-auto-2g-v1",
        version: 1,
        stages: {},
        recoveredAt: null,
        missionRuntime: createDefaultMissionRuntimeState({
          approved: true,
          datamoon: {
            lastRunId: "run-abc",
            importRequestJson: '{"run_name":"test"}',
            lastPollAt: null,
            lastImportedCount: 0,
            searchSummary: "Find roofing companies in Florida",
            audienceName: "Florida roofing",
            keepMonitoring: true,
            refreshCadence: "daily",
            boundAt: new Date().toISOString(),
            provider: "datamoon_audience",
            source: "find_leads",
          },
        }),
      },
      recommendations: [],
      recentSignals: [],
      executionHistory: [],
      emergencyStopActive: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    businessProfileApproved: true,
    pendingApprovalCount: 0,
  })
  const leadDiscovery = sections.find((section) => section.id === "lead_discovery")
  assert.ok(leadDiscovery)
  assert.match(leadDiscovery!.summary, /Monitoring lead search/)
  assert.ok(leadDiscovery!.items.some((item) => item.includes("Find roofing companies in Florida")))

  const card = synthesizeGrowthMissionCenter({
    dashboard: {
      generatedAt: new Date().toISOString(),
      briefing: null,
      sections: [],
      operatorActionCards: [],
      dailyRevenueWorkQueueEnabled: false,
      dailyRevenueWorkQueue: null,
      dailyRevenueWorkQueueDisplay: null,
    },
    businessProfileApproved: true,
    objectiveDashboard: {
      qa_marker: "growth-objective-ge-auto-2g-v1",
      runtime_qa_marker: "growth-objective-ge-auto-2g-v1",
      objectives: [
        {
          id: "obj-bind-card",
          organizationId: "org-1",
          title: "Acquire New Customers",
          description: null,
          objectiveType: "customers_acquired",
          targetValue: 10,
          currentValue: 0,
          startDate: null,
          targetDate: null,
          status: "active",
          ownerUserId: "user-1",
          priority: "high",
          autonomyLevel: "objective",
          safetyMode: "strict",
          plan: null,
          runtime: {
            qa_marker: "growth-objective-ge-auto-2g-v1",
            currentStageId: "monitor",
            running: true,
            startedAt: new Date().toISOString(),
            lastTickAt: new Date().toISOString(),
            lastSignalAt: null,
            lastSchedulerAt: null,
            schedulerRunCount: 0,
            schedulerRetryAttempts: 0,
            stalledSince: null,
            lastSchedulerResult: null,
            stageStates: {},
          },
          executionContext: {
            qa_marker: "growth-objective-ge-auto-2g-v1",
            version: 1,
            stages: {},
            recoveredAt: null,
            missionRuntime: createDefaultMissionRuntimeState({
              approved: true,
              lifecycleState: "monitoring",
              datamoon: {
                lastRunId: "run-abc",
                importRequestJson: "{}",
                lastPollAt: null,
                lastImportedCount: 0,
                keepMonitoring: true,
                searchSummary: "Florida roofing",
              },
            }),
          },
          recommendations: [],
          recentSignals: [],
          executionHistory: [],
          emergencyStopActive: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    },
  }).activeMissions[0]
  assert.match(card?.currentActivity ?? "", /Monitoring lead search/)

  const corePaths = listCorePaths()
  for (const corePath of corePaths) {
    const touched = [
      route,
      service,
      workbench,
      bindingCard,
      detailSections,
    ].some((source) => source.includes(corePath))
    assert.equal(touched, false, `must not modify Equipify Core path ${corePath}`)
  }

  console.log(`[${PHASE}] PASS`)
}

main().catch((error) => {
  console.error(`[${PHASE}] FAIL`, error)
  process.exit(1)
})
