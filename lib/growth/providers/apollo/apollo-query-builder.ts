/** Apollo people search query builder — Growth Engine ICP title/seniority filters. Client-safe. */

import type { ApolloPersonSearchInput } from "@/lib/growth/providers/apollo/apollo-types"
import { resolveContactsPerCompanyLimit } from "@/lib/growth/providers/apollo/apollo-run-guardrails"
import { resolveApolloCreditLimits } from "@/lib/growth/providers/apollo/apollo-config"

/** Decision-maker and operations titles — tuned Phase 7.PCA-3 (removed overly broad standalone tokens). */
export const GROWTH_APOLLO_PERSON_TITLES = [
  "owner",
  "founder",
  "co-founder",
  "president",
  "ceo",
  "chief executive officer",
  "coo",
  "chief operating officer",
  "operations manager",
  "director of operations",
  "service manager",
  "field service manager",
  "facilities manager",
  "maintenance manager",
  "clinical engineering",
  "clinical engineering manager",
  "biomedical equipment",
  "biomed manager",
  "equipment manager",
  "plant manager",
  "general manager",
  "vp operations",
  "vice president operations",
  "director of facilities",
  "director of maintenance",
] as const

export const GROWTH_APOLLO_PERSON_SENIORITIES = [
  "owner",
  "founder",
  "c_suite",
  "partner",
  "vp",
  "head",
  "director",
  "manager",
] as const

export function normalizeApolloDomain(
  domain: string | null | undefined,
  website_url?: string | null,
): string | null {
  const direct = domain?.trim().replace(/^www\./i, "").toLowerCase()
  if (direct && direct.includes(".")) return direct

  const website = website_url?.trim()
  if (!website) return null
  try {
    const url = new URL(website.startsWith("http") ? website : `https://${website}`)
    return url.hostname.replace(/^www\./i, "").toLowerCase() || null
  } catch {
    return null
  }
}

export function buildApolloPeopleSearchParams(input: ApolloPersonSearchInput): {
  params: URLSearchParams
  summary: string
  domain: string | null
  per_page: number
} {
  const domain = normalizeApolloDomain(input.domain, input.website_url)
  const per_page = resolveContactsPerCompanyLimit(input.limit)
  const limits = resolveApolloCreditLimits()
  const cappedPerPage = Math.min(per_page, limits.max_contacts_per_company)
  const params = new URLSearchParams()
  params.set("page", "1")
  params.set("per_page", String(cappedPerPage))
  params.set("include_similar_titles", "true")

  for (const title of GROWTH_APOLLO_PERSON_TITLES) {
    params.append("person_titles[]", title)
  }
  for (const seniority of GROWTH_APOLLO_PERSON_SENIORITIES) {
    params.append("person_seniorities[]", seniority)
  }

  if (domain) {
    params.append("q_organization_domains_list[]", domain)
  }

  const summary = domain
    ? `domain=${domain};titles=${GROWTH_APOLLO_PERSON_TITLES.length};seniorities=${GROWTH_APOLLO_PERSON_SENIORITIES.length}`
    : `company_name=${input.company_name};titles=${GROWTH_APOLLO_PERSON_TITLES.length}`

  return { params, summary, domain, per_page: cappedPerPage }
}
