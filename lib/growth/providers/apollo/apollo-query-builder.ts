/** Apollo people search query builder — Growth Engine ICP title/seniority filters. Client-safe. */

import type { ApolloPersonSearchInput } from "@/lib/growth/providers/apollo/apollo-types"
import { resolveContactsPerCompanyLimit } from "@/lib/growth/providers/apollo/apollo-run-guardrails"
import { resolveApolloCreditLimits } from "@/lib/growth/providers/apollo/apollo-config"

export type ApolloSearchTier = 1 | 2 | 3 | 4 | 5

/** Tier A–E labels for evidence and logging. */
export const APOLLO_SEARCH_TIER_NAMES: Record<ApolloSearchTier, string> = {
  1: "A_strict_domain_titles",
  2: "B_company_location_titles",
  3: "C_relaxed_owner_operator_titles",
  4: "D_org_only_fallback",
  5: "E_no_title_fallback",
}

export const APOLLO_TIER_E_MAX_PEOPLE = 5

/** Tier C — broader owner/operator and medical equipment service roles. */
export const GROWTH_APOLLO_PERSON_TITLES_TIER_3 = [
  "owner",
  "president",
  "founder",
  "ceo",
  "general manager",
  "operations manager",
  "service manager",
  "director of operations",
  "equipment manager",
  "biomed manager",
  "biomedical technician",
  "clinical engineering",
  "equipment repair",
  "dme manager",
  "respiratory manager",
  "sales manager",
  "purchasing manager",
  "procurement manager",
] as const

