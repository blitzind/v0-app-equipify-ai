/** Prospect Search — post-hydration filters on Growth Engine intelligence (7.PS-B). Client-safe. */

import type { GrowthCompanyIntelligenceCategory } from "@/lib/growth/company-intelligence/company-intelligence-types"
import type { GrowthBuyingCommitteeIntelligenceRole } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-types"
import type { GrowthProspectSearchPeopleResultRow } from "@/lib/growth/prospect-search/prospect-search-contact-discovery"
import type { GrowthProspectSearchEngineIntelligence } from "@/lib/growth/prospect-search/prospect-search-engine-intelligence-types"
import type {
  GrowthProspectSearchCompanyResult,
  GrowthProspectSearchFilters,
} from "@/lib/growth/prospect-search/prospect-search-types"

export type GrowthProspectSearchEngineIntelligenceSummary = {
  headline: string
  detail: string | null
  has_verified_company_intelligence: boolean
  verified_email_count: number
  verified_phone_count: number
  verified_profile_count: number
  committee_verified_count: number
  discovery_status_label: string
}

function engineIntel(
  company: Pick<GrowthProspectSearchCompanyResult, "contact_intelligence">,
): GrowthProspectSearchEngineIntelligence | null | undefined {
  return company.contact_intelligence?.engine_intelligence ?? null
}

export function hasActiveProspectSearchEngineIntelligenceFilters(
  filters: GrowthProspectSearchFilters,
): boolean {
  if (filters.engine_verified_email) return true
  if (filters.engine_verified_phone) return true
  if (filters.engine_verified_profile) return true
  if ((filters.buying_committee_roles?.length ?? 0) > 0) return true
  if ((filters.company_intelligence_categories?.length ?? 0) > 0) return true
  return false
}

export function companyMatchesProspectSearchEngineIntelligenceFilters(
  company: Pick<GrowthProspectSearchCompanyResult, "contact_intelligence">,
  filters: GrowthProspectSearchFilters,
): boolean {
  if (!hasActiveProspectSearchEngineIntelligenceFilters(filters)) return true

  const engine = engineIntel(company)
  if (!engine?.has_canonical_company) return false

  const channels = engine.verified_channels
  const committee = engine.buying_committee
  const companyIntel = engine.company_intelligence

  if (filters.engine_verified_email && !(channels?.persons_with_verified_email ?? 0)) {
    return false
  }
  if (filters.engine_verified_phone && !(channels?.persons_with_verified_phone ?? 0)) {
    return false
  }
  if (filters.engine_verified_profile && !(channels?.persons_with_verified_profile ?? 0)) {
    return false
  }

  const roleFilter = filters.buying_committee_roles ?? []
  if (roleFilter.length > 0) {
    const present = new Set((committee?.roles_present ?? []).map((r) => String(r)))
    const anyRole = roleFilter.some((role) => present.has(role))
    if (!anyRole) return false
  }

  const categoryFilter = filters.company_intelligence_categories ?? []
  if (categoryFilter.length > 0) {
    const present = new Set((companyIntel?.categories_present ?? []).map((c) => String(c)))
    const anyCategory = categoryFilter.some((cat) => present.has(cat))
    if (!anyCategory) return false
  }

  return true
}

function resolveProspectSearchPeopleRowCanonicalPersonId(
  row: Pick<GrowthProspectSearchPeopleResultRow, "contact_id" | "company">,
): string {
  const contacts = row.company.contact_intelligence?.contacts ?? []
  const contact = contacts.find((c) => c.id === row.contact_id)
  return (contact?.canonical_person_id ?? "").trim()
}

export function personMatchesProspectSearchEngineIntelligenceFilters(
  row: Pick<GrowthProspectSearchPeopleResultRow, "contact_id" | "company">,
  filters: GrowthProspectSearchFilters,
): boolean {
  if (!hasActiveProspectSearchEngineIntelligenceFilters(filters)) return true
  if (!companyMatchesProspectSearchEngineIntelligenceFilters(row.company, filters)) {
    return false
  }

  const engine = engineIntel(row.company)
  const channels = engine?.verified_channels
  const personId = resolveProspectSearchPeopleRowCanonicalPersonId(row)
  const personChannels = personId ? channels?.by_person_id?.[personId] : null

  if (filters.engine_verified_email && !personChannels?.has_verified_email) return false
  if (filters.engine_verified_phone && !personChannels?.has_verified_phone) return false
  if (filters.engine_verified_profile && !personChannels?.has_verified_profile) return false

  const roleFilter = filters.buying_committee_roles ?? []
  if (roleFilter.length > 0 && personId) {
    const member = engine?.buying_committee?.members?.find((m) => m.person_id === personId)
    if (!member || !roleFilter.includes(member.committee_role as GrowthBuyingCommitteeIntelligenceRole)) {
      return false
    }
  }

  return true
}

