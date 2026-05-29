import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthCompanyContactEmailStatus } from "@/lib/growth/contact-discovery/company-contact-types"
import type { EmailVerificationProviderResult } from "@/lib/growth/contact-verification/email-verification-types"
import { verifyEmailWithFixture } from "@/lib/growth/contact-verification/providers/fixture-email-verification"
import {
  isEmailVerificationDisabled,
  isEmailVerificationFixtureEnabled,
  isZeroBounceConfigured,
} from "@/lib/growth/contact-verification/providers/zerobounce-config"
import { verifyEmailWithZeroBounce } from "@/lib/growth/contact-verification/providers/zerobounce-client"
import { verifyEmailAddressHeuristic } from "@/lib/growth/contact-verification/verify-email-heuristic"
import { assertEmailSendAllowed } from "@/lib/growth/outbound/suppression-repository"

const EMAIL_FORMAT = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i

export function isEmailVerificationProviderConfigured(): boolean {
  if (isEmailVerificationDisabled()) return false
  return isZeroBounceConfigured() || isEmailVerificationFixtureEnabled()
}

export async function verifyEmailWithProvider(
  email: string | null | undefined,
  options?: {
    admin?: SupabaseClient
    leadId?: string | null
  },
): Promise<EmailVerificationProviderResult | null> {
  const normalized = (email ?? "").trim().toLowerCase()
  if (!normalized) return null

  if (!EMAIL_FORMAT.test(normalized)) {
    return {
      email: normalized,
      email_status: "invalid",
      confidence: 0,
      reasons: ["Invalid email format"],
      provider_name: null,
      provider_status: "invalid_format",
      provider_sub_status: null,
      verified_by_provider: false,
      blocked_by_suppression: false,
    }
  }

  if (options?.admin) {
    const suppression = await assertEmailSendAllowed(options.admin, normalized, {
      leadId: options.leadId,
    })
    if (!suppression.allowed) {
      return {
        email: normalized,
        email_status: "blocked",
        confidence: 0.98,
        reasons: [`Suppression blocked: ${suppression.reason ?? "suppressed"}`],
        provider_name: null,
        provider_status: "suppressed",
        provider_sub_status: suppression.blockLayer ?? null,
        verified_by_provider: false,
        blocked_by_suppression: true,
      }
    }
  }

  if (isEmailVerificationDisabled()) {
    return await heuristicAsProviderResult(normalized)
  }

  const zerobounce = await verifyEmailWithZeroBounce(normalized)
  if (zerobounce) return zerobounce

  const fixture = await verifyEmailWithFixture(normalized)
  if (fixture) return fixture

  return await heuristicAsProviderResult(normalized)
}

async function heuristicAsProviderResult(email: string): Promise<EmailVerificationProviderResult> {
  const heuristic = await verifyEmailAddressHeuristic(email)
  if (!heuristic) {
    return {
      email,
      email_status: "unknown",
      confidence: 0,
      reasons: ["No email provided"],
      provider_name: "heuristic",
      provider_status: "missing",
      provider_sub_status: null,
      verified_by_provider: false,
      blocked_by_suppression: false,
    }
  }
  const email_status: GrowthCompanyContactEmailStatus =
    heuristic.email_status === "verified" ? "discovered" : heuristic.email_status

  return {
    email,
    email_status,
    confidence: heuristic.confidence,
    reasons: [...heuristic.reasons, "Heuristic verification only — provider not configured"],
    provider_name: "heuristic",
    provider_status: heuristic.email_status,
    provider_sub_status: "no_provider_configured",
    verified_by_provider: false,
    blocked_by_suppression: false,
    raw_payload: {
      valid_format: heuristic.valid_format,
      mx_valid: heuristic.mx_valid,
      disposable: heuristic.disposable,
    },
  }
}

export function buildEmailVerificationMetadata(result: EmailVerificationProviderResult): Record<string, unknown> {
  return {
    email_verification: {
      provider_name: result.provider_name,
      provider_status: result.provider_status,
      provider_sub_status: result.provider_sub_status,
      verified_by_provider: result.verified_by_provider,
      blocked_by_suppression: result.blocked_by_suppression,
      verified_at: new Date().toISOString(),
      reasons: result.reasons,
      ...(result.raw_payload ? { raw_payload: result.raw_payload } : {}),
    },
  }
}
