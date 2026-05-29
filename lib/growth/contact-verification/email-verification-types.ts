/** Email verification provider types — client-safe. */

import type { GrowthCompanyContactEmailStatus } from "@/lib/growth/contact-discovery/company-contact-types"

export const GROWTH_EMAIL_VERIFICATION_QA_MARKER = "growth-email-verification-v1" as const

export const GROWTH_EMAIL_VERIFICATION_PROVIDER_NAMES = [
  "zerobounce",
  "fixture",
  "heuristic",
] as const

export type GrowthEmailVerificationProviderName =
  (typeof GROWTH_EMAIL_VERIFICATION_PROVIDER_NAMES)[number]

/** Final provider-assigned statuses (excludes pre-verification discovered). */
export const GROWTH_EMAIL_VERIFICATION_FINAL_STATUSES = [
  "verified",
  "risky",
  "invalid",
  "unknown",
  "blocked",
] as const

export type GrowthEmailVerificationFinalStatus =
  (typeof GROWTH_EMAIL_VERIFICATION_FINAL_STATUSES)[number]

export type EmailVerificationProviderResult = {
  email: string
  email_status: GrowthCompanyContactEmailStatus
  confidence: number
  reasons: string[]
  provider_name: GrowthEmailVerificationProviderName | null
  provider_status: string | null
  provider_sub_status: string | null
  verified_by_provider: boolean
  blocked_by_suppression: boolean
  raw_payload?: Record<string, unknown>
}

export function isEmailReadyForLeadPromotion(
  result: Pick<EmailVerificationProviderResult, "email_status" | "verified_by_provider">,
): boolean {
  return result.email_status === "verified" && result.verified_by_provider
}
