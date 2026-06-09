/** Apollo search query audit — evidence-only tier inspection and classification. Client-safe. */

import { buildApolloPeopleSearchParamsForTier, type ApolloSearchTier } from "@/lib/growth/providers/apollo/apollo-query-builder"
import {
  resolveApolloPersonMappingOutcome,
  type ApolloPersonMappingOutcome,
} from "@/lib/growth/providers/apollo/map-apollo-contact"
import type { ApolloPersonRecord, ApolloPersonSearchInput } from "@/lib/growth/providers/apollo/apollo-types"

export const APOLLO_SEARCH_QUERY_AUDIT_QA_MARKER = "apollo-search-query-audit-v1" as const

export const APOLLO_SEARCH_QUERY_AUDIT_COMPANY_NAMES = [
  "Medical Equipment Solutions",
  "A to Z Medical Equipment & Supplies LLC",
  "Next Level DME",
  "OMI MedTech",
  "MedTech AZ",
] as const

export type ApolloSearchQueryAuditClassification =
  | "NO_APOLLO_COVERAGE"
  | "WRONG_QUERY_STRATEGY"
  | "OVERLY_STRICT_MAPPING"
  | "COMPANY_MATCH_FAILURE"
  | "ENRICHMENT_FAILURE"

export type ApolloSearchQueryAuditPersonSample = {
  id: string | null
  name: string | null
  first_name: string | null
  last_name_obfuscated: string | null
  title: string | null
  headline: string | null
  email_status: string | null
  has_email: boolean | null
  seniority: string | null
  organization_name: string | null
  organization_domain: string | null
  organization_website: string | null
  city: string | null
  state: string | null
}

export type ApolloSearchQueryAuditPersonMappingRow = {
  name: string | null
  title: string | null
  company: string | null
  linkedin: string | null
  email_status: string | null
  accepted: boolean
  rejection_reason: string | null
}

export type ApolloSearchQueryAuditTierEvidence = {
  tier: ApolloSearchTier
  request_payload: Record<string, unknown>
  apollo_response_status: string
  apollo_message: string | null
  apollo_people_count: number
  apollo_total_matches: number | null
  first_5_raw_people: ApolloSearchQueryAuditPersonSample[]
  mapped_contacts: number
  mapping_rejections: number
  rejection_reasons: Record<string, number>
}

export type ApolloSearchQueryAuditCompanyReport = {
  qa_marker: typeof APOLLO_SEARCH_QUERY_AUDIT_QA_MARKER
  company_name: string
  company_candidate_id: string | null
  domain: string | null
  tier_1: ApolloSearchQueryAuditTierEvidence
  tier_2: ApolloSearchQueryAuditTierEvidence
  tier_3: ApolloSearchQueryAuditTierEvidence
  mapping_audit: ApolloSearchQueryAuditPersonMappingRow[]
  classification: ApolloSearchQueryAuditClassification
  classification_rationale: string
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  return null
}

function normalizeOrgToken(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/^www\./i, "")
}

function resolvePersonDisplayName(person: ApolloPersonRecord): string | null {
  const fromParts = [asTrimmedString(person.first_name), asTrimmedString(person.last_name)]
    .filter(Boolean)
    .join(" ")
  return (
    asTrimmedString(person.name) ??
    (fromParts || null) ??
    asTrimmedString(person.first_name)
  )
}

export function redactApolloPersonForAuditSample(person: ApolloPersonRecord): ApolloSearchQueryAuditPersonSample {
  const org = person.organization
  return {
    id: asTrimmedString(person.id),
    name: asTrimmedString(person.name),
    first_name: asTrimmedString(person.first_name),
    last_name_obfuscated: asTrimmedString(person.last_name_obfuscated),
    title: asTrimmedString(person.title),
    headline: asTrimmedString(person.headline),
    email_status: asTrimmedString(person.email_status),
    has_email: person.has_email ?? null,
    seniority: asTrimmedString(person.seniority),
    organization_name: asTrimmedString(org?.name),
    organization_domain: asTrimmedString(org?.primary_domain),
    organization_website: asTrimmedString(org?.website_url),
    city: asTrimmedString(person.city),
    state: asTrimmedString(person.state),
  }
}

