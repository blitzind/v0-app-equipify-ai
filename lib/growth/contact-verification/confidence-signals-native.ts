/** AI OS-native recipient email confidence signals (Wave 2C). No providers, no network. Client-safe. */

import { baseConfidenceForSource } from "@/lib/growth/email-discovery/email-discovery-confidence"
import type { GrowthEmailDiscoverySource } from "@/lib/growth/email-discovery/email-discovery-types"
import { isDisposableEmailDomain, isFreeEmailDomain, isRoleEmailLocalPart } from "@/lib/growth/import/email-classifiers"
import { isValidGrowthEmailFormat } from "@/lib/growth/import/email-format"
import { normalizeEmail, parseEmailDomain, parseEmailLocalPart } from "@/lib/growth/import/normalize"
import {
  emailDepthImpliesVerified,
  PROSPECT_SEARCH_EMAIL_VERIFICATION_DEPTHS,
  type ProspectSearchEmailVerificationDepth,
} from "@/lib/growth/prospect-search/prospect-search-contact-verification-depth"
import {
  GROWTH_EMAIL_CONFIDENCE_SIGNALS_QA_MARKER,
  roundScore,
  type RecipientEmailConfidenceSignal,
  type RecipientEmailConfidenceSignalBundle,
  type RecipientEmailConfidenceSignalStrength,
} from "@/lib/growth/contact-verification/confidence-signals-core"

export const NATIVE_RECIPIENT_EMAIL_SIGNAL_SOURCES = [
  "native_syntax",
  "native_domain",
  "native_disposable",
  "native_role",
  "native_discovery_context",
  "native_verification_depth",
  "provider_verification",
] as const

export type NativeRecipientEmailSignalSource = (typeof NATIVE_RECIPIENT_EMAIL_SIGNAL_SOURCES)[number]

export type NativeRecipientEmailSignalInput = {
  email: string
  discoverySource?: string | null
  verificationDepth?: string | null
  providerStatus?: string | null
}

const GROWTH_EMAIL_DISCOVERY_SOURCE_SET = new Set<string>([
  "website",
  "staging_contact",
  "pattern",
  "pdl",
  "manual",
  "unknown",
])

function extractTld(domain: string): string | null {
  const parts = domain.split(".").filter(Boolean)
  if (parts.length < 2) return null
  return parts[parts.length - 1] ?? null
}

function classifyDomainType(domain: string | null): "business" | "free" | "unknown" {
  if (!domain) return "unknown"
  if (isFreeEmailDomain(domain)) return "free"
  return "business"
}

function isProspectSearchEmailVerificationDepth(
  value: string,
): value is ProspectSearchEmailVerificationDepth {
  return (PROSPECT_SEARCH_EMAIL_VERIFICATION_DEPTHS as readonly string[]).includes(value)
}

function safeNativeSignal(input: {
  source: NativeRecipientEmailSignalSource
  score: number
  strength: RecipientEmailConfidenceSignalStrength
  status: string
  reason: string
  metadata?: Record<string, unknown>
}): RecipientEmailConfidenceSignal {
  return {
    source: input.source,
    score: roundScore(input.score),
    strength: input.strength,
    status: input.status,
    reason: input.reason,
    metadata: input.metadata ?? {},
  }
}

export function buildNativeEmailSyntaxSignal(email: string): RecipientEmailConfidenceSignal {
  try {
    const normalized = normalizeEmail(email)
    const valid = isValidGrowthEmailFormat(email)
    if (!valid || !normalized) {
      return safeNativeSignal({
        source: "native_syntax",
        score: 0,
        strength: "blocking",
        status: "invalid_format",
        reason: "Email syntax failed Growth format validation",
        metadata: { normalized_email: normalized, format_valid: false },
      })
    }
    return safeNativeSignal({
      source: "native_syntax",
      score: 1,
      strength: "strong",
      status: "valid_format",
      reason: "Email syntax passed Growth format validation",
      metadata: { normalized_email: normalized, format_valid: true },
    })
  } catch {
    return safeNativeSignal({
      source: "native_syntax",
      score: 0,
      strength: "blocking",
      status: "error",
      reason: "Native syntax signal evaluation failed safely",
      metadata: { format_valid: false },
    })
  }
}

