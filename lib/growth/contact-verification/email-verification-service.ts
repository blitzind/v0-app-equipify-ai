import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { EmailVerificationProviderResult } from "@/lib/growth/contact-verification/email-verification-types"
import { verifyEmailAddressHeuristic } from "@/lib/growth/contact-verification/verify-email-heuristic"
import { isEmailVerificationDisabled } from "@/lib/growth/contact-verification/providers/zerobounce-config"
import {
  isNativeVerificationAuthoritative,
  isNativeVerificationDnsEnabled,
} from "@/lib/growth/contact-verification/native-verification-feature"
import {
  isNativeVerificationServiceConfigured,
  verifyEmailWithNativeEngine,
} from "@/lib/growth/contact-verification/native-verification-authoritative-service"

export function isEmailVerificationProviderConfigured(): boolean {
  if (isEmailVerificationDisabled()) return false
  return isNativeVerificationServiceConfigured() || isNativeVerificationDnsEnabled()
}

export async function verifyEmailWithProvider(
  email: string | null | undefined,
  options?: {
    admin?: SupabaseClient
    leadId?: string | null
  },
): Promise<EmailVerificationProviderResult | null> {
  if (isEmailVerificationDisabled()) {
    return heuristicAsProviderResult((email ?? "").trim().toLowerCase())
  }

  if (isNativeVerificationAuthoritative() || isNativeVerificationDnsEnabled()) {
    return verifyEmailWithNativeEngine(email, options)
  }

  return verifyEmailWithNativeEngine(email, { ...options, skipDns: true })
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
  const email_status =
    heuristic.email_status === "verified" ? "discovered" : heuristic.email_status

  return {
    email,
    email_status,
    confidence: heuristic.confidence,
    reasons: [...heuristic.reasons, "Heuristic verification only — native authoritative mode off"],
    provider_name: "heuristic",
    provider_status: heuristic.email_status,
    provider_sub_status: "native_authoritative_disabled",
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
      authoritative_engine: result.provider_name === "native" ? "native-email-verification-v1" : null,
      ...(result.raw_payload ? { raw_payload: result.raw_payload } : {}),
    },
  }
}