export function personOrganizationMatchesTarget(
  person: ApolloPersonRecord,
  targetDomain: string | null,
  targetCompanyName: string,
): boolean | null {
  const orgDomain = normalizeOrgToken(person.organization?.primary_domain)
  const orgName = normalizeOrgToken(person.organization?.name)
  if (!orgDomain && !orgName) return null

  const targetDomainNorm = normalizeOrgToken(targetDomain)
  if (targetDomainNorm && orgDomain) {
    if (
      orgDomain === targetDomainNorm ||
      orgDomain.endsWith(`.${targetDomainNorm}`) ||
      targetDomainNorm.endsWith(`.${orgDomain}`)
    ) {
      return true
    }
  }

  const targetNameNorm = targetCompanyName.trim().toLowerCase()
  if (targetNameNorm && orgName) {
    const simplify = (value: string) => value.replace(/[^a-z0-9]/g, "")
    const targetToken = simplify(targetNameNorm).slice(0, 12)
    const orgToken = simplify(orgName)
    if (targetToken.length >= 6 && orgToken.includes(targetToken)) return true
    if (orgName.includes(targetNameNorm.slice(0, Math.min(14, targetNameNorm.length)))) return true
  }

  if (targetDomainNorm && orgDomain && orgDomain !== targetDomainNorm) return false
  if (targetNameNorm && orgName && !orgName.includes(targetNameNorm.slice(0, 8))) return false
  return null
}

export function buildApolloPersonMappingAuditRow(
  person: ApolloPersonRecord,
  input: { company_name: string; domain: string | null; mock: boolean },
): ApolloSearchQueryAuditPersonMappingRow {
  const linkedin = asTrimmedString(person.linkedin_url)
  const outcome: ApolloPersonMappingOutcome = resolveApolloPersonMappingOutcome(person, input)
  return {
    name: resolvePersonDisplayName(person),
    title: asTrimmedString(person.title) ?? asTrimmedString(person.headline),
    company: asTrimmedString(person.organization?.name),
    linkedin: linkedin && /linkedin\.com/i.test(linkedin) ? linkedin : null,
    email_status: asTrimmedString(person.email_status),
    accepted: outcome.accepted,
    rejection_reason: outcome.rejection_reason,
  }
}

export function auditApolloPeopleMapping(input: {
  people: ApolloPersonRecord[]
  company_name: string
  domain: string | null
  mock: boolean
}): ApolloSearchQueryAuditPersonMappingRow[] {
  return input.people.map((person) =>
    buildApolloPersonMappingAuditRow(person, {
      company_name: input.company_name,
      domain: input.domain,
      mock: input.mock,
    }),
  )
}

export function buildApolloSearchQueryAuditTierEvidence(input: {
  tier: ApolloSearchTier
  search_input: ApolloPersonSearchInput
  apollo_response_status: string
  apollo_message: string | null
  people: ApolloPersonRecord[]
  apollo_total_matches: number | null
  mock: boolean
}): ApolloSearchQueryAuditTierEvidence {
  const built = buildApolloPeopleSearchParamsForTier(input.search_input, input.tier)
  const mapping = auditApolloPeopleMapping({
    people: input.people,
    company_name: input.search_input.company_name,
    domain: built.domain,
    mock: input.mock,
  })
  const rejection_reasons: Record<string, number> = {}
  for (const row of mapping) {
    if (row.accepted || !row.rejection_reason) continue
    rejection_reasons[row.rejection_reason] = (rejection_reasons[row.rejection_reason] ?? 0) + 1
  }

  return {
    tier: input.tier,
    request_payload: built.request_payload,
    apollo_response_status: input.apollo_response_status,
    apollo_message: input.apollo_message,
    apollo_people_count: input.people.length,
    apollo_total_matches: input.apollo_total_matches,
    first_5_raw_people: input.people.slice(0, 5).map(redactApolloPersonForAuditSample),
    mapped_contacts: mapping.filter((row) => row.accepted).length,
    mapping_rejections: mapping.filter((row) => !row.accepted).length,
    rejection_reasons,
  }
}

function dedupePeopleById(people: ApolloPersonRecord[]): ApolloPersonRecord[] {
  const seen = new Set<string>()
  const unique: ApolloPersonRecord[] = []
  for (const person of people) {
    const id = asTrimmedString(person.id)
    const key = id ?? JSON.stringify(redactApolloPersonForAuditSample(person))
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(person)
  }
  return unique
}

