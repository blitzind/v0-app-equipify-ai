/** Shadow-only confidence signal instrumentation (Wave 2B/2E). No runtime influence. Client-safe. */

import type { GrowthCompanyContactEmailStatus } from "@/lib/growth/contact-discovery/company-contact-types"
import type {
  GrowthEmailDiscoverySource,
  GrowthEmailDiscoveryVerificationStatus,
} from "@/lib/growth/email-discovery/email-discovery-types"
import type { ApolloPersonRecord } from "@/lib/growth/providers/apollo/apollo-types"
import type { ApolloPeopleMappingContext } from "@/lib/growth/providers/apollo/map-apollo-contact"
import type { ProspectSearchEmailVerificationDepth } from "@/lib/growth/prospect-search/prospect-search-contact-verification-depth"
import {
  compareRecipientEmailConfidenceSignals,
  GROWTH_EMAIL_CONFIDENCE_SIGNALS_QA_MARKER,
  isEmailConfidenceShadowLoggingEnabled,
  logRecipientEmailConfidenceShadowComparison,
  roundScore,
  type RecipientEmailConfidenceSignal,
} from "@/lib/growth/contact-verification/confidence-signals-core"

let shadowRecursionDepth = 0

function runShadowSafe(label: string, fn: () => void): void {
  if (!isEmailConfidenceShadowLoggingEnabled()) return
  if (shadowRecursionDepth > 0) return
  shadowRecursionDepth += 1
  try {
    fn()
  } catch (error) {
    console.warn(
      JSON.stringify({
        shadow: "recipient_email_confidence_error",
        label,
        message: error instanceof Error ? error.message : "unknown",
      }),
    )
  } finally {
    shadowRecursionDepth -= 1
  }
}

function loadConfidenceSignalBuilders(): typeof import("@/lib/growth/contact-verification/confidence-signals") {
  // Lazy load avoids circular module initialization with integration owners.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@/lib/growth/contact-verification/confidence-signals") as typeof import("@/lib/growth/contact-verification/confidence-signals")
}

function loadNativeConfidenceScoring(): typeof import("@/lib/growth/contact-verification/confidence-signals-native") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@/lib/growth/contact-verification/confidence-signals-native") as typeof import("@/lib/growth/contact-verification/confidence-signals-native")
}

function legacyDiscoverySignal(input: {
  legacy_confidence: number
  verification_status: GrowthEmailDiscoveryVerificationStatus
}): RecipientEmailConfidenceSignal {
  return {
    source: "email_discovery",
    score: roundScore(input.legacy_confidence),
    strength: "informational",
    status: input.verification_status,
    reason: "Legacy email discovery confidence",
    metadata: { shadow: "legacy" },
  }
}

function legacyZeroBounceSignal(input: {
  email_status: GrowthCompanyContactEmailStatus
  legacy_confidence: number
}): RecipientEmailConfidenceSignal {
  return {
    source: "zerobounce",
    score: roundScore(input.legacy_confidence),
    strength: "informational",
    status: input.email_status,
    reason: "Legacy ZeroBounce mapped confidence",
    metadata: { shadow: "legacy" },
  }
}

function legacyApolloSignal(input: { legacy_confidence: number }): RecipientEmailConfidenceSignal {
  return {
    source: "apollo",
    score: roundScore(input.legacy_confidence),
    strength: "informational",
    status: "mapped",
    reason: "Legacy Apollo mapped confidence",
    metadata: { shadow: "legacy" },
  }
}

function logNativeLegacyConfidenceDrift(input: {
  integration: string
  legacy_score: number
  native_score: number
  delta: number
  native_tier: string
  native_sendable: boolean
  matched: boolean
  context?: Record<string, unknown>
}): void {
  if (!isEmailConfidenceShadowLoggingEnabled()) return
  console.info(
    JSON.stringify({
      qa_marker: GROWTH_EMAIL_CONFIDENCE_SIGNALS_QA_MARKER,
      shadow: "native_legacy_confidence_drift",
      integration: input.integration,
      legacy_score: roundScore(input.legacy_score),
      native_score: roundScore(input.native_score),
      delta: roundScore(input.delta),
      native_tier: input.native_tier,
      native_sendable: input.native_sendable,
      matched: input.matched,
      context: input.context ?? null,
    }),
  )
}

