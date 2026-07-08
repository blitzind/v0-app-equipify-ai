/**
 * GE-AVA-LAUNCH-RESULT-SEMANTICS-1B — Launch semantics + drawer spacing certification.
 * Run: pnpm test:ge-ava-launch-result-semantics-1b
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildAvaLaunchRunResultSemantics,
  buildAvaLaunchRunSuccessMessage,
  resolveAvaLaunchRunStoppedAt,
} from "../lib/growth/mission-center/growth-mission-ava-launch-run-result-semantics"

const PHASE = "GE-AVA-LAUNCH-RESULT-SEMANTICS-1B" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log(`[${PHASE}] Launch semantics + drawer spacing certification`)

  const detailDrawer = readSource("components/detail-drawer.tsx")
  assert.match(detailDrawer, /DRAWER_SHELL_CONTENT_CLASS/)
  assert.match(detailDrawer, /DRAWER_SHELL_PAD_X = "px-6"/)
  assert.match(detailDrawer, /space-y-6 dark:bg-\[#0B111E\]/)

  const sheet = readSource("components/ui/sheet.tsx")
  assert.match(sheet, /DRAWER_SHELL_CONTENT_CLASS/)
  assert.match(sheet, /DRAWER_SHELL_HEADER_CLASS/)
  assert.match(sheet, /DRAWER_CLOSE_BUTTON_CLASS/)

  const drawer = readSource("components/ui/drawer.tsx")
  assert.match(drawer, /DRAWER_SHELL_HEADER_CLASS/)
  assert.match(drawer, /DRAWER_SHELL_FOOTER_CLASS/)

  const service = readSource("lib/growth/mission-center/growth-mission-ava-launch-run-service.ts")
  assert.match(service, /buildAvaLaunchRunResultSemantics/)
  assert.match(service, /runCreatedApprovalCount/)
  assert.doesNotMatch(service, /stoppedAt: "human_approval"/)

  const workbench = readSource(
    "components/growth/workspace/executive-briefing/growth-home-datamoon-sourcing-workbench-section.tsx",
  )
  assert.match(workbench, /buildAvaLaunchRunSuccessMessage/)
  assert.doesNotMatch(workbench, /humanApprovalCenter\.totalPending/)

  const zeroImport = buildAvaLaunchRunResultSemantics({
    importedLeadIds: [],
    researchLeads: [],
    orgHumanApprovalPendingTotal: 4,
    runCreatedApprovalCount: 0,
  })
  assert.equal(zeroImport.stoppedAt, "import_complete")
  const zeroImportMessage = buildAvaLaunchRunSuccessMessage(zeroImport)
  assert.match(zeroImportMessage, /not created by this run/)
  assert.doesNotMatch(zeroImportMessage, /4 approval item.*from this run/i)

  const researchPending = buildAvaLaunchRunResultSemantics({
    importedLeadIds: ["lead-1"],
    researchLeads: [{ leadId: "lead-1", workflowStatus: "researching", researchPilotEnabled: true }],
    orgHumanApprovalPendingTotal: 4,
    runCreatedApprovalCount: 0,
  })
  assert.equal(researchPending.stoppedAt, "research_pending")
  assert.match(buildAvaLaunchRunSuccessMessage(researchPending), /Research is running asynchronously/)

  assert.equal(
    resolveAvaLaunchRunStoppedAt({ importedLeadCount: 2, runCreatedApprovalCount: 1 }),
    "human_approval",
  )

  console.log(`[${PHASE}] passed`)
}

main()
