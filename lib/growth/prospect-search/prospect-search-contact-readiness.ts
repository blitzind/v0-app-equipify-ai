/** Outreach readiness scoring for Prospect Search contacts. Client-safe. */

export const GROWTH_PEOPLE_HYDRATION_QA_MARKER = "growth-people-hydration-v1" as const

export type ProspectSearchContactOutreachReadiness = {
  email_available: boolean
  phone_available: boolean
  email_verified: boolean
  phone_verified: boolean
  call_ready: boolean
  outreach_ready: boolean
  compliance_status: "ready" | "suppressed" | "review_required"
  readiness_label: string
}

export function computeProspectSearchContactOutreachReadiness(input: {
  email?: string | null
  phone?: string | null
  verification_status?: string | null
  confidence?: number | null
  suppressed?: boolean
}): ProspectSearchContactOutreachReadiness {
  const email_available = Boolean(input.email?.trim())
  const phone_available = Boolean(input.phone?.trim())
  const verification = (input.verification_status ?? "").toLowerCase()

  const email_verified =
    email_available &&
    (verification.includes("email") ||
      verification.includes("verified_channels") ||
      verification === "mx_verified")
  const phone_verified =
    phone_available &&
    (verification.includes("phone") ||
      verification.includes("verified_channels") ||
      verification === "phone_verified")

  const call_ready = phone_available && !verification.includes("invalid")
  const suppressed = input.suppressed === true
  const outreach_ready =
    !suppressed && (email_verified || call_ready) && (input.confidence ?? 0) >= 0.45

  let readiness_label = "Needs verification"
  if (suppressed) readiness_label = "Suppressed for outreach"
  else if (outreach_ready && email_verified) readiness_label = "Email outreach ready"
  else if (outreach_ready && call_ready) readiness_label = "Call ready"
  else if (email_available && !email_verified) readiness_label = "Email found, verification pending"
  else if (phone_available && !phone_verified) readiness_label = "Phone found, verification pending"
  else if (email_available || phone_available) readiness_label = "Channels found — review before outreach"
  else readiness_label = "Name only — channels not verified"

  return {
    email_available,
    phone_available,
    email_verified,
    phone_verified,
    call_ready,
    outreach_ready,
    compliance_status: suppressed ? "suppressed" : outreach_ready ? "ready" : "review_required",
    readiness_label,
  }
}

export function formatProspectSearchContactSourceLabel(input: {
  source_label?: string | null
  source_page_url?: string | null
}): string {
  if (input.source_label?.trim()) return input.source_label.trim()
  if (input.source_page_url?.trim()) return `Extracted from ${input.source_page_url}`
  return "Internal contact research"
}
