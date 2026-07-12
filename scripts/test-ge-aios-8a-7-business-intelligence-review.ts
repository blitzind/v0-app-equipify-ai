/**
 * GE-AIOS-8A-7 — Business Intelligence review & approval layer certification.
 * Run: pnpm test:ge-aios-8a-7-business-intelligence-review
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

import {
  BUSINESS_INTELLIGENCE_REVIEW_FIELD_KEYS,
  businessIntelligenceReviewPrompt,
  GROWTH_BUSINESS_INTELLIGENCE_REVIEW_QA_MARKER,
  GROWTH_BUSINESS_INTELLIGENCE_REVIEW_SCHEMA_MIGRATION,
} from "../lib/growth/business-intelligence/business-intelligence-review-types"
import { buildBusinessIntelligenceReport } from "../lib/growth/business-intelligence/business-intelligence-report-builder"
import { applyBusinessIntelligenceReviewToBusinessProfileDraft } from "../lib/growth/business-intelligence/business-intelligence-apply-to-profile-service"
import {
  computeBusinessIntelligenceReviewProgress,
  getBusinessIntelligenceReportFieldByKey,
  saveBusinessIntelligenceReviewDecision,
} from "../lib/growth/business-intelligence/business-intelligence-review-service"
import type { BusinessProfileRecord } from "../lib/growth/business-profile/business-profile-types"
import { buildEvidenceEngineSnapshotPayload } from "../lib/growth/evidence-engine/evidence-engine-snapshot"
import { normalizeProviderCollection } from "../lib/growth/evidence-engine"
import { collectApprovedProfileEvidence } from "../lib/growth/evidence-engine/providers/approved-profile-evidence-provider"
import { extractBusinessEvidenceFromHtml } from "../lib/growth/evidence-engine/providers/website-business-extractor"
import { detectEvidenceContradictions } from "../lib/growth/evidence-engine/evidence-contradiction-detector"
import { mergeEvidenceItems, mergeNormalizedFacts } from "../lib/growth/evidence-engine/evidence-normalizer"

const PHASE = "GE-AIOS-8A-7" as const

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
  console.log(`[${PHASE}] Business Intelligence review certification`)

  assert.equal(GROWTH_BUSINESS_INTELLIGENCE_REVIEW_QA_MARKER, "ge-aios-8a-7-business-intelligence-review-v1")
  assert.equal(BUSINESS_INTELLIGENCE_REVIEW_FIELD_KEYS.length, 10)
  assert.match(businessIntelligenceReviewPrompt("Teammate"), /Please review/)

  const migration = readSource(`supabase/migrations/${GROWTH_BUSINESS_INTELLIGENCE_REVIEW_SCHEMA_MIGRATION}`)
  assert.ok(migration.includes("growth.business_intelligence_review_decisions"))
  assert.ok(migration.includes("business_intelligence_report_id"))

  const reviewRoute = readSource("app/api/platform/growth/business-intelligence/review-decision/route.ts")
  assert.match(reviewRoute, /export async function POST/)
  assert.match(reviewRoute, /saveBusinessIntelligenceReviewDecision/)
  assert.doesNotMatch(reviewRoute, /runEvidenceEngine|runBusinessIntelligence|approveBusinessProfileRow/)

  const applyRoute = readSource("app/api/platform/growth/business-intelligence/apply-to-business-profile/route.ts")
  assert.match(applyRoute, /applyBusinessIntelligenceReviewToBusinessProfileDraft/)
  assert.doesNotMatch(applyRoute, /approveBusinessProfileRow|rejectOtherApprovedBusinessProfiles/)

  const applyService = readSource("lib/growth/business-intelligence/business-intelligence-apply-to-profile-service.ts")
  assert.match(applyService, /insertBusinessProfileDraft/)
  assert.match(applyService, /updateBusinessProfileRow/)
  assert.doesNotMatch(applyService, /approveBusinessProfileRow/)

  const reportRoute = readSource("app/api/platform/growth/business-intelligence/report/route.ts")
  assert.doesNotMatch(reportRoute, /saveBusinessIntelligenceReviewDecision|applyBusinessIntelligenceReview/)

  const panelSource = readSource("components/growth/workspace/executive-briefing/growth-home-business-intelligence-panel.tsx")
  assert.match(panelSource, /Review progress/)
  assert.match(panelSource, /GrowthHomeBusinessIntelligenceReviewField/)
  assert.match(panelSource, /apply-to-business-profile/)
  assert.match(panelSource, /businessIntelligenceReviewPrompt/)

  const reviewFieldSource = readSource(
    "components/growth/workspace/executive-briefing/growth-home-business-intelligence-review-field.tsx",
  )
  assert.match(reviewFieldSource, /Approve/)
  assert.match(reviewFieldSource, /Edit/)
  assert.match(reviewFieldSource, /Dismiss/)
  assert.match(reviewFieldSource, /Mark unknown/)
  assert.match(reviewFieldSource, /Needs more info/)

  const snapshot = await buildTestSnapshot("org-bi-review-1")
  const report = buildBusinessIntelligenceReport({
    organization_id: "org-bi-review-1",
    evidence_snapshot_id: "snapshot-review-1",
    evidence_run_id: "run-test-1",
    snapshot,
  })

  const descriptionField = getBusinessIntelligenceReportFieldByKey(report, "company.company_description")
  assert.ok(descriptionField)

  const emptyProgress = computeBusinessIntelligenceReviewProgress({ report, decisions: [] })
  assert.equal(emptyProgress.reviewed_count, 0)
  assert.equal(emptyProgress.total_review_fields, 10)

  let upsertCalled = false
  const savedDecision = await saveBusinessIntelligenceReviewDecision(
    {} as import("@supabase/supabase-js").SupabaseClient,
    {
      organizationId: "org-bi-review-1",
      fieldKey: "company.company_description",
      decision: "approved",
      decidedBy: "user-1",
      deps: {
        isBusinessIntelligenceReviewSchemaReady: async () => true,
        fetchLatestBusinessIntelligenceReport: async () => ({
          report_id: "report-1",
          organization_id: "org-bi-review-1",
          evidence_snapshot_id: "snapshot-review-1",
          evidence_run_id: "run-test-1",
          status: "partial",
          generated_at: report.generated_at,
          is_current: true,
          report,
        }),
        upsertBusinessIntelligenceReviewDecision: async (_admin, input) => {
          upsertCalled = true
          return {
            id: "decision-1",
            organization_id: input.organization_id,
            business_intelligence_report_id: input.business_intelligence_report_id,
            evidence_snapshot_id: input.evidence_snapshot_id,
            field_key: input.field_key,
            original_value_json: input.original_value_json,
            approved_value_json: input.approved_value_json,
            decision: input.decision,
            confidence_at_decision: input.confidence_at_decision,
            supporting_evidence_ids: input.supporting_evidence_ids,
            decided_by: input.decided_by,
            decided_at: new Date().toISOString(),
            metadata: {},
          }
        },
        fetchBusinessIntelligenceReviewDecisions: async () => [
          {
            id: "decision-1",
            organization_id: "org-bi-review-1",
            business_intelligence_report_id: "report-1",
            evidence_snapshot_id: "snapshot-review-1",
            field_key: "company.company_description",
            original_value_json: descriptionField?.value ?? null,
            approved_value_json: descriptionField?.value ?? null,
            decision: "approved",
            confidence_at_decision: descriptionField?.confidence ?? 0,
            supporting_evidence_ids: [],
            decided_by: "user-1",
            decided_at: new Date().toISOString(),
            metadata: {},
          },
        ],
      },
    },
  )

  assert.equal(upsertCalled, true)
  assert.equal(savedDecision.decision.field_key, "company.company_description")

  await assert.rejects(
    () =>
      saveBusinessIntelligenceReviewDecision({} as import("@supabase/supabase-js").SupabaseClient, {
        organizationId: "org-bi-review-1",
        fieldKey: "invalid.field",
        decision: "approved",
        decidedBy: "user-1",
        deps: {
          isBusinessIntelligenceReviewSchemaReady: async () => true,
          fetchLatestBusinessIntelligenceReport: async () => null,
        },
      }),
    /Unknown review field_key/,
  )

  let insertDraftCalled = false
  let approveCalled = false

  const applyResult = await applyBusinessIntelligenceReviewToBusinessProfileDraft(
    {} as import("@supabase/supabase-js").SupabaseClient,
    {
      organizationId: "org-bi-review-1",
      createdBy: "user-1",
      deps: {
        fetchLatestBusinessIntelligenceReport: async () => ({
          report_id: "report-1",
          organization_id: "org-bi-review-1",
          evidence_snapshot_id: "snapshot-review-1",
          evidence_run_id: "run-test-1",
          status: "partial",
          generated_at: report.generated_at,
          is_current: true,
          report,
        }),
        fetchBusinessIntelligenceReviewDecisions: async () => [
          {
            id: "decision-1",
            organization_id: "org-bi-review-1",
            business_intelligence_report_id: "report-1",
            evidence_snapshot_id: "snapshot-review-1",
            field_key: "company.company_description",
            original_value_json: "Commercial HVAC",
            approved_value_json: "Commercial HVAC",
            decision: "approved",
            confidence_at_decision: 0.8,
            supporting_evidence_ids: [],
            decided_by: "user-1",
            decided_at: new Date().toISOString(),
            metadata: {},
          },
          ...BUSINESS_INTELLIGENCE_REVIEW_FIELD_KEYS.filter((key) => key !== "company.company_description").map(
            (field_key, index) => ({
              id: `decision-${index + 2}`,
              organization_id: "org-bi-review-1",
              business_intelligence_report_id: "report-1",
              evidence_snapshot_id: "snapshot-review-1",
              field_key,
              original_value_json: null,
              approved_value_json: null,
              decision: "marked_unknown" as const,
              confidence_at_decision: 0,
              supporting_evidence_ids: [],
              decided_by: "user-1",
              decided_at: new Date().toISOString(),
              metadata: {},
            }),
          ),
        ],
        getActiveApprovedBusinessProfile: async () => mockApprovedProfile("org-bi-review-1"),
        getLatestDraftBusinessProfile: async () => null,
        insertBusinessProfileDraft: async () => {
          insertDraftCalled = true
          return mockApprovedProfile("org-bi-review-1")
        },
        updateBusinessProfileRow: async () => null,
      },
    },
  )

  assert.equal(insertDraftCalled, true)
  assert.equal(approveCalled, false)
  assert.ok(applyResult.profileId)

  const forbidden = [
    "runProspectResearch",
    "runGrowthLeadResearch",
    "runAvaResearchQueueOrchestrator",
    "projectApprovedBusinessProfileToLeadDiscovery",
    "approveBusinessProfileRow",
    "lead-inbox",
    "revenue-queue",
  ]

  for (const file of [
    "app/api/platform/growth/business-intelligence/review-decision/route.ts",
    "lib/growth/business-intelligence/business-intelligence-review-service.ts",
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
