/** Contact-native index entity — primary people-first search dataset. Client-safe. */

import type { ProspectSearchContactOverlay } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence-types"
import type {
  GrowthProspectSearchCompanyResult,
  GrowthProspectSearchIndexPerson,
  GrowthProspectSearchPersonResult,
} from "@/lib/growth/prospect-search/prospect-search-types"

export const GROWTH_CONTACT_NATIVE_SEARCH_QA_MARKER = "growth-contact-native-search-v1" as const

export type ProspectSearchContactNativeIndexRecord = {
  qa_marker: typeof GROWTH_CONTACT_NATIVE_SEARCH_QA_MARKER
  identity_key: string
  contact_id: string
  normalized_full_name: string | null
  company_id: string
  company_name: string
  company_domain: string | null
  source_type: string
  title: string | null
  department: string | null
  seniority: string | null
  branch_location: string | null
  verified_emails: string[]
  verified_phones: string[]
  linkedin_refs: string[]
  confidence: number
  freshness_at: string | null
  verification_state: string
  contactability_score: number
  reachable_human_score: number
  queue_eligible: boolean
  enrichment_tier: "tier_1" | "tier_2" | "tier_3" | "tier_4"
  relationship_memory_ref: string | null
}

function normalizeDomain(website: string | null | undefined): string | null {
  if (!website?.trim()) return null
  try {
    const url = website.includes("://") ? new URL(website) : new URL(`https://${website}`)
    return url.hostname.replace(/^www\./, "").toLowerCase()
  } catch {
    return website.trim().replace(/^https?:\/\//, "").split("/")[0]?.toLowerCase() ?? null
  }
}

function contactIdentityKey(input: {
  contact_id: string
  company_id: string
  email?: string | null
}): string {
  const email = input.email?.trim().toLowerCase()
  if (email) return `email:${email}`
  return `contact:${input.company_id}:${input.contact_id}`
}

export function buildContactNativeIndexFromOverlay(input: {
  contact: ProspectSearchContactOverlay
  company: GrowthProspectSearchCompanyResult
}): ProspectSearchContactNativeIndexRecord {
  const { contact, company } = input
  const verification = (contact.verification_status ?? "pending").toLowerCase()
  const verifiedEmail =
    contact.email &&
    (verification.includes("verified") ||
      (contact.email_verification_depth ?? "").includes("published"))
      ? [contact.email]
      : []
  const verifiedPhone =
    contact.phone &&
    (verification.includes("phone") ||
      verification.includes("verified_channels") ||
      (contact.phone_verification_depth ?? "").includes("published"))
      ? [contact.phone]
      : []

  const reachable = company.reachable_human?.score ?? Math.round(contact.confidence * 100)
  const contactability = Math.round(
    verifiedEmail.length * 30 +
      verifiedPhonesScore(verifiedPhone.length) +
      (contact.name ? 20 : 0) +
      contact.confidence * 20,
  )

  return {
    qa_marker: GROWTH_CONTACT_NATIVE_SEARCH_QA_MARKER,
    identity_key: contact.contact_identity_key ?? contactIdentityKey({ contact_id: contact.id, company_id: company.id, email: contact.email }),
    contact_id: contact.id,
    normalized_full_name: contact.name?.trim().toLowerCase() ?? null,
    company_id: company.id,
    company_name: company.company_name,
    company_domain: normalizeDomain(company.website),
    source_type: company.source_type,
    title: contact.title ?? null,
    department: contact.role_type ?? null,
    seniority: null,
    branch_location: [contact.branch_city, contact.branch_state].filter(Boolean).join(", ") || null,
    verified_emails: verifiedEmail,
    verified_phones: verifiedPhone,
    linkedin_refs: contact.linkedin_url ? [contact.linkedin_url] : [],
    confidence: contact.confidence,
    freshness_at: contact.last_checked_at ?? contact.last_verified_at ?? null,
    verification_state: contact.verification_status ?? "pending",
    contactability_score: Math.min(100, contactability),
    reachable_human_score: reachable,
    queue_eligible: contact.outreach_ready === true,
    enrichment_tier: contactability >= 70 ? "tier_3" : contactability >= 40 ? "tier_2" : "tier_1",
    relationship_memory_ref: company.growth_lead_id ?? null,
  }
}

function verifiedPhonesScore(count: number): number {
  if (count <= 0) return 0
  return 25
}

export function buildContactNativeIndexFromIndexPerson(input: {
  person: GrowthProspectSearchIndexPerson | GrowthProspectSearchPersonResult
  company?: Pick<GrowthProspectSearchCompanyResult, "id" | "company_name" | "website" | "source_type"> | null
}): ProspectSearchContactNativeIndexRecord {
  const { person, company } = input
  const verification = (person.verification_status ?? "pending").toLowerCase()
  const hasVerifiedChannel = verification.includes("verified")

  return {
    qa_marker: GROWTH_CONTACT_NATIVE_SEARCH_QA_MARKER,
    identity_key: contactIdentityKey({
      contact_id: person.id,
      company_id: person.company_id,
      email: person.email,
    }),
    contact_id: person.id,
    normalized_full_name: person.full_name?.trim().toLowerCase() ?? null,
    company_id: person.company_id,
    company_name: person.company_name,
    company_domain: normalizeDomain(company?.website ?? null),
    source_type: person.source_type,
    title: person.title ?? null,
    department: person.role ?? null,
    seniority: null,
    branch_location: null,
    verified_emails: person.email && hasVerifiedChannel ? [person.email] : [],
    verified_phones: person.phone && hasVerifiedChannel ? [person.phone] : [],
    linkedin_refs: [],
    confidence: "rank_score" in person ? person.rank_score : 0.5,
    freshness_at: null,
    verification_state: person.verification_status,
    contactability_score: Math.round(
      (person.email ? 20 : 0) + (person.phone ? 20 : 0) + (person.full_name ? 15 : 0),
    ),
    reachable_human_score: hasVerifiedChannel ? 55 : 25,
    queue_eligible: hasVerifiedChannel,
    enrichment_tier: "tier_1",
    relationship_memory_ref: null,
  }
}

export function buildContactNativeIndexRecordsFromCompanies(
  companies: GrowthProspectSearchCompanyResult[],
): ProspectSearchContactNativeIndexRecord[] {
  const records: ProspectSearchContactNativeIndexRecord[] = []
  for (const company of companies) {
    for (const contact of company.contact_intelligence?.contacts ?? []) {
      if (!contact.name?.trim()) continue
      records.push(buildContactNativeIndexFromOverlay({ contact, company }))
    }
  }
  return records
}
