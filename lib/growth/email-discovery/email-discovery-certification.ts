/**
 * Phase 7.3A — Production verification readiness (certification gates).
 */

import {
  isEmailVerificationDisabled,
  isEmailVerificationFixtureEnabled,
  isZeroBounceConfigured,
} from "@/lib/growth/contact-verification/providers/zerobounce-config"

export const GROWTH_EMAIL_DISCOVERY_CERTIFICATION_QA_MARKER =
  "growth-email-discovery-certification-7.3a-v1" as const

export type EmailDiscoveryVerificationCertification = {
  ok: boolean
  production_safe: boolean
  zerobounce_configured: boolean
  verification_disabled: boolean
  fixture_enabled: boolean
  blockers: string[]
}

export function evaluateEmailDiscoveryVerificationCertification(): EmailDiscoveryVerificationCertification {
  const zerobounce_configured = isZeroBounceConfigured()
  const verification_disabled = isEmailVerificationDisabled()
  const fixture_enabled = isEmailVerificationFixtureEnabled()
  const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production"

  const blockers: string[] = []
  if (verification_disabled) {
    blockers.push("GROWTH_EMAIL_VERIFICATION_DISABLE=1 — provider verification is off.")
  }
  if (isProduction && !zerobounce_configured) {
    blockers.push("ZeroBounce is not configured in production (ZEROBOUNCE_API_KEY / GROWTH_ZEROBOUNCE_API_KEY).")
  }
  if (isProduction && fixture_enabled) {
    blockers.push("GROWTH_EMAIL_VERIFICATION_USE_FIXTURE is enabled in production — promotions are not provider-verified.")
  }
  if (!isProduction && !zerobounce_configured && fixture_enabled) {
    blockers.push("Non-production fixture mode: only heuristic/fixture verification (not cert-grade).")
  }

  const production_safe =
    !verification_disabled && zerobounce_configured && (!isProduction || !fixture_enabled)

  return {
    ok: blockers.length === 0 || (!isProduction && zerobounce_configured),
    production_safe,
    zerobounce_configured,
    verification_disabled,
    fixture_enabled,
    blockers,
  }
}
