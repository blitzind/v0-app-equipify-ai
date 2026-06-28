/** Recipient email confidence signal extraction (Wave 2A shadow layer). Client-safe. */

import { scoreContactCandidateConfidence } from "@/lib/growth/contact-discovery/contact-confidence"
import type { GrowthCompanyContactEmailStatus } from "@/lib/growth/contact-discovery/company-contact-types"
import type { GrowthContactVerificationState } from "@/lib/growth/contact-discovery/contact-discovery-types"
import {
  mapApolloPersonToContactDiscoveryRaw,
  type ApolloPeopleMappingContext,
} from "@/lib/growth/providers/apollo/map-apollo-contact"
import type { ApolloPersonRecord } from "@/lib/growth/providers/apollo/apollo-types"
import {
  baseConfidenceForSource,
  confidenceTierForEmailDiscovery,
} from "@/lib/growth/email-discovery/email-discovery-confidence"
import type {
  GrowthEmailDiscoverySource,
  GrowthEmailDiscoveryVerificationStatus,
} from "@/lib/growth/email-discovery/email-discovery-types"
import type { EmailVerificationProviderResult } from "@/lib/growth/contact-verification/email-verification-types"
import {
  confidenceForZeroBounceStatus,
  mapZeroBounceStatusToEmailStatus,
} from "@/lib/growth/contact-verification/providers/zerobounce-mapper"
import {
  emailDepthImpliesVerified,
  type ProspectSearchEmailVerificationDepth,
} from "@/lib/growth/prospect-search/prospect-search-contact-verification-depth"
import {
  compareRecipientEmailConfidenceSignals,
  GROWTH_EMAIL_CONFIDENCE_SIGNALS_QA_MARKER,
  isEmailConfidenceShadowLoggingEnabled,
  logRecipientEmailConfidenceShadowComparison,
  roundScore,
  type RecipientEmailConfidenceShadowContext,
  type RecipientEmailConfidenceSignal,
  type RecipientEmailConfidenceSignalBundle,
  type RecipientEmailConfidenceSignalComparison,
  type RecipientEmailConfidenceSignalSource,
  type RecipientEmailConfidenceSignalStrength,
  RECIPIENT_EMAIL_CONFIDENCE_SIGNAL_SOURCES,
  RECIPIENT_EMAIL_CONFIDENCE_SIGNAL_STRENGTHS,
} from "@/lib/growth/contact-verification/confidence-signals-core"

export {
  compareRecipientEmailConfidenceSignals,
  GROWTH_EMAIL_CONFIDENCE_SIGNALS_QA_MARKER,
  isEmailConfidenceShadowLoggingEnabled,
  logRecipientEmailConfidenceShadowComparison,
  RECIPIENT_EMAIL_CONFIDENCE_SIGNAL_SOURCES,
  RECIPIENT_EMAIL_CONFIDENCE_SIGNAL_STRENGTHS,
  type RecipientEmailConfidenceShadowContext,
  type RecipientEmailConfidenceSignal,
  type RecipientEmailConfidenceSignalBundle,
  type RecipientEmailConfidenceSignalComparison,
  type RecipientEmailConfidenceSignalSource,
  type RecipientEmailConfidenceSignalStrength,
}

export {
  buildNativeDisposableEmailSignal,
  buildNativeEmailDomainSignal,
  buildNativeEmailSyntaxSignal,
  buildNativeRecipientEmailSignalBundle,
  buildNativeRoleAccountSignal,
  compareNativeRecipientEmailConfidenceToLegacy,
  NATIVE_RECIPIENT_EMAIL_SIGNAL_SOURCES,
  resolveNativeRecipientEmailConfidence,
  resolveNativeRecipientEmailConfidenceFromSignals,
  type NativeLegacyConfidenceComparison,
  type NativeRecipientEmailConfidenceResult,
  type NativeRecipientEmailConfidenceTier,
  type NativeRecipientEmailSignalInput,
  type NativeRecipientEmailSignalSource,
} from "@/lib/growth/contact-verification/confidence-signals-native"

function strengthForEmailStatus(status: string, score: number): RecipientEmailConfidenceSignalStrength {
  if (status === "blocked" || status === "invalid") return "blocking"
  if (status === "verified") return "authoritative"
  if (score >= 0.85) return "strong"
  if (score >= 0.6) return "moderate"
  if (score >= 0.45) return "weak"
  if (status === "risky" || score < 0.45) return "negative"
  return "informational"
}

function strengthForScore(score: number): RecipientEmailConfidenceSignalStrength {
  if (score >= 0.85) return "strong"
  if (score >= 0.6) return "moderate"
  if (score >= 0.45) return "weak"
  return "informational"
}

