/**
 * Deterministic canonical person resolver (Phase 7.2B).
 * No AI, no fuzzy matching, no name-only or cross-company name merges.
 */

import {
  canonicalNameCompanyKey,
  canonicalNormalizedPersonEmail,
  canonicalNormalizedPersonLinkedIn,
  canonicalNormalizedPersonName,
  canonicalNormalizedPersonPhone,
} from "@/lib/growth/canonical-persons/canonical-person-normalize"
import type {
  GrowthCanonicalPersonCandidateInput,
  GrowthCanonicalPersonResolutionMethod,
  GrowthCanonicalPersonResolutionResult,
} from "@/lib/growth/canonical-persons/canonical-person-types"

export type CanonicalPersonResolverIndexes = {
  by_normalized_email: Map<string, string>
  by_normalized_linkedin: Map<string, string>
  by_normalized_phone: Map<string, string>
  by_name_company: Map<string, string>
}

export function createEmptyCanonicalPersonResolverIndexes(): CanonicalPersonResolverIndexes {
  return {
    by_normalized_email: new Map(),
    by_normalized_linkedin: new Map(),
    by_normalized_phone: new Map(),
    by_name_company: new Map(),
  }
}

export function registerCanonicalPersonInIndexes(
  indexes: CanonicalPersonResolverIndexes,
  personId: string,
  input: {
    normalized_email: string | null
    normalized_linkedin: string | null
    normalized_phone: string | null
    canonical_company_id: string | null
    normalized_name: string | null
  },
): void {
  if (input.normalized_email && !indexes.by_normalized_email.has(input.normalized_email)) {
    indexes.by_normalized_email.set(input.normalized_email, personId)
  }
  if (input.normalized_linkedin && !indexes.by_normalized_linkedin.has(input.normalized_linkedin)) {
    indexes.by_normalized_linkedin.set(input.normalized_linkedin, personId)
  }
  if (input.normalized_phone && !indexes.by_normalized_phone.has(input.normalized_phone)) {
    indexes.by_normalized_phone.set(input.normalized_phone, personId)
  }
  const nameCompany = canonicalNameCompanyKey(input.canonical_company_id, input.normalized_name)
  if (nameCompany && !indexes.by_name_company.has(nameCompany)) {
    indexes.by_name_company.set(nameCompany, personId)
  }
}

function methodConfidence(method: GrowthCanonicalPersonResolutionMethod): number {
  switch (method) {
    case "normalized_email":
      return 0.95
    case "normalized_linkedin":
      return 0.92
    case "normalized_phone":
      return 0.88
    case "name_company":
      return 0.72
    case "new":
      return 0.55
    default:
      return 0.5
  }
}

export function resolveCanonicalPerson(
  input: GrowthCanonicalPersonCandidateInput,
  indexes: CanonicalPersonResolverIndexes,
): GrowthCanonicalPersonResolutionResult {
  const normalizedEmail = canonicalNormalizedPersonEmail(input.email)
  const normalizedLinkedIn = canonicalNormalizedPersonLinkedIn(input.linkedin_url)
  const normalizedPhone = canonicalNormalizedPersonPhone(input.phone)
  const normalizedName = canonicalNormalizedPersonName(input.full_name)
  const nameCompanyKey = canonicalNameCompanyKey(input.canonical_company_id, input.full_name)

  if (normalizedEmail) {
    const id = indexes.by_normalized_email.get(normalizedEmail)
    if (id) {
      return {
        person_id: id,
        resolution_method: "normalized_email",
        normalized_email: normalizedEmail,
        normalized_linkedin: normalizedLinkedIn,
        normalized_phone: normalizedPhone,
        name_company_key: nameCompanyKey,
        would_create_new: false,
      }
    }
  }

  if (normalizedLinkedIn) {
    const id = indexes.by_normalized_linkedin.get(normalizedLinkedIn)
    if (id) {
      return {
        person_id: id,
        resolution_method: "normalized_linkedin",
        normalized_email: normalizedEmail,
        normalized_linkedin: normalizedLinkedIn,
        normalized_phone: normalizedPhone,
        name_company_key: nameCompanyKey,
        would_create_new: false,
      }
    }
  }

  if (normalizedPhone) {
    const id = indexes.by_normalized_phone.get(normalizedPhone)
    if (id) {
      return {
        person_id: id,
        resolution_method: "normalized_phone",
        normalized_email: normalizedEmail,
        normalized_linkedin: normalizedLinkedIn,
        normalized_phone: normalizedPhone,
        name_company_key: nameCompanyKey,
        would_create_new: false,
      }
    }
  }

  if (nameCompanyKey) {
    const id = indexes.by_name_company.get(nameCompanyKey)
    if (id) {
      return {
        person_id: id,
        resolution_method: "name_company",
        normalized_email: normalizedEmail,
        normalized_linkedin: normalizedLinkedIn,
        normalized_phone: normalizedPhone,
        name_company_key: nameCompanyKey,
        would_create_new: false,
      }
    }
  }

  return {
    person_id: null,
    resolution_method: "new",
    normalized_email: normalizedEmail,
    normalized_linkedin: normalizedLinkedIn,
    normalized_phone: normalizedPhone,
    name_company_key: nameCompanyKey,
    would_create_new: true,
  }
}

export function resolutionConfidenceFromPersonMethod(
  method: GrowthCanonicalPersonResolutionMethod,
  candidateConfidence?: number,
): number {
  const base = methodConfidence(method)
  const cand = candidateConfidence ?? 0
  if (cand <= 0) return base
  return Math.min(1, Math.max(base, cand * 0.85))
}

export function registerNewCanonicalPersonFromCandidate(
  indexes: CanonicalPersonResolverIndexes,
  personId: string,
  input: GrowthCanonicalPersonCandidateInput,
  resolution: GrowthCanonicalPersonResolutionResult,
): void {
  registerCanonicalPersonInIndexes(indexes, personId, {
    normalized_email: resolution.normalized_email,
    normalized_linkedin: resolution.normalized_linkedin,
    normalized_phone: resolution.normalized_phone,
    canonical_company_id: input.canonical_company_id ?? null,
    normalized_name: canonicalNormalizedPersonName(input.full_name),
  })
}
