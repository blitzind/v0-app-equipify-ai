/**
 * Deterministic canonical company resolver (Phase 7.2A).
 * No AI, no fuzzy name-only merges across distinct domains.
 */

import {
  canonicalExactDomain,
  canonicalNameCityKey,
  canonicalNameStateKey,
  canonicalNormalizedCompanyName,
  canonicalNormalizedDomain,
} from "@/lib/growth/canonical-companies/canonical-company-normalize"
import type {
  GrowthCanonicalCompanyCandidateInput,
  GrowthCanonicalCompanyResolutionMethod,
  GrowthCanonicalCompanyResolutionResult,
} from "@/lib/growth/canonical-companies/canonical-company-types"

export type CanonicalCompanyResolverIndexes = {
  by_normalized_domain: Map<string, string>
  by_exact_domain: Map<string, string>
  by_name_city: Map<string, string>
  by_name_state: Map<string, string>
}

export function createEmptyCanonicalCompanyResolverIndexes(): CanonicalCompanyResolverIndexes {
  return {
    by_normalized_domain: new Map(),
    by_exact_domain: new Map(),
    by_name_city: new Map(),
    by_name_state: new Map(),
  }
}

export function registerCanonicalCompanyInIndexes(
  indexes: CanonicalCompanyResolverIndexes,
  companyId: string,
  input: {
    primary_domain: string | null
    normalized_domain: string | null
    city: string | null
    state: string | null
    normalized_name: string | null
  },
): void {
  const normDomain = input.normalized_domain ?? canonicalNormalizedDomain(input.primary_domain, null)
  if (normDomain) {
    if (!indexes.by_normalized_domain.has(normDomain)) {
      indexes.by_normalized_domain.set(normDomain, companyId)
    }
    indexes.by_exact_domain.set(normDomain, companyId)
  }
  const exact = canonicalExactDomain(input.primary_domain)
  if (exact) indexes.by_exact_domain.set(exact, companyId)

  const nameCity = input.normalized_name
    ? canonicalNameCityKey(input.normalized_name, input.city)
    : null
  if (nameCity && !indexes.by_name_city.has(nameCity)) {
    indexes.by_name_city.set(nameCity, companyId)
  }
  const nameState = input.normalized_name
    ? canonicalNameStateKey(input.normalized_name, input.state)
    : null
  if (nameState && !indexes.by_name_state.has(nameState)) {
    indexes.by_name_state.set(nameState, companyId)
  }
}

function methodConfidence(method: GrowthCanonicalCompanyResolutionMethod): number {
  switch (method) {
    case "normalized_domain":
      return 0.95
    case "domain_alias":
      return 0.92
    case "name_city":
      return 0.72
    case "name_state":
      return 0.68
    case "new":
      return 0.55
    default:
      return 0.5
  }
}

export function resolveCanonicalCompany(
  input: GrowthCanonicalCompanyCandidateInput,
  indexes: CanonicalCompanyResolverIndexes,
): GrowthCanonicalCompanyResolutionResult {
  const normalizedDomain = canonicalNormalizedDomain(input.domain, input.website)
  const exactDomain = canonicalExactDomain(input.domain) ?? normalizedDomain
  const nameCityKey = canonicalNameCityKey(input.company_name, input.city)
  const nameStateKey = canonicalNameStateKey(input.company_name, input.state)

  if (normalizedDomain) {
    const id = indexes.by_normalized_domain.get(normalizedDomain)
    if (id) {
      return {
        company_id: id,
        resolution_method: "normalized_domain",
        normalized_domain: normalizedDomain,
        exact_domain: exactDomain,
        name_city_key: nameCityKey,
        name_state_key: nameStateKey,
        would_create_new: false,
        review_tier: false,
      }
    }
  }

  if (exactDomain) {
    const id = indexes.by_exact_domain.get(exactDomain)
    if (id) {
      return {
        company_id: id,
        resolution_method: "domain_alias",
        normalized_domain: normalizedDomain,
        exact_domain: exactDomain,
        name_city_key: nameCityKey,
        name_state_key: nameStateKey,
        would_create_new: false,
        review_tier: false,
      }
    }
  }

  if (nameCityKey) {
    const id = indexes.by_name_city.get(nameCityKey)
    if (id) {
      return {
        company_id: id,
        resolution_method: "name_city",
        normalized_domain: normalizedDomain,
        exact_domain: exactDomain,
        name_city_key: nameCityKey,
        name_state_key: nameStateKey,
        would_create_new: false,
        review_tier: true,
      }
    }
  }

  if (nameStateKey) {
    const id = indexes.by_name_state.get(nameStateKey)
    if (id) {
      return {
        company_id: id,
        resolution_method: "name_state",
        normalized_domain: normalizedDomain,
        exact_domain: exactDomain,
        name_city_key: nameCityKey,
        name_state_key: nameStateKey,
        would_create_new: false,
        review_tier: true,
      }
    }
  }

  return {
    company_id: null,
    resolution_method: "new",
    normalized_domain: normalizedDomain,
    exact_domain: exactDomain,
    name_city_key: nameCityKey,
    name_state_key: nameStateKey,
    would_create_new: true,
    review_tier: false,
  }
}

export function resolutionConfidenceFromMethod(
  method: GrowthCanonicalCompanyResolutionMethod,
  candidateConfidence?: number,
): number {
  const base = methodConfidence(method)
  const cand = candidateConfidence ?? 0
  if (cand <= 0) return base
  return Math.min(1, Math.max(base, cand * 0.85))
}

/** Register a newly created company into indexes for subsequent candidates in the same run. */
export function registerNewCanonicalCompanyFromCandidate(
  indexes: CanonicalCompanyResolverIndexes,
  companyId: string,
  input: GrowthCanonicalCompanyCandidateInput,
): void {
  registerCanonicalCompanyInIndexes(indexes, companyId, {
    primary_domain: input.domain ?? null,
    normalized_domain: canonicalNormalizedDomain(input.domain, input.website),
    city: input.city ?? null,
    state: input.state ?? null,
    normalized_name: canonicalNormalizedCompanyName(input.company_name),
  })
}
