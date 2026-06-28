/** Heuristic email verification — format, MX, disposable domain checks. Server-only. */

import "server-only"

import { promises as dns } from "node:dns"
import type { GrowthCompanyContactEmailStatus } from "@/lib/growth/contact-discovery/company-contact-types"
import { isDisposableEmailDomain } from "@/lib/growth/import/email-classifiers"
import { isValidGrowthEmailFormat } from "@/lib/growth/import/email-format"
import { parseEmailDomain } from "@/lib/growth/import/normalize"

export type HeuristicEmailVerificationResult = {
  email: string
  valid_format: boolean
  mx_valid: boolean | null
  disposable: boolean
  email_status: GrowthCompanyContactEmailStatus
  confidence: number
  reasons: string[]
}

export async function verifyEmailAddressHeuristic(
  email: string | null | undefined,
): Promise<HeuristicEmailVerificationResult | null> {
  const normalized = (email ?? "").trim().toLowerCase()
  if (!normalized) return null

  const reasons: string[] = []
  const valid_format = isValidGrowthEmailFormat(normalized)
  if (!valid_format) {
    return {
      email: normalized,
      valid_format: false,
      mx_valid: null,
      disposable: false,
      email_status: "invalid",
      confidence: 0,
      reasons: ["Invalid email format"],
    }
  }

  const domain = parseEmailDomain(normalized) ?? ""
  const disposable = isDisposableEmailDomain(domain)
  if (disposable) {
    reasons.push("Disposable domain detected")
  }

  let mx_valid: boolean | null = null
  try {
    const records = await dns.resolveMx(domain)
    mx_valid = records.length > 0
    reasons.push(mx_valid ? "MX records found" : "No MX records")
  } catch {
    mx_valid = false
    reasons.push("MX lookup failed")
  }

  let email_status: GrowthCompanyContactEmailStatus = "discovered"
  let confidence = 0.55
  if (disposable) {
    email_status = "risky"
    confidence = 0.25
  } else if (mx_valid === false) {
    email_status = "invalid"
    confidence = 0.15
  } else if (mx_valid === true) {
    email_status = "discovered"
    confidence = 0.72
  }

  return {
    email: normalized,
    valid_format,
    mx_valid,
    disposable,
    email_status,
    confidence,
    reasons,
  }
}