export function buildZeroBounceConfidenceSignal(
  input:
    | Pick<
        EmailVerificationProviderResult,
        | "email_status"
        | "confidence"
        | "provider_status"
        | "provider_sub_status"
        | "verified_by_provider"
      >
    | {
        email_status: GrowthCompanyContactEmailStatus
        confidence?: number
        provider_status?: string | null
        provider_sub_status?: string | null
        verified_by_provider?: boolean
      },
): RecipientEmailConfidenceSignal {
  const score = roundScore(input.confidence ?? confidenceForZeroBounceStatus(input.email_status))
  const status = input.email_status
  const verified =
    "verified_by_provider" in input ? Boolean(input.verified_by_provider) : status === "verified"
  const strength =
    verified && status === "verified"
      ? "authoritative"
      : strengthForEmailStatus(status, score)

  return {
    source: "zerobounce",
    score,
    strength,
    status,
    reason:
      input.provider_status != null
        ? `ZeroBounce provider status: ${input.provider_status}`
        : `ZeroBounce mapped email status: ${status}`,
    metadata: {
      provider_status: input.provider_status ?? null,
      provider_sub_status: input.provider_sub_status ?? null,
      verified_by_provider: verified,
    },
  }
}

export function buildEmailDiscoveryConfidenceSignal(input: {
  source: GrowthEmailDiscoverySource
  verification_status: GrowthEmailDiscoveryVerificationStatus
  confidence?: number
}): RecipientEmailConfidenceSignal {
  const base_confidence = roundScore(input.confidence ?? baseConfidenceForSource(input.source))
  const tier = confidenceTierForEmailDiscovery({
    source: input.source,
    verification_status: input.verification_status,
    base_confidence,
  })

  return {
    source: "email_discovery",
    score: base_confidence,
    strength: strengthForScore(base_confidence),
    status: input.verification_status,
    reason: `Email discovery source ${input.source} tier ${tier}`,
    metadata: {
      discovery_source: input.source,
      confidence_tier: tier,
      verification_status: input.verification_status,
    },
  }
}

export function buildApolloEmailConfidenceSignal(input: {
  person: ApolloPersonRecord
  context: ApolloPeopleMappingContext
}): RecipientEmailConfidenceSignal | null {
  const mapped = mapApolloPersonToContactDiscoveryRaw(input.person, input.context)
  if (!mapped) return null

  const score = roundScore(mapped.confidence ?? 0.5)
  const emailStatus = input.person.email_status ?? null

  return {
    source: "apollo",
    score,
    strength: strengthForScore(score),
    status: typeof emailStatus === "string" ? emailStatus : mapped.email ? "observed" : "missing",
    reason: mapped.email
      ? "Apollo mapped contact includes observed email"
      : "Apollo mapped contact without observed email",
    metadata: {
      email_present: Boolean(mapped.email),
      pii_observed: mapped.pii_observed,
      provider: "apollo",
    },
  }
}

export function buildVerificationDepthConfidenceSignal(input: {
  depth: ProspectSearchEmailVerificationDepth
}): RecipientEmailConfidenceSignal {
  const impliesVerified = emailDepthImpliesVerified(input.depth)

  return {
    source: "verification_depth",
    score: impliesVerified ? 1 : 0,
    strength: impliesVerified ? "moderate" : "informational",
    status: input.depth,
    reason: impliesVerified
      ? `Verification depth ${input.depth} implies verified evidence`
      : `Verification depth ${input.depth} does not imply verified email`,
    metadata: {
      implies_verified: impliesVerified,
      reserved_depths_not_implying_verified: ["mx_valid", "domain_accepts_mail"],
    },
  }
}

export function buildContactEvidenceConfidenceSignal(input: {
  base_confidence: number
  evidence_count: number
  verification_state: GrowthContactVerificationState
  has_observed_email: boolean
  has_observed_phone: boolean
  has_observed_linkedin: boolean
  title_role_match: boolean
}): RecipientEmailConfidenceSignal {
  const score = scoreContactCandidateConfidence(input)

  return {
    source: "contact_evidence",
    score,
    strength: strengthForScore(score),
    status: input.verification_state,
    reason: "Contact discovery composite evidence score",
    metadata: {
      evidence_count: input.evidence_count,
      has_observed_email: input.has_observed_email,
      has_observed_phone: input.has_observed_phone,
      has_observed_linkedin: input.has_observed_linkedin,
      title_role_match: input.title_role_match,
    },
  }
}

export function buildRecipientEmailConfidenceSignalBundle(input: {
  normalized_email?: string | null
  signals: RecipientEmailConfidenceSignal[]
}): RecipientEmailConfidenceSignalBundle {
  return {
    qa_marker: GROWTH_EMAIL_CONFIDENCE_SIGNALS_QA_MARKER,
    normalized_email: input.normalized_email?.trim().toLowerCase() ?? null,
    signals: input.signals,
  }
}

/** Convenience for shadow tests — map raw ZeroBounce API status through existing mapper. */
export function buildZeroBounceConfidenceSignalFromProviderStatus(input: {
  status: string
  sub_status?: string | null
  confidence?: number
  verified_by_provider?: boolean
}): RecipientEmailConfidenceSignal {
  const email_status = mapZeroBounceStatusToEmailStatus({
    status: input.status,
    sub_status: input.sub_status,
  })
  return buildZeroBounceConfidenceSignal({
    email_status,
    confidence: input.confidence ?? confidenceForZeroBounceStatus(email_status),
    provider_status: input.status,
    provider_sub_status: input.sub_status ?? null,
    verified_by_provider: input.verified_by_provider ?? email_status === "verified",
  })
}
