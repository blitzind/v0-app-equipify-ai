/** Map ZeroBounce API statuses → company_contacts.email_status. Client-safe. */

import type { GrowthCompanyContactEmailStatus } from "@/lib/growth/contact-discovery/company-contact-types"

export type ZeroBounceValidateResponse = {
  address?: string
  status?: string
  sub_status?: string
  free_email?: boolean | string
  did_you_mean?: string | null
  account?: string
  domain?: string
  mx_found?: boolean | string
  processed_at?: string
}

const BLOCKED_STATUSES = new Set(["spamtrap", "abuse", "do_not_mail", "toxic"])

export function mapZeroBounceStatusToEmailStatus(input: {
  status: string
  sub_status?: string | null
}): GrowthCompanyContactEmailStatus {
  const status = input.status.trim().toLowerCase()
  const sub = (input.sub_status ?? "").trim().toLowerCase()

  if (status === "valid") return "verified"
  if (status === "invalid") return "invalid"
  if (status === "catch-all") return "risky"
  if (status === "unknown") return "unknown"
  if (BLOCKED_STATUSES.has(status)) return "blocked"
  if (sub.includes("disposable")) return "risky"
  if (sub.includes("role_based")) return "risky"
  return "unknown"
}

export function confidenceForZeroBounceStatus(status: GrowthCompanyContactEmailStatus): number {
  switch (status) {
    case "verified":
      return 0.95
    case "invalid":
      return 0.92
    case "blocked":
      return 0.98
    case "risky":
      return 0.7
    case "unknown":
      return 0.45
    default:
      return 0.4
  }
}

export function reasonsForZeroBounceResult(raw: ZeroBounceValidateResponse): string[] {
  const reasons: string[] = []
  if (raw.status) reasons.push(`ZeroBounce status: ${raw.status}`)
  if (raw.sub_status) reasons.push(`ZeroBounce sub_status: ${raw.sub_status}`)
  if (raw.mx_found === false || raw.mx_found === "false") reasons.push("No MX records")
  if (raw.free_email === true || raw.free_email === "true") reasons.push("Free email provider")
  if (raw.did_you_mean) reasons.push(`Suggested correction: ${raw.did_you_mean}`)
  return reasons
}
