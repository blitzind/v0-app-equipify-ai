/**
 * GE-AIOS-END-TO-END-1A — Supervised sales loop certification (architecture + safety, no send).
 * Run: pnpm test:ge-aios-end-to-end-supervised-sales-loop-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GE_AIOS_END_TO_END_1A_BLOCK_IMAGING_LEAD_ID,
  GE_AIOS_END_TO_END_1A_LIVE_SEND_CONFIRM_ENV,
  GE_AIOS_END_TO_END_SUPERVISED_SALES_LOOP_1A_QA_MARKER,
} from "../lib/growth/training/end-to-end-supervised-sales-loop-1a-types"

const ROOT = process.cwd()
const PHASE = "GE-AIOS-END-TO-END-SUPERVISED-SALES-LOOP-1A" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function main(): void {
  console.log(`[${PHASE}] End-to-end supervised sales loop certification`)

  assert.equal(
    GE_AIOS_END_TO_END_SUPERVISED_SALES_LOOP_1A_QA_MARKER,
    "ge-aios-end-to-end-supervised-sales-loop-1a-v1",
  )
  assert.equal(GE_AIOS_END_TO_END_1A_LIVE_SEND_CONFIRM_ENV, "CONFIRM_GE_AIOS_END_TO_END_1A_LIVE_SEND")
  assert.equal(GE_AIOS_END_TO_END_1A_BLOCK_IMAGING_LEAD_ID, "6d9220f0-2960-468c-b4be-5d7595d292c3")

  const audit = readSource("lib/growth/training/end-to-end-supervised-sales-loop-production-audit-1a.ts")
  assert.match(audit, /runEndToEndSupervisedSalesLoopProductionAudit/)
  assert.match(audit, /pending_approval/)
  assert.doesNotMatch(audit, /executeTransportSend|runSequenceExecutionJob|\.insert\(|\.update\(|\.delete\(/)
  console.log("  ✓ production audit module is read-only")

  const probe = readSource("scripts/probe-ge-aios-end-to-end-supervised-sales-loop-1a.ts")
  assert.match(probe, /requireVercelProductionEnvRun: true/)
  assert.match(probe, /CONFIRM_GE_AIOS_END_TO_END_1A_LIVE_SEND/)
  console.log("  ✓ production probe requires Vercel production env and explicit live-send confirm")

  const handoff = readSource("lib/growth/mission-center/growth-ava-outreach-sequence-handoff-1f.ts")
  assert.match(handoff, /evaluateAvaOutreachPackageReadiness/)
  const enrollmentReuse = readSource("lib/growth/mission-center/growth-ava-outreach-enrollment-reuse-1i.ts")
  assert.match(enrollmentReuse, /validateSupervisedExecutionEnrollmentReuse/)
  const fulfillment = readSource(
    "lib/growth/mission-center/growth-ava-outreach-execution-request-fulfillment-service.ts",
  )
  assert.match(fulfillment, /validateSupervisedExecutionEnrollmentReuse/)
  assert.doesNotMatch(fulfillment, /executeTransportSend|sendSms|runSequenceExecutionJob/)
  console.log("  ✓ reuses supervised handoff 1F and enrollment reuse 1I — no parallel fulfillment")

  const sendDrawer = readSource("components/growth/workspace/ux-1a/review/growth-review-send-drawer.tsx")
  assert.match(sendDrawer, /sequences\/execution\/jobs/)
  assert.match(sendDrawer, /Nothing has been sent yet/)
  console.log("  ✓ send approval reuses canonical sequence job approve path")

  const packageCard = readSource("components/growth/ai-os/approvals/growth-ava-completed-outreach-package-card.tsx")
  assert.match(packageCard, /Authorize/)
  console.log("  ✓ package approval reuses existing outreach package card")

  assert.match(readSource("package.json"), /probe:ge-aios-end-to-end-supervised-sales-loop-1a/)
  assert.match(readSource("package.json"), /test:ge-aios-end-to-end-supervised-sales-loop-1a/)
  console.log("  ✓ package scripts registered")

  console.log(`[${PHASE}] passed`)
}

main()
