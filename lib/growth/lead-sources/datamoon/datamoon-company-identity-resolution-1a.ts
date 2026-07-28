/** AVA-SIMPLE-GPT-QUALIFICATION-1A — Credible company identity from DataMoon normalized records (client-safe). */

import {
  domainToCompanyNameHint,
  isConsumerEmailDomain,
  normalizeCompanyName,
} from "@/lib/growth/company-identification/company-identification-normalize"
import {
  resolveDatamoonCompanyName,
  resolveDatamoonCompanyWebsite,
} from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-company-identity"
import type { DatamoonNormalizedLeadRecord } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-types"

export const GROWTH_DATAMOON_COMPANY_IDENTITY_RESOLUTION_1A_QA_MARKER =
  "ava-simple-gpt-qualification-1a-datamoon-company-identity-v1" as const

/** B2B provider fields dropped by ext-mode filtering but required for company identity. */
export const DATAMOON_B2B_COMPANY_IDENTITY_FIELDS = [
  "company_name",
  "company_domain",
  "website",
  "company_city",
  "company_state",
  "company_country",
  "company_country_code",
  "company_linkedin_url",
  "company_linkedin",
  "company_id",
  "employer_id",
  "primary_industry",
  "job_title",
  "department",
  "company_naics",
  "company_sic",
  "programmatic_business_emails",
] as const

export type DatamoonCompanyIdentityState = "credible" | "insufficient_identity"

export type DatamoonCredibleCompanyIdentity = {
  state: DatamoonCompanyIdentityState
  companyName: string | null
  companyDomain: string | null
  companyWebsite: string | null
  providerCompanyId: string | null
  contactName: string | null
  contactTitle: string | null
  contactEmail: string | null
  contactLinkedIn: string | null
  primaryIndustry: string | null
  reasons: string[]
}

function hasExplicitCompanyName(value: string | null | undefined): boolean {
  const normalized = normalizeCompanyName(value ?? "")
  if (!normalized) return false
  if (normalized === "Unknown Company") return false
  if (normalized.endsWith("(company unknown)")) return false
  if (isConsumerEmailDomain(normalized)) return false
  return true
}

export function resolveDatamoonCredibleCompanyIdentity(
  normalized: DatamoonNormalizedLeadRecord,
): DatamoonCredibleCompanyIdentity {
  const domain = normalized.company_domain?.trim().toLowerCase() ?? null
  const credibleDomain = Boolean(domain && !isConsumerEmailDomain(domain))
  const explicitCompanyName = hasExplicitCompanyName(normalized.company_name)

  const contactName = normalized.contact_name?.trim() || null
  const contactTitle = normalized.job_title?.trim() || null
  const contactEmail = normalized.email?.trim() || normalized.business_email?.trim() || null
  const contactLinkedIn = normalized.linkedin_url?.trim() || null
  const providerCompanyId = normalized.provider_company_id?.trim() || null
  const primaryIndustry = normalized.primary_industry?.trim() || null

  if (!credibleDomain && !explicitCompanyName) {
    return {
      state: "insufficient_identity",
      companyName: null,
      companyDomain: null,
      companyWebsite: null,
      providerCompanyId,
      contactName,
      contactTitle,
      contactEmail,
      contactLinkedIn,
      primaryIndustry,
      reasons: [
        "missing_credible_company_domain",
        "missing_explicit_company_name",
        ...(contactName ? ["contact_only_record"] : []),
      ],
    }
  }

  const companyName = explicitCompanyName
    ? normalizeCompanyName(normalized.company_name)!
    : resolveDatamoonCompanyName({
        ...normalized,
        company_name: domain ? domainToCompanyNameHint(domain) : normalized.company_name,
      })

  return {
    state: "credible",
    companyName,
    companyDomain: domain,
    companyWebsite: resolveDatamoonCompanyWebsite(normalized),
    providerCompanyId,
    contactName,
    contactTitle,
    contactEmail,
    contactLinkedIn,
    primaryIndustry,
    reasons: [
      credibleDomain ? "credible_company_domain" : "explicit_company_name",
      ...(providerCompanyId ? ["provider_company_id_present"] : []),
    ],
  }
}

export function isDatamoonCompanyIdentityInsufficient(
  normalized: DatamoonNormalizedLeadRecord,
): boolean {
  return resolveDatamoonCredibleCompanyIdentity(normalized).state === "insufficient_identity"
}
