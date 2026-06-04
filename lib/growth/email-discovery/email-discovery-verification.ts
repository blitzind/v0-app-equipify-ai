import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { verifyEmailWithProvider } from "@/lib/growth/contact-verification/email-verification-service"
import type { GrowthCompanyContactEmailStatus } from "@/lib/growth/contact-discovery/company-contact-types"
import { confidenceForZeroBounceStatus } from "@/lib/growth/contact-verification/providers/zerobounce-mapper"
import { confidenceTierForEmailDiscovery } from "@/lib/growth/email-discovery/email-discovery-confidence"
import type {
  GrowthEmailDiscoveryDraftCandidate,
  GrowthEmailDiscoveryVerificationStatus,
} from "@/lib/growth/email-discovery/email-discovery-types"

function mapCompanyEmailStatusToDiscovery(
  status: GrowthCompanyContactEmailStatus,
): GrowthEmailDiscoveryVerificationStatus {
  switch (status) {
    case "verified":
      return "verified"
    case "invalid":
      return "invalid"
    case "blocked":
      return "blocked"
    case "risky":
      return "risky"
    case "unknown":
    case "discovered":
    default:
      return "unknown"
  }
}

export async function verifyEmailDiscoveryDraft(
  admin: SupabaseClient,
  draft: GrowthEmailDiscoveryDraftCandidate,
  options?: { leadId?: string | null },
): Promise<{
  verification_status: GrowthEmailDiscoveryVerificationStatus
  verified_at: string | null
  verification_provider: string
  verification_reasons: string[]
  confidence: number
  confidence_tier: GrowthEmailDiscoveryDraftCandidate["confidence_tier"]
  evidence: GrowthEmailDiscoveryDraftCandidate["evidence"]
}> {
  const result = await verifyEmailWithProvider(draft.email, {
    admin,
    leadId: options?.leadId ?? null,
  })

  if (!result) {
    return {
      verification_status: "unverified",
      verified_at: null,
      verification_provider: "",
      verification_reasons: ["Verification skipped"],
      confidence: draft.confidence,
      confidence_tier: draft.confidence_tier,
      evidence: draft.evidence,
    }
  }

  const verification_status = mapCompanyEmailStatusToDiscovery(result.email_status)
  const verified_at = verification_status === "verified" ? new Date().toISOString() : null
  const providerBoost =
    verification_status === "verified"
      ? confidenceForZeroBounceStatus("verified")
      : draft.confidence

  let confidence = draft.confidence
  if (draft.source === "pattern") {
    confidence =
      verification_status === "verified"
        ? Math.max(0.75, providerBoost)
        : Math.min(draft.confidence, 0.4)
  } else if (verification_status === "verified") {
    confidence = Math.max(draft.confidence, providerBoost)
  }

  const confidence_tier = confidenceTierForEmailDiscovery({
    source: draft.source,
    verification_status,
    base_confidence: confidence,
  })

  const evidence = [
    ...draft.evidence,
    {
      evidence_type: "verification" as const,
      source_url: null,
      evidence_text: result.reasons.join(" · ") || `Verification: ${verification_status}`,
      confidence,
      metadata: {
        provider_name: result.provider_name,
        provider_status: result.provider_status,
      },
    },
  ]

  return {
    verification_status,
    verified_at,
    verification_provider: result.provider_name ?? "internal",
    verification_reasons: result.reasons,
    confidence,
    confidence_tier,
    evidence,
  }
}

/** Pattern-only drafts stay unverified until explicitly verified. */
export function shouldVerifyDraft(draft: GrowthEmailDiscoveryDraftCandidate): boolean {
  if (draft.source === "pattern") return true
  if (draft.source === "pdl") return true
  return draft.confidence_tier !== "direct_evidence" || draft.source === "staging_contact"
}

export function stagingContactMaySkipVerification(draft: GrowthEmailDiscoveryDraftCandidate): boolean {
  return draft.source === "staging_contact" && draft.confidence >= 0.85
}
