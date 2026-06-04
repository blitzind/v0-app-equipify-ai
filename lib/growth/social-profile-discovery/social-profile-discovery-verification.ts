import "server-only"

import {
  confidenceTierForSocialProfileDiscovery,
  baseConfidenceForSocialProfileSource,
} from "@/lib/growth/social-profile-discovery/social-profile-discovery-confidence"
import { normalizeSocialProfileUrl } from "@/lib/growth/social-profile-discovery/social-profile-normalize"
import type {
  GrowthSocialProfileDiscoveryDraftCandidate,
  GrowthSocialProfileDiscoveryVerificationStatus,
} from "@/lib/growth/social-profile-discovery/social-profile-discovery-types"

/**
 * Deterministic, evidence-based verification (no paid providers, no AI, no invented URLs).
 */
export function verifySocialProfileDiscoveryDraft(
  draft: GrowthSocialProfileDiscoveryDraftCandidate,
): {
  verification_status: GrowthSocialProfileDiscoveryVerificationStatus
  verified_at: string | null
  verification_provider: string
  verification_reasons: string[]
  confidence: number
  confidence_tier: GrowthSocialProfileDiscoveryDraftCandidate["confidence_tier"]
  evidence: GrowthSocialProfileDiscoveryDraftCandidate["evidence"]
} {
  const normalized = normalizeSocialProfileUrl(draft.profile_type, draft.profile_url)
  if (!normalized || normalized.normalized_profile_key !== draft.normalized_profile_key) {
    return failDraft(draft, ["Profile URL normalization failed or key mismatch."])
  }

  let verification_status: GrowthSocialProfileDiscoveryVerificationStatus = "unverified"
  const reasons: string[] = []
  let confidence = draft.confidence

  const hasDirectWebsiteEvidence = draft.evidence.some(
    (e) =>
      e.evidence_type === "website_page" ||
      e.evidence_type === "website_structured" ||
      e.evidence_type === "social_link",
  )
  const hasStagingEvidence = draft.evidence.some((e) => e.evidence_type === "staging_row")
  const stagingTrusted = draft.staging_trusted === true

  if (draft.source === "website" && hasDirectWebsiteEvidence && confidence >= 0.85) {
    verification_status = "verified"
    reasons.push("Website social link with explicit URL on crawled page.")
  } else if (
    draft.source === "staging_contact" &&
    (stagingTrusted || hasStagingEvidence) &&
    confidence >= 0.85
  ) {
    verification_status = "verified"
    reasons.push("Staging row linked to canonical subject with trusted contact status.")
  } else if (draft.source === "canonical_channel" && confidence >= 0.8) {
    verification_status = "probable"
    reasons.push("Existing canonical profile channel — not re-crawled.")
  } else if (hasDirectWebsiteEvidence && confidence >= 0.7) {
    verification_status = "probable"
    reasons.push("Website evidence present; below verified confidence threshold.")
  } else if (confidence >= baseConfidenceForSocialProfileSource("manual")) {
    verification_status = "unverified"
    reasons.push("URL format valid; awaiting stronger subject evidence.")
  } else {
    verification_status = "unverified"
    reasons.push("Insufficient evidence for this profile URL.")
  }

  const verified_at = verification_status === "verified" ? new Date().toISOString() : null
  const confidence_tier = confidenceTierForSocialProfileDiscovery({
    source: draft.source,
    verification_status,
    base_confidence: confidence,
  })

  const evidence = [
    ...draft.evidence,
    {
      evidence_type: "verification" as const,
      source_url: null,
      source_record_id: null,
      extraction_method: "deterministic_url_and_evidence",
      evidence_text: reasons.join(" · ") || `Verification: ${verification_status}`,
      confidence,
    },
  ]

  return {
    verification_status,
    verified_at,
    verification_provider: "growth_deterministic_social_profile_verify",
    verification_reasons: reasons,
    confidence,
    confidence_tier,
    evidence,
  }
}

function failDraft(
  draft: GrowthSocialProfileDiscoveryDraftCandidate,
  reasons: string[],
): {
  verification_status: GrowthSocialProfileDiscoveryVerificationStatus
  verified_at: string | null
  verification_provider: string
  verification_reasons: string[]
  confidence: number
  confidence_tier: GrowthSocialProfileDiscoveryDraftCandidate["confidence_tier"]
  evidence: GrowthSocialProfileDiscoveryDraftCandidate["evidence"]
} {
  return {
    verification_status: "invalid",
    verified_at: null,
    verification_provider: "growth_deterministic_social_profile_verify",
    verification_reasons: reasons,
    confidence: Math.min(draft.confidence, 0.1),
    confidence_tier: confidenceTierForSocialProfileDiscovery({
      source: draft.source,
      verification_status: "invalid",
      base_confidence: draft.confidence,
    }),
    evidence: [
      ...draft.evidence,
      {
        evidence_type: "verification",
        evidence_text: reasons.join(" · "),
        confidence: 0,
        extraction_method: "deterministic_url_and_evidence",
      },
    ],
  }
}
