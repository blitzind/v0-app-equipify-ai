/** GE-DATAMOON-1B — Normalize Datamoon audience records into Growth lead shape. Client-safe. */

import {
  normalizeEmail,
  normalizeLinkedIn,
  normalizePhone,
  parseEmailDomain,
  trimOrNull,
} from "@/lib/growth/import/normalize"
import { isConsumerEmailDomain } from "@/lib/growth/company-identification/company-identification-normalize"
import {
  DATAMOON_EXT_OUTPUT_FIELDS,
  type DatamoonExtOutputField,
  type DatamoonNormalizedLeadRecord,
} from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-types"
import type { DatamoonAudienceMode } from "@/lib/growth/providers/datamoon/datamoon-config"

function pickString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key]
  if (typeof value === "string") return trimOrNull(value)
  if (Array.isArray(value) && typeof value[0] === "string") return trimOrNull(value[0])
  return null
}

function joinAddress(line1: string | null, line2: string | null): string | null {
  const parts = [line1, line2].filter(Boolean)
  return parts.length > 0 ? parts.join(", ") : null
}

export function filterDatamoonRecordToExtFields(
  record: Record<string, unknown>,
): Record<string, unknown> {
  const filtered: Record<string, unknown> = {}
  for (const field of DATAMOON_EXT_OUTPUT_FIELDS) {
    if (field in record) filtered[field] = record[field]
  }
  return filtered
}

export function normalizeDatamoonAudienceRecord(
  record: unknown,
  options?: { providerMode?: DatamoonAudienceMode },
): DatamoonNormalizedLeadRecord {
  const raw =
    record && typeof record === "object"
      ? options?.providerMode === "ext"
        ? filterDatamoonRecordToExtFields(record as Record<string, unknown>)
        : (record as Record<string, unknown>)
      : {}

  const firstName = pickString(raw, "first_name")
  const lastName = pickString(raw, "last_name")
  const businessEmail = normalizeEmail(pickString(raw, "business_email"))
  const personalEmailsRaw = pickString(raw, "personal_emails")
  const personalEmail = normalizeEmail(personalEmailsRaw)
  const email = businessEmail ?? personalEmail
  const personalPhone = normalizePhone(pickString(raw, "personal_phone"))
  const phone = personalPhone
  const linkedinRaw = pickString(raw, "linkedin_url")
  const linkedinSlug = normalizeLinkedIn(linkedinRaw)
  const linkedinUrl = linkedinSlug
    ? linkedinSlug.includes("linkedin.com")
      ? linkedinSlug
      : `https://www.linkedin.com/in/${linkedinSlug}`
    : linkedinRaw

  const addressLine1 = joinAddress(
    pickString(raw, "personal_address"),
    pickString(raw, "personal_address_2"),
  )
  const city = pickString(raw, "personal_city")
  const state = pickString(raw, "personal_state")
  const postalCode = pickString(raw, "personal_zip") ?? pickString(raw, "personal_zip4")
  const country = pickString(raw, "contact_country") ?? "US"

  const businessDomain = parseEmailDomain(businessEmail ?? "")
  const personalDomain = parseEmailDomain(personalEmail ?? "")
  const companyDomain =
    businessDomain && !isConsumerEmailDomain(businessDomain)
      ? businessDomain
      : personalDomain && !isConsumerEmailDomain(personalDomain)
        ? personalDomain
        : null

  const contactName =
    [firstName, lastName].filter(Boolean).join(" ").trim() || null

  const hasProviderIdentity = Boolean(email || phone || linkedinSlug || contactName)

  return {
    first_name: firstName,
    last_name: lastName,
    contact_name: contactName,
    business_email: businessEmail,
    personal_emails: personalEmailsRaw,
    email,
    personal_phone: pickString(raw, "personal_phone"),
    phone,
    linkedin_url: linkedinUrl,
    address_line1: addressLine1,
    address_line2: pickString(raw, "personal_address_2"),
    city,
    state,
    postal_code: postalCode,
    country,
    company_name: pickString(raw, "company_name"),
    company_domain: companyDomain,
    source: "datamoon",
    source_confidence: hasProviderIdentity ? "provider" : "default",
  }
}

export function isDatamoonRecordImportable(normalized: DatamoonNormalizedLeadRecord): boolean {
  return Boolean(
    normalized.email ||
      normalized.phone ||
      normalized.linkedin_url ||
      normalized.contact_name,
  )
}

export function listDatamoonExtOutputFields(): readonly DatamoonExtOutputField[] {
  return DATAMOON_EXT_OUTPUT_FIELDS
}
