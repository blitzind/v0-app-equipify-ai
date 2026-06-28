import { isValidGrowthEmailFormat } from "@/lib/growth/import/email-format"
import { normalizePhone, normalizeWebsiteUrl } from "@/lib/growth/import/normalize"

export function validateLeadContactEmail(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ""
  if (!trimmed) return null
  if (!isValidGrowthEmailFormat(trimmed)) {
    throw new Error("invalid_email")
  }
  return trimmed.toLowerCase()
}

export function normalizeLeadContactPhone(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ""
  if (!trimmed) return null
  const normalized = normalizePhone(trimmed)
  if (!normalized) throw new Error("invalid_phone")
  return normalized
}

export function normalizeLeadContactWebsite(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ""
  if (!trimmed) return null
  return normalizeWebsiteUrl(trimmed)
}

export function friendlyLeadContactValidationError(code: string): string {
  switch (code) {
    case "invalid_email":
      return "Enter a valid email address."
    case "invalid_phone":
      return "Enter a valid phone number (at least 10 digits)."
    case "company_name_required":
      return "Company name is required."
    default:
      return "Could not save contact info."
  }
}
