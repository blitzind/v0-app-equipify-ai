/** GE-AIOS-21C — Shared Datamoon company identity resolution (client-safe). */

import {
  domainToCompanyNameHint,
  isConsumerEmailDomain,
  normalizeCompanyName,
} from "@/lib/growth/company-identification/company-identification-normalize"
import type { DatamoonNormalizedLeadRecord } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-types"

export function resolveDatamoonCompanyName(normalized: DatamoonNormalizedLeadRecord): string {
  const explicit = normalizeCompanyName(normalized.company_name)
  if (explicit && !isConsumerEmailDomain(explicit)) {
    return explicit
  }

  const domain = normalized.company_domain?.trim().toLowerCase() ?? null
  if (domain && !isConsumerEmailDomain(domain)) {
    return domainToCompanyNameHint(domain)
  }

  const contactName = normalized.contact_name?.trim()
  if (contactName) {
    return `${contactName} (company unknown)`
  }

  return "Unknown Company"
}

export function resolveDatamoonCompanyWebsite(
  normalized: DatamoonNormalizedLeadRecord,
): string | null {
  const domain = normalized.company_domain?.trim().toLowerCase() ?? null
  if (!domain || isConsumerEmailDomain(domain)) return null
  return `https://${domain}`
}

export function resolveDatamoonCompanyGeography(normalized: DatamoonNormalizedLeadRecord): {
  city: string | null
  state: string | null
  country: string | null
  location: string | null
} {
  const city = normalized.company_city?.trim() || null
  const state = normalized.company_state?.trim() || null
  const country = normalized.company_country?.trim() || null
  const location = [city, state, country].filter(Boolean).join(", ") || null
  return { city, state, country, location }
}

export function resolveDatamoonProspectCompanyIdentityKey(
  normalized: DatamoonNormalizedLeadRecord,
): string | null {
  const domain = normalized.company_domain?.trim().toLowerCase() ?? null
  if (domain && !isConsumerEmailDomain(domain)) {
    return `domain:${domain}`
  }

  const providerCompanyId = normalized.provider_company_id?.trim()
  if (providerCompanyId) {
    return `provider_company:${providerCompanyId}`
  }

  const companyName = normalizeCompanyName(normalized.company_name)
  if (companyName) {
    const geo = [normalized.company_state, normalized.company_city].filter(Boolean).join("|")
    return geo ? `name:${companyName}|${geo.toLowerCase()}` : `name:${companyName.toLowerCase()}`
  }

  return null
}
