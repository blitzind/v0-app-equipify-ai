/** GE-VERIFY-1A — Authoritative native verification service (single engine, no third-party providers). Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthCompanyContactEmailStatus } from "@/lib/growth/contact-discovery/company-contact-types"
import type { EmailVerificationProviderResult } from "@/lib/growth/contact-verification/email-verification-types"
import {
  getCachedNativeVerification,
  setCachedNativeVerification,
} from "@/lib/growth/contact-verification/native-verification-cache"
import {
  isNativeVerificationAuthoritative,
  resolveNativeVerificationSkipDns,
} from "@/lib/growth/contact-verification/native-verification-feature"
import {
  verifyEmailNatively,
  type NativeEmailVerificationDependencies,
  type NativeEmailVerificationResult,
} from "@/lib/growth/contact-verification/native-email-verification"
import { isValidGrowthEmailFormat } from "@/lib/growth/import/email-format"

export const GROWTH_NATIVE_VERIFICATION_AUTHORITATIVE_QA_MARKER =
  "native-verification-authoritative-ge-verify-1a-v1" as const

export function mapNativeVerificationToEmailStatus(
  result: NativeEmailVerificationResult,
): GrowthCompanyContactEmailStatus {
  switch (result.status) {
    case "valid":
      return "verified"
    case "invalid":
      return "invalid"
    case "risky":
      return "risky"
    default:
      return "unknown"
  }
}

export function mapNativeVerificationToProviderResult(
  result: NativeEmailVerificationResult,
): EmailVerificationProviderResult {
  const email = result.normalized_email ?? ""
  return {
    email,
    email_status: mapNativeVerificationToEmailStatus(result),
    confidence: result.confidence.score,
    reasons: [...result.reasons, ...result.warnings.map((warning) => `warning:${warning}`)],
    provider_name: "native",
    provider_status: result.status,
    provider_sub_status: result.warnings[0] ?? null,
    verified_by_provider: result.status === "valid",
    blocked_by_suppression: false,
    raw_payload: {
      qa_marker: GROWTH_NATIVE_VERIFICATION_AUTHORITATIVE_QA_MARKER,
      engine_version: result.engine_version,
      mx_checked: result.mx_checked,
      mx_exists: result.mx_exists,
      spf_present: result.spf_present,
      dmarc_present: result.dmarc_present,
      disposable: result.disposable,
      role_account: result.role_account,
      free_email: result.free_email,
      duration_ms: result.duration_ms,
      confidence_tier: result.confidence.tier,
    },
  }
}

export async function verifyEmailWithNativeEngine(
  email: string | null | undefined,
  options?: {
    admin?: SupabaseClient
    leadId?: string | null
    skipDns?: boolean
    skipCache?: boolean
    nativeVerificationDependencies?: NativeEmailVerificationDependencies
  },
): Promise<EmailVerificationProviderResult | null> {
  const normalized = (email ?? "").trim().toLowerCase()
  if (!normalized) return null

  if (!isValidGrowthEmailFormat(normalized)) {
    return {
      email: normalized,
      email_status: "invalid",
      confidence: 0,
      reasons: ["invalid_syntax"],
      provider_name: "native",
      provider_status: "invalid",
      provider_sub_status: "invalid_syntax",
      verified_by_provider: false,
      blocked_by_suppression: false,
    }
  }

  if (options?.admin) {
    const { assertEmailSendAllowed } = await import("@/lib/growth/outbound/suppression-repository")
    const suppression = await assertEmailSendAllowed(options.admin, normalized, {
      leadId: options.leadId,
    })
    if (!suppression.allowed) {
      return {
        email: normalized,
        email_status: "blocked",
        confidence: 0.98,
        reasons: [`suppression_blocked:${suppression.reason ?? "suppressed"}`],
        provider_name: "native",
        provider_status: "blocked",
        provider_sub_status: suppression.blockLayer ?? null,
        verified_by_provider: false,
        blocked_by_suppression: true,
      }
    }
  }

  if (!options?.skipCache) {
    const cached = getCachedNativeVerification(normalized)
    if (cached) {
      const mapped = mapNativeVerificationToProviderResult(cached)
      return { ...mapped, reasons: [...mapped.reasons, "cache_hit"] }
    }
  }

  const skipDns = resolveNativeVerificationSkipDns({ skipDns: options?.skipDns })
  const native = await verifyEmailNatively(
    { email: normalized, skipDns },
    options?.nativeVerificationDependencies,
  )

  if (!options?.skipCache) {
    setCachedNativeVerification(normalized, native)
  }

  return mapNativeVerificationToProviderResult(native)
}

export function isNativeVerificationServiceConfigured(): boolean {
  return isNativeVerificationAuthoritative()
}
