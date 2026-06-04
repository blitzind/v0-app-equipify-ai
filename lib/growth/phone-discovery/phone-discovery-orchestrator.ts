import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { limitPhoneDiscoveryDraftsForVerification } from "@/lib/growth/phone-discovery/phone-discovery-limits"
import {
  assertPersonCompanyRoleForDiscovery,
  PhoneDiscoveryPreflightError,
} from "@/lib/growth/phone-discovery/phone-discovery-preflight"
import { promoteVerifiedPhoneDiscoveryCandidate } from "@/lib/growth/phone-discovery/phone-discovery-promote"
import {
  createPhoneDiscoveryRun,
  finalizePhoneDiscoveryRun,
  insertPhoneDiscoveryCandidate,
  insertPhoneDiscoveryEvidence,
  loadPhoneDiscoveryPersonContext,
  updatePhoneDiscoveryCandidatePromotion,
} from "@/lib/growth/phone-discovery/phone-discovery-repository"
import {
  collectCanonicalChannelPhoneDiscoveryCandidates,
  collectPdlPhoneDiscoveryCandidates,
  collectStagingPhoneDiscoveryCandidates,
  collectWebsitePhoneDiscoveryCandidates,
} from "@/lib/growth/phone-discovery/phone-discovery-sources"
import { verifyPhoneDiscoveryDraft } from "@/lib/growth/phone-discovery/phone-discovery-verification"
import {
  GROWTH_PHONE_DISCOVERY_QA_MARKER,
  type GrowthPhoneDiscoveryCandidateSummary,
  type GrowthPhoneDiscoveryDraftCandidate,
  type GrowthPhoneDiscoveryRunResult,
} from "@/lib/growth/phone-discovery/phone-discovery-types"

function dedupeDrafts(drafts: GrowthPhoneDiscoveryDraftCandidate[]): GrowthPhoneDiscoveryDraftCandidate[] {
  const byPhone = new Map<string, GrowthPhoneDiscoveryDraftCandidate>()
  for (const draft of drafts) {
    const existing = byPhone.get(draft.normalized_phone)
    if (!existing || draft.confidence > existing.confidence) {
      byPhone.set(draft.normalized_phone, draft)
    }
  }
  return [...byPhone.values()]
}

export async function runPhoneDiscoveryForCanonicalPerson(
  admin: SupabaseClient,
  input: {
    company_id: string
    person_id: string
    created_by?: string | null
    promote?: boolean
  },
): Promise<GrowthPhoneDiscoveryRunResult> {
  await assertPersonCompanyRoleForDiscovery(admin, {
    company_id: input.company_id,
    person_id: input.person_id,
  })

  const ctx = await loadPhoneDiscoveryPersonContext(admin, {
    company_id: input.company_id,
    person_id: input.person_id,
  })
  if (!ctx) {
    throw new Error("Canonical company or person not found.")
  }

  const run_id = await createPhoneDiscoveryRun(admin, {
    company_id: input.company_id,
    person_id: input.person_id,
    created_by: input.created_by ?? null,
  })

  const messages: string[] = []

  const sourceResults = await Promise.all([
    collectWebsitePhoneDiscoveryCandidates(ctx),
    collectStagingPhoneDiscoveryCandidates(admin, ctx),
    collectCanonicalChannelPhoneDiscoveryCandidates(admin, ctx),
    collectPdlPhoneDiscoveryCandidates(ctx),
  ])
  for (const result of sourceResults) {
    messages.push(...result.messages)
  }

  const deduped = dedupeDrafts(sourceResults.flatMap((r) => r.drafts))
  const { drafts, truncated } = limitPhoneDiscoveryDraftsForVerification(deduped)
  if (truncated > 0) {
    messages.push(`Verification cap: ${truncated} lower-priority candidate(s) skipped.`)
  }

  let verified_count = 0
  let promoted_count = 0
  const summaries: GrowthPhoneDiscoveryCandidateSummary[] = []

  try {
    for (const draft of drafts) {
      const v = verifyPhoneDiscoveryDraft(draft)
      if (v.verification_status === "verified") verified_count++

      const candidate_id = await insertPhoneDiscoveryCandidate(admin, {
        run_id,
        company_id: input.company_id,
        person_id: input.person_id,
        draft,
        verification_status: v.verification_status,
        verified_at: v.verified_at,
        verification_provider: v.verification_provider,
        verification_reasons: v.verification_reasons,
        promotion_status: "candidate",
        phone_type: v.phone_type,
      })
      await insertPhoneDiscoveryEvidence(admin, candidate_id, v.evidence)

      let promotion_status = "skipped"
      let promotion_reason = "Promotion disabled for this run."

      if (input.promote !== false) {
        const promo = await promoteVerifiedPhoneDiscoveryCandidate(admin, {
          person_id: input.person_id,
          phone: draft.phone,
          normalized_phone: draft.normalized_phone,
          phone_type: v.phone_type,
          confidence: v.confidence,
          verification_status: v.verification_status,
          provider_name: draft.provider_name,
          discovery_source: draft.discovery_source,
          run_id,
          candidate_id,
        })
        promotion_status = promo.promotion_status
        promotion_reason = promo.reason
        if (promo.promoted) promoted_count++
      } else {
        await updatePhoneDiscoveryCandidatePromotion(admin, {
          candidate_id,
          promotion_status: "skipped",
          promotion_reason,
        })
      }

      summaries.push({
        id: candidate_id,
        phone: draft.phone,
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

    await finalizePhoneDiscoveryRun(admin, {
      run_id,
      status: "completed",
      candidate_count: summaries.length,
      verified_count,
      promoted_count,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Phone discovery failed."
    await finalizePhoneDiscoveryRun(admin, {
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
    qa_marker: GROWTH_PHONE_DISCOVERY_QA_MARKER,
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

export { PhoneDiscoveryPreflightError }
