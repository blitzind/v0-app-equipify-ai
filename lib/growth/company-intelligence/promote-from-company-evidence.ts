/**
 * GE-AIOS-25C-1 — Promote high-confidence Company Evidence v22 facts into Company Intelligence.
 * Uses existing promoteVerifiedCompanyIntelligenceFinding gates. No new intelligence store.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { promoteVerifiedCompanyIntelligenceFinding } from "@/lib/growth/company-intelligence/company-intelligence-promote"
import {
  createCompanyIntelligenceRun,
  finalizeCompanyIntelligenceRun,
  insertCompanyIntelligenceEvidence,
} from "@/lib/growth/company-intelligence/company-intelligence-repository"
import {
  buildCompanyEvidencePromotionCandidates,
  GROWTH_COMPANY_EVIDENCE_CI_PROMOTION_QA_MARKER,
  type CompanyEvidencePromotionResult,
} from "@/lib/growth/company-intelligence/promote-from-company-evidence-candidates"
import type { GrowthCompanyEvidenceBundle } from "@/lib/growth/research/company-evidence/company-evidence-types"

export {
  buildCompanyEvidencePromotionCandidates,
  COMPANY_EVIDENCE_CI_PROMOTION_MIN_CONFIDENCE,
  GROWTH_COMPANY_EVIDENCE_CI_PROMOTION_QA_MARKER,
  type CompanyEvidencePromotionCandidate,
  type CompanyEvidencePromotionResult,
} from "@/lib/growth/company-intelligence/promote-from-company-evidence-candidates"

export async function promoteCompanyEvidenceToCompanyIntelligence(
  admin: SupabaseClient,
  input: {
    companyId: string | null
    bundle: GrowthCompanyEvidenceBundle | null
  },
): Promise<CompanyEvidencePromotionResult> {
  if (!input.companyId) {
    return {
      qaMarker: GROWTH_COMPANY_EVIDENCE_CI_PROMOTION_QA_MARKER,
      companyId: null,
      attempted: 0,
      promoted: 0,
      rejected: [],
      skippedReason: "no_canonical_company_id",
    }
  }
  if (!input.bundle) {
    return {
      qaMarker: GROWTH_COMPANY_EVIDENCE_CI_PROMOTION_QA_MARKER,
      companyId: input.companyId,
      attempted: 0,
      promoted: 0,
      rejected: [],
      skippedReason: "no_company_evidence_bundle",
    }
  }

  const candidates = buildCompanyEvidencePromotionCandidates(input.bundle)
  const accepted = candidates.filter((c) => c.accepted)
  const rejected = candidates
    .filter((c) => !c.accepted)
    .map((c) => ({
      key: c.draft.normalized_intelligence_key,
      reason: c.rejectReason ?? "rejected",
    }))

  if (accepted.length === 0) {
    return {
      qaMarker: GROWTH_COMPANY_EVIDENCE_CI_PROMOTION_QA_MARKER,
      companyId: input.companyId,
      attempted: candidates.length,
      promoted: 0,
      rejected,
      skippedReason: "no_promotable_candidates",
    }
  }

  const runId = await createCompanyIntelligenceRun(admin, { company_id: input.companyId })
  let promoted = 0
  const promotionRejected = [...rejected]

  for (const candidate of accepted) {
    const evidenceIds = await insertCompanyIntelligenceEvidence(admin, {
      run_id: runId,
      company_id: input.companyId,
      draft: candidate.draft,
      evidence: candidate.draft.evidence,
    })

    const result = await promoteVerifiedCompanyIntelligenceFinding(admin, {
      company_id: input.companyId,
      run_id: runId,
      draft: candidate.draft,
      verification_status: "verified",
      confidence: candidate.draft.confidence,
      source_evidence_ids: evidenceIds,
    })

    if (result.promoted) {
      promoted += 1
    } else {
      promotionRejected.push({
        key: candidate.draft.normalized_intelligence_key,
        reason: result.reason,
      })
    }
  }

  await finalizeCompanyIntelligenceRun(admin, {
    run_id: runId,
    status: "completed",
    finding_count: accepted.length,
    verified_count: accepted.length,
    promoted_count: promoted,
    metadata: { qa_marker: GROWTH_COMPANY_EVIDENCE_CI_PROMOTION_QA_MARKER },
  })

  return {
    qaMarker: GROWTH_COMPANY_EVIDENCE_CI_PROMOTION_QA_MARKER,
    companyId: input.companyId,
    attempted: candidates.length,
    promoted,
    rejected: promotionRejected,
    skippedReason: null,
  }
}
