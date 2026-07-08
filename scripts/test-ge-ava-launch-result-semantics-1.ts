/**
 * GE-AVA-LAUNCH-RESULT-SEMANTICS-1 — Run Ava success result semantics certification.
 * Run: pnpm test:ge-ava-launch-result-semantics-1
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AVA_LAUNCH_RESULT_SEMANTICS_1_QA_MARKER,
  buildAvaLaunchRunResultSemantics,
  buildAvaLaunchRunSuccessMessage,
  countRunRelatedHumanApprovalPending,
  resolveAvaLaunchRunStoppedAt,
} from "../lib/growth/mission-center/growth-mission-ava-launch-run-result-semantics"

const PHASE = "GE-AVA-LAUNCH-RESULT-SEMANTICS-1" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log(`[${PHASE}] Run Ava launch result semantics certification`)

  assert.equal(GROWTH_AVA_LAUNCH_RESULT_SEMANTICS_1_QA_MARKER, "ge-ava-launch-result-semantics-1-v1")

  const service = readSource("lib/growth/mission-center/growth-mission-ava-launch-run-service.ts")
  assert.match(service, /buildAvaLaunchRunResultSemantics/)
  assert.match(service, /runCreatedApprovalCount/)
  assert.match(service, /orgHumanApprovalPendingTotal/)
  assert.match(service, /researchPendingCount/)
  assert.match(service, /stoppedAt: resultSemantics\.stoppedAt/)
  assert.doesNotMatch(service, /stoppedAt: "human_approval"/)
  assert.doesNotMatch(service, /humanApprovalCenter\.totalPending/)

  const contract = readSource("lib/growth/mission-center/growth-mission-ava-launch-run-api-contract.ts")
  assert.match(contract, /orgHumanApprovalPendingTotal/)
  assert.match(contract, /runCreatedApprovalCount/)
  assert.match(contract, /importedLeadCount/)
  assert.match(contract, /researchPendingCount/)
  assert.doesNotMatch(contract, /totalPending: number/)

  const workbench = readSource(
    "components/growth/workspace/executive-briefing/growth-home-datamoon-sourcing-workbench-section.tsx",
  )
  assert.match(workbench, /buildAvaLaunchRunSuccessMessage/)
  assert.match(workbench, /result\.importedLeadCount/)
  assert.match(workbench, /result\.orgHumanApprovalPendingTotal/)
  assert.doesNotMatch(workbench, /humanApprovalCenter\.totalPending/)

  const zeroImportOrgPending = buildAvaLaunchRunResultSemantics({
    importedLeadIds: [],
    researchLeads: [],
    orgHumanApprovalPendingTotal: 4,
    runCreatedApprovalCount: 0,
  })
  assert.equal(zeroImportOrgPending.stoppedAt, "import_complete")
  assert.equal(zeroImportOrgPending.runCreatedApprovalCount, 0)
  assert.equal(zeroImportOrgPending.orgHumanApprovalPendingTotal, 4)

  const zeroImportMessage = buildAvaLaunchRunSuccessMessage(zeroImportOrgPending)
  assert.match(zeroImportMessage, /No new leads were imported/)
  assert.match(zeroImportMessage, /4 existing pending approvals/)
  assert.doesNotMatch(zeroImportMessage, /4 approval item.*from this run/i)
  assert.doesNotMatch(zeroImportMessage, /pending approval.*from this run/i)

  const researchPending = buildAvaLaunchRunResultSemantics({
    importedLeadIds: ["lead-1", "lead-2"],
    researchLeads: [
      { leadId: "lead-1", workflowStatus: "researching", researchPilotEnabled: true },
      { leadId: "lead-2", workflowStatus: null, researchPilotEnabled: true },
    ],
    orgHumanApprovalPendingTotal: 4,
    runCreatedApprovalCount: 0,
  })
  assert.equal(researchPending.stoppedAt, "research_pending")
  assert.equal(researchPending.importedLeadCount, 2)
  assert.equal(researchPending.researchPendingCount, 2)

  const researchPendingMessage = buildAvaLaunchRunSuccessMessage(researchPending)
  assert.match(researchPendingMessage, /Imported 2 leads/)
  assert.match(researchPendingMessage, /Research is running asynchronously/)
  assert.match(researchPendingMessage, /Approval items will appear after research/)
  assert.match(researchPendingMessage, /4 existing pending approvals/)
  assert.doesNotMatch(researchPendingMessage, /4 approval item.*from this run/i)

  const humanApproval = resolveAvaLaunchRunStoppedAt({
    importedLeadCount: 2,
    runCreatedApprovalCount: 1,
  })
  assert.equal(humanApproval, "human_approval")

  assert.equal(
    countRunRelatedHumanApprovalPending(
      [
        { status: "pending", subjectType: "lead", subjectId: "lead-1" },
        { status: "needs_review", subjectType: "system", subjectId: "cal-1" },
      ],
      ["lead-1"],
    ),
    1,
  )

  const humanApprovalMessage = buildAvaLaunchRunSuccessMessage({
    importedLeadCount: 2,
    runCreatedApprovalCount: 1,
    orgHumanApprovalPendingTotal: 4,
    researchPendingCount: 1,
    stoppedAt: "human_approval",
  })
  assert.match(humanApprovalMessage, /1 approval item from this run is ready/)

  console.log(`[${PHASE}] passed`)
}

main()
