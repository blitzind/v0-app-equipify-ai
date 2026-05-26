import type { GrowthContactVerificationProviderResult } from "@/lib/growth/enrichment/enrichment-provider-types"
import {
  scoreContactVerificationConfidence,
  topAttributionTier,
} from "@/lib/growth/enrichment/verification-confidence"
import type {
  GrowthContactVerification,
  GrowthVerificationChannelStatus,
} from "@/lib/growth/enrichment/enrichment-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeChannelStatus(value: unknown): GrowthVerificationChannelStatus {
  const v = asString(value)
  const allowed: GrowthVerificationChannelStatus[] = [
    "not_present",
    "unverified",
    "observed",
    "insufficient_evidence",
    "operator_verified",
    "rejected",
  ]
  return allowed.includes(v as GrowthVerificationChannelStatus)
    ? (v as GrowthVerificationChannelStatus)
    : "unverified"
}

export function normalizeContactVerificationResult(
  raw: GrowthContactVerificationProviderResult,
  provider_name: string,
  provider_type: string,
): Omit<GrowthContactVerification, "id" | "created_at" | "updated_at"> {
  const tiers = raw.source_attribution.map((a) => a.tier)
  const verification_confidence = scoreContactVerificationConfidence({
    email_status: raw.email_status,
    phone_status: raw.phone_status,
    linkedin_status: raw.linkedin_status,
    evidence_count: raw.evidence.length,
    top_tier: topAttributionTier(tiers),
  })

  return {
    contact_candidate_id: raw.contact_candidate_id,
    provider_name,
    provider_type,
    email_status: normalizeChannelStatus(raw.email_status),
    phone_status: normalizeChannelStatus(raw.phone_status),
    linkedin_status: normalizeChannelStatus(raw.linkedin_status),
    verification_confidence,
    verification_reason: raw.verification_reason || "No verification reason provided.",
    evidence: raw.evidence,
    source_attribution: raw.source_attribution,
    metadata: {
      dedupe_hash: `${raw.contact_candidate_id}:${provider_name}`,
      ...(raw.raw_payload ? { raw_payload: raw.raw_payload } : {}),
    },
  }
}

export function mergeContactVerifications(
  rows: GrowthContactVerification[],
): GrowthContactVerification | null {
  if (rows.length === 0) return null
  const best = [...rows].sort((a, b) => b.verification_confidence - a.verification_confidence)[0]!
  return best
}
