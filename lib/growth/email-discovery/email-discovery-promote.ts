import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { upsertCanonicalPersonEmail } from "@/lib/growth/canonical-persons/canonical-person-repository-core"
import { canPromoteEmailDiscoveryCandidate } from "@/lib/growth/email-discovery/email-discovery-confidence"
import {
  clearPrimaryFlagsForPersonExcept,
  evaluateCanonicalPersonEmailPromotion,
  fetchCanonicalPersonEmailByNormalized,
} from "@/lib/growth/email-discovery/email-discovery-person-email-integrity"
import { updateEmailDiscoveryCandidatePromotion } from "@/lib/growth/email-discovery/email-discovery-repository"
import { GROWTH_EMAIL_DISCOVERY_PROMOTION_MIN_CONFIDENCE } from "@/lib/growth/email-discovery/email-discovery-types"

export async function promoteVerifiedEmailDiscoveryCandidate(
  admin: SupabaseClient,
  input: {
    person_id: string
    email: string
    normalized_email: string
    confidence: number
    verification_status: string
    provider_name: string
    discovery_source: string
    run_id: string
    candidate_id: string
  },
): Promise<{ promoted: boolean; reason: string; promotion_status: "promoted" | "skipped" | "rejected" }> {
  if (
    !canPromoteEmailDiscoveryCandidate({
      verification_status: input.verification_status,
      confidence: input.confidence,
      min_confidence: GROWTH_EMAIL_DISCOVERY_PROMOTION_MIN_CONFIDENCE,
    })
  ) {
    const reason = "Promotion requires verified status and confidence >= threshold."
    await updateEmailDiscoveryCandidatePromotion(admin, {
      candidate_id: input.candidate_id,
      promotion_status: "skipped",
      promotion_reason: reason,
    })
    return { promoted: false, reason, promotion_status: "skipped" }
  }

  const existing = await fetchCanonicalPersonEmailByNormalized(admin, input.normalized_email)
  const ownership = evaluateCanonicalPersonEmailPromotion({
    existing,
    target_person_id: input.person_id,
    incoming_confidence: input.confidence,
    incoming_verification_status: input.verification_status,
  })

  if (!ownership.allowed) {
    await updateEmailDiscoveryCandidatePromotion(admin, {
      candidate_id: input.candidate_id,
      promotion_status: "rejected",
      promotion_reason: ownership.reason,
    })
    return { promoted: false, reason: ownership.reason, promotion_status: "rejected" }
  }

  const observed = new Date().toISOString()
  await clearPrimaryFlagsForPersonExcept(admin, input.person_id, input.normalized_email)

  await upsertCanonicalPersonEmail(admin, {
    person_id: input.person_id,
    email: input.email,
    normalized_email: input.normalized_email,
    email_type: "work",
    is_primary: true,
    verification_status: "verified",
    confidence: input.confidence,
    source_table: "email_discovery_candidates",
    source_id: input.candidate_id,
    provider_name: input.provider_name,
    discovery_source: input.discovery_source,
    observed_at: observed,
    metadata: {
      ...ownership.merge_metadata,
      email_discovery_run_id: input.run_id,
      promoted_at: observed,
      last_promotion_source: input.discovery_source,
    },
  })

  await updateEmailDiscoveryCandidatePromotion(admin, {
    candidate_id: input.candidate_id,
    promotion_status: "promoted",
    promotion_reason: ownership.reason,
    promoted_at: observed,
  })

  return { promoted: true, reason: ownership.reason, promotion_status: "promoted" }
}
