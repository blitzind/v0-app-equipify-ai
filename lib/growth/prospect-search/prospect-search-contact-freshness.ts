/** Unified contact freshness model for Prospect Search People mode. Client-safe. */

export const GROWTH_CONTACT_FRESHNESS_QA_MARKER = "growth-contact-freshness-v1" as const

export const PROSPECT_SEARCH_CONTACT_FRESHNESS_STATUSES = [
  "fresh",
  "aging",
  "stale",
  "expired",
  "unknown",
] as const

export type ProspectSearchContactFreshnessStatus =
  (typeof PROSPECT_SEARCH_CONTACT_FRESHNESS_STATUSES)[number]

export type ProspectSearchContactFreshnessFields = {
  discovered_at: string | null
  last_checked_at: string | null
  last_verified_at: string | null
  source_last_seen_at: string | null
  verification_expires_at: string | null
  freshness_status: ProspectSearchContactFreshnessStatus
}

const MS_PER_DAY = 86_400_000
const FRESH_DAYS = 30
const AGING_DAYS = 90
const STALE_DAYS = 180
const VERIFICATION_TTL_DAYS = 90

function parseSafeIsoDate(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return null
  return new Date(parsed)
}

function daysSince(date: Date, now: Date): number {
  return Math.floor((now.getTime() - date.getTime()) / MS_PER_DAY)
}

export function computeVerificationExpiresAt(input: {
  last_verified_at?: string | null
  last_checked_at?: string | null
}): string | null {
  const anchor =
    parseSafeIsoDate(input.last_verified_at) ?? parseSafeIsoDate(input.last_checked_at)
  if (!anchor) return null
  const expires = new Date(anchor.getTime() + VERIFICATION_TTL_DAYS * MS_PER_DAY)
  return expires.toISOString()
}

export function resolveProspectSearchContactFreshness(input: {
  discovered_at?: string | null
  last_checked_at?: string | null
  last_verified_at?: string | null
  source_last_seen_at?: string | null
  verification_expires_at?: string | null
  now?: Date
}): ProspectSearchContactFreshnessFields {
  const now = input.now ?? new Date()
  const discovered_at = input.discovered_at?.trim() || null
  const last_checked_at = input.last_checked_at?.trim() || null
  const last_verified_at = input.last_verified_at?.trim() || null
  const source_last_seen_at =
    input.source_last_seen_at?.trim() || last_checked_at || discovered_at || null
  const verification_expires_at =
    input.verification_expires_at?.trim() ||
    computeVerificationExpiresAt({ last_verified_at, last_checked_at })

  const checkedDate = parseSafeIsoDate(last_checked_at) ?? parseSafeIsoDate(source_last_seen_at)
  const expiresDate = parseSafeIsoDate(verification_expires_at)

  let freshness_status: ProspectSearchContactFreshnessStatus = "unknown"

  if (expiresDate && expiresDate.getTime() < now.getTime()) {
    freshness_status = "expired"
  } else if (!checkedDate) {
    freshness_status = "unknown"
  } else {
    const ageDays = daysSince(checkedDate, now)
    if (ageDays <= FRESH_DAYS) freshness_status = "fresh"
    else if (ageDays <= AGING_DAYS) freshness_status = "aging"
    else if (ageDays <= STALE_DAYS) freshness_status = "stale"
    else freshness_status = "expired"
  }

  return {
    discovered_at,
    last_checked_at,
    last_verified_at,
    source_last_seen_at,
    verification_expires_at,
    freshness_status,
  }
}

export function formatProspectSearchFreshnessLabel(
  status: ProspectSearchContactFreshnessStatus,
): string {
  switch (status) {
    case "fresh":
      return "Fresh"
    case "aging":
      return "Aging"
    case "stale":
      return "Stale — needs refresh"
    case "expired":
      return "Verification expired"
    default:
      return "Freshness unknown"
  }
}

export function resolveProspectSearchStaleWarning(input: {
  freshness_status: ProspectSearchContactFreshnessStatus
  last_checked_at?: string | null
  email?: string | null
  phone?: string | null
  email_verification_depth?: string | null
  phone_verification_depth?: string | null
  email_eligibility?: string | null
  call_eligibility?: string | null
  now?: Date
}): string | null {
  const now = input.now ?? new Date()
  const checked = parseSafeIsoDate(input.last_checked_at)

  if (input.freshness_status === "expired") return "Verification expired — refresh before outreach"
  if (input.freshness_status === "stale") {
    if (checked) {
      const days = daysSince(checked, now)
      return `Last checked ${days} days ago — needs refresh`
    }
    return "Needs refresh"
  }

  if (input.email?.trim() && input.email_verification_depth === "verification_needed") {
    return "Email found but not verified"
  }
  if (
    input.phone?.trim() &&
    (input.phone_verification_depth === "verification_needed" ||
      input.call_eligibility === "needs_review" ||
      input.call_eligibility === "verification_required")
  ) {
    return "Phone found, call readiness pending"
  }

  if (input.freshness_status === "aging" && checked) {
    const days = daysSince(checked, now)
    if (days >= 60) return `Last checked ${days} days ago`
  }

  return null
}

export function freshnessAffectsEligibility(
  status: ProspectSearchContactFreshnessStatus,
): boolean {
  return status === "stale" || status === "expired"
}
