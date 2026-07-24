/**
 * FUZOR-COMPANY-INTELLIGENCE-GPT-FIRST-1A — Focused certification.
 * Run: pnpm test:fuzor-ci-gpt-first-1a
 */

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  FUZOR_COMPANY_INTELLIGENCE_GPT_FIRST_1A_QA_MARKER,
  FUZOR_COMPANY_INTELLIGENCE_PROMPT_VERSION,
} from "../lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-types"
import {
  buildFuzorCompanyIntelligenceSystemPrompt,
  buildFuzorCompanyIntelligenceUserPrompt,
} from "../lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-prompts"
import { computeFuzorCompanyIntelligenceEvidenceFingerprint } from "../lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-evidence-fingerprint"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf8")
}

async function main(): Promise<void> {
  console.log(`[${FUZOR_COMPANY_INTELLIGENCE_GPT_FIRST_1A_QA_MARKER}] focused certification`)

  assert.equal(FUZOR_COMPANY_INTELLIGENCE_PROMPT_VERSION, "fuzor-company-intelligence-gpt-first-1a-v1")

  const system = buildFuzorCompanyIntelligenceSystemPrompt()
  assert.match(system, /informed business decisions/i)
  assert.match(system, /business comprehension/i)
  assert.doesNotMatch(system, /Summarize this company exactly/i)
  assert.match(system, /Do not mention Equipify/i)

  const user = buildFuzorCompanyIntelligenceUserPrompt({
    companyName: "Acme Lift Service",
    website: "https://acme.example",
    leadId: "11111111-1111-4111-8111-111111111111",
    linkedinCompanyUrl: null,
    verifiedDescription: "Regional forklift service provider.",
    verifiedOfferings: [],
    verifiedIndustries: [],
    verifiedCustomers: [],
    verifiedMarkets: [],
    verifiedDifferentiators: [],
    verifiedTechnologySignals: [],
    verifiedHiringSignals: [],
    websiteExcerpts: ["Founded to provide forklift service to the local community."],
    pagesObserved: [{ url: "https://acme.example/about", pageType: "about", status: "crawled" }],
    datamoonFindings: [],
    priorResearchNotes: null,
    missingFromCollection: ["Products or services not confirmed."],
  })
  assert.match(user, /Understand this company well enough/i)
  assert.match(system, /not a homepage summary/i)
  assert.doesNotMatch(user, /Here is everything we know/i)

  const fingerprintSource = readSource(
    "lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-evidence-fingerprint.ts",
  )
  assert.match(fingerprintSource, /promptVersion: FUZOR_COMPANY_INTELLIGENCE_PROMPT_VERSION/)

  const { evidenceFingerprint: a } = computeFuzorCompanyIntelligenceEvidenceFingerprint({
    companyName: "Acme",
    website: "https://acme.example",
    leadId: "11111111-1111-4111-8111-111111111111",
    linkedinCompanyUrl: null,
    verifiedDescription: "Service company",
    verifiedOfferings: ["service"],
    verifiedIndustries: [],
    verifiedCustomers: [],
    verifiedMarkets: [],
    verifiedDifferentiators: [],
    verifiedTechnologySignals: [],
    verifiedHiringSignals: [],
    websiteExcerpts: ["excerpt"],
    pagesObserved: [],
    datamoonFindings: [],
    priorResearchNotes: null,
    missingFromCollection: [],
  })

  // Prompt version in fingerprint should remain stable for identical packets across calls.
  const { evidenceFingerprint: b } = computeFuzorCompanyIntelligenceEvidenceFingerprint({
    companyName: "Acme",
    website: "https://acme.example",
    leadId: "11111111-1111-4111-8111-111111111111",
    linkedinCompanyUrl: null,
    verifiedDescription: "Service company",
    verifiedOfferings: ["service"],
    verifiedIndustries: [],
    verifiedCustomers: [],
    verifiedMarkets: [],
    verifiedDifferentiators: [],
    verifiedTechnologySignals: [],
    verifiedHiringSignals: [],
    websiteExcerpts: ["excerpt"],
    pagesObserved: [],
    datamoonFindings: [],
    priorResearchNotes: null,
    missingFromCollection: [],
  })
  assert.equal(a, b)

  console.log(`[${FUZOR_COMPANY_INTELLIGENCE_GPT_FIRST_1A_QA_MARKER}] PASS`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
