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
