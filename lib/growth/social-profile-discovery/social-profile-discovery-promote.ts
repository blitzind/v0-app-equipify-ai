import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { upsertCanonicalPersonProfile } from "@/lib/growth/canonical-persons/canonical-person-repository-core"
import { upsertCanonicalCompanyProfile } from "@/lib/growth/canonical-companies/canonical-company-repository-core"
import { canPromoteSocialProfileDiscoveryCandidate } from "@/lib/growth/social-profile-discovery/social-profile-discovery-confidence"
import {
  evaluateCanonicalProfilePromotion,
  fetchCanonicalCompanyProfileByNormalizedKey,
} from "@/lib/growth/social-profile-discovery/social-profile-discovery-company-profile-integrity"
import {
  fetchCanonicalPersonProfileByNormalizedKey,
} from "@/lib/growth/social-profile-discovery/social-profile-discovery-person-profile-integrity"
import { updateSocialProfileDiscoveryCandidatePromotion } from "@/lib/growth/social-profile-discovery/social-profile-discovery-repository"
import { canonicalPersonProfileTypeColumn } from "@/lib/growth/social-profile-discovery/social-profile-normalize"
import {
  GROWTH_SOCIAL_PROFILE_DISCOVERY_PROMOTION_MIN_CONFIDENCE,
  type GrowthSocialProfileDiscoveryProfileType,
} from "@/lib/growth/social-profile-discovery/social-profile-discovery-types"

export async function promoteVerifiedSocialProfileDiscoveryCandidate(
  admin: SupabaseClient,
  input: {
    discovery_scope: "person" | "company"
    company_id: string
    person_id: string | null
    profile_type: GrowthSocialProfileDiscoveryProfileType
    profile_url: string
    normalized_profile_key: string
    confidence: number
    verification_status: string
    provider_name: string
    discovery_source: string
    run_id: string
    candidate_id: string
  },
): Promise<{ promoted: boolean; reason: string; promotion_status: "promoted" | "skipped" | "rejected" }> {
  if (
    !canPromoteSocialProfileDiscoveryCandidate({
      verification_status: input.verification_status,
      confidence: input.confidence,
      min_confidence: GROWTH_SOCIAL_PROFILE_DISCOVERY_PROMOTION_MIN_CONFIDENCE,
    })
  ) {
    const reason = "Promotion requires verified status and confidence >= threshold."
    await updateSocialProfileDiscoveryCandidatePromotion(admin, {
      candidate_id: input.candidate_id,
      promotion_status: "skipped",
      promotion_reason: reason,
    })
    return { promoted: false, reason, promotion_status: "skipped" }
  }

  const observed = new Date().toISOString()

  if (input.discovery_scope === "person") {
    if (!input.person_id) {
      const reason = "Person-scoped promotion requires person_id."
      await updateSocialProfileDiscoveryCandidatePromotion(admin, {
        candidate_id: input.candidate_id,
        promotion_status: "rejected",
        promotion_reason: reason,
      })
      return { promoted: false, reason, promotion_status: "rejected" }
    }

    const existing = await fetchCanonicalPersonProfileByNormalizedKey(admin, input.normalized_profile_key)
    const ownership = evaluateCanonicalProfilePromotion({
      existing,
      target_owner_id: input.person_id,
      incoming_confidence: input.confidence,
      incoming_verification_status: input.verification_status,
    })

    if (!ownership.allowed) {
      await updateSocialProfileDiscoveryCandidatePromotion(admin, {
        candidate_id: input.candidate_id,
        promotion_status: "rejected",
        promotion_reason: ownership.reason,
      })
      return { promoted: false, reason: ownership.reason, promotion_status: "rejected" }
    }

    await upsertCanonicalPersonProfile(admin, {
      person_id: input.person_id,
      profile_type: canonicalPersonProfileTypeColumn(input.profile_type),
      profile_url: input.profile_url,
      normalized_profile_key: input.normalized_profile_key,
      confidence: input.confidence,
      verification_status: "verified",
      source_table: "social_profile_discovery_candidates",
      source_id: input.candidate_id,
      provider_name: input.provider_name,
      discovery_source: input.discovery_source,
      observed_at: observed,
      metadata: {
        ...ownership.merge_metadata,
        social_profile_discovery_run_id: input.run_id,
        promoted_at: observed,
        last_promotion_source: input.discovery_source,
      },
    })
  } else {
    const existing = await fetchCanonicalCompanyProfileByNormalizedKey(admin, input.normalized_profile_key)
    const ownership = evaluateCanonicalProfilePromotion({
      existing,
      target_owner_id: input.company_id,
      incoming_confidence: input.confidence,
      incoming_verification_status: input.verification_status,
    })

    if (!ownership.allowed) {
      await updateSocialProfileDiscoveryCandidatePromotion(admin, {
        candidate_id: input.candidate_id,
        promotion_status: "rejected",
        promotion_reason: ownership.reason,
      })
      return { promoted: false, reason: ownership.reason, promotion_status: "rejected" }
    }

    await upsertCanonicalCompanyProfile(admin, {
      company_id: input.company_id,
      profile_type: input.profile_type,
      profile_url: input.profile_url,
      normalized_profile_key: input.normalized_profile_key,
      confidence: input.confidence,
      verification_status: "verified",
      source_table: "social_profile_discovery_candidates",
      source_id: input.candidate_id,
      provider_name: input.provider_name,
      discovery_source: input.discovery_source,
      observed_at: observed,
      metadata: {
        ...ownership.merge_metadata,
        social_profile_discovery_run_id: input.run_id,
        promoted_at: observed,
        last_promotion_source: input.discovery_source,
      },
    })
  }

  await updateSocialProfileDiscoveryCandidatePromotion(admin, {
    candidate_id: input.candidate_id,
    promotion_status: "promoted",
    promotion_reason: "Promoted to canonical profile table.",
    promoted_at: observed,
  })

  return { promoted: true, reason: "Promoted to canonical profile table.", promotion_status: "promoted" }
}
