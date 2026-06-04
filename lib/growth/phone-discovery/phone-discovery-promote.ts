import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { upsertCanonicalPersonPhone } from "@/lib/growth/canonical-persons/canonical-person-repository-core"
import { canPromotePhoneDiscoveryCandidate } from "@/lib/growth/phone-discovery/phone-discovery-confidence"
import {
  clearPrimaryPhoneFlagsForPersonExcept,
  evaluateCanonicalPersonPhonePromotion,
  fetchCanonicalPersonPhoneByNormalized,
} from "@/lib/growth/phone-discovery/phone-discovery-person-phone-integrity"
import { updatePhoneDiscoveryCandidatePromotion } from "@/lib/growth/phone-discovery/phone-discovery-repository"
import { GROWTH_PHONE_DISCOVERY_PROMOTION_MIN_CONFIDENCE } from "@/lib/growth/phone-discovery/phone-discovery-types"

export async function promoteVerifiedPhoneDiscoveryCandidate(
  admin: SupabaseClient,
  input: {
    person_id: string
    phone: string
    normalized_phone: string
    phone_type: string
    confidence: number
    verification_status: string
    provider_name: string
    discovery_source: string
    run_id: string
    candidate_id: string
  },
): Promise<{ promoted: boolean; reason: string; promotion_status: "promoted" | "skipped" | "rejected" }> {
  if (
    !canPromotePhoneDiscoveryCandidate({
      verification_status: input.verification_status,
      confidence: input.confidence,
      min_confidence: GROWTH_PHONE_DISCOVERY_PROMOTION_MIN_CONFIDENCE,
    })
  ) {
    const reason = "Promotion requires verified status and confidence >= threshold."
    await updatePhoneDiscoveryCandidatePromotion(admin, {
      candidate_id: input.candidate_id,
      promotion_status: "skipped",
      promotion_reason: reason,
    })
    return { promoted: false, reason, promotion_status: "skipped" }
  }

  const existing = await fetchCanonicalPersonPhoneByNormalized(admin, input.normalized_phone)
  const ownership = evaluateCanonicalPersonPhonePromotion({
    existing,
    target_person_id: input.person_id,
    incoming_confidence: input.confidence,
    incoming_verification_status: input.verification_status,
  })

  if (!ownership.allowed) {
    await updatePhoneDiscoveryCandidatePromotion(admin, {
      candidate_id: input.candidate_id,
      promotion_status: "rejected",
      promotion_reason: ownership.reason,
    })
    return { promoted: false, reason: ownership.reason, promotion_status: "rejected" }
  }

  const observed = new Date().toISOString()
  await clearPrimaryPhoneFlagsForPersonExcept(admin, input.person_id, input.normalized_phone)

  const phone_type =
    input.phone_type === "mobile" || input.phone_type === "business" ? input.phone_type : "unknown"

  await upsertCanonicalPersonPhone(admin, {
    person_id: input.person_id,
    phone: input.phone,
    normalized_phone: input.normalized_phone,
    phone_type,
    is_primary: true,
    verification_status: "verified",
    confidence: input.confidence,
    source_table: "phone_discovery_candidates",
    source_id: input.candidate_id,
    provider_name: input.provider_name,
    discovery_source: input.discovery_source,
    observed_at: observed,
    metadata: {
      ...ownership.merge_metadata,
      phone_discovery_run_id: input.run_id,
      promoted_at: observed,
      last_promotion_source: input.discovery_source,
    },
  })

  await updatePhoneDiscoveryCandidatePromotion(admin, {
    candidate_id: input.candidate_id,
    promotion_status: "promoted",
    promotion_reason: ownership.reason,
    promoted_at: observed,
  })

  return { promoted: true, reason: ownership.reason, promotion_status: "promoted" }
}
