/**
 * GE-AVA-MISSION-RUNTIME-1A — Persistent mission execution certification.
 * Run: pnpm test:ge-ava-mission-runtime-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AVA_MISSION_RUNTIME_1A_QA_MARKER,
  GROWTH_MISSION_LIFECYCLE_STATES,
  GROWTH_MISSION_RUNTIME_RULE,
  createDefaultMissionRuntimeState,
  missionLifecycleActivityLabel,
  missionLifecycleStatusLabel,
} from "../lib/growth/mission-center/growth-mission-runtime-types"
import { synthesizeGrowthMissionCenter } from "../lib/growth/mission-center/growth-mission-center-synthesizer"

const PHASE = "GE-AVA-MISSION-RUNTIME-1A" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function globCronRoutes(): string[] {
  const root = path.join(process.cwd(), "app/api/cron")
  if (!fs.existsSync(root)) return []
  const results: string[] = []
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name === "route.ts") results.push(full.replace(process.cwd() + path.sep, ""))
    }
  }
  walk(root)
  return results
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Persistent mission execution certification`)

  assert.equal(GROWTH_AVA_MISSION_RUNTIME_1A_QA_MARKER, "ge-ava-mission-runtime-1a-v1")
  assert.match(GROWTH_MISSION_RUNTIME_RULE, /no new scheduler/)
  assert.deepEqual(GROWTH_MISSION_LIFECYCLE_STATES, [
    "planning",
    "monitoring",
    "finding_leads",
    "researching",
    "preparing_recommendations",
    "waiting_for_approval",
  ])

  const defaultRuntime = createDefaultMissionRuntimeState()
  assert.equal(defaultRuntime.lifecycleState, "planning")
  assert.equal(missionLifecycleStatusLabel("monitoring"), "Monitoring")
  assert.match(
    missionLifecycleActivityLabel("finding_leads", { ...defaultRuntime.counters, newCompaniesFound: 18 }),
    /18 new companies/,
  )
  assert.equal(missionLifecycleActivityLabel("waiting_for_approval", defaultRuntime.counters), "Waiting for approval")

  const scheduler = readSource("lib/growth/objectives/growth-objective-runtime-scheduler.ts")
  assert.match(scheduler, /runGrowthMissionRuntimeOrchestration/)
  assert.match(scheduler, /missionOrchestrationsAttempted/)

  const orchestrator = readSource("lib/growth/mission-center/growth-mission-runtime-orchestrator.ts")
  assert.match(orchestrator, /startAudienceSnapshotGeneration/)
  assert.match(orchestrator, /continueAudienceSnapshotGeneration/)
  assert.match(orchestrator, /startAudienceLeadCreation/)
  assert.match(orchestrator, /startDatamoonAudienceImportRun/)
  assert.match(orchestrator, /pollDatamoonAudienceImportRun/)
  assert.match(orchestrator, /importDatamoonAudiencePreviewRecords/)
  assert.match(orchestrator, /waiting_for_approval/)
  assert.doesNotMatch(
    orchestrator,
    /sendEmail|launchCampaign|enrollSequence|outboundExecution|processOutbound|approveAutomation/i,
  )

  const executionContext = readSource("lib/growth/objectives/growth-objective-execution-context.ts")
  assert.match(executionContext, /missionRuntime/)

  const synthesizer = readSource("lib/growth/mission-center/growth-mission-center-synthesizer.ts")
  assert.match(synthesizer, /missionRuntime/)
  assert.match(synthesizer, /GROWTH_AVA_MISSION_RUNTIME_1A_QA_MARKER/)

  const cronRoutes = globCronRoutes()
  assert.ok(
    cronRoutes.some((route) => route.includes("growth-objective-runtime-scheduler")),
    "must reuse existing growth-objective-runtime-scheduler cron",
  )
  assert.ok(
    !cronRoutes.some((route) => route.includes("mission-runtime")),
    "must not add a new mission-runtime cron route",
  )

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
          id: "obj-runtime-1",
          organizationId: "org-1",
          title: "Acquire New Customers",
          description: null,
          objectiveType: "customers_acquired",
          targetValue: 10,
          currentValue: 3,
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
            stageStates: {
              launch: { state: "completed", startedAt: null, completedAt: new Date().toISOString(), error: null },
            },
          },
          executionContext: {
            qa_marker: "growth-objective-ge-auto-2g-v1",
            version: 1,
            stages: {},
            recoveredAt: null,
            missionRuntime: createDefaultMissionRuntimeState({
              approved: true,
              lifecycleState: "researching",
              activityLabel: "Researching 12 companies",
              counters: {
                newCompaniesFound: 18,
                recordsImported: 12,
                researchingCount: 12,
                draftsPrepared: 0,
                pendingApprovals: 0,
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

  assert.equal(card?.statusLabel, "Researching")
  assert.equal(card?.currentActivity, "Researching 12 companies")

  console.log(`[${PHASE}] PASS`)
}

main().catch((error) => {
  console.error(`[${PHASE}] FAIL`, error)
  process.exit(1)
})
