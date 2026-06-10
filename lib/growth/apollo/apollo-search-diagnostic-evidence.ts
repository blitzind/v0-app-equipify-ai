/** Apollo search diagnostic evidence — safe person summaries and tier compact views. Client-safe. */

import type {
  ApolloMapperRejectionPersonSample,
  ApolloSearchTierAttemptEvidence,
} from "@/lib/growth/providers/apollo/apollo-tiered-people-search-types"
import type { ApolloSearchTier } from "@/lib/growth/providers/apollo/apollo-query-builder"
import {
  resolveApolloPersonMappingOutcome,
  type ApolloPeopleMappingContext,
} from "@/lib/growth/providers/apollo/map-apollo-contact"
import type { ApolloPersonRecord } from "@/lib/growth/providers/apollo/apollo-types"

export const APOLLO_SEARCH_DIAGNOSTIC_EVIDENCE_QA_MARKER = "apollo-search-diagnostic-evidence-v1" as const

export type { ApolloMapperRejectionPersonSample } from "@/lib/growth/providers/apollo/apollo-tiered-people-search-types"

export type ApolloMapperRejectionEvidence = {
  qa_marker: typeof APOLLO_SEARCH_DIAGNOSTIC_EVIDENCE_QA_MARKER
  tier: number | null
  tier_name: string | null
  raw_people_count: number
  mapped_people_count: number
  rejection_reasons: Record<string, number>
  rejected_people: ApolloMapperRejectionPersonSample[]
}

export type ApolloTierAttemptCompactSummary = {
  tier: number
  tier_name: string
  query_type: string
  request_payload_summary: string | null
  domain: string | null
  company_name: string | null
  location: string | null
  titles_count: number
  raw_count: number
  mapped_count: number
  partial_identity_count: number
  skipped_reason: string | null
  rejection_reasons: Record<string, number>
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  return null
}

function resolvePersonDisplayName(person: ApolloPersonRecord): string | null {
  const fromParts = [asTrimmedString(person.first_name), asTrimmedString(person.last_name)]
    .filter(Boolean)
    .join(" ")
  return asTrimmedString(person.name) ?? (fromParts || null) ?? asTrimmedString(person.first_name)
}

export function buildApolloMapperRejectionPersonSample(
  person: ApolloPersonRecord,
  input: {
    accepted: boolean
    rejection_reason: string | null
  },
): ApolloMapperRejectionPersonSample {
  const org = person.organization
  const linkedin = asTrimmedString(person.linkedin_url)
  return {
    name: resolvePersonDisplayName(person),
    title: asTrimmedString(person.title) ?? asTrimmedString(person.headline),
    organization_name: asTrimmedString(org?.name),
    organization_domain: asTrimmedString(org?.primary_domain),
    city: asTrimmedString(person.city),
    state: asTrimmedString(person.state),
    linkedin_url: linkedin && /linkedin\.com/i.test(linkedin) ? linkedin : null,
    email_status: asTrimmedString(person.email_status),
    accepted: input.accepted,
    rejection_reason: input.rejection_reason,
  }
}

export function auditApolloPeopleMappingDetailed(input: {
  people: ApolloPersonRecord[]
  company_name: string
  domain: string | null
  mock: boolean
  city?: string | null
  state?: string | null
  search_tier?: number | null
  mapping_policy?: ApolloPeopleMappingContext["mapping_policy"]
}): {
  samples: ApolloMapperRejectionPersonSample[]
  rejection_reasons: Record<string, number>
  mapped_count: number
} {
  const mappingContext: ApolloPeopleMappingContext = {
    company_name: input.company_name,
    domain: input.domain,
    mock: input.mock,
    city: input.city,
    state: input.state,
    search_tier: input.search_tier ?? null,
    mapping_policy: input.mapping_policy ?? null,
  }

  const rejection_reasons: Record<string, number> = {}
  const samples: ApolloMapperRejectionPersonSample[] = []
  let mapped_count = 0

  for (const person of input.people) {
    const outcome = resolveApolloPersonMappingOutcome(person, mappingContext)
    if (outcome.accepted) mapped_count += 1
    if (outcome.rejection_reason) {
      rejection_reasons[outcome.rejection_reason] =
        (rejection_reasons[outcome.rejection_reason] ?? 0) + 1
    }
    samples.push(
      buildApolloMapperRejectionPersonSample(person, {
        accepted: outcome.accepted,
        rejection_reason: outcome.rejection_reason,
      }),
    )
  }

  return { samples, rejection_reasons, mapped_count }
}

