/** Conservative contact verification depth — evidence-backed, no SMTP probing. Client-safe. */

export const GROWTH_CONTACT_VERIFICATION_DEPTH_QA_MARKER =
  "growth-contact-verification-depth-v1" as const

export const PROSPECT_SEARCH_EMAIL_VERIFICATION_DEPTHS = [
  "published_on_website",
  "mx_valid",
  "domain_accepts_mail",
  "role_email",
  "personal_email",
  "unverifiable",
  "invalid_format",
  "disposable_domain",
  "verification_needed",
] as const

export type ProspectSearchEmailVerificationDepth =
  (typeof PROSPECT_SEARCH_EMAIL_VERIFICATION_DEPTHS)[number]

export const PROSPECT_SEARCH_PHONE_VERIFICATION_DEPTHS = [
  "published_on_website",
  "office_line",
  "mobile_possible",
  "toll_free",
  "dispatch_line",
  "invalid_format",
  "dnc_blocked",
  "verification_needed",
] as const

export type ProspectSearchPhoneVerificationDepth =
  (typeof PROSPECT_SEARCH_PHONE_VERIFICATION_DEPTHS)[number]

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "tempmail.com",
  "throwaway.email",
  "yopmail.com",
  "10minutemail.com",
])

const ROLE_LOCAL_PARTS = new Set([
  "info",
  "contact",
  "sales",
  "support",
  "hello",
  "admin",
  "office",
  "service",
  "dispatch",
  "billing",
  "hr",
  "careers",
  "help",
  "team",
])

const EMAIL_FORMAT_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function emailDomain(email: string): string | null {
  const parts = email.trim().toLowerCase().split("@")
  return parts.length === 2 ? parts[1]! : null
}

function emailLocalPart(email: string): string | null {
  const parts = email.trim().toLowerCase().split("@")
  return parts.length === 2 ? parts[0]! : null
}

function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "")
}

function isTollFree(digits: string): boolean {
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1)
  if (digits.length !== 10) return false
  const prefix = digits.slice(0, 3)
  return ["800", "888", "877", "866", "855", "844", "833"].includes(prefix)
}

function isLikelyMobile(digits: string): boolean {
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1)
  if (digits.length !== 10) return false
  const area = digits.slice(0, 3)
  return !area.startsWith("8") && !area.startsWith("9")
}

function hasWebsiteEvidence(input: {
  source_label?: string | null
  source_page_url?: string | null
  source_evidence?: Array<{ source?: string; page_url?: string | null }>
}): boolean {
  if (input.source_page_url?.trim()) return true
  const label = (input.source_label ?? "").toLowerCase()
  if (label.includes("website") || label.includes("public extract") || label.includes("contact page")) {
    return true
  }
  return (input.source_evidence ?? []).some((item) => {
    const source = (item.source ?? "").toLowerCase()
    return (
      source.includes("website") ||
      source.includes("public_extract") ||
      Boolean(item.page_url?.trim())
    )
  })
}

export function classifyProspectSearchEmailVerificationDepth(input: {
  email?: string | null
  source_label?: string | null
  source_page_url?: string | null
  source_evidence?: Array<{ source?: string; page_url?: string | null; evidence?: string }>
  email_status?: string | null
}): ProspectSearchEmailVerificationDepth {
  const email = input.email?.trim()
  if (!email) return "unverifiable"
  if (!EMAIL_FORMAT_RE.test(email)) return "invalid_format"

  const domain = emailDomain(email)
  if (domain && DISPOSABLE_DOMAINS.has(domain)) return "disposable_domain"

  const local = emailLocalPart(email)
  const onWebsite = hasWebsiteEvidence(input)

  if (onWebsite) {
    if (local && ROLE_LOCAL_PARTS.has(local)) return "role_email"
    return "published_on_website"
  }

  if (local && ROLE_LOCAL_PARTS.has(local)) return "role_email"
  if (local && local.includes(".")) return "personal_email"

  const status = (input.email_status ?? "").toLowerCase()
  if (status === "verified") return "published_on_website"

  return "verification_needed"
}

export function classifyProspectSearchPhoneVerificationDepth(input: {
  phone?: string | null
  source_label?: string | null
  source_page_url?: string | null
  source_evidence?: Array<{ source?: string; evidence?: string; page_url?: string | null }>
  phone_on_dnc?: boolean | null
  phone_status?: string | null
}): ProspectSearchPhoneVerificationDepth {
  const phone = input.phone?.trim()
  if (!phone) return "verification_needed"

  const digits = normalizePhoneDigits(phone)
  if (digits.length < 10) return "invalid_format"
  if (input.phone_on_dnc === true) return "dnc_blocked"
  if (isTollFree(digits)) return "toll_free"

  const evidenceBlob = (input.source_evidence ?? [])
    .map((item) => `${item.evidence ?? ""} ${item.source ?? ""}`.toLowerCase())
    .join(" ")
  if (evidenceBlob.includes("dispatch") || evidenceBlob.includes("after hours")) {
    return "dispatch_line"
  }

  const onWebsite = hasWebsiteEvidence(input)
  if (onWebsite) {
    if (isLikelyMobile(digits)) return "mobile_possible"
    return "published_on_website"
  }

  const status = (input.phone_status ?? "").toLowerCase()
  if (status === "mobile") return "mobile_possible"
  if (status === "business") return "office_line"

  if (isLikelyMobile(digits)) return "mobile_possible"
  return "office_line"
}

export function formatEmailVerificationDepthLabel(depth: ProspectSearchEmailVerificationDepth): string {
  return depth.replace(/_/g, " ")
}

export function formatPhoneVerificationDepthLabel(depth: ProspectSearchPhoneVerificationDepth): string {
  return depth.replace(/_/g, " ")
}

export function emailDepthImpliesVerified(depth: ProspectSearchEmailVerificationDepth): boolean {
  return (
    depth === "published_on_website" ||
    depth === "mx_valid" ||
    depth === "domain_accepts_mail" ||
    depth === "personal_email"
  )
}

export function phoneDepthImpliesCallable(depth: ProspectSearchPhoneVerificationDepth): boolean {
  return (
    depth === "published_on_website" ||
    depth === "office_line" ||
    depth === "mobile_possible" ||
    depth === "dispatch_line"
  )
}
