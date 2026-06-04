import "server-only"

import { safeFetchJson } from "@/lib/growth/prospect-search/prospect-search-safe-fetch-json"
import {
  getZeroBounceApiKey,
  isEmailVerificationDisabled,
  isZeroBounceConfigured,
  resolveZeroBounceValidateUrl,
} from "@/lib/growth/contact-verification/providers/zerobounce-config"
import {
  confidenceForZeroBounceStatus,
  mapZeroBounceStatusToEmailStatus,
  reasonsForZeroBounceResult,
  type ZeroBounceValidateResponse,
} from "@/lib/growth/contact-verification/providers/zerobounce-mapper"
import type { EmailVerificationProviderResult } from "@/lib/growth/contact-verification/email-verification-types"

export async function verifyEmailWithZeroBounce(
  email: string,
): Promise<EmailVerificationProviderResult | null> {
  if (isEmailVerificationDisabled() || !isZeroBounceConfigured()) return null

  const normalized = email.trim().toLowerCase()
  if (!normalized) return null

  const apiKey = getZeroBounceApiKey()
  if (!apiKey) return null

  const response = await safeFetchJson<ZeroBounceValidateResponse>(
    resolveZeroBounceValidateUrl(normalized, apiKey),
    {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    },
  )

  if (!response.ok || !response.data) {
    return {
      email: normalized,
      email_status: "unknown",
      confidence: 0.35,
      reasons: [response.error ?? "ZeroBounce request failed"],
      provider_name: "zerobounce",
      provider_status: "provider_error",
      provider_sub_status: response.error_kind ?? null,
      verified_by_provider: false,
      blocked_by_suppression: false,
      raw_payload: {
        status: response.status,
        error: response.error,
        error_kind: response.error_kind,
      },
    }
  }

  const raw = response.data
  const providerStatus = (raw.status ?? "unknown").trim().toLowerCase()
  const email_status = mapZeroBounceStatusToEmailStatus({
    status: providerStatus,
    sub_status: raw.sub_status,
  })

  return {
    email: normalized,
    email_status,
    confidence: confidenceForZeroBounceStatus(email_status),
    reasons: reasonsForZeroBounceResult(raw),
    provider_name: "zerobounce",
    provider_status: providerStatus,
    provider_sub_status: raw.sub_status?.trim() || null,
    verified_by_provider: email_status === "verified",
    blocked_by_suppression: false,
    raw_payload: raw as Record<string, unknown>,
  }
}