export function buildNativeEmailDomainSignal(email: string): RecipientEmailConfidenceSignal {
  try {
    const domain = parseEmailDomain(email)
    const tld = domain ? extractTld(domain) : null
    if (!domain) {
      return safeNativeSignal({
        source: "native_domain",
        score: 0,
        strength: "blocking",
        status: "domain_missing",
        reason: "Email domain could not be parsed",
        metadata: { domain_present: false, domain: null, tld: null, domain_class: "unknown" },
      })
    }
    const domainClass = classifyDomainType(domain)
    return safeNativeSignal({
      source: "native_domain",
      score: 1,
      strength: domainClass === "free" ? "moderate" : "strong",
      status: "domain_parsed",
      reason: `Parsed email domain (${domainClass})`,
      metadata: {
        domain_present: true,
        domain,
        tld,
        domain_class: domainClass,
      },
    })
  } catch {
    return safeNativeSignal({
      source: "native_domain",
      score: 0,
      strength: "negative",
      status: "error",
      reason: "Native domain signal evaluation failed safely",
      metadata: { domain_present: false, domain: null, tld: null, domain_class: "unknown" },
    })
  }
}

export function buildNativeDisposableEmailSignal(email: string): RecipientEmailConfidenceSignal {
  try {
    const domain = parseEmailDomain(email)
    const disposable = isDisposableEmailDomain(domain)
    if (disposable) {
      return safeNativeSignal({
        source: "native_disposable",
        score: 0,
        strength: "blocking",
        status: "disposable_domain",
        reason: "Email domain matched disposable classifier",
        metadata: { domain, disposable: true },
      })
    }
    return safeNativeSignal({
      source: "native_disposable",
      score: 1,
      strength: "informational",
      status: "not_disposable",
      reason: "Email domain is not in disposable classifier set",
      metadata: { domain, disposable: false },
    })
  } catch {
    return safeNativeSignal({
      source: "native_disposable",
      score: 1,
      strength: "informational",
      status: "unknown",
      reason: "Native disposable signal evaluation failed safely",
      metadata: { disposable: false },
    })
  }
}

export function buildNativeRoleAccountSignal(email: string): RecipientEmailConfidenceSignal {
  try {
    const localPart = parseEmailLocalPart(email)
    const roleAccount = isRoleEmailLocalPart(localPart)
    if (roleAccount) {
      return safeNativeSignal({
        source: "native_role",
        score: 0.65,
        strength: "negative",
        status: "role_account",
        reason: "Local part matches role-account classifier",
        metadata: { local_part: localPart, role_account: true },
      })
    }
    return safeNativeSignal({
      source: "native_role",
      score: 1,
      strength: "informational",
      status: "person_like",
      reason: "Local part appears person-like",
      metadata: { local_part: localPart, role_account: false },
    })
  } catch {
    return safeNativeSignal({
      source: "native_role",
      score: 1,
      strength: "informational",
      status: "unknown",
      reason: "Native role signal evaluation failed safely",
      metadata: { role_account: false },
    })
  }
}

function buildNativeDiscoveryContextSignal(
  discoverySource: string,
): RecipientEmailConfidenceSignal {
  const normalizedSource = discoverySource.trim().toLowerCase()
  const isKnownSource = GROWTH_EMAIL_DISCOVERY_SOURCE_SET.has(normalizedSource)
  const score = isKnownSource
    ? baseConfidenceForSource(normalizedSource as GrowthEmailDiscoverySource)
    : 0.5
  return safeNativeSignal({
    source: "native_discovery_context",
    score,
    strength: score >= 0.85 ? "strong" : score >= 0.6 ? "moderate" : "informational",
    status: normalizedSource || "unknown",
    reason: "Discovery source evidence (native, no provider call)",
    metadata: {
      discovery_source: normalizedSource || null,
      known_discovery_source: isKnownSource,
    },
  })
}

