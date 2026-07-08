/**
 * GE-AVA-AUTONOMY-LAUNCH-RUN-1 — Ava launch run compositor certification.
 * Run: pnpm test:ge-ava-autonomy-launch-run-1
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AVA_AUTONOMY_LAUNCH_RUN_1_QA_MARKER,
  GROWTH_AVA_LAUNCH_RUN_TITLE,
  buildMissionAvaLaunchRunApiPath,
} from "../lib/growth/mission-center/growth-mission-ava-launch-run-api-contract"

const PHASE = "GE-AVA-AUTONOMY-LAUNCH-RUN-1" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Ava launch run compositor certification`)

  assert.equal(GROWTH_AVA_AUTONOMY_LAUNCH_RUN_1_QA_MARKER, "ge-ava-autonomy-launch-run-1-v1")
  assert.equal(GROWTH_AVA_LAUNCH_RUN_TITLE, "Run Ava")
  assert.match(buildMissionAvaLaunchRunApiPath("mission-1"), /\/ava-launch-run$/)

  const route = readSource("app/api/platform/growth/mission-center/[missionId]/ava-launch-run/route.ts")
  assert.match(route, /runGrowthMissionAvaLaunchRun/)
  assert.match(route, /approvedByUser/)
  assert.doesNotMatch(route, /sendEmail|enrollSequence|launchCampaign|outboundExecution/i)

  const service = readSource("lib/growth/mission-center/growth-mission-ava-launch-run-service.ts")
  assert.match(service, /fetchBusinessProfileWorkspaceState/)
  assert.match(service, /growth_profile_not_approved/)
  assert.match(service, /getGrowthObjective/)
  assert.match(service, /buildDatamoonImportRequestFromAudienceDraft/)
  assert.match(service, /startDatamoonAudienceImportRun/)
  assert.match(service, /bindFindLeadsSearchToMission/)
  assert.match(service, /waitForDatamoonAudienceImportRunPollCompletion/)
  assert.match(service, /importDatamoonAudiencePreviewRecords/)
  assert.match(service, /registerAvaAutonomyCompletionPendingLeads/)
  assert.match(service, /fetchLatestGrowthLeadResearchWorkflowSnapshot/)
  assert.match(service, /fetchAiOsCommandCenterReadModel/)
  assert.match(service, /buildAvaLaunchRunResultSemantics/)
  assert.match(service, /stoppedAt: resultSemantics\.stoppedAt/)
  assert.doesNotMatch(service, /sendEmail|enrollSequence|launchCampaign|outboundExecution/i)
  assert.doesNotMatch(service, /growth-objective-runtime-scheduler|cron/i)

  const workbench = readSource(
    "components/growth/workspace/executive-briefing/growth-home-datamoon-sourcing-workbench-section.tsx",
  )
  assert.match(workbench, /buildMissionAvaLaunchRunApiPath/)
  assert.match(workbench, /handleRunAvaLaunch/)
  assert.match(workbench, /buildAvaLaunchRunSuccessMessage/)
  assert.match(workbench, /GROWTH_AVA_LAUNCH_RUN_TITLE/)

  const setup = readSource(
    "components/growth/workspace/executive-briefing/growth-home-start-ava-setup-section.tsx",
  )
  assert.match(setup, /GROWTH_AVA_LAUNCH_RUN_TITLE/)

  console.log(`[${PHASE}] passed`)
}

void main()
