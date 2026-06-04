import "server-only"

import { verifyPhoneNumber } from "@/lib/growth/contact-verification/verify-phone"
import { canonicalNormalizedPersonPhone } from "@/lib/growth/canonical-persons/canonical-person-normalize"
import {
  confidenceTierForPhoneDiscovery,
  baseConfidenceForPhoneSource,
} from "@/lib/growth/phone-discovery/phone-discovery-confidence"
import type {
  GrowthPhoneDiscoveryDraftCandidate,
  GrowthPhoneDiscoveryPhoneType,
  GrowthPhoneDiscoveryVerificationStatus,
} from "@/lib/growth/phone-discovery/phone-discovery-types"

function mapVerifyStatusToPhoneType(
  phone_status: "unknown" | "business" | "mobile" | "invalid",
): GrowthPhoneDiscoveryPhoneType {
  if (phone_status === "mobile") return "mobile"
  if (phone_status === "business") return "business"
  return "unknown"
}

/**
 * Deterministic, evidence-based verification (no paid providers, no AI guessing).
 *
 * verified — direct website/staging evidence + valid E.164-style NA number + high confidence
 * probable — PDL or valid format with provider evidence but not direct publish proof
 * unverified — valid format, insufficient evidence
 * invalid — normalize or format check failed
 */
export function verifyPhoneDiscoveryDraft(
  draft: GrowthPhoneDiscoveryDraftCandidate,
): {
  verification_status: GrowthPhoneDiscoveryVerificationStatus
  verified_at: string | null
  verification_provider: string
  verification_reasons: string[]
  confidence: number
  confidence_tier: GrowthPhoneDiscoveryDraftCandidate["confidence_tier"]
  phone_type: GrowthPhoneDiscoveryPhoneType
  evidence: GrowthPhoneDiscoveryDraftCandidate["evidence"]
} {
  const normalized = canonicalNormalizedPersonPhone(draft.phone)
  if (!normalized) {
    return failDraft(draft, ["Phone normalization failed — invalid or too short."])
  }

  const contextBits = [
    draft.evidence.map((e) => e.evidence_text).join(" "),
    draft.discovery_source,
    draft.phone_type,
  ].join(" ")

  const formatCheck = verifyPhoneNumber(draft.phone, contextBits)
  if (!formatCheck || formatCheck.phone_status === "invalid") {
    return failDraft(draft, formatCheck?.reasons ?? ["Invalid phone format."])
  }

  let verification_status: GrowthPhoneDiscoveryVerificationStatus = "unverified"
  const reasons: string[] = [...(formatCheck.reasons ?? [])]
  let confidence = Math.max(draft.confidence, formatCheck.confidence)
  let phone_type = draft.phone_type !== "unknown" ? draft.phone_type : mapVerifyStatusToPhoneType(formatCheck.phone_status)

  const hasDirectWebsiteEvidence = draft.evidence.some(
    (e) =>
      e.evidence_type === "website_page" ||
      e.evidence_type === "website_structured" ||
      e.evidence_type === "tel_link",
  )
  const hasStagingEvidence = draft.evidence.some((e) => e.evidence_type === "staging_row")
  const stagingVerifiedHint = draft.staging_trusted === true

  if (draft.source === "website" && hasDirectWebsiteEvidence && confidence >= 0.85) {
    verification_status = "verified"
    reasons.push("Website tel/schema evidence with person name match.")
  } else if (
    (draft.source === "staging_contact" || draft.source === "canonical_channel") &&
    (stagingVerifiedHint || hasStagingEvidence) &&
    confidence >= 0.85
  ) {
    verification_status = "verified"
    reasons.push("Staging or canonical channel row with verified/trusted phone status.")
  } else if (draft.source === "pdl" && confidence >= 0.78) {
    verification_status = "probable"
    reasons.push("PDL person record — provider evidence; not independently verified on website.")
  } else if (hasDirectWebsiteEvidence && confidence >= 0.7) {
    verification_status = "probable"
    reasons.push("Website evidence present; confidence below verified threshold.")
  } else if (formatCheck.confidence >= 0.55) {
    verification_status = "unverified"
    reasons.push("Valid number format; awaiting stronger person-company evidence.")
  }

  const verified_at = verification_status === "verified" ? new Date().toISOString() : null
  const confidence_tier = confidenceTierForPhoneDiscovery({
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
      extraction_method: "deterministic_format_and_evidence",
      evidence_text: reasons.join(" · ") || `Verification: ${verification_status}`,
      confidence,
      metadata: { phone_status: formatCheck.phone_status },
    },
  ]

  return {
    verification_status,
    verified_at,
    verification_provider: "growth_deterministic_phone_verify",
    verification_reasons: reasons,
    confidence,
    confidence_tier,
    phone_type,
    evidence,
  }
}

function failDraft(
  draft: GrowthPhoneDiscoveryDraftCandidate,
  reasons: string[],
): {
  verification_status: GrowthPhoneDiscoveryVerificationStatus
  verified_at: string | null
  verification_provider: string
  verification_reasons: string[]
  confidence: number
  confidence_tier: GrowthPhoneDiscoveryDraftCandidate["confidence_tier"]
  phone_type: GrowthPhoneDiscoveryPhoneType
  evidence: GrowthPhoneDiscoveryDraftCandidate["evidence"]
} {
  return {
    verification_status: "invalid",
    verified_at: null,
    verification_provider: "growth_deterministic_phone_verify",
    verification_reasons: reasons,
    confidence: Math.min(draft.confidence, 0.1),
    confidence_tier: confidenceTierForPhoneDiscovery({
      source: draft.source,
      verification_status: "invalid",
      base_confidence: draft.confidence,
    }),
    phone_type: draft.phone_type,
    evidence: [
      ...draft.evidence,
      {
        evidence_type: "verification",
        evidence_text: reasons.join(" · "),
        confidence: 0,
        extraction_method: "deterministic_format_and_evidence",
      },
    ],
  }
}
