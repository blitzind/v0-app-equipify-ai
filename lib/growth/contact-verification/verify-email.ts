/** Email verification — format, MX, disposable domain checks. Server-only. */

import "server-only"

import { promises as dns } from "node:dns"

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "tempmail.com",
  "10minutemail.com",
  "yopmail.com",
  "throwaway.email",
])

export type EmailVerificationResult = {
  email: string
  valid_format: boolean
  mx_valid: boolean | null
  disposable: boolean
  email_status: "unknown" | "discovered" | "verified" | "risky" | "invalid"
  confidence: number
  reasons: string[]
}

const EMAIL_FORMAT = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i

export async function verifyEmailAddress(email: string | null | undefined): Promise<EmailVerificationResult | null> {
  const normalized = (email ?? "").trim().toLowerCase()
  if (!normalized) return null

  const reasons: string[] = []
  const valid_format = EMAIL_FORMAT.test(normalized)
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

  const domain = normalized.split("@")[1] ?? ""
  const disposable = DISPOSABLE_DOMAINS.has(domain)
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

  let email_status: EmailVerificationResult["email_status"] = "discovered"
  let confidence = 0.55
  if (!valid_format) {
    email_status = "invalid"
    confidence = 0
  } else if (disposable) {
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
