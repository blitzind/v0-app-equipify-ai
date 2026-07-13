import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { analyzeBuyingCommitteeCoverage } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-coverage"
import { limitBuyingCommitteeDraftsForVerification } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-limits"
import {
  assertBuyingCommitteeIntelligencePreflight,
  BuyingCommitteeIntelligencePreflightError,
} from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-preflight"
import { promoteVerifiedBuyingCommitteeAssignment } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-promote"
import {
  createBuyingCommitteeIntelligenceRun,
  finalizeBuyingCommitteeIntelligenceRun,
  insertBuyingCommitteeIntelligenceEvidence,
} from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-repository"
import {
  collectAllBuyingCommitteeIntelligenceAssignments,
  loadBuyingCommitteeIntelligenceContext,
} from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-sources"
import { verifyBuyingCommitteeIntelligenceDraft } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-verification"
import {
  GROWTH_BUYING_COMMITTEE_INTELLIGENCE_QA_MARKER,
  type GrowthBuyingCommitteeIntelligenceAssignmentSummary,
  type GrowthBuyingCommitteeIntelligenceRole,
  type GrowthBuyingCommitteeIntelligenceRunResult,
} from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-types"
import { scheduleUnifiedRevenueWorkflowLifecycleReEvaluationForCanonicalCompany } from "@/lib/growth/revenue-workflow/unified-revenue-workflow-lifecycle-runner"

export { BuyingCommitteeIntelligencePreflightError }

export async function runBuyingCommitteeIntelligenceForCanonicalCompany(
  admin: SupabaseClient,
  input: {
    company_id: string
    created_by?: string | null
    promote?: boolean
  },
): Promise<GrowthBuyingCommitteeIntelligenceRunResult> {
  await assertBuyingCommitteeIntelligencePreflight(admin, { company_id: input.company_id })

  const ctx = await loadBuyingCommitteeIntelligenceContext(admin, { company_id: input.company_id })
  if (!ctx) throw new Error("Canonical company not found.")

  const run_id = await createBuyingCommitteeIntelligenceRun(admin, {
    company_id: input.company_id,
    created_by: input.created_by,
  })

  const collected = await collectAllBuyingCommitteeIntelligenceAssignments(admin, ctx)
  const messages = [...collected.messages]
  const { drafts, truncated } = limitBuyingCommitteeDraftsForVerification(collected.drafts)
  if (truncated > 0) {
    messages.push(`Verification cap: ${truncated} lower-priority assignment(s) skipped.`)
  }

  let verified_count = 0
  let promoted_count = 0
  const summaries: GrowthBuyingCommitteeIntelligenceAssignmentSummary[] = []
  const verified_roles: GrowthBuyingCommitteeIntelligenceRole[] = []
  const verified_person_ids: string[] = []

  try {
    for (const draft of drafts) {
      const v = verifyBuyingCommitteeIntelligenceDraft(draft)
      if (v.verification_status === "verified") {
        verified_count++
        verified_roles.push(draft.committee_role)
        verified_person_ids.push(draft.person_id)
      }

      const evidence_ids = await insertBuyingCommitteeIntelligenceEvidence(admin, {
        run_id,
        company_id: input.company_id,
        draft,
        evidence: v.evidence,
      })

      let promotion_status = "not_requested"
      let promotion_reason: string | undefined
      if (input.promote !== false) {
        const promo = await promoteVerifiedBuyingCommitteeAssignment(admin, {
          company_id: input.company_id,
          run_id,
          draft,
          verification_status: v.verification_status,
          confidence: v.confidence,
          source_evidence_ids: evidence_ids,
        })
        promotion_status = promo.promotion_status
        promotion_reason = promo.reason
        if (promo.promoted) {
          promoted_count++
          void (async () => {
            const { ingestBuyingCommitteePromotionForCompany } = await import(
              "@/lib/growth/aios/growth/growth-adaptive-loop-1b-live-ingestion"
            )
            await ingestBuyingCommitteePromotionForCompany(admin, {
              companyId: input.company_id,
              committeeRole: draft.committee_role,
              personLabel: draft.full_name,
              occurredAt: new Date().toISOString(),
              sourceEventId: promo.member_id ?? draft.person_id,
            }).catch(() => undefined)
          })()
        }
      }

      summaries.push({
        assignment_ref: draft.assignment_ref,
        person_id: draft.person_id,
        full_name: draft.full_name,
        job_title: draft.job_title,
        committee_role: draft.committee_role,
        source: draft.source,
        confidence: v.confidence,
        verification_status: v.verification_status,
        promotion_status,
        promotion_reason,
        evidence_count: v.evidence.length,
      })
    }

    const coverage = analyzeBuyingCommitteeCoverage({
      verified_roles,
      verified_person_ids,
    })

    await finalizeBuyingCommitteeIntelligenceRun(admin, {
      run_id,
      status: "completed",
      member_count: drafts.length,
      verified_count,
      promoted_count,
      coverage,
      metadata: { assignments: summaries },
    })

    if (promoted_count > 0 || verified_count > 0) {
      void scheduleUnifiedRevenueWorkflowLifecycleReEvaluationForCanonicalCompany({
        admin,
        canonicalCompanyId: input.company_id,
        event: "operator_refresh_buying_committee",
        actor: { userId: input.created_by ?? null, email: null },
      })
    }

    return {
      run_id,
      company_id: input.company_id,
      qa_marker: GROWTH_BUYING_COMMITTEE_INTELLIGENCE_QA_MARKER,
      member_count: drafts.length,
      verified_count,
      promoted_count,
      coverage,
      assignments: summaries,
      messages,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Buying committee intelligence run failed."
    await finalizeBuyingCommitteeIntelligenceRun(admin, {
      run_id,
      status: "failed",
      member_count: drafts.length,
      verified_count,
      promoted_count,
      coverage: analyzeBuyingCommitteeCoverage({ verified_roles: [], verified_person_ids: [] }),
      error_message: message,
    })
    throw e
  }
}