export function classifyApolloSearchQueryAudit(input: {
  tier_evidence: ApolloSearchQueryAuditTierEvidence[]
  mapping_audit: ApolloSearchQueryAuditPersonMappingRow[]
  people: ApolloPersonRecord[]
  target_domain: string | null
  target_company_name: string
}): { classification: ApolloSearchQueryAuditClassification; rationale: string } {
  const uniquePeople = dedupePeopleById(input.people)
  const totalRaw = uniquePeople.length
  const acceptedCount = input.mapping_audit.filter((row) => row.accepted).length

  if (totalRaw === 0) {
    return {
      classification: "NO_APOLLO_COVERAGE",
      rationale: "All three tiers returned zero Apollo people (HTTP success with empty result sets).",
    }
  }

  const orgMatchResults = uniquePeople.map((person) =>
    personOrganizationMatchesTarget(person, input.target_domain, input.target_company_name),
  )
  const explicitMismatch = orgMatchResults.filter((value) => value === false).length
  const explicitMatch = orgMatchResults.filter((value) => value === true).length

  const tier1 = input.tier_evidence.find((row) => row.tier === 1)
  const tier2 = input.tier_evidence.find((row) => row.tier === 2)

  if (
    (tier1?.apollo_people_count ?? 0) === 0 &&
    (tier2?.apollo_people_count ?? 0) > 0 &&
    explicitMismatch > 0 &&
    explicitMatch === 0
  ) {
    return {
      classification: "WRONG_QUERY_STRATEGY",
      rationale:
        "Domain-exact tier returned zero people while company-name tier returned people from unrelated organizations.",
    }
  }

  if (explicitMismatch >= Math.ceil(totalRaw * 0.5) && explicitMatch === 0) {
    return {
      classification: "COMPANY_MATCH_FAILURE",
      rationale:
        "Apollo returned people but organization domain/name does not match the Equipify company identity.",
    }
  }

  const rejectionCounts: Record<string, number> = {}
  for (const row of input.mapping_audit) {
    if (row.accepted || !row.rejection_reason) continue
    rejectionCounts[row.rejection_reason] = (rejectionCounts[row.rejection_reason] ?? 0) + 1
  }

  const enrichmentSignals =
    (rejectionCounts.map_failed ?? 0) +
    (rejectionCounts.missing_full_name ?? 0) +
    (rejectionCounts.name_not_plausible ?? 0) +
    Object.entries(rejectionCounts)
      .filter(([reason]) => reason.startsWith("identity_"))
      .reduce((sum, [, count]) => sum + count, 0)

  const hasEmailWithoutMapped =
    uniquePeople.some((person) => person.has_email === true) && acceptedCount === 0

  if (enrichmentSignals >= Math.ceil(totalRaw * 0.5) && hasEmailWithoutMapped) {
    return {
      classification: "ENRICHMENT_FAILURE",
      rationale:
        "Apollo returned people with identity/email signals but mapping rejected them before enrichment could resolve contact channels.",
    }
  }

  if (acceptedCount === 0) {
    const dominantReason = Object.entries(rejectionCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
    return {
      classification: "OVERLY_STRICT_MAPPING",
      rationale:
        dominantReason != null
          ? `Apollo returned ${totalRaw} people but mapping rejected all of them (dominant reason: ${dominantReason}).`
          : `Apollo returned ${totalRaw} people but mapping rejected all of them.`,
    }
  }

  if ((tier1?.apollo_people_count ?? 0) === 0 && (tier2?.apollo_people_count ?? 0) === 0) {
    return {
      classification: "WRONG_QUERY_STRATEGY",
      rationale:
        "Domain and company-name tiers returned zero people while a broader tier returned matches, indicating restrictive query parameters.",
    }
  }

  return {
    classification: "OVERLY_STRICT_MAPPING",
    rationale: `Apollo returned ${totalRaw} people with ${acceptedCount} mapped; residual blocker likely mapping filters.`,
  }
}

export function buildApolloSearchQueryAuditCompanyReport(input: {
  company_name: string
  company_candidate_id: string | null
  domain: string | null
  tier_evidence: ApolloSearchQueryAuditTierEvidence[]
  people: ApolloPersonRecord[]
  mapping_audit: ApolloSearchQueryAuditPersonMappingRow[]
}): ApolloSearchQueryAuditCompanyReport {
  const tier1 = input.tier_evidence.find((row) => row.tier === 1)!
  const tier2 = input.tier_evidence.find((row) => row.tier === 2)!
  const tier3 = input.tier_evidence.find((row) => row.tier === 3)!
  const { classification, rationale } = classifyApolloSearchQueryAudit({
    tier_evidence: input.tier_evidence,
    mapping_audit: input.mapping_audit,
    people: input.people,
    target_domain: input.domain,
    target_company_name: input.company_name,
  })

  return {
    qa_marker: APOLLO_SEARCH_QUERY_AUDIT_QA_MARKER,
    company_name: input.company_name,
    company_candidate_id: input.company_candidate_id,
    domain: input.domain,
    tier_1: tier1,
    tier_2: tier2,
    tier_3: tier3,
    mapping_audit: input.mapping_audit,
    classification,
    classification_rationale: rationale,
  }
}
