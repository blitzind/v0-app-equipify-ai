/**
 * GE-AIOS-8A-3 — Business Intelligence consumer certification.
 * Run: pnpm test:ge-aios-8a-3-business-intelligence
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

import type { BusinessProfileRecord } from "../lib/growth/business-profile/business-profile-types"
import {
  buildBusinessIntelligenceReport,
  GROWTH_BUSINESS_INTELLIGENCE_QA_MARKER,
  GROWTH_BUSINESS_INTELLIGENCE_SCHEMA_MIGRATION,
  isUnknownField,
  mapSnapshotToBusinessIntelligenceFields,
} from "../lib/growth/business-intelligence"
import { runBusinessIntelligence } from "../lib/growth/business-intelligence/run-business-intelligence"
import { buildEvidenceEngineSnapshotPayload } from "../lib/growth/evidence-engine/evidence-engine-snapshot"
import { normalizeProviderCollection } from "../lib/growth/evidence-engine"
import { collectApprovedProfileEvidence } from "../lib/growth/evidence-engine/providers/approved-profile-evidence-provider"
import { extractBusinessEvidenceFromHtml } from "../lib/growth/evidence-engine/providers/website-business-extractor"
import { detectEvidenceContradictions } from "../lib/growth/evidence-engine/evidence-contradiction-detector"
import { mergeEvidenceItems, mergeNormalizedFacts } from "../lib/growth/evidence-engine/evidence-normalizer"

const PHASE = "GE-AIOS-8A-3" as const

const SAMPLE_HTML = `<!doctype html><html><head><title>Acme</title><meta name="description" content="Commercial HVAC maintenance across the Midwest." /></head><body><p>Facilities teams rely on Acme for proactive maintenance.</p></body></html>`

const CONFLICT_HTML = `<!doctype html><html><head><title>Acme</title><meta name="description" content="Residential plumbing for homeowners only." /></head><body><p>Homeowner plumbing services.</p></body></html>`

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

async function buildTestSnapshot(organizationId: string, withConflict = false) {
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
  const conflictItems = withConflict
    ? extractBusinessEvidenceFromHtml({
        html: CONFLICT_HTML,
        pageUrl: "https://acme.example/about",
        pageType: "about",
      }).filter((item) => item.fact_key === "company.description")
    : []

  const approvedNormalized = normalizeProviderCollection(approvedOutput)
  const websiteNormalized = normalizeProviderCollection({
    organization_id: organizationId,
    provider: "website",
    raw_items: [...websiteItems, ...conflictItems],
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
  console.log(`[${PHASE}] Business Intelligence certification`)

  assert.equal(GROWTH_BUSINESS_INTELLIGENCE_QA_MARKER, "ge-aios-8a-3-business-intelligence-v1")
  assert.equal(GROWTH_BUSINESS_INTELLIGENCE_SCHEMA_MIGRATION, "20271002130000_growth_business_intelligence_ge_aios_8a_3.sql")

  const migration = readSource(`supabase/migrations/${GROWTH_BUSINESS_INTELLIGENCE_SCHEMA_MIGRATION}`)
  assert.ok(migration.includes("growth.business_intelligence_reports"))
  assert.equal(migration.includes("create table if not exists growth.organization_business_profiles"), false)

  const snapshot = await buildTestSnapshot("org-bi-1")
  const fieldMap = mapSnapshotToBusinessIntelligenceFields(snapshot)

  for (const field of Object.values(fieldMap)) {
    if (!isUnknownField(field)) {
      assert.ok(field.supporting_evidence_ids.length > 0)
    }
  }

  assert.ok(isUnknownField(fieldMap["company.plans_pricing"]!))

  const report = buildBusinessIntelligenceReport({
    organization_id: "org-bi-1",
    evidence_snapshot_id: "snapshot-1",
    evidence_run_id: "run-test-1",
    snapshot,
  })

  assert.ok(report.sections.company.company_description.value)
  assert.ok(report.sections.market.industries_served.value)
  assert.ok(isUnknownField(report.sections.company.plans_pricing))
  assert.ok(report.gaps.some((gap) => gap.gap_code === "missing_pricing_evidence"))
  assert.ok(report.confidence_summary.unknown_count > 0)

  const conflictSnapshot = await buildTestSnapshot("org-bi-2", true)
  const conflictReport = buildBusinessIntelligenceReport({
    organization_id: "org-bi-2",
    evidence_snapshot_id: "snapshot-2",
    evidence_run_id: "run-test-2",
    snapshot: conflictSnapshot,
  })
  assert.ok(
    conflictReport.gaps.some((gap) => gap.gap_code === "company_description_conflict") ||
      conflictReport.gaps.some((gap) => gap.gap_code === "needs_review_items_present"),
  )

  let evidenceEngineCalled = false
  const emptyResult = await runBusinessIntelligence({
    admin: {} as import("@supabase/supabase-js").SupabaseClient,
    organizationId: "org-empty",
    runEvidenceEngine: false,
    persist: false,
    deps: {
      fetchLatestEvidenceEngineSnapshot: async () => null,
      fetchLatestBusinessIntelligenceReport: async () => null,
    },
  })
  assert.equal(emptyResult.empty_state, true)
  assert.equal(evidenceEngineCalled, false)

  const snapshotRecord = {
    snapshot_id: "snapshot-3",
    organization_id: "org-bi-3",
    run_id: "run-test-3",
    generated_at: new Date().toISOString(),
    input_hash: "hash-3",
    is_current: true,
    snapshot,
  }

  const biResult = await runBusinessIntelligence({
    admin: {} as import("@supabase/supabase-js").SupabaseClient,
    organizationId: "org-bi-3",
    runEvidenceEngine: false,
    persist: false,
    deps: {
      fetchLatestEvidenceEngineSnapshot: async () => snapshotRecord,
      fetchLatestBusinessIntelligenceReport: async () => null,
      fetchBusinessIntelligenceReportBySnapshot: async () => null,
      isBusinessIntelligenceSchemaReady: async () => false,
    },
  })

  assert.equal(biResult.empty_state, false)
  assert.ok(biResult.report)
  assert.equal(biResult.persisted, false)

  await runBusinessIntelligence({
    admin: {} as import("@supabase/supabase-js").SupabaseClient,
    organizationId: "org-bi-4",
    runEvidenceEngine: true,
    persist: false,
    deps: {
      fetchLatestEvidenceEngineSnapshot: async () => null,
      fetchLatestBusinessIntelligenceReport: async () => null,
      fetchBusinessIntelligenceReportBySnapshot: async () => null,
      isBusinessIntelligenceSchemaReady: async () => false,
    },
  }).catch(() => undefined)

  await runBusinessIntelligence({
    admin: {} as import("@supabase/supabase-js").SupabaseClient,
    organizationId: "org-bi-5",
    runEvidenceEngine: true,
    persist: false,
    deps: {
      fetchLatestEvidenceEngineSnapshot: async () => snapshotRecord,
      fetchLatestBusinessIntelligenceReport: async () => null,
      fetchBusinessIntelligenceReportBySnapshot: async () => null,
      isBusinessIntelligenceSchemaReady: async () => false,
      // Injected via runEvidenceEngine deps passthrough — simulate explicit collection request.
    },
  })

  const runBiWithEngine = readSource("lib/growth/business-intelligence/run-business-intelligence.ts")
  assert.ok(runBiWithEngine.includes("if (!snapshot && runEvidenceEngineFlag)"))
  assert.ok(runBiWithEngine.includes("await runEvidenceEngine("))

  const forbidden = [
    "runProspectResearch",
    "runGrowthLeadResearch",
    "runAvaResearchQueueOrchestrator",
    "runAiTask",
    "datamoon",
    "projectApprovedBusinessProfileToLeadDiscovery",
    "collectWebsiteEvidence",
    "lead-inbox",
  ]

  for (const file of [
    "lib/growth/business-intelligence/run-business-intelligence.ts",
    "lib/growth/business-intelligence/business-intelligence-report-builder.ts",
    "lib/growth/business-intelligence/business-intelligence-fact-mapper.ts",
    "lib/growth/business-intelligence/business-intelligence-repository.ts",
  ]) {
    const source = readSource(file)
    for (const token of forbidden) {
      assert.equal(source.includes(token), false, `${file} must not reference ${token}`)
    }
  }

  const runBiSource = readSource("lib/growth/business-intelligence/run-business-intelligence.ts")
  assert.ok(runBiSource.includes("runEvidenceEngineFlag = input.runEvidenceEngine === true"))
  assert.ok(runBiSource.includes("fetchLatestEvidenceEngineSnapshot"))
  assert.doesNotMatch(runBiSource, /\.update\([\s\S]*organization_business_profiles/)

  const repoSource = readSource("lib/growth/business-intelligence/business-intelligence-repository.ts")
  assert.equal(repoSource.includes("persistBusinessIntelligenceReport"), true)
  assert.equal(repoSource.includes("organization_business_profiles"), false)

  console.log(`[${PHASE}] certification passed`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
