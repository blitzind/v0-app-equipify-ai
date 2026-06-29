/** GE-VERIFY-1A — Native verification production diagnostics (client-safe). */

import type { NativeEmailVerificationResult } from "@/lib/growth/contact-verification/native-email-verification"
import {
  isNativeVerificationAuthoritative,
  isNativeVerificationDnsEnabled,
  isNativeVerificationConfigured,
} from "@/lib/growth/contact-verification/native-verification-feature"
import {
  isNativeVerificationStale,
  resolveNativeVerificationTtlDays,
} from "@/lib/growth/contact-verification/native-verification-freshness"

export const GROWTH_NATIVE_VERIFICATION_DIAGNOSTICS_QA_MARKER =
  "native-verification-diagnostics-ge-verify-1a-v1" as const

export type NativeVerificationProductionDiagnostics = {
  qa_marker: typeof GROWTH_NATIVE_VERIFICATION_DIAGNOSTICS_QA_MARKER
  authoritative: boolean
  dns_enabled: boolean
  configured: boolean
  ttl_days_default: number
  ttl_days_dns_skipped: number
  result?: {
    email: string | null
    status: string
    confidence: number
    confidence_tier: string
    reasons: string[]
    warnings: string[]
    mx_checked: boolean
    mx_exists: boolean | null
    spf_present: boolean | null
    dmarc_present: boolean | null
    duration_ms: number
    cache_status: "miss" | "hit" | "bypass"
    fresh: boolean
    source: "native"
  }
}

export function buildNativeVerificationProductionDiagnostics(input: {
  result?: NativeEmailVerificationResult | null
  verified_at?: string | null
  cache_status?: "miss" | "hit" | "bypass"
  env?: NodeJS.ProcessEnv
}): NativeVerificationProductionDiagnostics {
  const dns_skipped = input.result?.warnings.includes("dns_skipped") ?? false
  const fresh =
    input.verified_at != null
      ? !isNativeVerificationStale({
          verified_at: input.verified_at,
          dns_skipped,
        })
      : false

  return {
    qa_marker: GROWTH_NATIVE_VERIFICATION_DIAGNOSTICS_QA_MARKER,
    authoritative: isNativeVerificationAuthoritative(input.env),
    dns_enabled: isNativeVerificationDnsEnabled(input.env),
    configured: isNativeVerificationConfigured(input.env),
    ttl_days_default: resolveNativeVerificationTtlDays({ env: input.env }),
    ttl_days_dns_skipped: resolveNativeVerificationTtlDays({ dns_skipped: true, env: input.env }),
    ...(input.result
      ? {
          result: {
            email: input.result.normalized_email,
            status: input.result.status,
            confidence: input.result.confidence.score,
            confidence_tier: input.result.confidence.tier,
            reasons: input.result.reasons,
            warnings: input.result.warnings,
            mx_checked: input.result.mx_checked,
            mx_exists: input.result.mx_exists,
            spf_present: input.result.spf_present,
            dmarc_present: input.result.dmarc_present,
            duration_ms: input.result.duration_ms,
            cache_status: input.cache_status ?? "miss",
            fresh,
            source: "native",
          },
        }
      : {}),
  }
}
