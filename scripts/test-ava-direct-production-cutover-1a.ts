/**
 * AVA-DIRECT-PRODUCTION-CUTOVER-1A — Focused certification (no GPT).
 * Run: pnpm test:ava-direct-production-cutover-1a
 */

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { AVA_DIRECT_PRODUCTION_CUTOVER_1A_QA_MARKER } from "../lib/growth/ava-reasoning/ava-direct/equipify-ava-direct-reasoning"
import { AVA_SUPERVISED_CUTOVER_1A_QA_MARKER } from "../lib/growth/ava-reasoning/equipify-supervised-cutover-service"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf8")
}

function certifyDirectSupervisedCutover(cutover: string): void {
  assert.match(cutover, /runEquipifyAvaDirectReasoning/)
  assert.match(cutover, /retrieveWebsiteTextForAvaDirect/)
  assert.match(cutover, /persistSendableAvaSupervisedDraft/)
  assert.match(cutover, /input\.persist !== false/)
  assert.match(cutover, /input\.persist === false/)
  assert.match(cutover, /outboundSendAuthorized: false/)
  assert.doesNotMatch(cutover, /ensureCompanyIntelligenceForGrowthLead/)
  assert.doesNotMatch(cutover, /runAvaReasoning\(/)
  assert.doesNotMatch(cutover, /insertGrowthAiCopilotGeneration/)
  assert.doesNotMatch(
    cutover,
    /executeOutbound|sendOutbound|queueSequence|transportJob|runEquipifyOutbound/i,
  )
}

async function main(): Promise<void> {
  console.log(`[${AVA_DIRECT_PRODUCTION_CUTOVER_1A_QA_MARKER}] focused certification`)

  const route = readSource("app/api/platform/growth/leads/[leadId]/ava-direct-outreach/route.ts")
  assert.match(route, /runEquipifySupervisedAvaOutreach/)
  assert.match(route, /persist: parsed\.data\?\.persist/)
  assert.doesNotMatch(route, /runAvaDirectOutreach/)

  certifyDirectSupervisedCutover(
    readSource("lib/growth/ava-reasoning/equipify-supervised-cutover-service.ts"),
  )

  console.log(`[${AVA_SUPERVISED_CUTOVER_1A_QA_MARKER}] PASS`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
