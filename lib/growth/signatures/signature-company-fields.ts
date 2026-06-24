/** GS-GROWTH-SIGNATURES-1A — company display name vs website URL (client-safe). */

import { GROWTH_SIGNATURE_DEFAULT_COMPANY_NAME } from "@/lib/growth/signatures/signature-profile-defaults"

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function deriveCompanyLabelFromWebsite(website: string | null | undefined): string | null {
  const websiteTrimmed = trimOrNull(website)
  if (!websiteTrimmed) return null
  try {
    const host = new URL(websiteTrimmed.includes("://") ? websiteTrimmed : `https://${websiteTrimmed}`).hostname
    return host.replace(/^www\./, "")
  } catch {
    return websiteTrimmed
  }
}

export function formatSignatureWebsiteHref(website: string): string {
  return website.includes("://") ? website : `https://${website}`
}

export function resolveSignatureCompanyFields(input: {
  company_name?: string | null
  website?: string | null
  /** When null, no fallback label is applied (for merge fields). Default: Equipify.ai. */
  fallbackLabel?: string | null
}): {
  companyLabel: string
  websiteHref: string | null
} {
  const website = trimOrNull(input.website)
  const companyName = trimOrNull(input.company_name)
  let companyLabel = companyName ?? deriveCompanyLabelFromWebsite(website)
  if (!companyLabel) {
    companyLabel =
      input.fallbackLabel === undefined
        ? GROWTH_SIGNATURE_DEFAULT_COMPANY_NAME
        : (input.fallbackLabel ?? "")
  }
  const websiteHref = website ? formatSignatureWebsiteHref(website) : null
  return { companyLabel, websiteHref }
}