export function shadowCompareNativeLegacyConfidenceDrift(input: {
  integration: string
  legacy_score: number
  email?: string | null
  discoverySource?: string | null
  verificationDepth?: string | null
  providerStatus?: string | null
  context?: Record<string, unknown>
}): void {
  if (!isEmailConfidenceShadowLoggingEnabled()) return
  if (!input.email?.trim()) return

  try {
    const { resolveNativeRecipientEmailConfidence, compareNativeRecipientEmailConfidenceToLegacy } =
      loadNativeConfidenceScoring()
    const nativeResult = resolveNativeRecipientEmailConfidence({
      email: input.email,
      discoverySource: input.discoverySource,
      verificationDepth: input.verificationDepth,
      providerStatus: input.providerStatus,
    })
    const comparison = compareNativeRecipientEmailConfidenceToLegacy({
      legacyScore: input.legacy_score,
      nativeResult,
      context: input.context,
    })
    logNativeLegacyConfidenceDrift({
      integration: input.integration,
      legacy_score: comparison.legacyScore,
      native_score: comparison.nativeScore,
      delta: comparison.delta,
      native_tier: comparison.nativeTier,
      native_sendable: nativeResult.sendable,
      matched: comparison.matched,
      context: {
        email_present: true,
        discovery_source: input.discoverySource ?? null,
        verification_depth: input.verificationDepth ?? null,
        provider_status: input.providerStatus ?? null,
        ...input.context,
      },
    })
  } catch (error) {
    console.warn(
      JSON.stringify({
        shadow: "native_legacy_confidence_drift_error",
        integration: input.integration,
        message: error instanceof Error ? error.message : "unknown",
      }),
    )
  }
}

function maybeCompareNativeLegacyDrift(input: {
  integration: string
  legacy_score: number
  email?: string | null
  discoverySource?: string | null
  verificationDepth?: string | null
  providerStatus?: string | null
  context?: Record<string, unknown>
}): void {
  shadowCompareNativeLegacyConfidenceDrift(input)
}

export function shadowCompareEmailDiscoveryConfidence(input: {
  source: GrowthEmailDiscoverySource
  verification_status: GrowthEmailDiscoveryVerificationStatus
  legacy_confidence: number
  integration: string
  email?: string | null
  verificationDepth?: string | null
  providerStatus?: string | null
}): void {
  runShadowSafe(`email_discovery:${input.integration}`, () => {
    const { buildEmailDiscoveryConfidenceSignal } = loadConfidenceSignalBuilders()
    const signal = buildEmailDiscoveryConfidenceSignal({
      source: input.source,
      verification_status: input.verification_status,
      confidence: input.legacy_confidence,
    })
    const legacy = legacyDiscoverySignal({
      legacy_confidence: input.legacy_confidence,
      verification_status: input.verification_status,
    })
    const comparison = compareRecipientEmailConfidenceSignals([legacy], [signal])
    const delta = roundScore(input.legacy_confidence - signal.score)
    logRecipientEmailConfidenceShadowComparison({
      label: `email_discovery:${input.integration}`,
      comparison,
      context: {
        integration: input.integration,
        source: "email_discovery",
        legacy_score: input.legacy_confidence,
        signal_score: signal.score,
        delta,
        status: input.verification_status,
        discovery_source: input.source,
        email_present: Boolean(input.email?.trim()),
      },
    })
    maybeCompareNativeLegacyDrift({
      integration: `${input.integration}:native_drift`,
      legacy_score: input.legacy_confidence,
      email: input.email,
      discoverySource: input.source,
      verificationDepth: input.verificationDepth,
      providerStatus: input.providerStatus,
      context: { drift_source: "email_discovery" },
    })
  })
}

