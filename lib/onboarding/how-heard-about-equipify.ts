/**
 * Canonical “How did you hear about Equipify?” options for signup/onboarding.
 * Stored on `organizations.how_heard_about_equipify` (+ optional `_other` text).
 */

export const HOW_HEARD_ABOUT_EQUIPIFY_OTHER_VALUE = "other" as const

export const HOW_HEARD_ABOUT_EQUIPIFY_OPTIONS = [
  { value: "google_search", label: "Google Search" },
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "youtube", label: "YouTube" },
  { value: "referral", label: "Referral" },
  { value: "email", label: "Email" },
  { value: "cold_call", label: "Cold Call" },
  { value: "trade_show_event", label: "Trade Show / Event" },
  { value: "existing_customer", label: "Existing Customer" },
  { value: "partner_vendor", label: "Partner / Vendor" },
  { value: "podcast", label: "Podcast" },
  { value: "online_ad", label: "Online Ad" },
  { value: HOW_HEARD_ABOUT_EQUIPIFY_OTHER_VALUE, label: "Other" },
] as const

export type HowHeardAboutEquipifyValue = (typeof HOW_HEARD_ABOUT_EQUIPIFY_OPTIONS)[number]["value"]

const VALUE_SET = new Set<string>(HOW_HEARD_ABOUT_EQUIPIFY_OPTIONS.map((o) => o.value))

export function isHowHeardAboutEquipifyValue(value: string | null | undefined): value is HowHeardAboutEquipifyValue {
  if (!value) return false
  return VALUE_SET.has(value.trim().toLowerCase())
}

export function labelForHowHeardAboutEquipify(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  const normalized = value.trim().toLowerCase()
  const match = HOW_HEARD_ABOUT_EQUIPIFY_OPTIONS.find((o) => o.value === normalized)
  return match?.label ?? null
}

/** User-facing summary for admin / internal surfaces (never raw slug alone when label exists). */
export function formatHowHeardAboutEquipifyDisplay(args: {
  value: string | null | undefined
  other: string | null | undefined
}): string | null {
  const v = args.value?.trim()
  if (!v) return null
  const label = labelForHowHeardAboutEquipify(v) ?? v.replace(/_/g, " ")
  if (v === HOW_HEARD_ABOUT_EQUIPIFY_OTHER_VALUE) {
    const detail = args.other?.trim()
    return detail ? `${label}: ${detail}` : label
  }
  return label
}

export type ParsedHowHeardInput =
  | { ok: true; value: HowHeardAboutEquipifyValue | null; other: string | null }
  | { ok: false; message: string }

const OTHER_MAX = 200

/** Server-side normalization for provision API. Field is optional overall. */
export function parseHowHeardAboutEquipifyInput(args: {
  value: string | null | undefined
  other: string | null | undefined
}): ParsedHowHeardInput {
  const raw = typeof args.value === "string" ? args.value.trim() : ""
  if (!raw) {
    const otherOnly = typeof args.other === "string" ? args.other.trim() : ""
    if (otherOnly) {
      return { ok: false, message: "Select how you heard about Equipify, or leave both fields blank." }
    }
    return { ok: true, value: null, other: null }
  }

  const normalized = raw.toLowerCase()
  if (!isHowHeardAboutEquipifyValue(normalized)) {
    return { ok: false, message: "Please choose a valid option for how you heard about Equipify." }
  }

  const otherRaw = typeof args.other === "string" ? args.other.trim().slice(0, OTHER_MAX) : ""
  if (normalized === HOW_HEARD_ABOUT_EQUIPIFY_OTHER_VALUE) {
    if (!otherRaw) {
      return { ok: false, message: "Please tell us how you found us." }
    }
    return { ok: true, value: normalized, other: otherRaw }
  }

  if (otherRaw) {
    return { ok: false, message: "Additional details are only needed when you select Other." }
  }

  return { ok: true, value: normalized, other: null }
}