export function filterProspectSearchCompaniesByEngineIntelligence<
  T extends GrowthProspectSearchCompanyResult,
>(companies: T[], filters: GrowthProspectSearchFilters): T[] {
  if (!hasActiveProspectSearchEngineIntelligenceFilters(filters)) return companies
  return companies.filter((row) => companyMatchesProspectSearchEngineIntelligenceFilters(row, filters))
}

export function filterProspectSearchPeopleByEngineIntelligence(
  rows: GrowthProspectSearchPeopleResultRow[],
  filters: GrowthProspectSearchFilters,
): GrowthProspectSearchPeopleResultRow[] {
  if (!hasActiveProspectSearchEngineIntelligenceFilters(filters)) return rows
  return rows.filter((row) => personMatchesProspectSearchEngineIntelligenceFilters(row, filters))
}

export function buildProspectSearchEngineIntelligenceSummary(
  company: Pick<GrowthProspectSearchCompanyResult, "contact_intelligence" | "company_name">,
): GrowthProspectSearchEngineIntelligenceSummary | null {
  const engine = engineIntel(company)
  if (!engine?.has_canonical_company) return null

  const channels = engine.verified_channels
  const committee = engine.buying_committee
  const companyIntel = engine.company_intelligence

  const parts: string[] = []
  if (companyIntel?.has_verified_intelligence) {
    parts.push(`${companyIntel.categories_present.length} intel categories`)
  } else if (companyIntel?.discovery_status) {
    parts.push(`Company intel: ${companyIntel.discovery_status.replace(/_/g, " ")}`)
  }
  if ((committee?.verified_member_count ?? 0) > 0) {
    parts.push(`${committee!.verified_member_count} committee`)
  }
  if ((channels?.persons_with_verified_email ?? 0) > 0) {
    parts.push(`${channels!.persons_with_verified_email} emails`)
  }
  if ((channels?.persons_with_verified_phone ?? 0) > 0) {
    parts.push(`${channels!.persons_with_verified_phone} phones`)
  }
  if ((channels?.persons_with_verified_profile ?? 0) > 0) {
    parts.push(`${channels!.persons_with_verified_profile} profiles`)
  }

  const headline =
    parts.length > 0
      ? `Growth Engine: ${parts.join(" · ")}`
      : "AI OS: canonical company linked — no verified intelligence yet"

  return {
    headline,
    detail:
      committee?.single_thread_risk && (committee.verified_member_count ?? 0) > 0
        ? "Single-thread risk — expand verified committee coverage before outreach."
        : null,
    has_verified_company_intelligence: Boolean(companyIntel?.has_verified_intelligence),
    verified_email_count: channels?.persons_with_verified_email ?? 0,
    verified_phone_count: channels?.persons_with_verified_phone ?? 0,
    verified_profile_count: channels?.persons_with_verified_profile ?? 0,
    committee_verified_count: committee?.verified_member_count ?? 0,
    discovery_status_label: companyIntel?.discovery_status ?? "none",
  }
}

export type GrowthProspectSearchPersonEngineChannelBadges = {
  verified_email: boolean
  verified_phone: boolean
  verified_profile: boolean
  committee_role: string | null
}

export function resolveProspectSearchPersonEngineChannelBadges(
  row: Pick<GrowthProspectSearchPeopleResultRow, "contact_id" | "company">,
): GrowthProspectSearchPersonEngineChannelBadges {
  const engine = engineIntel(row.company)
  const personId = resolveProspectSearchPeopleRowCanonicalPersonId(row)
  const channels = personId ? engine?.verified_channels?.by_person_id?.[personId] : null
  const member = personId
    ? engine?.buying_committee?.members?.find((m) => m.person_id === personId)
    : null

  return {
    verified_email: Boolean(channels?.has_verified_email),
    verified_phone: Boolean(channels?.has_verified_phone),
    verified_profile: Boolean(channels?.has_verified_profile),
    committee_role: member ? String(member.committee_role) : null,
  }
}
