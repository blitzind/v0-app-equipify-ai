/**
 * GE-AIOS-22 — Evidence-Driven Company Qualification certification.
 * Run: pnpm test:ge-aios-22-company-evidence
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildCompanyEvidenceProfileFromRawItems,
  collectCompanyEvidenceSourceUrls,
  COMPANY_EVIDENCE_CONFIDENCE_THRESHOLD,
  COMPANY_EVIDENCE_MAX_PAGES,
  compareCompanyEvidenceToMission,
  computeCompanyEvidenceQualityScores,
  evaluateCompanyEvidenceCrawlStop,
  GROWTH_COMPANY_EVIDENCE_22_QA_MARKER,
  shouldRefreshCompanyEvidence,
} from "../lib/growth/research/company-evidence"
import type { EvidenceProviderRawItem } from "../lib/growth/evidence-engine/evidence-engine-types"

const PHASE = "GE-AIOS-22" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function sampleRawItems(): EvidenceProviderRawItem[] {
  return [
    {
      fact_key: "company.description",
      category: "company",
      value_text: "Precision CNC manufacturer serving aerospace and medical industries.",
      provider: "website",
      decision_tier: "structured_extraction",
      evidence_type: "meta_tag",
      source_url: "https://acme.example/about",
      page_title: "About Acme",
      raw_excerpt: "Precision CNC manufacturer serving aerospace and medical industries.",
      evidence_confidence: 0.9,
    },
    {
      fact_key: "company.industries_served",
      category: "ideal_customers",
      value_text: "Aerospace",
      provider: "website",
      decision_tier: "structured_extraction",
      evidence_type: "website_structured",
      source_url: "https://acme.example/industries",
      page_title: "Industries",
      raw_excerpt: "Aerospace",
      evidence_confidence: 0.86,
    },
    {
      fact_key: "company.services",
      category: "company",
      value_text: "5-axis CNC machining",
      provider: "website",
      decision_tier: "structured_extraction",
      evidence_type: "website_structured",
      source_url: "https://acme.example/services",
      page_title: "Services",
      raw_excerpt: "5-axis CNC machining",
      evidence_confidence: 0.84,
    },
    {
      fact_key: "company.products",
      category: "company",
      value_text: "Precision components",
      provider: "website",
      decision_tier: "structured_extraction",
      evidence_type: "website_structured",
      source_url: "https://acme.example/products",
      page_title: "Products",
      raw_excerpt: "Precision components",
      evidence_confidence: 0.83,
    },
  ]
}

function main(): void {
  console.log(`[${PHASE}] Evidence-Driven Company Qualification certification`)

  assert.equal(GROWTH_COMPANY_EVIDENCE_22_QA_MARKER, "ge-aios-22-company-evidence-v1")
  console.log("  ✓ 22 QA marker")

  const orchestrator = readSource("lib/growth/research/research-orchestrator.ts")
  assert.match(orchestrator, /collectProspectCompanyEvidence/)
  assert.match(orchestrator, /companyEvidence_v22/)
  assert.match(orchestrator, /loadGrowthLeadAdmissionContext/)
  assert.doesNotMatch(orchestrator, /new QualificationEngine/)
  assert.doesNotMatch(orchestrator, /new ResearchEngine/)
  console.log("  ✓ research orchestrator collects evidence before downstream inference")

  const collector = readSource("lib/growth/research/company-evidence/company-evidence-collector.ts")
  assert.match(collector, /extractBusinessEvidenceFromHtml/)
  assert.match(collector, /planBusinessWebsiteCrawlUrls/)
  assert.match(collector, /evaluateCompanyEvidenceCrawlStop/)
  console.log("  ✓ collector reuses website business extractor + crawl planner")

  const evidenceProvider = readSource("lib/growth/evidence-engine/providers/website-evidence-provider.ts")
  assert.match(evidenceProvider, /export function planBusinessWebsiteCrawlUrls/)
  console.log("  ✓ crawl planner exported from existing website evidence provider")

  const executionService = readSource("lib/growth/research/growth-lead-research-execution-service.ts")
  assert.match(executionService, /companyEvidence_v22/)
  assert.match(executionService, /verifiedEvidence/)
  console.log("  ✓ research workflow reuses structured evidence summary")

  const companyIntel = readSource("components/growth/growth-company-intelligence-snapshot.tsx")
  assert.match(companyIntel, /companyEvidence_v22/)
  assert.match(companyIntel, /Verified industries/)
  console.log("  ✓ company intelligence enriched with verified evidence")

  const researchTypes = readSource("lib/growth/research/research-types.ts")
  assert.match(researchTypes, /companyEvidence_v22/)
  console.log("  ✓ research signals extended with structured evidence bundle")

  const profile = buildCompanyEvidenceProfileFromRawItems(sampleRawItems())
  assert.ok(profile.companyDescription?.value.includes("Precision CNC"))
  assert.ok(profile.industriesServed?.values.includes("Aerospace"))
  assert.ok(profile.primaryServices?.values.includes("5-axis CNC machining"))
  assert.ok(profile.primaryProducts?.values.includes("Precision components"))

  const sourceUrls = collectCompanyEvidenceSourceUrls(profile)
  assert.ok(sourceUrls.includes("https://acme.example/about"))
  assert.ok(sourceUrls.includes("https://acme.example/industries"))
  console.log("  ✓ structured evidence includes source URLs")

  const qualityScores = computeCompanyEvidenceQualityScores({
    profile,
    websiteFetchOk: true,
    pagesCrawled: 4,
    hasVerifiedDomain: true,
  })
  assert.ok(qualityScores.overallEvidenceConfidence > 0.5)
  assert.ok(qualityScores.industryConfidence > 0.5)
  assert.ok(qualityScores.offeringConfidence > 0.5)
  console.log("  ✓ evidence quality scores calculated")

  const stop = evaluateCompanyEvidenceCrawlStop({
    profile,
    qualityScores,
    pagesCrawled: 4,
    maxPages: COMPANY_EVIDENCE_MAX_PAGES,
  })
  assert.equal(stop.shouldStop, true)
  console.log("  ✓ crawl budget stops when sufficient evidence gathered")

  const missionComparison = compareCompanyEvidenceToMission({
    profile,
    approvedProfile: {
      company: {
        companyName: "Equipify",
        website: "https://equipify.com",
        shortDescription: "Industrial equipment sales",
        productsServices: ["CNC equipment"],
        businessModel: "B2B",
        primaryValueProposition: "Manufacturing growth",
      },
      idealCustomers: {
        targetIndustries: ["Aerospace", "Medical Device"],
        companySizeRanges: ["50-500"],
        geography: ["Midwest"],
        buyerPersonas: ["Operations"],
        disqualifiers: ["retail"],
      },
      problemsAndTriggers: {
        painPoints: [],
        buyingTriggers: [],
        competitorsAlternatives: [],
        keywords: ["manufacturing", "cnc"],
        negativeKeywords: [],
      },
      salesAndMarketing: {
        averageDealSize: null,
        salesCycleEstimate: null,
        messagingAngles: [],
        qualificationCriteria: [],
      },
      confidence: { score: 0.8, assumptions: [], missingInformation: [] },
    },
    activeMissionTitle: "Manufacturing expansion",
  })
  assert.ok(missionComparison.evidenceBacked)
  assert.ok(missionComparison.explanations.some((line) => line.includes("Website identifies")))
  console.log("  ✓ mission comparison references verified evidence")

  assert.equal(
    shouldRefreshCompanyEvidence({
      existing: {
        qaMarker: GROWTH_COMPANY_EVIDENCE_22_QA_MARKER,
        collectedAt: new Date().toISOString(),
        websiteUrl: "https://acme.example",
        profile,
        qualityScores,
        crawlState: {
          pagesPlanned: 4,
          pagesCrawled: 4,
          pagesSkipped: 0,
          stoppedEarly: true,
          stopReason: "sufficient_evidence_gathered",
          websiteCoverage: ["https://acme.example/about"],
          missingInformation: [],
        },
        missionComparison,
        qualificationExplanation: null,
        evidenceSources: sourceUrls,
        cacheKey: "abc",
      },
      website: "https://acme.example",
    }),
    false,
  )
  assert.equal(
    shouldRefreshCompanyEvidence({
      existing: null,
      website: "https://acme.example",
      rebuild: true,
    }),
    true,
  )
  console.log("  ✓ cache policy avoids duplicate crawling")

  assert.ok(COMPANY_EVIDENCE_CONFIDENCE_THRESHOLD >= 0.7)
  console.log("  ✓ confidence threshold configured")

  console.log(`[${PHASE}] PASS — Evidence-Driven Company Qualification certified (local)`)
}

main()
