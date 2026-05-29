import "server-only"

import type { GrowthCompanyContactEmailStatus } from "@/lib/growth/contact-discovery/company-contact-types"
import type { EmailVerificationProviderResult } from "@/lib/growth/contact-verification/email-verification-types"
import { isEmailVerificationFixtureEnabled } from "@/lib/growth/contact-verification/providers/zerobounce-config"

function fixtureStatusForEmail(email: string): GrowthCompanyContactEmailStatus {
  const normalized = email.trim().toLowerCase()
  const local = normalized.split("@")[0] ?? ""
  if (local.includes("invalid") || local.startsWith("bad.")) return "invalid"
  if (local.includes("blocked") || local.includes("spamtrap")) return "blocked"
  if (local.includes("risky") || local.includes("catchall")) return "risky"
  if (local.includes("unknown")) return "unknown"
  if (local.includes("valid") || local.startsWith("good.")) return "verified"
  return "verified"
}

export async function verifyEmailWithFixture(
  email: string,
): Promise<EmailVerificationProviderResult | null> {
  if (!isEmailVerificationFixtureEnabled()) return null

  const normalized = email.trim().toLowerCase()
  if (!normalized) return null

  const email_status = fixtureStatusForEmail(normalized)

  return {
    email: normalized,
    email_status,
    confidence: email_status === "verified" ? 0.9 : 0.75,
    reasons: [`Fixture verification assigned status: ${email_status}`],
    provider_name: "fixture",
    provider_status: email_status,
    provider_sub_status: "fixture_mode",
    verified_by_provider: email_status === "verified",
    blocked_by_suppression: false,
    raw_payload: { fixture: true },
  }
}
