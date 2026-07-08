/**
 * GE-AIOS-8A-4 — Evidence-constrained BI AI recommendation layer certification.
 * Run: pnpm test:ge-aios-8a-4-business-intelligence-ai
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

import type { BusinessProfileRecord } from "../lib/growth/business-profile/business-profile-types"
import {
  buildBusinessIntelligenceReport,
  GROWTH_BUSINESS_INTELLIGENCE_AI_QA_MARKER,
  recommendationHasEvidenceOrGapReference,
  validateAndSanitizeBusinessIntelligenceAiModel,
  validateRecommendationEvidencePolicy,
} from "../lib/growth/business-intelligence"
import {
  buildBusinessIntelligenceAiContext,
  buildDeterministicGapRecommendations,
  generateBusinessIntelligenceAiRecommendations,
} from "../lib/growth/business-intelligence/business-intelligence-ai-recommendations"
import { runBusinessIntelligence } from "../lib/growth/business-intelligence/run-business-intelligence"
import { buildEvidenceEngineSnapshotPayload } from "../lib/growth/evidence-engine/evidence-engine-snapshot"
import { normalizeProviderCollection } from "../lib/growth/evidence-engine"
import { collectApprovedProfileEvidence } from "../lib/growth/evidence-engine/providers/approved-profile-evidence-provider"
import { extractBusinessEvidenceFromHtml } from "../lib/growth/evidence-engine/providers/website-business-extractor"
import { detectEvidenceContradictions } from "../lib/growth/evidence-engine/evidence-contradiction-detector"
import { mergeEvidenceItems, mergeNormalizedFacts } from "../lib/growth/evidence-engine/evidence-normalizer"

const PHASE = "GE-AIOS-8A-4" as const

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
  console.log(`[${PHASE}] Business Intelligence AI recommendation certification`)

  assert.equal(GROWTH_BUSINESS_INTELLIGENCE_AI_QA_MARKER, "ge-aios-8a-4-business-intelligence-ai-v1")

  for (const file of [
    "lib/growth/business-intelligence/business-intelligence-ai-schema.ts",
    "lib/growth/business-intelligence/business-intelligence-ai-prompts.ts",
    "lib/growth/business-intelligence/business-intelligence-ai-recommendations.ts",
  ]) {
    assert.ok(fs.existsSync(path.join(process.cwd(), file)), `${file} must exist`)
  }

  const snapshot = await buildTestSnapshot("org-bi-ai-1")
  const report = buildBusinessIntelligenceReport({
    organization_id: "org-bi-ai-1",
    evidence_snapshot_id: "snapshot-ai-1",
    evidence_run_id: "run-test-1",
    snapshot,
  })

  assert.ok(report.gaps.some((gap) => gap.gap_code === "missing_pricing_evidence"))
  assert.ok(report.gaps.every((gap) => gap.gap_id.startsWith("gap_")))

  const pricingGap = report.gaps.find((gap) => gap.gap_code === "missing_pricing_evidence")!
  const context = buildBusinessIntelligenceAiContext(report)

  assert.ok(context.allowed_gap_ids.includes(pricingGap.gap_id))
  assert.ok(context.allowed_evidence_ids.length > 0)
  assert.equal(
    context.evidence_backed_fields.some((field) => field.field_key.includes("plans_pricing")),
    false,
    "plans_pricing must not be sent to AI when unknown",
  )

  const policyReject = validateRecommendationEvidencePolicy({
    recommendation: {
      category: "ideal_customer_profile",
      recommendation: "Target enterprise SaaS buyers in fintech without evidence.",
      confidence: 0.9,
      reasoning: ["Unsupported claim."],
      supporting_evidence_ids: [],
      related_gap_ids: [],
      requires_human_review: false,
      editable_by_user: true,
    },
    allowedEvidenceIds: new Set(context.allowed_evidence_ids),
    allowedGapIds: new Set(context.allowed_gap_ids),
  })
  assert.equal(policyReject.ok, false)

  const invalidModel = validateAndSanitizeBusinessIntelligenceAiModel({
    model: {
      recommendations: [
        {
          category: "positioning",
          recommendation: "Position as the cheapest HVAC vendor at $99/month.",
          confidence: 0.95,
          reasoning: ["Invented pricing."],
          supporting_evidence_ids: ["evidence-does-not-exist"],
          related_gap_ids: [],
          requires_human_review: false,
          editable_by_user: true,
        },
      ],
    },
    allowedEvidenceIds: new Set(context.allowed_evidence_ids),
    allowedGapIds: new Set(context.allowed_gap_ids),
  })
  assert.equal(invalidModel.ok, false)

  let aiCallCount = 0
  const validEvidenceId = context.allowed_evidence_ids[0]!

  const mockValidAi = async () => {
    aiCallCount += 1
    return validateAndSanitizeBusinessIntelligenceAiModel({
      model: {
        recommendations: [
          {
            category: "missing_information",
            recommendation: `Ask the operator to confirm pricing and packaging before outreach. No pricing evidence exists in the BI report.`,
            confidence: 0.82,
            reasoning: [
              `Pricing field is unknown; gap ${pricingGap.gap_id} requires operator confirmation.`,
            ],
            supporting_evidence_ids: [],
            related_gap_ids: [pricingGap.gap_id],
            requires_human_review: true,
            editable_by_user: true,
          },
          {
            category: "positioning",
            recommendation: "Lead with commercial HVAC maintenance value using verified company description evidence.",
            confidence: 0.78,
            reasoning: ["Company description is evidence-backed."],
            supporting_evidence_ids: [validEvidenceId],
            related_gap_ids: [],
            requires_human_review: false,
            editable_by_user: true,
          },
        ],
      },
      allowedEvidenceIds: new Set(context.allowed_evidence_ids),
      allowedGapIds: new Set(context.allowed_gap_ids),
    })
  }

  const withoutAi = await runBusinessIntelligence({
    admin: {} as import("@supabase/supabase-js").SupabaseClient,
    organizationId: "org-bi-ai-2",
    runEvidenceEngine: false,
    persist: false,
    includeAiRecommendations: false,
    deps: {
      fetchLatestEvidenceEngineSnapshot: async () => ({
        snapshot_id: "snapshot-ai-2",
        organization_id: "org-bi-ai-2",
        run_id: "run-test-2",
        generated_at: new Date().toISOString(),
        input_hash: "hash-ai-2",
        is_current: true,
        snapshot,
      }),
      fetchLatestBusinessIntelligenceReport: async () => null,
      fetchBusinessIntelligenceReportBySnapshot: async () => null,
      generateBusinessIntelligenceAiRecommendations: async () => {
        aiCallCount += 1
        throw new Error("AI must not be called when includeAiRecommendations is false")
      },
    },
  })

  assert.equal(withoutAi.empty_state, false)
  assert.equal(withoutAi.ai_recommendations_included, false)
  assert.equal(withoutAi.report?.ai_recommendations_metadata?.status, "skipped")
  assert.equal(aiCallCount, 0)

  aiCallCount = 0
  const withAi = await runBusinessIntelligence({
    admin: {} as import("@supabase/supabase-js").SupabaseClient,
    organizationId: "org-bi-ai-3",
    runEvidenceEngine: false,
    persist: false,
    includeAiRecommendations: true,
    deps: {
      fetchLatestEvidenceEngineSnapshot: async () => ({
        snapshot_id: "snapshot-ai-3",
        organization_id: "org-bi-ai-3",
        run_id: "run-test-3",
        generated_at: new Date().toISOString(),
        input_hash: "hash-ai-3",
        is_current: true,
        snapshot,
      }),
      fetchLatestBusinessIntelligenceReport: async () => null,
      fetchBusinessIntelligenceReportBySnapshot: async () => null,
      generateBusinessIntelligenceAiRecommendations: async (input) =>
        generateBusinessIntelligenceAiRecommendations({
          ...input,
          deps: { runAiRecommendations: mockValidAi },
        }),
    },
  })

  assert.equal(aiCallCount, 1)
  assert.equal(withAi.ai_recommendations_included, true)
  assert.ok(withAi.report?.ai_recommendations && withAi.report.ai_recommendations.length > 0)

  for (const recommendation of withAi.report!.ai_recommendations!) {
    assert.ok(recommendationHasEvidenceOrGapReference(recommendation))
    assert.ok(recommendation.recommendation_id)
    assert.ok(recommendation.category)
    assert.ok(recommendation.reasoning.length > 0)
  }

  const pricingRec = withAi.report!.ai_recommendations!.find((rec) =>
    rec.related_gap_ids.includes(pricingGap.gap_id),
  )
  assert.ok(pricingRec, "missing pricing must produce ask-user recommendation via gap_id")
  assert.equal(pricingRec.category, "missing_information")
  assert.match(pricingRec.recommendation.toLowerCase(), /confirm|ask|operator|pricing/)
  assert.doesNotMatch(pricingRec.recommendation, /\$\d+/)

  const conflictSnapshot = await buildTestSnapshot("org-bi-ai-4", true)
  const conflictReport = buildBusinessIntelligenceReport({
    organization_id: "org-bi-ai-4",
    evidence_snapshot_id: "snapshot-ai-4",
    evidence_run_id: "run-test-4",
    snapshot: conflictSnapshot,
  })

  const conflictGap =
    conflictReport.gaps.find((gap) => gap.gap_code === "company_description_conflict") ??
    conflictReport.gaps.find((gap) => gap.gap_code === "needs_review_items_present")
  assert.ok(conflictGap, "conflict snapshot must produce review gap")

  const deterministicConflictRecs = buildDeterministicGapRecommendations(conflictReport)
  assert.ok(
    deterministicConflictRecs.some(
      (rec) =>
        rec.category === "evidence_conflict" ||
        (rec.requires_human_review && rec.related_gap_ids.length > 0),
    ),
    "contradictions must produce review recommendations",
  )

  aiCallCount = 0
  const invalidAiResult = await generateBusinessIntelligenceAiRecommendations({
    organizationId: "org-bi-ai-5",
    report,
    deps: {
      runAiRecommendations: async () => ({
        ok: false,
        error: "Unknown supporting_evidence_id: fake-evidence",
        recommendations: [],
      }),
    },
  })

  assert.equal(invalidAiResult.metadata.status, "failed")
  assert.ok(invalidAiResult.recommendations && invalidAiResult.recommendations.length > 0)
  assert.ok(
    invalidAiResult.recommendations!.every((rec) => rec.related_gap_ids.length > 0),
    "fallback recommendations must cite gap IDs",
  )
  assert.equal(aiCallCount, 0)

  const runBiSource = readSource("lib/growth/business-intelligence/run-business-intelligence.ts")
  assert.ok(runBiSource.includes("includeAiRecommendations === true"))
  assert.ok(runBiSource.includes("attachAiRecommendationsIfRequested"))
  assert.doesNotMatch(runBiSource, /\.update\([\s\S]*organization_business_profiles/)

  const forbidden = [
    "runProspectResearch",
    "runGrowthLeadResearch",
    "runAvaResearchQueueOrchestrator",
    "datamoon",
    "projectApprovedBusinessProfileToLeadDiscovery",
    "lead-inbox",
    "revenue-queue",
  ]

  for (const file of [
    "lib/growth/business-intelligence/run-business-intelligence.ts",
    "lib/growth/business-intelligence/business-intelligence-ai-recommendations.ts",
    "lib/growth/business-intelligence/business-intelligence-ai-prompts.ts",
    "lib/growth/business-intelligence/business-intelligence-ai-schema.ts",
  ]) {
    const source = readSource(file)
    for (const token of forbidden) {
      assert.equal(source.includes(token), false, `${file} must not reference ${token}`)
    }
  }

  const aiRecSource = readSource("lib/growth/business-intelligence/business-intelligence-ai-recommendations.ts")
  assert.ok(aiRecSource.includes("validateAndSanitizeBusinessIntelligenceAiModel"))
  assert.ok(aiRecSource.includes("buildDeterministicGapRecommendations"))

  const repoSource = readSource("lib/growth/business-intelligence/business-intelligence-repository.ts")
  assert.ok(repoSource.includes("report_json"))
  assert.equal(repoSource.includes("ai_recommendations"), false, "AI recs live inside report_json only")

  const tasksSource = readSource("lib/ai/tasks.ts")
  assert.ok(tasksSource.includes("growth_business_intelligence_recommendations"))

  console.log(`[${PHASE}] certification passed`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
