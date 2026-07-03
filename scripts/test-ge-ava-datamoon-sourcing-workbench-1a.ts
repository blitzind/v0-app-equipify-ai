/**
 * GE-AVA-DATAMOON-SOURCING-WORKBENCH-1A — Datamoon sourcing workbench certification.
 * Run: pnpm test:ge-ava-datamoon-sourcing-workbench-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildDatamoonImportRequestFromAudienceDraft } from "../lib/growth/ava-home/datamoon/ava-datamoon-sourcing-draft-builder"
import {
  isRecognizedAvaDatamoonSourcingCommand,
  parseAvaDatamoonSourcingCommand,
} from "../lib/growth/ava-home/datamoon/ava-datamoon-sourcing-command-parser"
import {
  createDefaultAvaDatamoonAudienceDraft,
  GROWTH_AVA_DATAMOON_SOURCING_WORKBENCH_1A_QA_MARKER,
} from "../lib/growth/ava-home/datamoon/ava-datamoon-sourcing-workbench-types"
import {
  GROWTH_HOME_AVA_ASK_DRAFT_LABEL,
  GROWTH_HOME_BUILD_AUDIENCE_LABEL,
  GROWTH_HOME_DATAMOON_RUNS_API_PATH,
  GROWTH_HOME_DATAMOON_SOURCING_DRAFT_API_PATH,
} from "../lib/growth/ava-home/datamoon/growth-home-datamoon-sourcing-api-contract"

const PHASE = "GE-AVA-DATAMOON-SOURCING-WORKBENCH-1A" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Datamoon sourcing workbench certification`)

  assert.equal(GROWTH_AVA_DATAMOON_SOURCING_WORKBENCH_1A_QA_MARKER, "ge-ava-datamoon-sourcing-workbench-1a-v1")
  assert.equal(GROWTH_HOME_DATAMOON_SOURCING_DRAFT_API_PATH, "/api/platform/growth/ava/datamoon-sourcing/draft")
  assert.equal(GROWTH_HOME_DATAMOON_RUNS_API_PATH, "/api/platform/growth/lead-sources/datamoon/runs")

  const equipmentDraft = parseAvaDatamoonSourcingCommand("Find equipment maintenance software buyers")
  assert.equal(equipmentDraft.editable, true)
  assert.equal(equipmentDraft.requiresApproval, true)
  assert.ok(equipmentDraft.audienceDraft.topics.includes("equipment maintenance software"))
  assert.ok(equipmentDraft.audienceDraft.intentLevels.includes("high"))
  assert.ok(equipmentDraft.audienceDraft.intentLevels.includes("medium"))
  assert.equal(equipmentDraft.audienceDraft.lookbackDays, 7)
  assert.equal(equipmentDraft.audienceDraft.geography.country, "US")
  assert.equal(equipmentDraft.audienceDraft.companySize, "smb")
  assert.ok(equipmentDraft.explanation.includes("Review or edit"))

  const medicalDraft = parseAvaDatamoonSourcingCommand("Find medical equipment service companies")
  assert.ok(medicalDraft.audienceDraft.topics.includes("medical equipment service"))

  const publicSafetyDraft = parseAvaDatamoonSourcingCommand("Find public safety service companies")
  assert.ok(publicSafetyDraft.audienceDraft.topics.includes("public safety equipment service"))
  assert.ok(publicSafetyDraft.audienceDraft.jobTitles.includes("general manager"))

  assert.equal(isRecognizedAvaDatamoonSourcingCommand(""), false)
  assert.equal(isRecognizedAvaDatamoonSourcingCommand("Find buyers in Texas"), true)

  const manualDraft = createDefaultAvaDatamoonAudienceDraft({ audienceName: "Manual audience" })
  const manualRequest = buildDatamoonImportRequestFromAudienceDraft(manualDraft)
  assert.equal(manualRequest.run_name, "Manual audience")
  assert.ok(Array.isArray(manualRequest.filters))
  assert.ok(manualRequest.filters.some((filter) => filter.field === "country"))

  const avaRequest = buildDatamoonImportRequestFromAudienceDraft(equipmentDraft.audienceDraft)
  assert.equal(avaRequest.audience_type, equipmentDraft.audienceDraft.audienceType)
  assert.ok(avaRequest.filters.some((filter) => filter.field === "topic"))

  const draftRoute = readSource("app/api/platform/growth/ava/datamoon-sourcing/draft/route.ts")
  assert.match(draftRoute, /parseAvaDatamoonSourcingCommand/)
  assert.doesNotMatch(
    draftRoute,
    /buildAudience|fetchAudience|startDatamoonAudienceImportRun|datamoon-client|importDatamoon|createGrowthLead|sendEmail|enroll|outbound/i,
  )

  const workbenchSource = readSource(
    "components/growth/workspace/executive-briefing/growth-home-datamoon-sourcing-workbench-section.tsx",
  )
  assert.match(workbenchSource, /ava_draft/)
  assert.match(workbenchSource, /manual_search/)
  assert.match(workbenchSource, /GROWTH_HOME_AVA_ASK_DRAFT_LABEL/)
  assert.match(workbenchSource, /GROWTH_HOME_BUILD_AUDIENCE_LABEL/)
  assert.match(workbenchSource, /buildConfirmed/)
  assert.match(workbenchSource, /GROWTH_HOME_DATAMOON_RUNS_API_PATH/)
  assert.match(workbenchSource, /buildDatamoonImportRequestFromAudienceDraft/)
  assert.match(workbenchSource, /DatamoonSourcingWorkbenchForm/)
  assert.match(workbenchSource, /GROWTH_HOME_IMPORT_SELECTED_LABEL/)
  assert.match(workbenchSource, /GROWTH_HOME_REJECT_SELECTED_LABEL/)
  assert.doesNotMatch(
    workbenchSource,
    /import_all_previewed:\s*true[^}]*handleBuildAudience|handleBuildAudience[\s\S]*import_all_previewed:\s*true/,
  )
  assert.doesNotMatch(workbenchSource, /sendEmail|enrollSequence|sequenceEnrollment|launchCampaign|createLeadCandidate|autoImport/i)
  assert.match(workbenchSource, /no auto-import/)

  const importService = readSource("lib/growth/lead-sources/datamoon/datamoon-audience-import-service.ts")
  assert.match(importService, /startDatamoonAudienceImportRun/)
  assert.match(importService, /importDatamoonAudiencePreviewRecords/)

  const formSource = readSource("components/growth/lead-sources/datamoon/datamoon-sourcing-workbench-form.tsx")
  assert.match(formSource, /Audience name/)
  assert.match(formSource, /Intent levels/)
  assert.match(formSource, /Job titles/)
  assert.match(formSource, /Include business email/)

  const dashboardSource = readSource(
    "components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx",
  )
  assert.match(dashboardSource, /GrowthHomeDatamoonSourcingWorkbenchSection/)

  assert.equal(GROWTH_HOME_AVA_ASK_DRAFT_LABEL, "Ask Ava to Draft")
  assert.equal(GROWTH_HOME_BUILD_AUDIENCE_LABEL, "Build Audience")

  console.log(`[${PHASE}] PASS — Datamoon sourcing workbench certified (local)`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
