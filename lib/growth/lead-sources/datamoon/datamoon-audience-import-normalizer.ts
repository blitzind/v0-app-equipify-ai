/** GE-DATAMOON-1B — Normalize Datamoon audience records into Growth lead shape. Client-safe. */

import {
  isConsumerEmailDomain,
  normalizeDomain,
} from "@/lib/growth/company-identification/company-identification-normalize"
import {
  normalizeEmail,
  normalizeLinkedIn,
  normalizePhone,
  parseEmailDomain,
  trimOrNull,
} from "@/lib/growth/import/normalize"
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

function pickStringList(record: Record<string, unknown>, key: string): string[] {
  const value = record[key]
  if (typeof value === "string") {
    const trimmed = trimOrNull(value)
    return trimmed ? [trimmed] : []
  }
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => (typeof entry === "string" ? trimOrNull(entry) : null))
    .filter((entry): entry is string => Boolean(entry))
}

function joinAddress(line1: string | null, line2: string | null): string | null {
  const parts = [line1, line2].filter(Boolean)
  return parts.length > 0 ? parts.join(", ") : null
}

function resolveCompanyDomain(raw: Record<string, unknown>, businessEmail: string | null, personalEmail: string | null): string | null {
  const providerDomain = normalizeDomain(pickString(raw, "company_domain"))
  if (providerDomain && !isConsumerEmailDomain(providerDomain)) {
    return providerDomain
  }

  const websiteDomain = normalizeDomain(pickString(raw, "website"))
  if (websiteDomain && !isConsumerEmailDomain(websiteDomain)) {
    return websiteDomain
  }

  const programmaticEmails = pickString(raw, "programmatic_business_emails")
  for (const candidate of (programmaticEmails ?? "").split(/[,;|]/)) {
    const domain = parseEmailDomain(normalizeEmail(candidate) ?? "")
    if (domain && !isConsumerEmailDomain(domain)) return domain
  }

  const businessDomain = parseEmailDomain(businessEmail ?? "")
  if (businessDomain && !isConsumerEmailDomain(businessDomain)) {
    return businessDomain
  }

  const personalDomain = parseEmailDomain(personalEmail ?? "")
  if (personalDomain && !isConsumerEmailDomain(personalDomain)) {
    return personalDomain
  }

  return null
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
  const personalEmailCandidates = (personalEmailsRaw ?? "")
    .split(/[,;|]/)
    .map((part) => normalizeEmail(part))
    .filter((value): value is string => Boolean(value))
  const personalEmail = personalEmailCandidates[0] ?? normalizeEmail(personalEmailsRaw)
  const email =
    businessEmail ??
    normalizeEmail(pickString(raw, "work_email")) ??
    normalizeEmail(pickString(raw, "email")) ??
    personalEmail
  const personalPhoneRaw =
    pickString(raw, "personal_phone") ??
    pickString(raw, "mobile_phone") ??
    pickString(raw, "direct_phone") ??
    pickString(raw, "work_phone") ??
    pickString(raw, "business_phone") ??
    pickString(raw, "phone")
  const personalPhone = normalizePhone(personalPhoneRaw)
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

  const companyDomain = resolveCompanyDomain(raw, businessEmail, personalEmail)
  const companyLinkedInRaw =
    pickString(raw, "company_linkedin_url") ?? pickString(raw, "company_linkedin")
  const companyLinkedInSlug = normalizeLinkedIn(companyLinkedInRaw)
  const companyLinkedinUrl = companyLinkedInSlug
    ? companyLinkedInSlug.includes("linkedin.com")
      ? companyLinkedInSlug
      : `https://www.linkedin.com/company/${companyLinkedInSlug}`
    : companyLinkedInRaw

  const providerCompanyId =
    pickString(raw, "company_id") ??
    pickString(raw, "employer_id") ??
    (typeof raw.id === "number" || typeof raw.id === "string" ? String(raw.id) : null)

  const contactName = [firstName, lastName].filter(Boolean).join(" ").trim() || null
  const hasProviderIdentity = Boolean(email || phone || linkedinSlug || contactName)

  return {
    first_name: firstName,
    last_name: lastName,
    contact_name: contactName,
    business_email: businessEmail,
    personal_emails: personalEmailsRaw,
    email,
    personal_phone: personalPhoneRaw,
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
    company_city: pickString(raw, "company_city"),
    company_state: pickString(raw, "company_state"),
    company_country: pickString(raw, "company_country") ?? pickString(raw, "company_country_code"),
    company_linkedin_url: companyLinkedinUrl,
    provider_company_id: providerCompanyId,
    primary_industry: pickString(raw, "primary_industry"),
    job_title: pickString(raw, "job_title"),
    department: pickString(raw, "department"),
    naics_codes: pickStringList(raw, "company_naics"),
    sic_codes: pickStringList(raw, "company_sic"),
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
