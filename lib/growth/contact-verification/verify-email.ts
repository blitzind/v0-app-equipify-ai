/** Email verification — provider-first with heuristic fallback. Server-only. */

import "server-only"

import type { GrowthCompanyContactEmailStatus } from "@/lib/growth/contact-discovery/company-contact-types"
import { verifyEmailWithProvider } from "@/lib/growth/contact-verification/email-verification-service"
import { verifyEmailAddressHeuristic } from "@/lib/growth/contact-verification/verify-email-heuristic"

export type EmailVerificationResult = {
  email: string
  valid_format: boolean
  mx_valid: boolean | null
  disposable: boolean
  email_status: GrowthCompanyContactEmailStatus
  confidence: number
  reasons: string[]
  verified_by_provider?: boolean
  provider_name?: string | null
}

export async function verifyEmailAddress(
  email: string | null | undefined,
): Promise<EmailVerificationResult | null> {
  const provider = await verifyEmailWithProvider(email)
  if (provider) {
    const raw = provider.raw_payload ?? {}
    return {
      email: provider.email,
      valid_format: provider.email_status !== "invalid" || provider.provider_status !== "invalid_format",
      mx_valid: typeof raw.mx_valid === "boolean" ? raw.mx_valid : null,
      disposable: Boolean(raw.disposable),
      email_status: provider.email_status,
      confidence: provider.confidence,
      reasons: provider.reasons,
      verified_by_provider: provider.verified_by_provider,
      provider_name: provider.provider_name,
    }
  }

  const heuristic = await verifyEmailAddressHeuristic(email)
  if (!heuristic) return null

  return {
    email: heuristic.email,
    valid_format: heuristic.valid_format,
    mx_valid: heuristic.mx_valid,
    disposable: heuristic.disposable,
    email_status: heuristic.email_status,
    confidence: heuristic.confidence,
    reasons: heuristic.reasons,
    verified_by_provider: false,
    provider_name: "heuristic",
  }
}
