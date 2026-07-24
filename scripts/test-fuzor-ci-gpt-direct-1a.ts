/**
 * FUZOR-COMPANY-INTELLIGENCE-GPT-DIRECT-1A — Focused certification.
 * Run: pnpm test:fuzor-ci-gpt-direct-1a
 */

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  buildGptDirectCompanyIntelligenceSystemPrompt,
  buildGptDirectCompanyIntelligenceUserPrompt,
  FUZOR_CI_GPT_DIRECT_1A_QA_MARKER,
} from "../lib/growth/company-intelligence/gpt-direct-experiment/fuzor-company-intelligence-gpt-direct-prompts"
import {
  runGptDirectCompanyIntelligenceExperiment,
  retrieveWebsiteTextForGptDirect,
} from "../lib/growth/company-intelligence/gpt-direct-experiment/fuzor-company-intelligence-gpt-direct-experiment"
import { normalizeFuzorCompanyBusinessUnderstanding } from "../lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-schema"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf8")
}

async function main(): Promise<void> {
  console.log(`[${FUZOR_CI_GPT_DIRECT_1A_QA_MARKER}] focused certification`)

  const prodService = readSource(
    "lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-service.ts",
  )
  assert.doesNotMatch(prodService, /gpt-direct-experiment/)

  const system = buildGptDirectCompanyIntelligenceSystemPrompt()
  assert.match(system, /informed business decisions/i)
  assert.doesNotMatch(system, /VERIFIED OFFERINGS/i)

  const user = buildGptDirectCompanyIntelligenceUserPrompt({
    companyName: "Acme Lift",
    website: "https://acme.example",
    websitePages: [{ url: "https://acme.example", text: "We provide forklift service." }],
    retrievalStatus: "ok",
  })
  assert.match(user, /RETRIEVED WEBSITE TEXT/i)
  assert.match(user, /forklift service/i)
  assert.doesNotMatch(user, /Evidence extraction/i)

  const sampleUnderstanding = normalizeFuzorCompanyBusinessUnderstanding({
    executiveSummary: "Acme provides forklift service.",
    revenueModel: { summary: "Service revenue.", models: ["service"], evidence: ["forklift service"] },
    productsAndServices: {
      offerings: ["Forklift service"],
      notes: null,
      evidence: ["forklift service"],
    },
    operationalModel: {
      summary: "Field service business.",
      characteristics: ["field service"],
      evidence: ["forklift service"],
    },
    customers: { summary: "Local businesses.", segments: ["businesses"], evidence: ["local community"] },
    industriesServed: { industries: ["material handling"], evidence: ["forklift"] },
    operationalChallenges: { challenges: [] },
    companyStrengths: { strengths: ["Clear service focus"], evidence: ["forklift service"] },
    unknowns: [],
    evidenceUsed: ["We provide forklift service."],
    evidenceWeakness: null,
  })

  const run = await runGptDirectCompanyIntelligenceExperiment({
    companyName: "Acme Lift",
    website: "https://acme.example",
    organizationId: "55555555-5555-4555-8555-555555555555",
    retrieveWebsite: async () => ({
      status: "ok",
      normalizedUrl: "https://acme.example",
      pages: [{ url: "https://acme.example", text: "We provide forklift service." }],
      totalChars: 28,
      message: null,
    }),
    runModel: async ({ userPrompt, systemPrompt }) => {
      assert.match(userPrompt, /forklift service/i)
      assert.match(systemPrompt, /informed business decisions/i)
      return {
        provider: "openai",
        model: "gpt-5.5",
        understanding: sampleUnderstanding,
        promptTokens: 10,
        completionTokens: 20,
      }
    },
  })

  assert.equal(run.ok, true)
  if (run.ok) {
    assert.equal(run.output.qaMarker, FUZOR_CI_GPT_DIRECT_1A_QA_MARKER)
    assert.match(run.output.understanding.executiveSummary, /forklift/i)
  }

  const retrieval = await retrieveWebsiteTextForGptDirect(null)
  assert.equal(retrieval.status, "no_website")

  console.log(`[${FUZOR_CI_GPT_DIRECT_1A_QA_MARKER}] PASS`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
