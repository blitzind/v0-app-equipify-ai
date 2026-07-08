/**
 * GE-AIOS-8A-6 — Business Intelligence operator research trigger certification.
 * Run: pnpm test:ge-aios-8a-6-business-intelligence-research-trigger
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

import {
  GROWTH_BUSINESS_INTELLIGENCE_RESEARCH_API_PATH,
  GROWTH_BUSINESS_INTELLIGENCE_RESEARCH_QA_MARKER,
  GROWTH_BUSINESS_INTELLIGENCE_RESEARCH_STEPS,
} from "../lib/growth/business-intelligence/business-intelligence-api-contract"
import { buildBusinessIntelligenceReport } from "../lib/growth/business-intelligence/business-intelligence-report-builder"
import { runBusinessIntelligenceOperatorResearch } from "../lib/growth/business-intelligence/business-intelligence-research-service"
import type { BusinessProfileRecord } from "../lib/growth/business-profile/business-profile-types"
import { buildEvidenceEngineSnapshotPayload } from "../lib/growth/evidence-engine/evidence-engine-snapshot"
import { normalizeProviderCollection } from "../lib/growth/evidence-engine"
import { collectApprovedProfileEvidence } from "../lib/growth/evidence-engine/providers/approved-profile-evidence-provider"
import { extractBusinessEvidenceFromHtml } from "../lib/growth/evidence-engine/providers/website-business-extractor"
import { detectEvidenceContradictions } from "../lib/growth/evidence-engine/evidence-contradiction-detector"
import { mergeEvidenceItems, mergeNormalizedFacts } from "../lib/growth/evidence-engine/evidence-normalizer"
import { isUnknownField } from "../lib/growth/business-intelligence"

const PHASE = "GE-AIOS-8A-6" as const

const SAMPLE_HTML = `<!doctype html><html><head><title>Acme</title><meta name="description" content="Commercial HVAC maintenance across the Midwest." /></head><body><p>Facilities teams rely on Acme for proactive maintenance.</p></body></html>`

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function mockApprovedProfile(organizationId: string): BusinessProfileRecord {
  const approvedAt = "2026-01-15T12:00:00.000Z"
  return {
    id: "profile-approved-1",
    organizationId,
    status: "approved",
    isActive: true,
    companyName: "Acme Field Services",
    website: "https://acme.example",
    input: { companyName: "Acme Field Services", website: "https://acme.example" },
    profile: {
      company: {
        companyName: "Acme Field Services",
        website: "https://acme.example",
        shortDescription: "Commercial HVAC maintenance and repair.",
        productsServices: ["Preventive maintenance"],
        businessModel: "B2B service contracts",
        primaryValueProposition: "Keep facilities HVAC online.",
      },
      idealCustomers: {
        targetIndustries: ["Commercial HVAC"],
        companySizeRanges: ["11–50"],
        geography: ["Midwest United States"],
        buyerPersonas: ["Facilities Manager"],
        disqualifiers: ["Residential-only"],
      },
      problemsAndTriggers: {
        painPoints: ["Unplanned downtime"],
        buyingTriggers: ["Equipment failures"],
        competitorsAlternatives: ["In-house maintenance"],
        keywords: ["hvac maintenance"],
        negativeKeywords: ["residential"],
      },
      salesAndMarketing: {
        averageDealSize: "$24k ACV",
        salesCycleEstimate: "60 days",
        messagingAngles: ["Reduce downtime"],
        qualificationCriteria: ["Commercial facilities"],
      },
      confidence: { score: 0.9, assumptions: [], missingInformation: [] },
    },
    label: "Approved — Ava can use this to guide lead discovery and recommendations.",
    createdBy: null,
    approvedBy: "user-1",
    approvedAt,
    rejectedAt: null,
    createdAt: approvedAt,
    updatedAt: approvedAt,
  }
}

async function buildTestSnapshot(organizationId: string) {
  const approvedOutput = await collectApprovedProfileEvidence({
    admin: {} as import("@supabase/supabase-js").SupabaseClient,
    organizationId,
    loadApprovedProfile: async () => mockApprovedProfile(organizationId),
  })
  const websiteItems = extractBusinessEvidenceFromHtml({
    html: SAMPLE_HTML,
    pageUrl: "https://acme.example",
    pageType: "homepage",
  })

  const approvedNormalized = normalizeProviderCollection(approvedOutput)
  const websiteNormalized = normalizeProviderCollection({
    organization_id: organizationId,
    provider: "website",
    raw_items: websiteItems,
    warnings: [],
    diagnostics: {},
  })

  const evidence = mergeEvidenceItems([...approvedNormalized.evidence, ...websiteNormalized.evidence])
  const facts = mergeNormalizedFacts([...approvedNormalized.facts, ...websiteNormalized.facts])
  const contradictionResult = detectEvidenceContradictions({
    organization_id: organizationId,
    facts,
    evidence,
  })

  return buildEvidenceEngineSnapshotPayload({
    organization_id: organizationId,
    run_id: "run-test-1",
    source_providers: ["website", "approved_profile"],
    evidence: contradictionResult.evidence,
    facts: contradictionResult.facts,
    contradictions: contradictionResult.contradictions,
  })
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Business Intelligence research trigger certification`)

  assert.equal(GROWTH_BUSINESS_INTELLIGENCE_RESEARCH_QA_MARKER, "ge-aios-8a-6-business-intelligence-research-trigger-v1")
  assert.equal(GROWTH_BUSINESS_INTELLIGENCE_RESEARCH_API_PATH, "/api/platform/growth/business-intelligence/research")
  assert.equal(GROWTH_BUSINESS_INTELLIGENCE_RESEARCH_STEPS.length, 5)

  const reportRoute = readSource("app/api/platform/growth/business-intelligence/report/route.ts")
  assert.match(reportRoute, /export async function GET/)
  assert.doesNotMatch(reportRoute, /export async function POST|runEvidenceEngine|runBusinessIntelligence|runAiTask/)

  const researchRoute = readSource("app/api/platform/growth/business-intelligence/research/route.ts")
  assert.match(researchRoute, /export async function POST/)
  assert.match(researchRoute, /runBusinessIntelligenceOperatorResearch/)
  assert.doesNotMatch(researchRoute, /export async function GET/)

  const researchService = readSource("lib/growth/business-intelligence/business-intelligence-research-service.ts")
  assert.match(researchService, /runEvidenceEngineImpl\(/)
  assert.match(researchService, /trigger: "operator_request"/)
  assert.match(researchService, /providers: \["website", "approved_profile"\]/)
  assert.match(researchService, /runBusinessIntelligenceImpl\(/)
  assert.match(researchService, /includeAiRecommendations: true/)
  assert.match(researchService, /runEvidenceEngine: false/)
  assert.doesNotMatch(researchService, /organization_business_profiles.*update|persistBusinessProfile|approveBusinessProfile/)

  const sectionSource = readSource(
    "components/growth/workspace/executive-briefing/growth-home-business-intelligence-section.tsx",
  )
  assert.match(sectionSource, /GROWTH_BUSINESS_INTELLIGENCE_RESEARCH_API_PATH/)
  assert.match(sectionSource, /data-qa-action="research-my-company"/)
  assert.match(sectionSource, /data-qa-state="researching"/)
  assert.match(sectionSource, /GROWTH_BUSINESS_INTELLIGENCE_RESEARCH_STEPS/)
  assert.match(sectionSource, /Retry/)
  assert.doesNotMatch(sectionSource, /disabled title="Company research will be available/)
  assert.doesNotMatch(sectionSource, /runEvidenceEngine|runBusinessIntelligence|runAiTask/)

  const panelSource = readSource(
    "components/growth/workspace/executive-briefing/growth-home-business-intelligence-panel.tsx",
  )
  assert.match(panelSource, /recentlyResearched/)
  assert.match(panelSource, /GROWTH_BUSINESS_INTELLIGENCE_RECENTLY_RESEARCHED_LABEL/)

  const workspaceSummarySource = readSource("lib/growth/home/growth-home-workspace-summary-service.ts")
  assert.doesNotMatch(workspaceSummarySource, /runEvidenceEngine|runBusinessIntelligence|business-intelligence\/research/)

  const snapshot = await buildTestSnapshot("org-bi-research-1")
  const report = buildBusinessIntelligenceReport({
    organization_id: "org-bi-research-1",
    evidence_snapshot_id: "snapshot-research-1",
    evidence_run_id: "run-test-1",
    snapshot,
  })

  assert.ok(isUnknownField(report.sections.company.plans_pricing))
  assert.ok(report.gaps.length > 0)

  let evidenceEngineCalled = false
  let businessIntelligenceCalled = false

  const researchResult = await runBusinessIntelligenceOperatorResearch(
    {} as import("@supabase/supabase-js").SupabaseClient,
    {
      organizationId: "org-bi-research-1",
      deps: {
        getActiveApprovedBusinessProfile: async () => mockApprovedProfile("org-bi-research-1"),
        runEvidenceEngine: async () => {
          evidenceEngineCalled = true
          return {
            ok: true,
            organization_id: "org-bi-research-1",
            trigger: "operator_request",
            collections: [],
            evidence: [],
            facts: [],
            contradictions: [],
            warnings: [],
            diagnostics: {},
            run_id: "run-test-1",
            snapshot_id: "snapshot-research-1",
            input_hash: "hash-1",
            cached: true,
            persisted: true,
          }
        },
        runBusinessIntelligence: async () => {
          businessIntelligenceCalled = true
          return {
            ok: true,
            status: "partial",
            organization_id: "org-bi-research-1",
            report,
            report_id: "report-1",
            persisted: true,
            evidence_snapshot_id: "snapshot-research-1",
            evidence_run_id: "run-test-1",
            empty_state: false,
            ai_recommendations_included: true,
          }
        },
        fetchBusinessIntelligenceReportReadModel: async () => ({
          schemaReady: true,
          empty_state: false,
          payload: {
            report_id: "report-1",
            status: "partial",
            generated_at: report.generated_at,
            evidence_snapshot_id: "snapshot-research-1",
            evidence_run_id: "run-test-1",
            report,
            confidence_summary: report.confidence_summary,
            gaps: report.gaps,
            contradictions: report.contradictions,
            ai_recommendations: report.ai_recommendations ?? null,
            ai_recommendations_metadata: report.ai_recommendations_metadata ?? null,
            evidence_by_id: {},
          },
        }),
      },
    },
  )

  assert.equal(evidenceEngineCalled, true)
  assert.equal(businessIntelligenceCalled, true)
  assert.equal(researchResult.ok, true)
  if (researchResult.ok) {
    assert.equal(researchResult.cached, true)
    assert.ok(researchResult.payload.report)
    assert.ok(researchResult.payload.gaps.length > 0)
  }

  const failureResult = await runBusinessIntelligenceOperatorResearch(
    {} as import("@supabase/supabase-js").SupabaseClient,
    {
      organizationId: "org-bi-research-2",
      deps: {
        getActiveApprovedBusinessProfile: async () => null,
        runEvidenceEngine: async () => {
          throw new Error("website fetch failed")
        },
      },
    },
  )
  assert.equal(failureResult.ok, false)

  const forbidden = [
    "runProspectResearch",
    "runGrowthLeadResearch",
    "runAvaResearchQueueOrchestrator",
    "projectApprovedBusinessProfileToLeadDiscovery",
    "lead-inbox",
    "revenue-queue",
    "persistBusinessProfile",
    "approveBusinessProfile",
  ]

  for (const file of [
    "app/api/platform/growth/business-intelligence/research/route.ts",
    "lib/growth/business-intelligence/business-intelligence-research-service.ts",
    "components/growth/workspace/executive-briefing/growth-home-business-intelligence-section.tsx",
  ]) {
    const source = readSource(file)
    for (const token of forbidden) {
      assert.equal(source.includes(token), false, `${file} must not reference ${token}`)
    }
  }

  console.log(`[${PHASE}] certification passed`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
