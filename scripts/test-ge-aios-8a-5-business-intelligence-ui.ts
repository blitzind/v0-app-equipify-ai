/**
 * GE-AIOS-8A-5 — Business Intelligence read-only Home panel certification.
 * Run: pnpm test:ge-aios-8a-5-business-intelligence-ui
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

import {
  GROWTH_BUSINESS_INTELLIGENCE_EMPTY_MESSAGE,
  GROWTH_BUSINESS_INTELLIGENCE_READ_ONLY_BANNER,
  GROWTH_BUSINESS_INTELLIGENCE_RESEARCH_CTA_LABEL,
  GROWTH_BUSINESS_INTELLIGENCE_UI_QA_MARKER,
  growthBusinessIntelligenceReportHref,
} from "../lib/growth/business-intelligence/business-intelligence-api-contract"
import { buildBusinessIntelligenceReport } from "../lib/growth/business-intelligence/business-intelligence-report-builder"
import type { BusinessProfileRecord } from "../lib/growth/business-profile/business-profile-types"
import { buildEvidenceEngineSnapshotPayload } from "../lib/growth/evidence-engine/evidence-engine-snapshot"
import { normalizeProviderCollection } from "../lib/growth/evidence-engine"
import { collectApprovedProfileEvidence } from "../lib/growth/evidence-engine/providers/approved-profile-evidence-provider"
import { extractBusinessEvidenceFromHtml } from "../lib/growth/evidence-engine/providers/website-business-extractor"
import { detectEvidenceContradictions } from "../lib/growth/evidence-engine/evidence-contradiction-detector"
import { mergeEvidenceItems, mergeNormalizedFacts } from "../lib/growth/evidence-engine/evidence-normalizer"
import { isUnknownField } from "../lib/growth/business-intelligence"

const PHASE = "GE-AIOS-8A-5" as const

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
  console.log(`[${PHASE}] Business Intelligence UI certification`)

  assert.equal(GROWTH_BUSINESS_INTELLIGENCE_UI_QA_MARKER, "ge-aios-8a-5-business-intelligence-ui-v1")
  assert.equal(GROWTH_BUSINESS_INTELLIGENCE_EMPTY_MESSAGE, "Ava hasn't researched your business yet.")
  assert.equal(GROWTH_BUSINESS_INTELLIGENCE_RESEARCH_CTA_LABEL, "Research my company")
  assert.match(growthBusinessIntelligenceReportHref(true), /includeAiRecommendations=true/)

  const routePath = "app/api/platform/growth/business-intelligence/report/route.ts"
  const routeSource = readSource(routePath)
  assert.match(routeSource, /export async function GET/)
  assert.match(routeSource, /fetchBusinessIntelligenceReportReadModel/)
  assert.doesNotMatch(routeSource, /export async function POST|export async function PUT|export async function PATCH|export async function DELETE/)
  assert.doesNotMatch(routeSource, /runBusinessIntelligence|runEvidenceEngine|runAiTask|generateBusinessIntelligenceAiRecommendations/)

  const readServiceSource = readSource("lib/growth/business-intelligence/business-intelligence-report-read-service.ts")
  assert.match(readServiceSource, /fetchLatestBusinessIntelligenceReport/)
  assert.doesNotMatch(readServiceSource, /runBusinessIntelligence|runEvidenceEngine|runAiTask|persistBusinessIntelligenceReport/)

  const sectionSource = readSource(
    "components/growth/workspace/executive-briefing/growth-home-business-intelligence-section.tsx",
  )
  assert.match(sectionSource, /growthBusinessIntelligenceReportHref/)
  assert.match(sectionSource, /GROWTH_BUSINESS_INTELLIGENCE_EMPTY_MESSAGE/)
  assert.match(sectionSource, /GROWTH_BUSINESS_INTELLIGENCE_RESEARCH_CTA_LABEL/)
  assert.match(sectionSource, /data-qa-action="research-my-company"/)
  assert.doesNotMatch(sectionSource, /runBusinessIntelligence|runEvidenceEngine|runAiTask|runProspectResearch|datamoon/)

  const panelSource = readSource(
    "components/growth/workspace/executive-briefing/growth-home-business-intelligence-panel.tsx",
  )
  assert.match(panelSource, /Confidence summary/)
  assert.match(panelSource, /Review Ava's understanding|Review Ava&apos;s understanding/)
  assert.match(panelSource, /Company description/)
  assert.match(panelSource, /Pricing \/ plans/)
  assert.match(panelSource, /Gaps/)
  assert.match(panelSource, /Recommendations/)
  assert.match(panelSource, /View evidence/)
  assert.match(panelSource, /Review progress/)
  assert.match(panelSource, /Human review required/)
  assert.doesNotMatch(panelSource, /onSubmit|mutate|enroll|outbound/i)

  const strategySource = readSource("components/growth/workspace/executive-briefing/growth-home-growth-strategy-section.tsx")
  assert.match(strategySource, /GrowthHomeBusinessIntelligenceSection/)
  assert.match(strategySource, /data-workflow-step="understand"/)

  const workspaceSummarySource = readSource("lib/growth/home/growth-home-workspace-summary-service.ts")
  assert.doesNotMatch(workspaceSummarySource, /runBusinessIntelligence|business-intelligence\/report|fetchBusinessIntelligenceReportReadModel/)

  const snapshot = await buildTestSnapshot("org-bi-ui-1")
  const report = buildBusinessIntelligenceReport({
    organization_id: "org-bi-ui-1",
    evidence_snapshot_id: "snapshot-ui-1",
    evidence_run_id: "run-test-1",
    snapshot,
  })

  assert.ok(isUnknownField(report.sections.company.plans_pricing))
  assert.ok(report.gaps.some((gap) => gap.gap_code === "missing_pricing_evidence"))

  const forbidden = [
    "runProspectResearch",
    "runGrowthLeadResearch",
    "runAvaResearchQueueOrchestrator",
    "projectApprovedBusinessProfileToLeadDiscovery",
    "lead-inbox",
    "revenue-queue",
    "organization_business_profiles",
  ]

  for (const file of [
    routePath,
    "lib/growth/business-intelligence/business-intelligence-report-read-service.ts",
    "components/growth/workspace/executive-briefing/growth-home-business-intelligence-section.tsx",
    "components/growth/workspace/executive-briefing/growth-home-business-intelligence-panel.tsx",
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
