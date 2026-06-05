/** Phase 7.PS-IH — Reject company-name fragments mislabeled as persons. Client-safe. */

import { isPlausiblePersonName } from "@/lib/growth/contact-discovery/extract/extract-shared"
import { isGenericIdentityName } from "@/lib/growth/human-identity-evidence/human-identity-evidence-evidence"

const INDUSTRY_FRAGMENT_TOKENS = new Set([
  "biomedical",
  "medical",
  "technologies",
  "technology",
  "technicians",
  "technician",
  "services",
  "service",
  "equipment",
  "repair",
  "repairs",
  "supply",
  "supplies",
  "solutions",
  "group",
  "llc",
  "inc",
  "corp",
  "company",
  "center",
  "centre",
  "dme",
  "healthcare",
  "health",
  "care",
])

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 2)
}

export function isCompanyNameFragmentAsPerson(input: {
  full_name: string
  company_name: string
}): boolean {
  const full_name = input.full_name.trim()
  const company_name = input.company_name.trim()
  if (!full_name || !company_name) return true

  const nameNorm = normalizeText(full_name)
  const companyNorm = normalizeText(company_name)

  if (nameNorm === companyNorm) return true
  if (companyNorm.includes(nameNorm) && nameNorm.length >= 10) return true
  if (nameNorm.includes(companyNorm) && companyNorm.length >= 10) return true

  const nameTokens = tokenize(full_name)
  const companyTokens = tokenize(company_name)
  if (nameTokens.length === 0) return true

  const overlap = nameTokens.filter((token) => companyTokens.includes(token))
  if (nameTokens.length >= 2 && overlap.length / nameTokens.length >= 0.6) return true

  const industryOverlap = nameTokens.filter((token) => INDUSTRY_FRAGMENT_TOKENS.has(token))
  if (
    nameTokens.length >= 2 &&
    industryOverlap.length >= 2 &&
    !isPlausiblePersonName(full_name)
  ) {
    return true
  }

  if (/\b(biomedical|medical equipment|technologies|technicians)\b/i.test(full_name)) {
    if (!isPlausiblePersonName(full_name)) return true
  }

  return false
}

export function evaluateServiceShopPersonCandidate(input: {
  full_name: string
  company_name: string
  title?: string | null
  has_external_evidence?: boolean
  has_corroboration_evidence?: boolean
}): {
  accepted: boolean
  rejection_reason: string | null
} {
  const full_name = input.full_name.trim()
  if (!full_name || isGenericIdentityName(full_name)) {
    return { accepted: false, rejection_reason: "generic_identity" }
  }

  if (isCompanyNameFragmentAsPerson({ full_name, company_name: input.company_name })) {
    return { accepted: false, rejection_reason: "company_name_fragment" }
  }

  const hasTitle = Boolean(input.title?.trim())
  const hasEvidence =
    hasTitle ||
    input.has_external_evidence === true ||
    input.has_corroboration_evidence === true

  if (!hasEvidence && !isPlausiblePersonName(full_name)) {
    return { accepted: false, rejection_reason: "insufficient_person_evidence" }
  }

  return { accepted: true, rejection_reason: null }
}