function buildNativeVerificationDepthContextSignal(
  verificationDepth: string,
): RecipientEmailConfidenceSignal {
  const depth = verificationDepth.trim()
  const knownDepth = isProspectSearchEmailVerificationDepth(depth)
  const impliesVerified = knownDepth ? emailDepthImpliesVerified(depth) : false
  return safeNativeSignal({
    source: "native_verification_depth",
    score: impliesVerified ? 1 : 0,
    strength: impliesVerified ? "moderate" : "informational",
    status: depth || "unknown",
    reason: knownDepth
      ? `Verification depth ${depth} (native evidence)`
      : "Unknown verification depth label",
    metadata: {
      verification_depth: depth || null,
      known_depth: knownDepth,
      implies_verified: impliesVerified,
    },
  })
}

function buildNativeProviderVerificationContextSignal(
  providerStatus: string,
): RecipientEmailConfidenceSignal {
  const status = providerStatus.trim()
  return safeNativeSignal({
    source: "provider_verification",
    score: 0.5,
    strength: "informational",
    status: status || "unknown",
    reason: "Provider status recorded for shadow parity (no provider call)",
    metadata: {
      provider_status: status || null,
      native_only: true,
    },
  })
}

export function buildNativeRecipientEmailSignalBundle(
  input: NativeRecipientEmailSignalInput,
): RecipientEmailConfidenceSignalBundle {
  try {
    const signals: RecipientEmailConfidenceSignal[] = [
      buildNativeEmailSyntaxSignal(input.email),
      buildNativeEmailDomainSignal(input.email),
      buildNativeDisposableEmailSignal(input.email),
      buildNativeRoleAccountSignal(input.email),
    ]

    if (input.discoverySource?.trim()) {
      signals.push(buildNativeDiscoveryContextSignal(input.discoverySource))
    }
    if (input.verificationDepth?.trim()) {
      signals.push(buildNativeVerificationDepthContextSignal(input.verificationDepth))
    }
    if (input.providerStatus?.trim()) {
      signals.push(buildNativeProviderVerificationContextSignal(input.providerStatus))
    }

    return {
      qa_marker: GROWTH_EMAIL_CONFIDENCE_SIGNALS_QA_MARKER,
      normalized_email: normalizeEmail(input.email),
      signals,
    }
  } catch {
    return {
      qa_marker: GROWTH_EMAIL_CONFIDENCE_SIGNALS_QA_MARKER,
      normalized_email: null,
      signals: [
        safeNativeSignal({
          source: "native_syntax",
          score: 0,
          strength: "blocking",
          status: "bundle_error",
          reason: "Native bundle evaluation failed safely",
        }),
      ],
    }
  }
}

export type NativeRecipientEmailConfidenceTier =
  | "excellent"
  | "good"
  | "moderate"
  | "risky"
  | "blocked"

export type NativeRecipientEmailConfidenceResult = {
  score: number
  tier: NativeRecipientEmailConfidenceTier
  sendable: boolean
  reasons: string[]
  signals: RecipientEmailConfidenceSignal[]
}

export type NativeLegacyConfidenceComparison = {
  matched: boolean
  delta: number
  legacyScore: number
  nativeScore: number
  nativeTier: NativeRecipientEmailConfidenceTier
  context?: Record<string, unknown>
}

const STRONG_DISCOVERY_SOURCES = new Set(["website", "staging_contact"])

function findNativeSignal(
  signals: RecipientEmailConfidenceSignal[],
  source: NativeRecipientEmailSignalSource,
): RecipientEmailConfidenceSignal | undefined {
  return signals.find((signal) => signal.source === source)
}

function discoverySourceBonus(discoverySource: string | null | undefined): number {
  const normalized = discoverySource?.trim().toLowerCase()
  if (!normalized) return 0
  if (STRONG_DISCOVERY_SOURCES.has(normalized)) return 0.1
  if (GROWTH_EMAIL_DISCOVERY_SOURCE_SET.has(normalized)) return 0.05
  return 0
}

function tierForNativeScore(
  score: number,
  sendable: boolean,
): NativeRecipientEmailConfidenceTier {
  if (!sendable || score <= 0) return "blocked"
  if (score >= 0.9) return "excellent"
  if (score >= 0.8) return "good"
  if (score >= 0.65) return "moderate"
  return "risky"
}

