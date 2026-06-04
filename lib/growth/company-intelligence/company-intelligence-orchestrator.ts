import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { limitCompanyIntelligenceDraftsForVerification } from "@/lib/growth/company-intelligence/company-intelligence-limits"
import {
  assertCompanyIntelligencePreflight,
  CompanyIntelligencePreflightError,
} from "@/lib/growth/company-intelligence/company-intelligence-preflight"
import { promoteVerifiedCompanyIntelligenceFinding } from "@/lib/growth/company-intelligence/company-intelligence-promote"
import {
  createCompanyIntelligenceRun,
  finalizeCompanyIntelligenceRun,
  insertCompanyIntelligenceEvidence,
} from "@/lib/growth/company-intelligence/company-intelligence-repository"
import {
  collectAllCompanyIntelligenceFindings,
  loadCompanyIntelligenceContext,
} from "@/lib/growth/company-intelligence/company-intelligence-sources"
import { verifyCompanyIntelligenceDraft } from "@/lib/growth/company-intelligence/company-intelligence-verification"
import {
  GROWTH_COMPANY_INTELLIGENCE_QA_MARKER,
  type GrowthCompanyIntelligenceFindingSummary,
  type GrowthCompanyIntelligenceRunResult,
} from "@/lib/growth/company-intelligence/company-intelligence-types"

function dedupeDrafts(
  drafts: import("@/lib/growth/company-intelligence/company-intelligence-types").GrowthCompanyIntelligenceDraftFinding[],
) {
  const byKey = new Map<string, (typeof drafts)[number]>()
  for (const draft of drafts) {
    const existing = byKey.get(draft.normalized_intelligence_key)
    if (!existing || draft.confidence > existing.confidence) {
      byKey.set(draft.normalized_intelligence_key, draft)
    }
  }
  return [...byKey.values()]
}

export async function runCompanyIntelligenceForCanonicalCompany(
  admin: SupabaseClient,
  input: {
    company_id: string
    created_by?: string | null
    promote?: boolean
  },
): Promise<GrowthCompanyIntelligenceRunResult> {
  await assertCompanyIntelligencePreflight(admin, { company_id: input.company_id })

  const ctx = await loadCompanyIntelligenceContext(admin, { company_id: input.company_id })
  if (!ctx) throw new Error("Canonical company not found.")

  const run_id = await createCompanyIntelligenceRun(admin, {
    company_id: input.company_id,
    created_by: input.created_by,
  })

  const collected = await collectAllCompanyIntelligenceFindings(admin, ctx)
  const messages = [...collected.messages]
  const deduped = dedupeDrafts(collected.drafts)
  const { drafts, truncated } = limitCompanyIntelligenceDraftsForVerification(deduped)
  if (truncated > 0) {
    messages.push(`Verification cap: ${truncated} lower-priority finding(s) skipped.`)
  }

  let verified_count = 0
  let promoted_count = 0
  const summaries: GrowthCompanyIntelligenceFindingSummary[] = []

  try {
    for (const draft of drafts) {
      const v = verifyCompanyIntelligenceDraft(draft)
      if (v.verification_status === "verified") verified_count++

      const evidence_ids = await insertCompanyIntelligenceEvidence(admin, {
        run_id,
        company_id: input.company_id,
        draft,
        evidence: v.evidence,
      })

      let promotion_status = "skipped"
      let promotion_reason = "Promotion disabled for this run."

      if (input.promote !== false) {
        const promo = await promoteVerifiedCompanyIntelligenceFinding(admin, {
          company_id: input.company_id,
          run_id,
          draft,
          verification_status: v.verification_status,
          confidence: v.confidence,
          source_evidence_ids: evidence_ids,
        })
        promotion_status = promo.promotion_status
        promotion_reason = promo.reason
        if (promo.promoted) promoted_count++
      }

      summaries.push({
        finding_ref: draft.finding_ref,
        intelligence_category: draft.intelligence_category,
        intelligence_key: draft.intelligence_key,
        value_text: draft.value_text,
        source: draft.source,
        confidence: v.confidence,
        confidence_tier: v.confidence_tier,
        verification_status: v.verification_status,
        promotion_status,
        promotion_reason,
        verification_provider: v.verification_provider,
        verification_reasons: v.verification_reasons,
        evidence_count: v.evidence.length,
      })
    }

    await finalizeCompanyIntelligenceRun(admin, {
      run_id,
      status: "completed",
      finding_count: summaries.length,
      verified_count,
      promoted_count,
      metadata: { findings: summaries, qa_marker: GROWTH_COMPANY_INTELLIGENCE_QA_MARKER },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Company intelligence collection failed."
    await finalizeCompanyIntelligenceRun(admin, {
      run_id,
      status: "failed",
      finding_count: summaries.length,
      verified_count,
      promoted_count,
      error_message: message,
      metadata: { findings: summaries },
    })
    throw e
  }

  return {
    qa_marker: GROWTH_COMPANY_INTELLIGENCE_QA_MARKER,
    run_id,
    company_id: input.company_id,
    status: "completed",
    finding_count: summaries.length,
    verified_count,
    promoted_count,
    findings: summaries,
    messages,
  }
}

export { CompanyIntelligencePreflightError }
