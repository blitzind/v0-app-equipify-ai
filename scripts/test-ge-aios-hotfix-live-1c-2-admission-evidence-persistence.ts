/**
 * GE-AIOS-HOTFIX-LIVE-1C-2 — Admission + evidence persistence certification.
 * Run: pnpm test:ge-aios-hotfix-live-1c-2-admission-evidence-persistence
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildCanonicalIntakeLeadMetadata } from "../lib/growth/lead-inbox/lead-inbox-canonical-intake-bridge"
import { mergeGrowthLeadMetadata } from "../lib/growth/lead-repository"
import {
  buildLeadAdmissionMetadata,
  evaluateGrowthLeadAdmission,
} from "../lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import { GROWTH_LEAD_ADMISSION_21C_QA_MARKER } from "../lib/growth/revenue-workflow/growth-lead-admission-types"
import {
  GROWTH_COMPANY_EVIDENCE_22_QA_MARKER,
  GROWTH_COMPANY_EVIDENCE_COLLECTION_QA_MARKER,
} from "../lib/growth/research/company-evidence/company-evidence-types"
import { mapProspectResearchRunRow } from "../lib/growth/research/research-repository"

const PHASE = "GE-AIOS-HOTFIX-LIVE-1C-2" as const

const SAMPLE_PROFILE = {
  company: {
    companyName: "Equipify",
    website: "https://equipify.example",
    shortDescription: "Field service software",
    productsServices: ["CMMS", "field service"],
    businessModel: "B2B SaaS",
    primaryValueProposition: "Equipment service operations",
  },
  idealCustomers: {
    targetIndustries: ["medical equipment service", "biomedical repair"],
    companySizeRanges: ["11-50", "51-200"],
    geography: ["United States"],
    buyerPersonas: ["Owner", "Operations Manager"],
    disqualifiers: ["retail", "roofing contractor"],
  },
  problemsAndTriggers: {
    painPoints: ["manual dispatch"],
    buyingTriggers: ["equipment downtime"],
    competitorsAlternatives: [],
    keywords: ["medical equipment service"],
    negativeKeywords: ["roofing", "seafood"],
  },
  salesAndMarketing: {
    averageDealSize: null,
    salesCycleEstimate: null,
    messagingAngles: [],
    qualificationCriteria: ["service business"],
  },
  confidence: {
    score: 85,
    assumptions: [],
    missingInformation: [],
  },
} as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function sampleInboxInput(overrides: Record<string, unknown> = {}) {
  return {
    dedupe_hash: "dedupe-hotfix-1c-2",
    site_key: "prospect_search:live-1c-2",
    intent_session_id: "session-hotfix-1c-2",
    visitor_key: "visitor-hotfix-1c-2",
    session_count: 1,
    visit_count: 1,
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    company_name: "Block Imaging",
    domain: "blockimaging.com",
    candidate_type: "company",
    candidate_priority: 80,
    intent_score: 70,
    intent_grade: "A",
    candidate_confidence: 0.82,
    pipeline_entry: "prospect_search",
    candidate_reasoning: "Medical imaging equipment service",
    candidate_evidence: [{ source: "prospect_search", evidence: "blockimaging.com" }],
    candidate_attribution: [{ source: "prospect_search", evidence: "canonical push" }],
    existing_account_match: null,
    existing_lead_match: null,
    metadata: { prospect_search: { query: "biomedical equipment service" } },
    ...overrides,
  }
}

function main(): void {
  console.log(`[${PHASE}] Admission + evidence persistence certification`)

  const repoSource = readSource("lib/growth/lead-inbox/lead-inbox-repository.ts")
  assert.match(repoSource, /const existingLead = await fetchGrowthLeadById\(admin, canonical\.growth_lead_id\)/)
  assert.match(repoSource, /buildCanonicalIntakeLeadMetadata\([\s\S]*existingLead\?\.metadata/)
  console.log("  ✓ createLeadCandidate merges existing lead metadata before inbox patch")

  const bridgeSource = readSource("lib/growth/lead-inbox/lead-inbox-canonical-intake-bridge.ts")
  assert.match(bridgeSource, /mergeGrowthLeadMetadata/)
  assert.match(bridgeSource, /existingLeadMetadata/)
  console.log("  ✓ canonical intake bridge preserves pre-existing lead metadata")

  const leadRepoSource = readSource("lib/growth/lead-repository.ts")
  assert.match(leadRepoSource, /export function mergeGrowthLeadMetadata/)
  console.log("  ✓ shared mergeGrowthLeadMetadata helper exists")

  const admissionAt = "2026-07-10T17:26:00.000Z"
  const acceptedAdmission = buildLeadAdmissionMetadata(
    {
      state: "accepted",
      reasons: ["profile_aligned"],
      qa_marker: GROWTH_LEAD_ADMISSION_21C_QA_MARKER,
      requiresHumanReview: false,
      allowLeadCreation: true,
      leadStatus: "new",
      sanitized: {
        companyName: "Block Imaging",
        website: "https://blockimaging.com",
        domain: "blockimaging.com",
      },
    },
    admissionAt,
  )

  const canonical = {
    growth_lead_id: "lead-hotfix-1c-2",
    lead_status: "new",
    lead_created: true,
    dedupe_rule: null,
  }

  const mergedAccepted = buildCanonicalIntakeLeadMetadata(
    sampleInboxInput() as never,
    canonical,
    {
      ...acceptedAdmission,
      unified_intake_source: "saved_search",
      revenue_workflow_v4: { queued: true },
    },
  )

  assert.equal(mergedAccepted.admission_state, "accepted")
  assert.equal(mergedAccepted.admission_qa_marker, GROWTH_LEAD_ADMISSION_21C_QA_MARKER)
  assert.deepEqual(mergedAccepted.admission_reasons, ["profile_aligned"])
  assert.equal(mergedAccepted.admission_evaluated_at, admissionAt)
  assert.equal(mergedAccepted.requires_human_review, false)
  assert.equal(mergedAccepted.revenue_workflow_v4?.queued, true)
  assert.ok(Array.isArray(mergedAccepted.candidate_attribution))
  console.log("  ✓ accepted intake preserves 21C admission metadata + workflow metadata")

  const reviewAdmission = buildLeadAdmissionMetadata(
    {
      state: "review",
      reasons: ["identity_uncertain"],
      qa_marker: GROWTH_LEAD_ADMISSION_21C_QA_MARKER,
      requiresHumanReview: true,
      allowLeadCreation: true,
      leadStatus: "new",
      sanitized: {
        companyName: "Review Co",
        website: "https://review.example",
        domain: "review.example",
      },
    },
    admissionAt,
  )
  const mergedReview = buildCanonicalIntakeLeadMetadata(sampleInboxInput() as never, canonical, reviewAdmission)
  assert.equal(mergedReview.admission_state, "review")
  assert.equal(mergedReview.requires_human_review, true)
  console.log("  ✓ review intake preserves human-review metadata")

  const invalidAdmission = evaluateGrowthLeadAdmission(
    {
      companyName: "yahoo.com",
      website: "https://yahoo.com",
      domain: "yahoo.com",
      industry: null,
      email: "kpulham@yahoo.com",
      contactName: "Kim Pulham",
      identityUncertain: false,
      source: "datamoon",
      metadata: { business_email: null },
    },
    { approvedProfile: SAMPLE_PROFILE, activeMissionTitle: "Equipment service ICP" },
  )
  assert.equal(invalidAdmission.allowLeadCreation, false)
  assert.equal(invalidAdmission.state, "invalid")
  console.log("  ✓ rejected/invalid intake behavior unchanged")

  const laterWorkflowPatch = mergeGrowthLeadMetadata(mergedAccepted, {
    revenue_execution_timeline_v5: { event: "research_completed" },
    qualification_context: { source: "sales_loop" },
  })
  assert.equal(laterWorkflowPatch.admission_state, "accepted")
  assert.equal(laterWorkflowPatch.admission_qa_marker, GROWTH_LEAD_ADMISSION_21C_QA_MARKER)
  assert.equal(laterWorkflowPatch.revenue_execution_timeline_v5?.event, "research_completed")
  console.log("  ✓ later workflow metadata merges without erasing admission fields")

  const orchestrator = readSource("lib/growth/research/research-orchestrator.ts")
  assert.match(orchestrator, /collectProspectCompanyEvidence/)
  assert.match(orchestrator, /companyEvidence_v22/)
  assert.match(orchestrator, /companyEvidenceCollection_v22/)
  assert.match(orchestrator, /buildCompanyEvidenceCollectionRecord/)
  assert.doesNotMatch(orchestrator, /runAiTask/)
  console.log("  ✓ canonical research orchestrator invokes GE-AIOS-22 evidence + collection record")

  const executionService = readSource("lib/growth/research/growth-lead-research-execution-service.ts")
  assert.match(executionService, /runProspectResearch/)
  assert.doesNotMatch(executionService, /insertGrowthLeadResearchRun/)
  console.log("  ✓ 21A facade remains canonical research entry (no legacy run insert)")

  const mappedRun = mapProspectResearchRunRow({
    id: "run-hotfix-1c-2",
    organization_id: "org",
    lead_id: "lead-hotfix-1c-2",
    status: "completed",
    website_url: "https://blockimaging.com",
    company_name: "Block Imaging",
    industry_guess: "Medical Equipment",
    employee_size_guess: null,
    revenue_size_guess: null,
    website_maturity_score: 72,
    social_presence_score: null,
    reputation_score: null,
    technology_score: null,
    detected_technologies: [],
    signals: {
      painSignals: [],
      companyEvidence_v22: {
        qa_marker: GROWTH_COMPANY_EVIDENCE_22_QA_MARKER,
        collectedAt: admissionAt,
        websiteUrl: "https://blockimaging.com",
        profile: {},
        qualityScores: {
          identityConfidence: 0.8,
          websiteConfidence: 0.8,
          industryConfidence: 0.7,
          offeringConfidence: 0.7,
          marketConfidence: 0.6,
          overallEvidenceConfidence: 0.72,
        },
        crawlState: {
          pagesPlanned: 3,
          pagesCrawled: 3,
          pagesSkipped: 0,
          stoppedEarly: false,
          stopReason: null,
          websiteCoverage: ["https://blockimaging.com"],
          missingInformation: [],
        },
        missionComparison: null,
        qualificationExplanation: null,
        evidenceSources: ["https://blockimaging.com"],
        cacheKey: null,
      },
      companyEvidenceCollection_v22: {
        qa_marker: GROWTH_COMPANY_EVIDENCE_COLLECTION_QA_MARKER,
        status: "collected",
        collectedAt: admissionAt,
      },
    },
    competitors: [],
    research_summary: "summary",
    suggested_pitch_angle: null,
    suggested_sequence: null,
    suggested_call_opening: null,
    recommended_next_action: "Call Prospect",
    research_confidence: 0.7,
    input_hash: "hash",
    completed_at: admissionAt,
    failed_reason: null,
    created_at: admissionAt,
  })

  assert.equal(mappedRun.signals.companyEvidence_v22?.qaMarker, GROWTH_COMPANY_EVIDENCE_22_QA_MARKER)
  assert.deepEqual(mappedRun.signals.companyEvidence_v22?.evidenceSources, ["https://blockimaging.com"])
  assert.equal(mappedRun.signals.companyEvidenceCollection_v22?.status, "collected")
  console.log("  ✓ companyEvidence_v22 + collection record survive repository mapping")

  const failedMapped = mapProspectResearchRunRow({
    ...({
      id: "run-failed-evidence",
      organization_id: "org",
      lead_id: "lead",
      status: "completed",
      website_url: "https://blockimaging.com",
      company_name: "Block Imaging",
      industry_guess: null,
      employee_size_guess: null,
      revenue_size_guess: null,
      website_maturity_score: null,
      social_presence_score: null,
      reputation_score: null,
      technology_score: null,
      detected_technologies: [],
      signals: {
        painSignals: [],
        companyEvidenceCollection_v22: {
          qaMarker: GROWTH_COMPANY_EVIDENCE_COLLECTION_QA_MARKER,
          status: "failed",
          reason: "collector_timeout",
          collectedAt: admissionAt,
        },
      },
      competitors: [],
      research_summary: null,
      suggested_pitch_angle: null,
      suggested_sequence: null,
      suggested_call_opening: null,
      recommended_next_action: null,
      research_confidence: null,
      input_hash: null,
      completed_at: admissionAt,
      failed_reason: null,
      created_at: admissionAt,
    } as const),
  })
  assert.equal(failedMapped.signals.companyEvidenceCollection_v22?.status, "failed")
  assert.equal(failedMapped.signals.companyEvidenceCollection_v22?.reason, "collector_timeout")
  assert.equal(failedMapped.signals.companyEvidence_v22, undefined)
  console.log("  ✓ evidence failures remain observable without blocking research completion")

  assert.equal(GROWTH_COMPANY_EVIDENCE_COLLECTION_QA_MARKER, "ge-aios-22-company-evidence-collection-v1")
  console.log("  ✓ collection QA marker registered")

  console.log(`[${PHASE}] certification passed`)
}

main()
