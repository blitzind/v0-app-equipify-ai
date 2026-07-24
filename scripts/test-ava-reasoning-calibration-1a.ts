/**
 * AVA-REASONING-CALIBRATION-1A — Focused certification.
 * Run: pnpm test:ava-reasoning-calibration-1a
 */

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  AVA_REASONING_CALIBRATION_1A_QA_MARKER,
  EQUIPIFY_AVA_CALIBRATED_OBJECTIVE,
  EQUIPIFY_AVA_CALIBRATED_ROLE_KNOWLEDGE,
  enrichOrganizationKnowledgeWithSalesCalibration,
} from "../lib/growth/ava-reasoning/equipify-ava-sales-calibration"
import type { AvaOrganizationKnowledge } from "../lib/fuzor/ava-reasoning/ava-reasoning-types"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf8")
}

async function main(): Promise<void> {
  console.log(`[${AVA_REASONING_CALIBRATION_1A_QA_MARKER}] focused certification`)

  const cutover = readSource("lib/growth/ava-reasoning/equipify-supervised-cutover-service.ts")
  assert.match(cutover, /EQUIPIFY_AVA_CALIBRATED_ROLE_KNOWLEDGE/)
  assert.match(cutover, /EQUIPIFY_AVA_CALIBRATED_OBJECTIVE/)
  assert.match(cutover, /enrichOrganizationKnowledgeWithSalesCalibration/)
  assert.doesNotMatch(cutover, /AVA_GROWTH_ROLE_KNOWLEDGE_V1/)

  // Reusable layer unchanged.
  assert.doesNotMatch(
    readSource("lib/fuzor/ava-reasoning/ava-reasoning-prompts.ts"),
    /CALIBRATION|salesperson waiting|due diligence/i,
  )
  assert.doesNotMatch(
    readSource("lib/fuzor/ava-reasoning/ava-role-knowledge.ts"),
    /CALIBRATION|salesperson waiting/i,
  )

  assert.match(EQUIPIFY_AVA_CALIBRATED_OBJECTIVE, /likely worth contacting/)
  assert.match(EQUIPIFY_AVA_CALIBRATED_OBJECTIVE, /probability/)
  assert.match(EQUIPIFY_AVA_CALIBRATED_ROLE_KNOWLEDGE.summary, /imperfect/)
  assert.match(
    EQUIPIFY_AVA_CALIBRATED_ROLE_KNOWLEDGE.constraints.join(" "),
    /Hold only when/i,
  )
  assert.doesNotMatch(
    EQUIPIFY_AVA_CALIBRATED_ROLE_KNOWLEDGE.constraints.join(" "),
    /confidence score|fit score|pain score/i,
  )

  const kb: AvaOrganizationKnowledge = {
    source: "approved_business_profile",
    versionId: "p1",
    organizationName: "Equipify",
    identitySummary: null,
    productsAndCapabilities: [],
    customersServed: [],
    problemsSolved: [],
    differentiators: [],
    positioning: [],
    approvedTerminologyPrefer: [],
    approvedTerminologyAvoid: [],
    customerOutcomes: [],
    limitations: [],
    disqualifiers: [],
  } as AvaOrganizationKnowledge

  const enriched = enrichOrganizationKnowledgeWithSalesCalibration(kb)
  assert.match(enriched.positioning.join(" "), /Hold is rare/)

  console.log(`[${AVA_REASONING_CALIBRATION_1A_QA_MARKER}] PASS`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
