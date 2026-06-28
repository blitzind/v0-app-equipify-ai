/**
 * Wave 2A — recipient email confidence signal extraction (shadow layer).
 * Run: pnpm test:growth-email-confidence-signals
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  confidenceForZeroBounceStatus,
  mapZeroBounceStatusToEmailStatus,
} from "../lib/growth/contact-verification/providers/zerobounce-mapper"
import {
  baseConfidenceForSource,
  canPromoteEmailDiscoveryCandidate,
  confidenceTierForEmailDiscovery,
} from "../lib/growth/email-discovery/email-discovery-confidence"
import { scoreContactCandidateConfidence } from "../lib/growth/contact-discovery/contact-confidence"
import { isEmailReadyForLeadPromotion } from "../lib/growth/contact-verification/email-verification-types"
import { mapApolloPersonToContactDiscoveryRaw } from "../lib/growth/providers/apollo/map-apollo-contact"
import { emailDepthImpliesVerified } from "../lib/growth/prospect-search/prospect-search-contact-verification-depth"
import {
  buildApolloEmailConfidenceSignal,
  buildContactEvidenceConfidenceSignal,
  buildEmailDiscoveryConfidenceSignal,
  buildRecipientEmailConfidenceSignalBundle,
  buildVerificationDepthConfidenceSignal,
  buildZeroBounceConfidenceSignal,
  buildZeroBounceConfidenceSignalFromProviderStatus,
  compareRecipientEmailConfidenceSignals,
  GROWTH_EMAIL_CONFIDENCE_SIGNALS_QA_MARKER,
  isEmailConfidenceShadowLoggingEnabled,
  logRecipientEmailConfidenceShadowComparison,
} from "../lib/growth/contact-verification/confidence-signals"
import { buildProspectSearchContactConfidenceReasoning } from "../lib/growth/prospect-search/prospect-search-contact-confidence-reasoning"
import {
  shadowCompareApolloEmailConfidence,
  shadowCompareEmailDiscoveryConfidence,
  shadowCompareNativeLegacyConfidenceDrift,
  shadowCompareProspectSearchVerificationDepth,
  shadowCompareZeroBounceConfidence,
} from "../lib/growth/contact-verification/confidence-signals-shadow"
import {
  buildNativeDisposableEmailSignal,
  buildNativeEmailDomainSignal,
  buildNativeEmailSyntaxSignal,
  buildNativeRecipientEmailSignalBundle,
  buildNativeRoleAccountSignal,
  compareNativeRecipientEmailConfidenceToLegacy,
  NATIVE_RECIPIENT_EMAIL_SIGNAL_SOURCES,
  resolveNativeRecipientEmailConfidence,
  resolveNativeRecipientEmailConfidenceFromSignals,
} from "../lib/growth/contact-verification/confidence-signals-native"

assert.equal(GROWTH_EMAIL_CONFIDENCE_SIGNALS_QA_MARKER, "growth-email-confidence-signals-v1")

// ZeroBounce — preserve mapper scores (provider status → email status → confidence)
const zeroBounceCases: Array<{ provider_status: string; expected_email_status: string }> = [
  { provider_status: "valid", expected_email_status: "verified" },
  { provider_status: "invalid", expected_email_status: "invalid" },
  { provider_status: "spamtrap", expected_email_status: "blocked" },
  { provider_status: "catch-all", expected_email_status: "risky" },
  { provider_status: "unknown", expected_email_status: "unknown" },
]
for (const { provider_status, expected_email_status } of zeroBounceCases) {
  const email_status = mapZeroBounceStatusToEmailStatus({ status: provider_status })
  assert.equal(email_status, expected_email_status, `zerobounce map for ${provider_status}`)
  const expected = confidenceForZeroBounceStatus(email_status)
  const signal = buildZeroBounceConfidenceSignalFromProviderStatus({ status: provider_status })
  assert.equal(signal.score, expected, `zerobounce score for ${provider_status}`)
  assert.equal(signal.source, "zerobounce")
}

const zbDirect = buildZeroBounceConfidenceSignal({
  email_status: "verified",
  confidence: 0.95,
  provider_status: "valid",
  provider_sub_status: "none",
  verified_by_provider: true,
})
assert.equal(zbDirect.score, 0.95)
assert.equal(zbDirect.strength, "authoritative")

// Email discovery — preserve base confidence + tier
for (const source of ["website", "pdl", "pattern", "manual"] as const) {
  const base = baseConfidenceForSource(source)
  const signal = buildEmailDiscoveryConfidenceSignal({
    source,
    verification_status: source === "pattern" ? "verified" : "unverified",
  })
  assert.equal(signal.score, base, `discovery base for ${source}`)
  const tier = confidenceTierForEmailDiscovery({
    source,
    verification_status: source === "pattern" ? "verified" : "unverified",
    base_confidence: base,
  })
  assert.equal(signal.metadata.confidence_tier, tier)
}

// Apollo — wrap mapped contact confidence
const apolloPerson = {
  id: "apollo-1",
  first_name: "Jane",
  last_name: "Owner",
  email: "jane@acme.com",
  email_status: "verified",
  title: "CEO",
} as const
const apolloMapped = mapApolloPersonToContactDiscoveryRaw(apolloPerson, {
  company_name: "Acme",
  domain: "acme.com",
  mock: true,
})
assert.ok(apolloMapped)
const apolloSignal = buildApolloEmailConfidenceSignal({
  person: apolloPerson,
  context: { company_name: "Acme", domain: "acme.com", mock: true },
})
assert.ok(apolloSignal)
assert.equal(apolloSignal!.score, apolloMapped!.confidence)

// Verification depth — GE-EI-IMP-1B implied verified behavior
assert.equal(emailDepthImpliesVerified("published_on_website"), true)
assert.equal(emailDepthImpliesVerified("personal_email"), true)
assert.equal(emailDepthImpliesVerified("mx_valid"), false)
assert.equal(emailDepthImpliesVerified("domain_accepts_mail"), false)

const depthVerified = buildVerificationDepthConfidenceSignal({ depth: "published_on_website" })
assert.equal(depthVerified.metadata.implies_verified, true)
const depthReserved = buildVerificationDepthConfidenceSignal({ depth: "mx_valid" })
assert.equal(depthReserved.metadata.implies_verified, false)

// Contact evidence — preserve composite score
const evidenceInput = {
  base_confidence: 0.5,
  evidence_count: 2,
  verification_state: "unverified" as const,
  has_observed_email: true,
  has_observed_phone: false,
  has_observed_linkedin: true,
  title_role_match: true,
}
const expectedEvidenceScore = scoreContactCandidateConfidence(evidenceInput)
const evidenceSignal = buildContactEvidenceConfidenceSignal(evidenceInput)
assert.equal(evidenceSignal.score, expectedEvidenceScore)

// Promotion gates unchanged (sanity — not wired to signals)
assert.equal(
  canPromoteEmailDiscoveryCandidate({ verification_status: "verified", confidence: 0.9 }),
  true,
)
assert.equal(
  canPromoteEmailDiscoveryCandidate({ verification_status: "verified", confidence: 0.8 }),
  false,
)
assert.equal(isEmailReadyForLeadPromotion({ email_status: "verified", verified_by_provider: true }), true)
assert.equal(isEmailReadyForLeadPromotion({ email_status: "verified", verified_by_provider: false }), false)

// Bundle + shadow compare
const bundle = buildRecipientEmailConfidenceSignalBundle({
  normalized_email: "Jane@Acme.com",
  signals: [zbDirect, depthVerified, evidenceSignal],
})
assert.equal(bundle.normalized_email, "jane@acme.com")
assert.equal(bundle.signals.length, 3)

const comparison = compareRecipientEmailConfidenceSignals(bundle.signals, [...bundle.signals])
assert.equal(comparison.matched, true)
assert.equal(comparison.diffs.length, 3)

const mismatched = compareRecipientEmailConfidenceSignals(
  [zbDirect],
  [{ ...zbDirect, score: 0.5 }],
)
assert.equal(mismatched.matched, false)

// Shadow logging is off by default
assert.equal(isEmailConfidenceShadowLoggingEnabled({ GROWTH_EMAIL_CONFIDENCE_SHADOW_LOGS: undefined }), false)
assert.equal(isEmailConfidenceShadowLoggingEnabled({ GROWTH_EMAIL_CONFIDENCE_SHADOW_LOGS: "true" }), true)

let shadowLogged = false
const originalInfo = console.info
console.info = (...args: unknown[]) => {
  shadowLogged = true
  originalInfo(...args)
}
try {
  logRecipientEmailConfidenceShadowComparison({
    label: "self_compare",
    comparison,
    bundle,
  })
  assert.equal(shadowLogged, false, "shadow logger must stay quiet without env flag")
} finally {
  console.info = originalInfo
}

// Wave 2B — shadow wiring does not change legacy outputs (flag off)
assert.equal(process.env.GROWTH_EMAIL_CONFIDENCE_SHADOW_LOGS, undefined)
assert.equal(baseConfidenceForSource("website"), 0.88)
assert.equal(baseConfidenceForSource("pdl"), 0.82)
assert.equal(
  confidenceTierForEmailDiscovery({
    source: "pattern",
    verification_status: "verified",
    base_confidence: 0.35,
  }),
  "pattern_verified",
)
assert.equal(confidenceForZeroBounceStatus("verified"), 0.95)
assert.equal(confidenceForZeroBounceStatus("risky"), 0.7)

const apolloPersonShadow = {
  id: "apollo-shadow",
  first_name: "Sam",
  last_name: "Lead",
  email: "sam@example.com",
  email_status: "verified",
  title: "Director",
} as const
const apolloMappedShadow = mapApolloPersonToContactDiscoveryRaw(apolloPersonShadow, {
  company_name: "Example",
  domain: "example.com",
  mock: true,
})
assert.ok(apolloMappedShadow)
assert.equal(apolloMappedShadow!.confidence, 0.85)

const reasoningBaseline = buildProspectSearchContactConfidenceReasoning({
  confidence: 0.62,
  email: "ops@example.com",
  email_verification_depth: "published_on_website",
  source_evidence_count: 2,
})
assert.equal(reasoningBaseline.confidence_label, "moderate")
assert.ok(reasoningBaseline.top_reasons.some((r) => r.includes("website")))

// Shadow helpers are no-ops without throwing when metadata is sparse
assert.doesNotThrow(() => {
  shadowCompareProspectSearchVerificationDepth({
    integration: "test_missing_depth",
    legacy_confidence_score: 0.5,
  })
})
assert.doesNotThrow(() => {
  logRecipientEmailConfidenceShadowComparison({
    label: "missing_context",
    comparison: mismatched,
  })
})

// Shadow helpers tolerate mismatches without throwing when flag enabled
const priorShadowFlag = process.env.GROWTH_EMAIL_CONFIDENCE_SHADOW_LOGS
process.env.GROWTH_EMAIL_CONFIDENCE_SHADOW_LOGS = "true"
try {
  assert.doesNotThrow(() => {
    shadowCompareEmailDiscoveryConfidence({
      source: "website",
      verification_status: "unverified",
      legacy_confidence: 0.88,
      integration: "test_wiring",
    })
  })
  assert.doesNotThrow(() => {
    shadowCompareZeroBounceConfidence({
      email_status: "verified",
      legacy_confidence: 0.95,
      integration: "test_wiring",
    })
  })
  assert.doesNotThrow(() => {
    shadowCompareApolloEmailConfidence({
      person: apolloPersonShadow,
      context: { company_name: "Example", domain: "example.com", mock: true },
      legacy_confidence: 0.85,
      integration: "test_wiring",
    })
  })
  assert.doesNotThrow(() => {
    shadowCompareProspectSearchVerificationDepth({
      email_verification_depth: "mx_valid",
      legacy_confidence_score: 0.62,
      email_present: true,
      integration: "test_wiring",
    })
  })

  // Legacy outputs still unchanged with shadow flag enabled
  assert.equal(baseConfidenceForSource("website"), 0.88)
  assert.equal(confidenceForZeroBounceStatus("verified"), 0.95)
  const apolloMappedWithFlag = mapApolloPersonToContactDiscoveryRaw(apolloPersonShadow, {
    company_name: "Example",
    domain: "example.com",
    mock: true,
  })
  assert.equal(apolloMappedWithFlag?.confidence, 0.85)
  const reasoningWithFlag = buildProspectSearchContactConfidenceReasoning({
    confidence: 0.62,
    email: "ops@example.com",
    email_verification_depth: "published_on_website",
    source_evidence_count: 2,
  })
  assert.deepEqual(reasoningWithFlag, reasoningBaseline)
} finally {
  if (priorShadowFlag === undefined) {
    delete process.env.GROWTH_EMAIL_CONFIDENCE_SHADOW_LOGS
  } else {
    process.env.GROWTH_EMAIL_CONFIDENCE_SHADOW_LOGS = priorShadowFlag
  }
}

// Wave 2C — native AI OS email confidence signals
const validSyntax = buildNativeEmailSyntaxSignal("Jane.Doe@AcmeHealth.com")
assert.equal(validSyntax.source, "native_syntax")
assert.equal(validSyntax.strength, "strong")
assert.equal(validSyntax.score, 1)

const invalidSyntax = buildNativeEmailSyntaxSignal("not-an-email")
assert.equal(invalidSyntax.source, "native_syntax")
assert.equal(invalidSyntax.strength, "blocking")
assert.equal(invalidSyntax.score, 0)

const disposableSignal = buildNativeDisposableEmailSignal("user@mailinator.com")
assert.equal(disposableSignal.source, "native_disposable")
assert.equal(disposableSignal.strength, "blocking")
assert.equal(disposableSignal.score, 0)

const businessDisposable = buildNativeDisposableEmailSignal("jane.doe@acmehealth.com")
assert.equal(businessDisposable.strength, "informational")
assert.equal(businessDisposable.score, 1)
assert.equal(businessDisposable.metadata.disposable, false)

const roleSignal = buildNativeRoleAccountSignal("info@acmehealth.com")
assert.equal(roleSignal.source, "native_role")
assert.equal(roleSignal.strength, "negative")
assert.equal(roleSignal.score, 0.65)
assert.equal(roleSignal.metadata.role_account, true)

const personRoleSignal = buildNativeRoleAccountSignal("jane.doe@acmehealth.com")
assert.equal(personRoleSignal.strength, "informational")
assert.equal(personRoleSignal.score, 1)
assert.equal(personRoleSignal.metadata.role_account, false)

const domainSignal = buildNativeEmailDomainSignal("jane.doe@acmehealth.com")
assert.equal(domainSignal.metadata.domain_present, true)
assert.equal(domainSignal.metadata.domain, "acmehealth.com")
assert.equal(domainSignal.metadata.tld, "com")
assert.equal(domainSignal.metadata.domain_class, "business")

const nativeBundle = buildNativeRecipientEmailSignalBundle({
  email: "jane.doe@acmehealth.com",
  discoverySource: "website",
  verificationDepth: "published_on_website",
  providerStatus: "valid",
})
assert.equal(nativeBundle.normalized_email, "jane.doe@acmehealth.com")
assert.equal(nativeBundle.signals.length, 7)
for (const source of [
  "native_syntax",
  "native_domain",
  "native_disposable",
  "native_role",
  "native_discovery_context",
  "native_verification_depth",
  "provider_verification",
] as const) {
  assert.ok(
    nativeBundle.signals.some((signal) => signal.source === source),
    `native bundle missing ${source}`,
  )
}
assert.ok(
  nativeBundle.signals.every((signal) =>
    (NATIVE_RECIPIENT_EMAIL_SIGNAL_SOURCES as readonly string[]).includes(signal.source),
  ),
)

assert.doesNotThrow(() => {
  const invalidBundle = buildNativeRecipientEmailSignalBundle({ email: "@@@invalid" })
  assert.ok(invalidBundle.signals.length >= 4)
  assert.equal(invalidBundle.normalized_email, null)
})

const nativeModuleSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/contact-verification/confidence-signals-native.ts"),
  "utf8",
)
assert.doesNotMatch(nativeModuleSource, /zerobounce/i)
assert.doesNotMatch(nativeModuleSource, /map-apollo-contact/i)
assert.doesNotMatch(nativeModuleSource, /apollo-types/i)
assert.doesNotMatch(nativeModuleSource, /fetch\(/i)

// Wave 2D — native composite confidence scorer
const blockedSyntax = resolveNativeRecipientEmailConfidence({ email: "not-an-email" })
assert.equal(blockedSyntax.score, 0)
assert.equal(blockedSyntax.tier, "blocked")
assert.equal(blockedSyntax.sendable, false)
assert.ok(blockedSyntax.reasons.includes("Invalid email syntax"))

const blockedDisposable = resolveNativeRecipientEmailConfidence({ email: "user@mailinator.com" })
assert.equal(blockedDisposable.score, 0)
assert.equal(blockedDisposable.tier, "blocked")
assert.equal(blockedDisposable.sendable, false)
assert.ok(blockedDisposable.reasons.includes("Disposable email domain"))

const businessEmail = resolveNativeRecipientEmailConfidence({ email: "jane.doe@acmehealth.com" })
assert.equal(businessEmail.score, 0.95)
assert.equal(businessEmail.tier, "excellent")
assert.equal(businessEmail.sendable, true)

const roleEmail = resolveNativeRecipientEmailConfidence({ email: "info@acmehealth.com" })
assert.equal(roleEmail.score, 0.8)
assert.equal(roleEmail.tier, "good")
assert.equal(roleEmail.sendable, true)
assert.ok(roleEmail.reasons.includes("Role account local part"))

const freeEmail = resolveNativeRecipientEmailConfidence({ email: "jane.doe@gmail.com" })
assert.equal(freeEmail.score, 0.85)
assert.equal(freeEmail.tier, "good")
assert.equal(freeEmail.sendable, true)
assert.ok(freeEmail.reasons.includes("Free email domain"))

const verifiedDepthEmail = resolveNativeRecipientEmailConfidence({
  email: "jane.doe@acmehealth.com",
  verificationDepth: "published_on_website",
})
assert.equal(verifiedDepthEmail.score, 1)
assert.equal(verifiedDepthEmail.tier, "excellent")
assert.ok(verifiedDepthEmail.reasons.includes("Verification depth implies verified evidence"))

const withoutProvider = resolveNativeRecipientEmailConfidence({
  email: "jane.doe@acmehealth.com",
})
const withProvider = resolveNativeRecipientEmailConfidence({
  email: "jane.doe@acmehealth.com",
  providerStatus: "valid",
})
assert.equal(withProvider.score, withoutProvider.score)
assert.equal(withProvider.tier, withoutProvider.tier)
assert.equal(withProvider.sendable, withoutProvider.sendable)

const clampedHigh = resolveNativeRecipientEmailConfidence({
  email: "jane.doe@acmehealth.com",
  discoverySource: "website",
  verificationDepth: "published_on_website",
})
assert.equal(clampedHigh.score, 1)
assert.equal(roleEmail.score, 0.8)
assert.equal(businessEmail.score, 0.95)

const bundleForResolver = buildNativeRecipientEmailSignalBundle({ email: "jane.doe@acmehealth.com" })
const fromSignals = resolveNativeRecipientEmailConfidenceFromSignals(bundleForResolver.signals)
const fromInput = resolveNativeRecipientEmailConfidence({ email: "jane.doe@acmehealth.com" })
assert.equal(fromSignals.score, fromInput.score)
assert.equal(fromSignals.tier, fromInput.tier)
assert.equal(fromSignals.sendable, fromInput.sendable)
assert.deepEqual(fromSignals.reasons, fromInput.reasons)

const legacyComparison = compareNativeRecipientEmailConfidenceToLegacy({
  legacyScore: 0.95,
  nativeResult: businessEmail,
  context: { integration: "test_native_composite" },
})
assert.equal(legacyComparison.legacyScore, 0.95)
assert.equal(legacyComparison.nativeScore, 0.95)
assert.equal(legacyComparison.delta, 0)
assert.equal(legacyComparison.matched, true)
assert.equal(legacyComparison.nativeTier, "excellent")
assert.equal(businessEmail.score, 0.95, "legacy comparison must not mutate native score")

// Wave 2E — native vs legacy drift shadow wiring
assert.doesNotThrow(() => {
  shadowCompareNativeLegacyConfidenceDrift({
    integration: "test_missing_email",
    legacy_score: 0.88,
  })
})

let driftLogged = false
const originalInfoDrift = console.info
console.info = (...args: unknown[]) => {
  const payload = args[0]
  if (typeof payload === "string" && payload.includes("native_legacy_confidence_drift")) {
    driftLogged = true
  }
  originalInfoDrift(...args)
}
try {
  shadowCompareNativeLegacyConfidenceDrift({
    integration: "test_flag_off",
    legacy_score: 0.95,
    email: "jane.doe@acmehealth.com",
  })
  assert.equal(driftLogged, false, "native drift must stay quiet without env flag")
} finally {
  console.info = originalInfoDrift
}

const driftFlagPrior = process.env.GROWTH_EMAIL_CONFIDENCE_SHADOW_LOGS
process.env.GROWTH_EMAIL_CONFIDENCE_SHADOW_LOGS = "true"
try {
  let driftPayload: Record<string, unknown> | null = null
  console.info = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].includes("native_legacy_confidence_drift")) {
      driftPayload = JSON.parse(args[0] as string) as Record<string, unknown>
    }
    originalInfoDrift(...args)
  }
  try {
    assert.doesNotThrow(() => {
      shadowCompareNativeLegacyConfidenceDrift({
        integration: "test_flag_on",
        legacy_score: 0.95,
        email: "jane.doe@acmehealth.com",
        providerStatus: "valid",
      })
    })
    assert.ok(driftPayload, "native drift log expected when flag enabled")
    assert.equal(driftPayload!.integration, "test_flag_on")
    assert.equal(driftPayload!.legacy_score, 0.95)
    assert.equal(driftPayload!.native_score, 0.95)
    assert.equal(driftPayload!.matched, true)
    assert.equal(typeof driftPayload!.native_tier, "string")
    assert.equal(typeof driftPayload!.native_sendable, "boolean")

    const providerNeutral = resolveNativeRecipientEmailConfidence({
      email: "jane.doe@acmehealth.com",
    })
    const providerTagged = resolveNativeRecipientEmailConfidence({
      email: "jane.doe@acmehealth.com",
      providerStatus: "invalid",
    })
    assert.equal(providerTagged.score, providerNeutral.score)

    const discoveryBefore = baseConfidenceForSource("website")
    shadowCompareEmailDiscoveryConfidence({
      source: "website",
      verification_status: "unverified",
      legacy_confidence: discoveryBefore,
      integration: "test_2e_discovery",
      email: "ops@acmehealth.com",
    })
    assert.equal(baseConfidenceForSource("website"), discoveryBefore)

    const zbBefore = confidenceForZeroBounceStatus("verified")
    shadowCompareZeroBounceConfidence({
      email_status: "verified",
      legacy_confidence: zbBefore,
      integration: "test_2e_zerobounce",
      email: "ops@acmehealth.com",
      provider_status: "valid",
    })
    assert.equal(confidenceForZeroBounceStatus("verified"), zbBefore)

    const apolloBefore = mapApolloPersonToContactDiscoveryRaw(apolloPersonShadow, {
      company_name: "Example",
      domain: "example.com",
      mock: true,
    })
    shadowCompareApolloEmailConfidence({
      person: apolloPersonShadow,
      context: { company_name: "Example", domain: "example.com", mock: true },
      legacy_confidence: apolloBefore!.confidence,
      integration: "test_2e_apollo",
      email: "sam@example.com",
    })
    const apolloAfter = mapApolloPersonToContactDiscoveryRaw(apolloPersonShadow, {
      company_name: "Example",
      domain: "example.com",
      mock: true,
    })
    assert.equal(apolloAfter?.confidence, apolloBefore?.confidence)

    const reasoningBefore = buildProspectSearchContactConfidenceReasoning({
      confidence: 0.62,
      email: "ops@acmehealth.com",
      email_verification_depth: "published_on_website",
      source_evidence_count: 2,
    })
    shadowCompareProspectSearchVerificationDepth({
      email_verification_depth: "published_on_website",
      legacy_confidence_score: reasoningBefore.confidence_score,
      email: "ops@acmehealth.com",
      integration: "test_2e_prospect_search",
    })
    const reasoningAfter = buildProspectSearchContactConfidenceReasoning({
      confidence: 0.62,
      email: "ops@acmehealth.com",
      email_verification_depth: "published_on_website",
      source_evidence_count: 2,
    })
    assert.deepEqual(reasoningAfter, reasoningBefore)
  } finally {
    console.info = originalInfoDrift
  }
} finally {
  if (driftFlagPrior === undefined) {
    delete process.env.GROWTH_EMAIL_CONFIDENCE_SHADOW_LOGS
  } else {
    process.env.GROWTH_EMAIL_CONFIDENCE_SHADOW_LOGS = driftFlagPrior
  }
}

console.log("growth-email-confidence-signals checks passed")
