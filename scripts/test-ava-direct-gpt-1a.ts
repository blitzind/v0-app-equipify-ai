/**
 * AVA-DIRECT-GPT-1A — Focused certification.
 * Run: pnpm test:ava-direct-gpt-1a
 */

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  buildAvaDirectGptSystemPrompt,
  buildAvaDirectGptUserPrompt,
} from "../lib/growth/ava-reasoning/ava-direct-gpt-experiment/ava-direct-gpt-prompts"
import { normalizeAvaDirectGptResult } from "../lib/growth/ava-reasoning/ava-direct-gpt-experiment/ava-direct-gpt-schema"
import { runAvaDirectGptExperiment } from "../lib/growth/ava-reasoning/ava-direct-gpt-experiment/ava-direct-gpt-experiment"
import { EQUIPIFY_AVA_CALIBRATED_ROLE_KNOWLEDGE } from "../lib/growth/ava-reasoning/equipify-ava-sales-calibration"

const ROOT = process.cwd()

async function main(): Promise<void> {
  console.log("[ava-direct-gpt-1a-v1] focused certification")

  const avaService = readFileSync(
    resolve(ROOT, "lib/fuzor/ava-reasoning/ava-reasoning-service.ts"),
    "utf8",
  )
  assert.doesNotMatch(avaService, /ava-direct-gpt-experiment/)

  const system = buildAvaDirectGptSystemPrompt(EQUIPIFY_AVA_CALIBRATED_ROLE_KNOWLEDGE)
  assert.match(system, /no pre-built Company Intelligence/i)

  const user = buildAvaDirectGptUserPrompt({
    companyName: "Acme Service",
    website: "https://acme.example",
    websiteText: "We service forklifts for local businesses.",
    roleKnowledge: EQUIPIFY_AVA_CALIBRATED_ROLE_KNOWLEDGE,
    objective: "Sell Equipify to qualified prospects.",
    organizationKnowledge: {
      source: "test",
      versionId: null,
      organizationName: "Equipify",
      identitySummary: "Equipment service platform",
      productsAndCapabilities: ["work orders"],
      customersServed: ["field service"],
      problemsSolved: ["dispatch"],
      differentiators: [],
      positioning: [],
      approvedTerminologyPrefer: [],
      approvedTerminologyAvoid: [],
      customerOutcomes: [],
      limitations: [],
      disqualifiers: ["retail"],
    },
    contacts: [],
  })
  assert.match(user, /PUBLIC WEBSITE TEXT/i)
  assert.doesNotMatch(user, /CANONICAL COMPANY INTELLIGENCE/i)

  const normalized = normalizeAvaDirectGptResult({
    companyUnderstanding: "Acme services forklifts.",
    decision: "pursue",
    rationale: "Field service fit.",
    strongestAngle: "Service workflows",
    recommendedContact: null,
    missingInformation: [],
    email: null,
    evidenceReferences: ["forklifts"],
  })
  assert.equal(normalized.companyUnderstanding, "Acme services forklifts.")

  const run = await runAvaDirectGptExperiment({
    companyName: "Acme Service",
    website: "https://acme.example",
    websiteText: "We service forklifts.",
    organizationId: "55555555-5555-4555-8555-555555555555",
    roleKnowledge: EQUIPIFY_AVA_CALIBRATED_ROLE_KNOWLEDGE,
    objective: "Sell Equipify.",
    organizationKnowledge: {
      source: "test",
      versionId: null,
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
    },
    contacts: [],
  })

  void run
  console.log("[ava-direct-gpt-1a-v1] PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