export function buildApolloMapperRejectionEvidenceFromTierAttempts(
  tier_attempts: ApolloSearchTierAttemptEvidence[],
): ApolloMapperRejectionEvidence | null {
  const candidates = tier_attempts.filter(
    (attempt) => attempt.raw_contacts_returned > 0 && attempt.mapper_rejection_samples.length > 0,
  )
  const attempt =
    candidates.sort((left, right) => right.raw_contacts_returned - left.raw_contacts_returned)[0] ??
    tier_attempts.find((row) => row.raw_contacts_returned > 0) ??
    null

  if (!attempt) return null

  const rejected_people = attempt.mapper_rejection_samples.filter((row) => !row.accepted)
  if (rejected_people.length === 0 && attempt.mapped_contacts > 0) return null

  return {
    qa_marker: APOLLO_SEARCH_DIAGNOSTIC_EVIDENCE_QA_MARKER,
    tier: attempt.tier,
    tier_name: attempt.tier_name,
    raw_people_count: attempt.raw_contacts_returned,
    mapped_people_count: attempt.mapped_contacts,
    rejection_reasons: attempt.rejection_reasons,
    rejected_people,
  }
}

function inferQueryType(attempt: ApolloSearchTierAttemptEvidence): string {
  if (attempt.skipped_reason?.startsWith("skipped:")) {
    return attempt.skipped_reason.replace(/^skipped:/, "")
  }
  if (attempt.request_payload.q_organization_domains_list) return "domain"
  if (attempt.request_payload.q_organization_name) return "company_name"
  return "unknown"
}

export function buildApolloTierAttemptCompactSummary(
  attempt: ApolloSearchTierAttemptEvidence,
): ApolloTierAttemptCompactSummary {
  return {
    tier: attempt.tier,
    tier_name: attempt.tier_name,
    query_type: inferQueryType(attempt),
    request_payload_summary: attempt.request_payload_summary || null,
    domain: attempt.company_domain,
    company_name: attempt.company_name || null,
    location: attempt.organization_location,
    titles_count: attempt.person_titles.length,
    raw_count: attempt.raw_contacts_returned,
    mapped_count: attempt.mapped_contacts,
    partial_identity_count: attempt.mapped_partial_identity_contacts ?? 0,
    skipped_reason: attempt.skipped_reason,
    rejection_reasons: attempt.rejection_reasons,
  }
}

export function buildApolloTierAttemptsCompactSummaries(
  tier_attempts: ApolloSearchTierAttemptEvidence[],
): ApolloTierAttemptCompactSummary[] {
  return tier_attempts.map(buildApolloTierAttemptCompactSummary)
}

export function summarizeApolloSearchOutcomes(
  companies: Array<{ acquisition_evidence?: { search_outcome?: string | null } | null }>,
): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const company of companies) {
    const outcome = company.acquisition_evidence?.search_outcome ?? "unknown"
    counts[outcome] = (counts[outcome] ?? 0) + 1
  }
  return counts
}

export function buildApolloMapperRejectionSamplesForTier(input: {
  people: ApolloPersonRecord[]
  company_name: string
  domain: string | null
  mock: boolean
  city?: string | null
  state?: string | null
  tier: ApolloSearchTier
}): ApolloMapperRejectionPersonSample[] {
  const mappingPolicy = resolveApolloTierMappingPolicy(input.tier, {
    domain: input.domain,
    state: input.state ?? null,
  })
  return auditApolloPeopleMappingDetailed({
    people: input.people,
    company_name: input.company_name,
    domain: input.domain,
    mock: input.mock,
    city: input.city,
    state: input.state,
    search_tier: input.tier,
    mapping_policy: mappingPolicy,
  }).samples
}
