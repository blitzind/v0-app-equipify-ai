/** Apollo people search query builder — Growth Engine ICP title/seniority filters. Client-safe. */

import type { ApolloPersonSearchInput } from "@/lib/growth/providers/apollo/apollo-types"
import { resolveContactsPerCompanyLimit } from "@/lib/growth/providers/apollo/apollo-run-guardrails"
import { resolveApolloCreditLimits } from "@/lib/growth/providers/apollo/apollo-config"

export type ApolloSearchTier = 1 | 2 | 3

/** Tier 3 uses a focused title set when domain/name + persona search needs broader match. */
export const GROWTH_APOLLO_PERSON_TITLES_TIER_3 = [
  "owner",
  "founder",
  "president",
  "ceo",
  "general manager",
  "operations manager",
  "director of operations",
  "service manager",
  "equipment manager",
  "sales manager",
] as const

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

export type ApolloPeopleSearchParamsBuilt = {
  params: URLSearchParams
  summary: string
  domain: string | null
  per_page: number
  tier: ApolloSearchTier
  company_name: string
  person_titles: readonly string[]
  person_seniorities: readonly string[]
  domain_exact_only: boolean
  request_payload: Record<string, unknown>
}

function serializeParams(params: URLSearchParams): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  for (const [key, value] of params.entries()) {
    if (key.endsWith("[]")) {
      const base = key.slice(0, -2)
      const existing = payload[base]
      if (Array.isArray(existing)) {
        existing.push(value)
      } else {
        payload[base] = [value]
      }
      continue
    }
    payload[key] = value
  }
  return payload
}

export function buildApolloPeopleSearchParamsForTier(
  input: ApolloPersonSearchInput,
  tier: ApolloSearchTier,
): ApolloPeopleSearchParamsBuilt {
  const domain = normalizeApolloDomain(input.domain, input.website_url)
  const company_name = input.company_name.trim()
  const per_page = resolveContactsPerCompanyLimit(input.limit)
  const limits = resolveApolloCreditLimits()
  const cappedPerPage = Math.min(per_page, limits.max_contacts_per_company)
  const params = new URLSearchParams()
  params.set("page", "1")
  params.set("per_page", String(cappedPerPage))
  params.set("include_similar_titles", "true")

  const person_titles =
    tier === 3 ? GROWTH_APOLLO_PERSON_TITLES_TIER_3 : GROWTH_APOLLO_PERSON_TITLES
  const person_seniorities = tier === 3 ? ([] as const) : GROWTH_APOLLO_PERSON_SENIORITIES

  for (const title of person_titles) {
    params.append("person_titles[]", title)
  }
  for (const seniority of person_seniorities) {
    params.append("person_seniorities[]", seniority)
  }

  let domain_exact_only = false

  if (tier === 1) {
    if (domain) {
      params.append("q_organization_domains_list[]", domain)
      domain_exact_only = true
    } else if (company_name) {
      params.set("q_organization_name", company_name)
    }
  } else if (tier === 2) {
    if (company_name) {
      params.set("q_organization_name", company_name)
    }
  } else {
    if (domain) {
      params.append("q_organization_domains_list[]", domain)
      domain_exact_only = true
    } else if (company_name) {
      params.set("q_organization_name", company_name)
    }
  }

  const summary =
    tier === 1
      ? domain
        ? `tier1;domain=${domain};titles=${person_titles.length};seniorities=${person_seniorities.length}`
        : `tier1;company_name=${company_name};titles=${person_titles.length};seniorities=${person_seniorities.length}`
      : tier === 2
        ? `tier2;company_name=${company_name};titles=${person_titles.length};seniorities=${person_seniorities.length}`
        : domain
          ? `tier3;domain=${domain};titles=${person_titles.length};seniorities=0`
          : `tier3;company_name=${company_name};titles=${person_titles.length};seniorities=0`

  return {
    params,
    summary,
    domain,
    per_page: cappedPerPage,
    tier,
    company_name,
    person_titles,
    person_seniorities,
    domain_exact_only,
    request_payload: serializeParams(params),
  }
}

export function buildApolloPeopleSearchParams(input: ApolloPersonSearchInput): {
  params: URLSearchParams
  summary: string
  domain: string | null
  per_page: number
} {
  const built = buildApolloPeopleSearchParamsForTier(input, 1)
  return {
    params: built.params,
    summary: built.summary,
    domain: built.domain,
    per_page: built.per_page,
  }
}