/** Tier A/B — full medical equipment / DME / biomed ICP title set. */
export const GROWTH_APOLLO_PERSON_TITLES = [
  "owner",
  "founder",
  "co-founder",
  "president",
  "ceo",
  "chief executive officer",
  "coo",
  "chief operating officer",
  "general manager",
  "operations manager",
  "director of operations",
  "service manager",
  "field service manager",
  "facilities manager",
  "maintenance manager",
  "clinical engineering",
  "clinical engineering manager",
  "biomedical equipment",
  "biomedical equipment technician",
  "biomedical technician",
  "biomed manager",
  "equipment manager",
  "equipment repair",
  "plant manager",
  "dme manager",
  "respiratory manager",
  "sales manager",
  "purchasing manager",
  "procurement manager",
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

export const GROWTH_APOLLO_PERSON_SENIORITIES_TIER_3 = [
  "owner",
  "founder",
  "c_suite",
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

export function resolveApolloOrganizationLocation(input: {
  city?: string | null
  state?: string | null
}): string | null {
  const city = input.city?.trim()
  const state = input.state?.trim()
  if (city && state) return `${city}, ${state}, United States`
  if (state) return `${state}, United States`
  if (city) return `${city}, United States`
  return null
}

export type ApolloPeopleSearchParamsBuilt = {
  params: URLSearchParams
  summary: string
  domain: string | null
  per_page: number
  tier: ApolloSearchTier
  tier_name: string
  company_name: string
  organization_location: string | null
  person_titles: readonly string[]
  person_seniorities: readonly string[]
  domain_exact_only: boolean
  title_filter_applied: boolean
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

function appendTitlesAndSeniorities(
  params: URLSearchParams,
  titles: readonly string[],
  seniorities: readonly string[],
): void {
  for (const title of titles) {
    params.append("person_titles[]", title)
  }
  for (const seniority of seniorities) {
    params.append("person_seniorities[]", seniority)
  }
}

export function buildApolloPeopleSearchParamsForTier(
  input: ApolloPersonSearchInput,
  tier: ApolloSearchTier,
): ApolloPeopleSearchParamsBuilt {
  const domain = normalizeApolloDomain(input.domain, input.website_url)
  const company_name = input.company_name.trim()
  const organization_location = resolveApolloOrganizationLocation({
    city: input.city,
    state: input.state,
  })
  const per_page = resolveContactsPerCompanyLimit(input.limit)
  const limits = resolveApolloCreditLimits()
  const cappedPerPage =
    tier === 5
      ? Math.min(per_page, limits.max_contacts_per_company, APOLLO_TIER_E_MAX_PEOPLE)
      : Math.min(per_page, limits.max_contacts_per_company)

  const params = new URLSearchParams()
  params.set("page", "1")
  params.set("per_page", String(cappedPerPage))
  params.set("include_similar_titles", "true")

  let person_titles: readonly string[] = []
  let person_seniorities: readonly string[] = []
  let domain_exact_only = false
  let title_filter_applied = false

  if (tier === 1) {
    person_titles = GROWTH_APOLLO_PERSON_TITLES
    person_seniorities = GROWTH_APOLLO_PERSON_SENIORITIES
    title_filter_applied = true
    appendTitlesAndSeniorities(params, person_titles, person_seniorities)
    if (domain) {
      params.append("q_organization_domains_list[]", domain)
      domain_exact_only = true
    } else if (company_name) {
      params.set("q_organization_name", company_name)
    }
  } else if (tier === 2) {
    person_titles = GROWTH_APOLLO_PERSON_TITLES
    person_seniorities = GROWTH_APOLLO_PERSON_SENIORITIES
    title_filter_applied = true
    appendTitlesAndSeniorities(params, person_titles, person_seniorities)
    if (company_name) {
      params.set("q_organization_name", company_name)
    }
    if (organization_location) {
      params.append("organization_locations[]", organization_location)
    }
  } else if (tier === 3) {
    person_titles = GROWTH_APOLLO_PERSON_TITLES_TIER_3
    person_seniorities = GROWTH_APOLLO_PERSON_SENIORITIES_TIER_3
    title_filter_applied = true
    appendTitlesAndSeniorities(params, person_titles, person_seniorities)
    if (domain) {
      params.append("q_organization_domains_list[]", domain)
      domain_exact_only = true
    } else if (company_name) {
      params.set("q_organization_name", company_name)
      if (organization_location) {
        params.append("organization_locations[]", organization_location)
      }
    }
  } else if (tier === 4) {
    title_filter_applied = false
    if (domain) {
      params.append("q_organization_domains_list[]", domain)
      domain_exact_only = true
    } else if (company_name) {
      params.set("q_organization_name", company_name)
      if (organization_location) {
        params.append("organization_locations[]", organization_location)
      }
    }
  } else {
    title_filter_applied = false
    if (domain) {
      params.append("q_organization_domains_list[]", domain)
      domain_exact_only = true
    } else if (company_name) {
      params.set("q_organization_name", company_name)
      if (organization_location) {
        params.append("organization_locations[]", organization_location)
      }
    }
  }

  const tier_name = APOLLO_SEARCH_TIER_NAMES[tier]
  const summary = [
    tier_name,
    domain ? `domain=${domain}` : company_name ? `company=${company_name}` : "no_anchor",
    organization_location ? `location=${organization_location}` : null,
    title_filter_applied ? `titles=${person_titles.length}` : "titles=0",
    person_seniorities.length > 0 ? `seniorities=${person_seniorities.length}` : "seniorities=0",
    `per_page=${cappedPerPage}`,
  ]
    .filter(Boolean)
    .join(";")

  return {
    params,
    summary,
    domain,
    per_page: cappedPerPage,
    tier,
    tier_name,
    company_name,
    organization_location,
    person_titles,
    person_seniorities,
    domain_exact_only,
    title_filter_applied,
    request_payload: serializeParams(params),
  }
}

export function shouldSkipApolloSearchTier(
  tier: ApolloSearchTier,
  input: ApolloPersonSearchInput,
): string | null {
  const domain = normalizeApolloDomain(input.domain, input.website_url)
  const company_name = input.company_name.trim()
  const organization_location = resolveApolloOrganizationLocation({
    city: input.city,
    state: input.state,
  })

  if (tier === 1) {
    if (!domain && !company_name) return "missing_domain_and_company_name"
    return null
  }
  if (tier === 2) {
    if (!company_name) return "missing_company_name"
    if (!domain && !organization_location) return "missing_location_for_name_search"
    return null
  }
  if (tier === 3 || tier === 4 || tier === 5) {
    if (!domain && !company_name) return "missing_domain_and_company_name"
    if (!domain && !organization_location) return "missing_location_for_name_search"
    return null
  }
  return null
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
