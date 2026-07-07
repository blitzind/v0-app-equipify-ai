/**
 * GE-AVA-LAUNCH-MISSION-SETUP-1A — Start Ava guided launch certification.
 * Run: pnpm test:ge-ava-launch-mission-setup-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_AVA_MISSION_RUNTIME_1A_QA_MARKER } from "../lib/growth/mission-center/growth-mission-runtime-types"
import { createDefaultMissionRuntimeState } from "../lib/growth/mission-center/growth-mission-runtime-types"
import {
  GROWTH_AVA_LAUNCH_MISSION_SETUP_1A_QA_MARKER,
  GROWTH_AVA_LAUNCH_MISSION_SETUP_RULE,
  GROWTH_AVA_LAUNCH_MISSION_SETUP_TITLE,
  GROWTH_AVA_LAUNCH_MISSION_DEFAULT_TITLE,
} from "../lib/growth/workspace/executive-briefing/growth-home-launch-mission-setup-1a"
import {
  hasLeadSearchBound,
  isLaunchMissionSetupComplete,
  resolveAcquisitionMission,
  shouldShowStartAvaSetupCard,
  synthesizeGrowthHomeLaunchMissionSetup,
} from "../lib/growth/workspace/executive-briefing/growth-home-launch-mission-setup-synthesizer"
import type { GrowthObjective } from "../lib/growth/objectives/growth-objective-types"

const PHASE = "GE-AVA-LAUNCH-MISSION-SETUP-1A" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function baseObjective(overrides: Partial<GrowthObjective> = {}): GrowthObjective {
  return {
    id: "mission-1",
    organizationId: "org-1",
    title: GROWTH_AVA_LAUNCH_MISSION_DEFAULT_TITLE,
    description: null,
    objectiveType: "customers_acquired",
    targetValue: 10,
    currentValue: 0,
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
      currentStageId: "discover",
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
    ...overrides,
  }
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Start Ava guided launch certification`)

  assert.equal(GROWTH_AVA_LAUNCH_MISSION_SETUP_1A_QA_MARKER, "ge-ava-launch-mission-setup-1a-v1")
  assert.equal(GROWTH_AVA_LAUNCH_MISSION_SETUP_TITLE, "Start Ava")
  assert.match(GROWTH_AVA_LAUNCH_MISSION_SETUP_RULE, /no new runtime engine/)

  const missingProfile = synthesizeGrowthHomeLaunchMissionSetup({
    businessProfileApproved: false,
    hasBusinessProfileDraft: false,
    objectives: [],
    mailboxWarnings: 0,
    expiredMailboxes: 0,
  })
  assert.equal(missingProfile.steps[0]?.status, "blocked")
  assert.equal(missingProfile.setupComplete, false)
  assert.equal(missingProfile.currentStepId, "growth_profile")
  assert.equal(shouldShowStartAvaSetupCard({
    businessProfileApproved: false,
    hasBusinessProfileDraft: false,
    objectives: [],
    mailboxWarnings: 0,
    expiredMailboxes: 0,
  }), true)
  console.log("  ✓ missing Growth Profile blocks setup")

  const approvedProfile = synthesizeGrowthHomeLaunchMissionSetup({
    businessProfileApproved: true,
    hasBusinessProfileDraft: true,
    objectives: [],
    mailboxWarnings: 0,
    expiredMailboxes: 0,
  })
  assert.equal(approvedProfile.steps[0]?.status, "complete")
  assert.equal(approvedProfile.steps[1]?.actionKind, "create_mission")
  assert.equal(approvedProfile.currentStepId, "mission")
  console.log("  ✓ approved Growth Profile advances setup")

  const withMission = synthesizeGrowthHomeLaunchMissionSetup({
    businessProfileApproved: true,
    hasBusinessProfileDraft: true,
    objectives: [baseObjective()],
    mailboxWarnings: 0,
    expiredMailboxes: 0,
  })
  assert.equal(withMission.steps[1]?.status, "complete")
  assert.equal(withMission.currentStepId, "lead_search")
  assert.equal(resolveAcquisitionMission([baseObjective()])?.id, "mission-1")
  console.log("  ✓ missing lead search prompts Find Leads")

  const reusedMission = synthesizeGrowthHomeLaunchMissionSetup({
    businessProfileApproved: true,
    hasBusinessProfileDraft: true,
    objectives: [
      baseObjective({ id: "existing-mission", title: "Acquire New Customers" }),
      baseObjective({ id: "other-mission", title: "Other", objectiveType: "demos_booked" }),
    ],
    mailboxWarnings: 0,
    expiredMailboxes: 0,
  })
  assert.equal(reusedMission.acquisitionMissionId, "existing-mission")
  console.log("  ✓ existing mission is reused")

  const boundSearch = synthesizeGrowthHomeLaunchMissionSetup({
    businessProfileApproved: true,
    hasBusinessProfileDraft: true,
    objectives: [
      baseObjective({
        executionContext: {
          qa_marker: "growth-objective-execution-context-v1",
          version: 1,
          stages: {},
          recoveredAt: null,
          missionRuntime: createDefaultMissionRuntimeState({
            datamoon: {
              lastRunId: "run-1",
              importRequestJson: '{"filters":[]}',
              lastPollAt: null,
              lastImportedCount: 0,
              keepMonitoring: true,
            },
          }),
        },
      }),
    ],
    mailboxWarnings: 0,
    expiredMailboxes: 0,
  })
  assert.equal(boundSearch.steps[2]?.status, "complete")
  assert.equal(
    hasLeadSearchBound(
      baseObjective({
        executionContext: {
          qa_marker: "growth-objective-execution-context-v1",
          version: 1,
          stages: {},
          recoveredAt: null,
          missionRuntime: createDefaultMissionRuntimeState({
            datamoon: {
              lastRunId: "run-1",
              importRequestJson: '{"filters":[]}',
              lastPollAt: null,
              lastImportedCount: 0,
            },
          }),
        },
      }),
    ),
    true,
  )
  assert.equal(isLaunchMissionSetupComplete({
    businessProfileApproved: true,
    hasBusinessProfileDraft: true,
    objectives: [
      baseObjective({
        executionContext: {
          qa_marker: "growth-objective-execution-context-v1",
          version: 1,
          stages: {},
          recoveredAt: null,
          missionRuntime: createDefaultMissionRuntimeState({
            datamoon: {
              lastRunId: "run-1",
              importRequestJson: '{"filters":[]}',
              lastPollAt: null,
              lastImportedCount: 0,
              keepMonitoring: true,
            },
          }),
        },
      }),
    ],
    mailboxWarnings: 0,
    expiredMailboxes: 0,
  }), true)
  console.log("  ✓ bound lead search advances setup")

  const mailboxWarnings = synthesizeGrowthHomeLaunchMissionSetup({
    businessProfileApproved: true,
    hasBusinessProfileDraft: true,
    objectives: [baseObjective()],
    mailboxWarnings: 2,
    expiredMailboxes: 0,
    mailboxSummary: "2 mailboxes need attention",
  })
  assert.equal(mailboxWarnings.steps[3]?.status, "warning")
  assert.match(mailboxWarnings.steps[3]?.summary ?? "", /2 mailboxes need attention|mailbox warning/i)

  const mailboxBlocked = synthesizeGrowthHomeLaunchMissionSetup({
    businessProfileApproved: true,
    hasBusinessProfileDraft: true,
    objectives: [baseObjective()],
    mailboxWarnings: 1,
    expiredMailboxes: 1,
  })
  assert.equal(mailboxBlocked.steps[3]?.status, "blocked")
  assert.equal(mailboxBlocked.steps[3]?.blocksLaunch, true)
  console.log("  ✓ mailbox warnings shown clearly")

  const setupComponent = readSource(
    "components/growth/workspace/executive-briefing/growth-home-start-ava-setup-section.tsx",
  )
  assert.match(setupComponent, /data-qa-section="home-start-ava-setup"/)
  assert.match(setupComponent, /GROWTH_AVA_LAUNCH_MISSION_SETUP_1A_QA_MARKER/)
  assert.doesNotMatch(setupComponent, /sendOutbound|send_email|importSelected|buildAudience|runDatamoonImport/)
  assert.doesNotMatch(setupComponent, /autoApprove|approvedByUser:\s*true/)
  console.log("  ✓ setup never sends outbound or auto-imports")

  const dashboard = readSource(
    "components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx",
  )
  assert.match(dashboard, /GrowthHomeStartAvaSetupSection/)
  assert.ok(
    dashboard.indexOf("GrowthHomeStartAvaSetupSection") < dashboard.indexOf("GrowthHomeMissionCenterSection"),
    "Start Ava card must appear before Mission Center",
  )
  console.log("  ✓ Growth Home mounts Start Ava setup card")

  const corePaths = ["lib/billing", "lib/supabase", "app/(core)", "components/core"]
  for (const corePath of corePaths) {
    const full = path.join(process.cwd(), corePath)
    if (fs.existsSync(full)) {
      assert.doesNotMatch(setupComponent, new RegExp(corePath.replace(/[()]/g, "\\$&")))
    }
  }
  console.log("  ✓ no Equipify Core coupling in setup component")

  assert.equal(GROWTH_AVA_MISSION_RUNTIME_1A_QA_MARKER, "ge-ava-mission-runtime-1a-v1")

  console.log(`[${PHASE}] PASS — ${GROWTH_AVA_LAUNCH_MISSION_SETUP_1A_QA_MARKER}`)
}

main().catch((error) => {
  console.error(`[${PHASE}] FAIL`, error)
  process.exit(1)
})
