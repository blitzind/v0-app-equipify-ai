import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { evaluateEmailDiscoveryVerificationCertification } from "@/lib/growth/email-discovery/email-discovery-certification"
import {
  assertEmailDiscoveryVerificationReadyForRun,
  assertPersonCompanyRoleForDiscovery,
  EmailDiscoveryPreflightError,
} from "@/lib/growth/email-discovery/email-discovery-preflight"
import { limitEmailDiscoveryDraftsForVerification } from "@/lib/growth/email-discovery/email-discovery-limits"
import {
  collectPatternEmailDiscoveryCandidates,
  collectPdlEmailDiscoveryCandidates,
  collectStagingEmailDiscoveryCandidates,
  collectWebsiteEmailDiscoveryCandidates,
} from "@/lib/growth/email-discovery/email-discovery-sources"
import {
  createEmailDiscoveryRun,
  finalizeEmailDiscoveryRun,
  insertEmailDiscoveryCandidate,
  insertEmailDiscoveryEvidence,
  loadEmailDiscoveryPersonContext,
  updateEmailDiscoveryCandidatePromotion,
} from "@/lib/growth/email-discovery/email-discovery-repository"
import { promoteVerifiedEmailDiscoveryCandidate } from "@/lib/growth/email-discovery/email-discovery-promote"
import { verifyEmailDiscoveryDraft } from "@/lib/growth/email-discovery/email-discovery-verification"
import {
  GROWTH_EMAIL_DISCOVERY_QA_MARKER,
  type GrowthEmailDiscoveryCandidateSummary,
  type GrowthEmailDiscoveryDraftCandidate,
  type GrowthEmailDiscoveryRunResult,
} from "@/lib/growth/email-discovery/email-discovery-types"

function dedupeDrafts(drafts: GrowthEmailDiscoveryDraftCandidate[]): GrowthEmailDiscoveryDraftCandidate[] {
  const byEmail = new Map<string, GrowthEmailDiscoveryDraftCandidate>()
  for (const draft of drafts) {
    const existing = byEmail.get(draft.normalized_email)
    if (!existing || draft.confidence > existing.confidence) {
      byEmail.set(draft.normalized_email, draft)
    }
  }
  return [...byEmail.values()]
}

export async function runEmailDiscoveryForCanonicalPerson(
  admin: SupabaseClient,
  input: {
    company_id: string
    person_id: string
    created_by?: string | null
    lead_id?: string | null
    promote?: boolean
    require_production_safe_verification?: boolean
  },
): Promise<GrowthEmailDiscoveryRunResult> {
  await assertPersonCompanyRoleForDiscovery(admin, {
    company_id: input.company_id,
    person_id: input.person_id,
  })

  assertEmailDiscoveryVerificationReadyForRun({
    require_production_safe: input.require_production_safe_verification ?? false,
  })

  const ctx = await loadEmailDiscoveryPersonContext(admin, {
    company_id: input.company_id,
    person_id: input.person_id,
  })
  if (!ctx) {
    throw new Error("Canonical company or person not found.")
  }

  const run_id = await createEmailDiscoveryRun(admin, {
    company_id: input.company_id,
    person_id: input.person_id,
    created_by: input.created_by ?? null,
  })

  const messages: string[] = []
  const verification_cert = evaluateEmailDiscoveryVerificationCertification()
  if (verification_cert.blockers.length > 0) {
    messages.push(...verification_cert.blockers.map((b) => `Verification: ${b}`))
  }

  const sourceResults = await Promise.all([
    collectWebsiteEmailDiscoveryCandidates(ctx),
    collectStagingEmailDiscoveryCandidates(admin, ctx),
    collectPatternEmailDiscoveryCandidates(ctx),
    collectPdlEmailDiscoveryCandidates(ctx),
  ])
  for (const result of sourceResults) {
    messages.push(...result.messages)
  }

  const deduped = dedupeDrafts(sourceResults.flatMap((r) => r.drafts))
  const { drafts, truncated } = limitEmailDiscoveryDraftsForVerification(deduped)
  if (truncated > 0) {
    messages.push(
      `Verification cap: ${truncated} lower-priority candidate(s) skipped (pattern last) to limit provider volume.`,
    )
  }

  let verified_count = 0
  let promoted_count = 0
  const summaries: GrowthEmailDiscoveryCandidateSummary[] = []

  try {
    for (const draft of drafts) {
      const v = await verifyEmailDiscoveryDraft(admin, draft, { leadId: input.lead_id ?? null })
      const verified: GrowthEmailDiscoveryDraftCandidate = {
        ...draft,
        confidence: v.confidence,
        confidence_tier: v.confidence_tier,
        evidence: v.evidence,
      }
      if (v.verification_status === "verified") verified_count++

      const candidate_id = await insertEmailDiscoveryCandidate(admin, {
        run_id,
        company_id: input.company_id,
        person_id: input.person_id,
        draft: verified,
        verification_status: v.verification_status,
        verified_at: v.verified_at,
        verification_provider: v.verification_provider,
        verification_reasons: v.verification_reasons,
        promotion_status: "candidate",
      })
      await insertEmailDiscoveryEvidence(admin, candidate_id, verified.evidence)

      let promotion_status = "skipped"
      let promotion_reason = "Promotion disabled for this run."

      if (input.promote !== false) {
        const promo = await promoteVerifiedEmailDiscoveryCandidate(admin, {
          person_id: input.person_id,
          email: verified.email,
          normalized_email: verified.normalized_email,
          confidence: v.confidence,
          verification_status: v.verification_status,
          provider_name: verified.provider_name,
          discovery_source: verified.discovery_source,
          run_id,
          candidate_id,
        })
        promotion_status = promo.promotion_status
        promotion_reason = promo.reason
        if (promo.promoted) promoted_count++
      } else {
        await updateEmailDiscoveryCandidatePromotion(admin, {
          candidate_id,
          promotion_status: "skipped",
          promotion_reason,
        })
      }

      summaries.push({
        id: candidate_id,
        email: verified.email,
        source: verified.source,
        confidence: v.confidence,
        confidence_tier: v.confidence_tier,
        verification_status: v.verification_status,
        promotion_status,
        promotion_reason,
        verification_provider: v.verification_provider,
        verification_reasons: v.verification_reasons,
        evidence_count: verified.evidence.length,
      })
    }

    await finalizeEmailDiscoveryRun(admin, {
      run_id,
      status: "completed",
      candidate_count: summaries.length,
      verified_count,
      promoted_count,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Email discovery failed."
    await finalizeEmailDiscoveryRun(admin, {
      run_id,
      status: "failed",
      candidate_count: summaries.length,
      verified_count,
      promoted_count,
      error_message: message,
    })
    throw e
  }

  return {
    qa_marker: GROWTH_EMAIL_DISCOVERY_QA_MARKER,
    run_id,
    company_id: input.company_id,
    person_id: input.person_id,
    status: "completed",
    candidate_count: summaries.length,
    verified_count,
    promoted_count,
    candidates: summaries,
    messages,
  }
}

export { EmailDiscoveryPreflightError }
