/**
 * FUZOR-COMPANY-INTELLIGENCE-2A — Focused certification.
 * Run: pnpm test:fuzor-company-intelligence-2a
 */

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  computeFuzorCompanyIntelligenceEvidenceFingerprint,
  buildFuzorCompanyIntelligenceEvidenceRefs,
} from "../lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-evidence-fingerprint"
import {
  FUZOR_COMPANY_INTELLIGENCE_CONSUMER_MIGRATION_AUDIT,
  estimateDuplicatedInterpretationReductionPercent,
} from "../lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-consumer-migration-audit"
import {
  FUZOR_COMPANY_INTELLIGENCE_2A_MIGRATION,
  FUZOR_COMPANY_INTELLIGENCE_2A_QA_MARKER,
  FUZOR_COMPANY_INTELLIGENCE_PLATFORM_VERSION,
} from "../lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-2a-types"
import type { FuzorCompanyIntelligenceEvidencePacket } from "../lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-types"
import { companyIntelligenceUnderstandingFingerprint } from "../lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-platform"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf8")
}

function samplePacket(): FuzorCompanyIntelligenceEvidencePacket {
  return {
    companyName: "Block Imaging",
    website: "https://blockimaging.com",
    leadId: "6d9220f0-2960-468c-b4be-5d7595d292c3",
    linkedinCompanyUrl: null,
    verifiedDescription: "Global diagnostic imaging company.",
    verifiedOfferings: ["Multi-Vendor Service", "Reliable Imaging Parts"],
    verifiedIndustries: [],
    verifiedCustomers: [],
    verifiedMarkets: [],
    verifiedDifferentiators: [],
    verifiedTechnologySignals: [],
    verifiedHiringSignals: [],
    websiteExcerpts: ["EOL and EOS support"],
    pagesObserved: [{ url: "https://blockimaging.com/services", pageType: "services", status: "crawled" }],
    datamoonFindings: [],
    priorResearchNotes: null,
    missingFromCollection: [],
  }
}

async function main(): Promise<void> {
  console.log(`[${FUZOR_COMPANY_INTELLIGENCE_2A_QA_MARKER}] focused certification`)

  // Restricted surfaces untouched.
  for (const file of [
    "lib/growth/home/growth-home-workspace-summary-service.ts",
    "lib/growth/ava-direct-outreach/ava-direct-outreach-service.ts",
  ]) {
    assert.doesNotMatch(readSource(file), /ensureCompanyIntelligence|FUZOR_COMPANY_INTELLIGENCE_2A/)
  }

  assert.match(
    readSource("supabase/migrations/20270901120000_fuzor_company_intelligence_versions_2a.sql"),
    /fuzor_company_intelligence_versions/,
  )
  assert.match(
    readSource("supabase/migrations/20270901120000_fuzor_company_intelligence_versions_2a.sql"),
    /grant select, insert/,
  )
  assert.doesNotMatch(
    readSource("supabase/migrations/20270901120000_fuzor_company_intelligence_versions_2a.sql"),
    /grant select, insert, update, delete/,
  )
  assert.equal(FUZOR_COMPANY_INTELLIGENCE_2A_MIGRATION, "20270901120000_fuzor_company_intelligence_versions_2a")
  assert.equal(FUZOR_COMPANY_INTELLIGENCE_PLATFORM_VERSION, "fuzor-ci-2a-v1")

  const a = computeFuzorCompanyIntelligenceEvidenceFingerprint(samplePacket())
  const b = computeFuzorCompanyIntelligenceEvidenceFingerprint(samplePacket())
  assert.equal(a.evidenceFingerprint, b.evidenceFingerprint)

  const changed = computeFuzorCompanyIntelligenceEvidenceFingerprint({
    ...samplePacket(),
    verifiedOfferings: ["Multi-Vendor Service", "Equipment Sourcing"],
  })
  assert.notEqual(a.evidenceFingerprint, changed.evidenceFingerprint)

  const refs = buildFuzorCompanyIntelligenceEvidenceRefs(samplePacket())
  assert.equal(refs.hasVerifiedDescription, true)
  assert.equal(refs.verifiedOfferingCount, 2)
  // Refs must not embed full understanding or Equipify seller context.
  assert.equal("idealCustomer" in refs, false)

  assert.ok(FUZOR_COMPANY_INTELLIGENCE_CONSUMER_MIGRATION_AUDIT.length >= 10)
  assert.ok(estimateDuplicatedInterpretationReductionPercent() >= 50)

  const fp1 = companyIntelligenceUnderstandingFingerprint({
    executiveSummary: "x",
    revenueModel: { summary: "s", models: [], evidence: [] },
    productsAndServices: { offerings: [], notes: null, evidence: [] },
    operationalModel: { summary: "o", characteristics: [], evidence: [] },
    customers: { summary: "c", segments: [], evidence: [] },
    industriesServed: { industries: [], evidence: [] },
    operationalChallenges: { challenges: [] },
    companyStrengths: { strengths: [], evidence: [] },
    unknowns: [],
    evidenceUsed: [],
    evidenceWeakness: null,
  })
  const fp2 = companyIntelligenceUnderstandingFingerprint({
    executiveSummary: "x",
    revenueModel: { summary: "s", models: [], evidence: [] },
    productsAndServices: { offerings: [], notes: null, evidence: [] },
    operationalModel: { summary: "o", characteristics: [], evidence: [] },
    customers: { summary: "c", segments: [], evidence: [] },
    industriesServed: { industries: [], evidence: [] },
    operationalChallenges: { challenges: [] },
    companyStrengths: { strengths: [], evidence: [] },
    unknowns: [],
    evidenceUsed: [],
    evidenceWeakness: null,
  })
  assert.equal(fp1, fp2)

  // Platform API surface exists and requires ownership.
  const platformSrc = readSource(
    "lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-platform.ts",
  )
  assert.match(platformSrc, /export async function ensureCompanyIntelligence/)
  assert.match(platformSrc, /export async function loadCompanyIntelligence/)
  assert.match(platformSrc, /export async function consumeCompanyIntelligenceForAiEmployee/)
  assert.match(platformSrc, /ownerOrganizationId/)
  assert.match(platformSrc, /owner_organization_required/)
  assert.doesNotMatch(
    platformSrc,
    /organizationId = input\.organizationId \?\? getGrowthEngineAiOrgId\(\)/,
  )

  assert.match(
    readSource("lib/fuzor/company-intelligence/index.ts"),
    /ensureCompanyIntelligence/,
  )
  assert.match(
    readSource(
      "lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-growth-lead-adapter.ts",
    ),
    /ensureCompanyIntelligenceForGrowthLead/,
  )

  console.log(`[${FUZOR_COMPANY_INTELLIGENCE_2A_QA_MARKER}] PASS`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
