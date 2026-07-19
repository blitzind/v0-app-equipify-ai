/**
 * GE-AVA-OPERATOR-WORKSPACE-1 — Ava operator approval workspace UI certification.
 * Run: pnpm test:ge-ava-operator-workspace-1
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AVA_OPERATOR_SEQUENCE_APPROVAL_HREF,
  GROWTH_AVA_OPERATOR_SUCCESS_PIPELINE_STEPS,
  GROWTH_AVA_OPERATOR_WORKSPACE_1_QA_MARKER,
  buildAvaOperatorPackageActionApiPath,
} from "../lib/growth/mission-center/growth-ava-operator-workspace-contract"

const PHASE = "GE-AVA-OPERATOR-WORKSPACE-1" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Operator approval workspace UI certification`)

  assert.equal(GROWTH_AVA_OPERATOR_WORKSPACE_1_QA_MARKER, "ge-ava-operator-workspace-1-v1")
  assert.equal(GROWTH_AVA_OPERATOR_SEQUENCE_APPROVAL_HREF, "/growth/campaigns/sequences")
  assert.equal(
    buildAvaOperatorPackageActionApiPath("pkg-1"),
    "/api/platform/growth/ai-os/autonomous-outreach-preparation-pilot/packages/pkg-1/action",
  )
  assert.deepEqual(GROWTH_AVA_OPERATOR_SUCCESS_PIPELINE_STEPS, [
    "Package authorized",
    "Execution request created",
    "Sequence prepared",
    "Transport approval required",
    "Reply monitoring automatic",
    "Follow-up automatic",
  ])

  const workspace = readSource("components/growth/ai-os/growth-ava-operator-approval-workspace.tsx")
  assert.match(workspace, /GrowthAvaOperatorApprovalWorkspace/)
  assert.match(workspace, /Research Summary/)
  assert.match(workspace, /Opportunity Assessment/)
  assert.match(workspace, /Buying Committee/)
  assert.match(workspace, /Communication Strategy/)
  assert.match(workspace, /Draft Preview/)
  assert.match(workspace, /Authorize/)
  assert.match(workspace, /Review transport approval/)
  assert.match(workspace, /GROWTH_AVA_OPERATOR_SEQUENCE_APPROVAL_HREF/)
  assert.match(workspace, /GROWTH_AVA_OPERATOR_SUCCESS_PIPELINE_STEPS/)
  assert.doesNotMatch(workspace, /executeTransportSend|sendSms|runSequenceExecutionJob/)
  assert.doesNotMatch(workspace, /Approve Package/)

  const panel = readSource("components/growth/ai-os/growth-ai-os-lead-research-pilot-panel.tsx")
  assert.match(panel, /GrowthAvaOperatorApprovalWorkspace/)
  assert.match(panel, /packageId/)

  const page = readSource("app/(growth)/growth/os/pilot/lead-research/[leadId]/page.tsx")
  assert.match(page, /useSearchParams/)
  assert.match(page, /packageId/)

  const hac = readSource("lib/growth/aios/approvals/growth-human-approval-center-engine.ts")
  assert.match(hac, /buildGrowthReviewPackageHref/)

  console.log(`[${PHASE}] passed`)
}

void main()
