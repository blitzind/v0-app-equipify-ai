/**
 * FUZOR-COMPANY-INTELLIGENCE-1A — Focused certification.
 * Run: pnpm test:fuzor-company-intelligence-1a
 */

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  FUZOR_COMPANY_INTELLIGENCE_1A_QA_MARKER,
  FUZOR_COMPANY_INTELLIGENCE_MODEL,
  type FuzorCompanyIntelligenceEvidencePacket,
} from "../lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-types"
import { runFuzorCompanyIntelligence } from "../lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-service"
import {
  fuzorCompanyBusinessUnderstandingSchema,
  normalizeFuzorCompanyBusinessUnderstanding,
} from "../lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-schema"
import {
  buildFuzorCompanyIntelligenceSystemPrompt,
  buildFuzorCompanyIntelligenceUserPrompt,
} from "../lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-prompts"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf8")
}

function samplePacket(
  overrides?: Partial<FuzorCompanyIntelligenceEvidencePacket>,
): FuzorCompanyIntelligenceEvidencePacket {
  return {
    companyName: "Acme Biomedical Service",
    website: "https://acme-biomed.example",
    leadId: "11111111-1111-4111-8111-111111111111",
    linkedinCompanyUrl: null,
    verifiedDescription:
      "Acme Biomedical Service repairs and maintains medical imaging equipment on-site.",
    verifiedOfferings: ["MRI service", "CT preventative maintenance"],
    verifiedIndustries: ["Healthcare"],
    verifiedCustomers: ["Hospitals"],
    verifiedMarkets: ["United States"],
    verifiedDifferentiators: ["Multi-vendor imaging service"],
    verifiedTechnologySignals: [],
    verifiedHiringSignals: [],
    websiteExcerpts: ["We service MRI and CT systems nationwide."],
    pagesObserved: [{ url: "https://acme-biomed.example/services", pageType: "services", status: "crawled" }],
    datamoonFindings: [],
    priorResearchNotes: "Medical equipment service firm with field technicians.",
    missingFromCollection: [],
    ...overrides,
  }
}

async function main(): Promise<void> {
  console.log(`[${FUZOR_COMPANY_INTELLIGENCE_1A_QA_MARKER}] focused certification`)

  // Must not touch restricted surfaces.
  for (const file of [
    "lib/growth/home/growth-home-workspace-summary-service.ts",
    "lib/growth/ava-direct-outreach/ava-direct-outreach-service.ts",
    "components/growth/workspace/growth-workspace-dashboard-body.tsx",
  ]) {
    assert.doesNotMatch(readSource(file), /fuzor-company-intelligence-1a|FUZOR_COMPANY_INTELLIGENCE/)
  }

  assert.match(
    readSource(
      "lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-types.ts",
    ),
    /gpt-5\.5/,
  )
  assert.equal(FUZOR_COMPANY_INTELLIGENCE_MODEL, "gpt-5.5")

  const system = buildFuzorCompanyIntelligenceSystemPrompt()
  assert.match(system, /business comprehension|informed business decisions/i)
  assert.match(system, /Do not mention Equipify/i)
  assert.match(system, /Do not determine ICP fit/i)

  const user = buildFuzorCompanyIntelligenceUserPrompt(samplePacket())
  assert.match(user, /Acme Biomedical Service/)
  assert.match(user, /VERIFIED DESCRIPTION/)
  assert.doesNotMatch(user, /idealCustomer|disqualifier|sellerTruth/i)

  const parsed = normalizeFuzorCompanyBusinessUnderstanding(
    fuzorCompanyBusinessUnderstandingSchema.parse({
      executiveSummary: "Acme services medical imaging equipment in the field.",
      revenueModel: {
        summary: "Likely service revenue from maintenance and repairs.",
        models: ["service", "parts"],
        evidence: ["repairs and maintains medical imaging equipment"],
      },
      productsAndServices: {
        offerings: ["MRI service", "CT preventative maintenance"],
        notes: null,
        evidence: ["MRI service"],
      },
      operationalModel: {
        summary: "Field technicians perform on-site service.",
        characteristics: ["field technicians", "recurring maintenance"],
        evidence: ["on-site"],
      },
      customers: {
        summary: "Healthcare providers.",
        segments: ["Hospitals"],
        evidence: ["Hospitals"],
      },
      industriesServed: {
        industries: ["Healthcare"],
        evidence: ["Healthcare"],
      },
      operationalChallenges: {
        challenges: [
          {
            challenge: "Multi-modality service coordination",
            why: "Serving MRI and CT systems implies complex asset and technician workflows.",
            evidence: ["MRI service", "CT preventative maintenance"],
          },
        ],
      },
      companyStrengths: {
        strengths: ["Clear multi-modality imaging service focus"],
        evidence: ["MRI service"],
      },
      unknowns: ["technician count", "service volume"],
      evidenceUsed: ["Acme Biomedical Service repairs and maintains medical imaging equipment on-site."],
      evidenceWeakness: null,
    }),
  )
  assert.match(parsed.executiveSummary, /imaging/i)
  assert.ok(parsed.unknowns.includes("technician count"))

  const fakeAdmin = {} as SupabaseClient

  const missing = await runFuzorCompanyIntelligence({
    admin: fakeAdmin,
    leadId: "11111111-1111-4111-8111-111111111111",
    organizationId: "55555555-5555-4555-8555-555555555555",
    gatherEvidence: async () => ({
      ok: false,
      code: "lead_not_found",
      message: "Lead not found.",
    }),
    runModel: async () => {
      throw new Error("should not run")
    },
  })
  assert.equal(missing.ok, false)
  if (!missing.ok) assert.equal(missing.code, "lead_not_found")

  const ok = await runFuzorCompanyIntelligence({
    admin: fakeAdmin,
    leadId: "11111111-1111-4111-8111-111111111111",
    organizationId: "55555555-5555-4555-8555-555555555555",
    gatherEvidence: async () => ({ ok: true, packet: samplePacket() }),
    runModel: async ({ userPrompt, systemPrompt }) => {
      assert.match(userPrompt, /Acme Biomedical Service/)
      assert.match(userPrompt, /VERIFIED OFFERINGS/)
      assert.match(systemPrompt, /Do not mention Equipify/)
      // Evidence packet itself must not inject seller/ICP context.
      assert.doesNotMatch(userPrompt, /idealCustomer|sellerTruth|disqualifier guidance/i)
      return {
        provider: "openai",
        model: FUZOR_COMPANY_INTELLIGENCE_MODEL,
        understanding: parsed,
        attempts: 1,
        promptTokens: 10,
        completionTokens: 20,
      }
    },
  })
  assert.equal(ok.ok, true)
  if (ok.ok) {
    assert.equal(ok.output.qaMarker, FUZOR_COMPANY_INTELLIGENCE_1A_QA_MARKER)
    assert.equal(ok.output.model, "gpt-5.5")
    assert.equal(ok.output.understanding.executiveSummary, parsed.executiveSummary)
    assert.equal(ok.output.promptTokens, 10)
    assert.equal(ok.output.completionTokens, 20)
  }

  // Evidence gatherer source must not import Equipify seller truth.
  assert.doesNotMatch(
    readSource(
      "lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-evidence-gatherer.ts",
    ),
    /loadOutreachSellerTruth|idealCustomer|missionComparison|websiteMaturityScore|painSignals/,
  )

  console.log(`[${FUZOR_COMPANY_INTELLIGENCE_1A_QA_MARKER}] PASS`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