export function shadowCompareZeroBounceConfidence(input: {
  email_status: GrowthCompanyContactEmailStatus
  legacy_confidence: number
  provider_status?: string | null
  provider_sub_status?: string | null
  integration: string
  email?: string | null
}): void {
  runShadowSafe(`zerobounce:${input.integration}`, () => {
    const { buildZeroBounceConfidenceSignal } = loadConfidenceSignalBuilders()
    const signal = buildZeroBounceConfidenceSignal({
      email_status: input.email_status,
      confidence: input.legacy_confidence,
      provider_status: input.provider_status ?? null,
      provider_sub_status: input.provider_sub_status ?? null,
      verified_by_provider: input.email_status === "verified",
    })
    const legacy = legacyZeroBounceSignal({
      email_status: input.email_status,
      legacy_confidence: input.legacy_confidence,
    })
    const comparison = compareRecipientEmailConfidenceSignals([legacy], [signal])
    const delta = roundScore(input.legacy_confidence - signal.score)
    logRecipientEmailConfidenceShadowComparison({
      label: `zerobounce:${input.integration}`,
      comparison,
      context: {
        integration: input.integration,
        source: "zerobounce",
        legacy_score: input.legacy_confidence,
        signal_score: signal.score,
        delta,
        status: input.email_status,
        provider_status: input.provider_status ?? null,
        email_present: Boolean(input.email?.trim()),
      },
    })
    maybeCompareNativeLegacyDrift({
      integration: `${input.integration}:native_drift`,
      legacy_score: input.legacy_confidence,
      email: input.email,
      providerStatus: input.provider_status ?? null,
      context: { drift_source: "zerobounce" },
    })
  })
}

export function shadowCompareApolloEmailConfidence(input: {
  person: ApolloPersonRecord
  context: ApolloPeopleMappingContext
  legacy_confidence: number
  integration: string
  email?: string | null
}): void {
  runShadowSafe(`apollo:${input.integration}`, () => {
    const { buildApolloEmailConfidenceSignal } = loadConfidenceSignalBuilders()
    const signal = buildApolloEmailConfidenceSignal({
      person: input.person,
      context: input.context,
    })
    if (!signal) return
    const legacy = legacyApolloSignal({ legacy_confidence: input.legacy_confidence })
    const comparison = compareRecipientEmailConfidenceSignals([legacy], [signal])
    const delta = roundScore(input.legacy_confidence - signal.score)
    logRecipientEmailConfidenceShadowComparison({
      label: `apollo:${input.integration}`,
      comparison,
      context: {
        integration: input.integration,
        source: "apollo",
        legacy_score: input.legacy_confidence,
        signal_score: signal.score,
        delta,
        status: signal.status,
        email_present: Boolean(input.email?.trim()),
        mock: input.context.mock,
      },
    })
    maybeCompareNativeLegacyDrift({
      integration: `${input.integration}:native_drift`,
      legacy_score: input.legacy_confidence,
      email: input.email,
      providerStatus:
        typeof input.person.email_status === "string" ? input.person.email_status : null,
      context: { drift_source: "apollo" },
    })
  })
}

export function shadowCompareProspectSearchVerificationDepth(input: {
  email_verification_depth?: ProspectSearchEmailVerificationDepth | null
  legacy_confidence_score: number
  email?: string | null
  email_present?: boolean
  integration: string
}): void {
  runShadowSafe(`prospect_search:${input.integration}`, () => {
    const depth = input.email_verification_depth
    if (!depth) return
    const { buildVerificationDepthConfidenceSignal } = loadConfidenceSignalBuilders()
    const signal = buildVerificationDepthConfidenceSignal({ depth })
    const comparison = compareRecipientEmailConfidenceSignals(
      [
        {
          source: "verification_depth",
          score: input.legacy_confidence_score,
          strength: "informational",
          status: depth,
          reason: "Legacy prospect search composite confidence score",
          metadata: { shadow: "legacy_composite" },
        },
      ],
      [signal],
    )
    logRecipientEmailConfidenceShadowComparison({
      label: `prospect_search:${input.integration}`,
      comparison,
      context: {
        integration: input.integration,
        source: "verification_depth",
        legacy_score: input.legacy_confidence_score,
        signal_score: signal.score,
        delta: roundScore(input.legacy_confidence_score - signal.score),
        status: depth,
        email_present: input.email_present ?? Boolean(input.email?.trim()),
        implies_verified: signal.metadata.implies_verified ?? null,
        parity_note: "Composite legacy score vs depth-only signal (informational)",
      },
    })
    maybeCompareNativeLegacyDrift({
      integration: `${input.integration}:native_drift`,
      legacy_score: input.legacy_confidence_score,
      email: input.email,
      verificationDepth: depth,
      context: { drift_source: "prospect_search" },
    })
  })
}