function isInvalidNativeSyntaxSignal(signal: RecipientEmailConfidenceSignal | undefined): boolean {
  if (!signal) return true
  if (signal.strength === "blocking") return true
  if (signal.metadata.format_valid === false) return true
  return signal.status === "invalid_format" || signal.status === "error"
}

function isDisposableNativeSignal(signal: RecipientEmailConfidenceSignal | undefined): boolean {
  if (!signal) return false
  return signal.metadata.disposable === true || signal.status === "disposable_domain"
}

export function resolveNativeRecipientEmailConfidenceFromSignals(
  signals: RecipientEmailConfidenceSignal[],
): NativeRecipientEmailConfidenceResult {
  try {
    const syntax = findNativeSignal(signals, "native_syntax")
    const disposable = findNativeSignal(signals, "native_disposable")

    if (isInvalidNativeSyntaxSignal(syntax)) {
      return {
        score: 0,
        tier: "blocked",
        sendable: false,
        reasons: ["Invalid email syntax"],
        signals,
      }
    }

    if (isDisposableNativeSignal(disposable)) {
      return {
        score: 0,
        tier: "blocked",
        sendable: false,
        reasons: ["Disposable email domain"],
        signals,
      }
    }

    const domain = findNativeSignal(signals, "native_domain")
    const role = findNativeSignal(signals, "native_role")
    const discovery = findNativeSignal(signals, "native_discovery_context")
    const depth = findNativeSignal(signals, "native_verification_depth")

    let score = 0.75
    const reasons: string[] = ["Base native confidence"]

    score += 0.1
    reasons.push("Valid email syntax")

    if (domain?.metadata.domain_present === true) {
      score += 0.05
      reasons.push("Domain parsed")
    }

    const domainClass = domain?.metadata.domain_class
    if (domainClass === "business") {
      score += 0.05
      reasons.push("Business domain")
    } else if (domainClass === "free") {
      score -= 0.05
      reasons.push("Free email domain")
    } else if (domainClass === "unknown") {
      score -= 0.05
      reasons.push("Unknown domain class")
    }

    const discoverySource =
      typeof discovery?.metadata.discovery_source === "string"
        ? discovery.metadata.discovery_source
        : null
    const discoveryBonus = discoverySourceBonus(discoverySource)
    if (discoveryBonus > 0) {
      score += discoveryBonus
      reasons.push(`Known discovery source (${discoverySource})`)
    }

    if (depth?.metadata.implies_verified === true) {
      score += 0.1
      reasons.push("Verification depth implies verified evidence")
    }

    if (role?.metadata.role_account === true) {
      score -= 0.15
      reasons.push("Role account local part")
    }

    score = roundScore(Math.min(1, Math.max(0, score)))
    const sendable = score > 0
    const tier = tierForNativeScore(score, sendable)

    return { score, tier, sendable, reasons, signals }
  } catch {
    return {
      score: 0,
      tier: "blocked",
      sendable: false,
      reasons: ["Native confidence evaluation failed safely"],
      signals,
    }
  }
}

export function resolveNativeRecipientEmailConfidence(
  input: NativeRecipientEmailSignalInput,
): NativeRecipientEmailConfidenceResult {
  try {
    const bundle = buildNativeRecipientEmailSignalBundle(input)
    return resolveNativeRecipientEmailConfidenceFromSignals(bundle.signals)
  } catch {
    return {
      score: 0,
      tier: "blocked",
      sendable: false,
      reasons: ["Native confidence evaluation failed safely"],
      signals: [],
    }
  }
}

export function compareNativeRecipientEmailConfidenceToLegacy(input: {
  legacyScore: number
  nativeResult: NativeRecipientEmailConfidenceResult
  context?: Record<string, unknown>
  tolerance?: number
}): NativeLegacyConfidenceComparison {
  const tolerance = input.tolerance ?? 0.0005
  const legacyScore = roundScore(input.legacyScore)
  const nativeScore = roundScore(input.nativeResult.score)
  const delta = roundScore(nativeScore - legacyScore)
  return {
    matched: Math.abs(delta) <= tolerance,
    delta,
    legacyScore,
    nativeScore,
    nativeTier: input.nativeResult.tier,
    context: input.context,
  }
}
