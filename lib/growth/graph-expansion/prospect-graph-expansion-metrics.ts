/** Phase 7.PS-HS — Prospect graph expansion metrics (server + client-safe builders). */

import type { SupabaseClient } from "@supabase/supabase-js"
import { isGenericIdentityName } from "@/lib/growth/human-identity-evidence/human-identity-evidence-evidence"
import {
  GROWTH_PROSPECT_GRAPH_EXPANSION_QA_MARKER,
  GROWTH_PROSPECT_SOURCE_TYPES,
  type GrowthProspectGraphExpansionMetrics,
  type GrowthProspectSourceType,
} from "@/lib/growth/graph-expansion/prospect-graph-expansion-types"
import { resolveProspectSourceRefreshCadenceMs } from "@/lib/growth/graph-expansion/prospect-source-registry"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0
  return Math.round((numerator / denominator) * 100)
}

function mapCompanyContactSourceToProspectSource(source_type: string): GrowthProspectSourceType | null {
  switch (source_type) {
    case "website":
      return "website"
    case "team_page":
      return "team_page"
    case "contact_page":
      return "contact_page"
    case "public_record":
      return "directory"
    default:
      return null
  }
}

function mapPageTypeToProspectSource(page_type: string | null | undefined): GrowthProspectSourceType | null {
  switch (page_type) {
    case "team":
    case "staff":
      return "team_page"
    case "leadership":
      return "leadership_page"
    case "contact":
    case "locations":
    case "branch":
      return "contact_page"
    case "about":
      return "website"
    default:
      return null
  }
}

export function buildEmptyProspectGraphExpansionMetrics(): GrowthProspectGraphExpansionMetrics {
  const source_attribution = Object.fromEntries(
    GROWTH_PROSPECT_SOURCE_TYPES.map((t) => [t, 0]),
  ) as Partial<Record<GrowthProspectSourceType, number>>

  return {
    companies_total: 0,
    companies_with_website: 0,
    persons_total: 0,
    named_persons_total: 0,
    titles_total: 0,
    verified_emails_total: 0,
    verified_phones_total: 0,
    verified_profiles_total: 0,
    committee_members_verified: 0,
    named_person_density_pct: 0,
    committee_density_pct: 0,
    source_attribution,
    evidence_freshness: { fresh_sources: 0, stale_sources: 0, unknown_sources: 0 },
  }
}

export function diffProspectGraphExpansionMetrics(
  before: GrowthProspectGraphExpansionMetrics,
  after: GrowthProspectGraphExpansionMetrics,
): Partial<GrowthProspectGraphExpansionMetrics> {
  return {
    companies_total: after.companies_total - before.companies_total,
    persons_total: after.persons_total - before.persons_total,
    named_persons_total: after.named_persons_total - before.named_persons_total,
    titles_total: after.titles_total - before.titles_total,
    verified_emails_total: after.verified_emails_total - before.verified_emails_total,
    verified_phones_total: after.verified_phones_total - before.verified_phones_total,
    verified_profiles_total: after.verified_profiles_total - before.verified_profiles_total,
    committee_members_verified: after.committee_members_verified - before.committee_members_verified,
    named_person_density_pct: after.named_person_density_pct - before.named_person_density_pct,
    committee_density_pct: after.committee_density_pct - before.committee_density_pct,
  }
}

export async function loadProspectGraphExpansionMetrics(
  admin: SupabaseClient,
  input: {
    company_ids?: string[]
    industry_contains?: string | null
    limit?: number
  } = {},
): Promise<{ qa_marker: typeof GROWTH_PROSPECT_GRAPH_EXPANSION_QA_MARKER; metrics: GrowthProspectGraphExpansionMetrics }> {
  const metrics = buildEmptyProspectGraphExpansionMetrics()
  const limit = input.limit ?? 500
  const industryFilter = (input.industry_contains ?? "").trim().toLowerCase()

  let companyIds = [...(input.company_ids ?? [])]

  if (companyIds.length === 0) {
    let query = admin
      .schema("growth")
      .from("companies")
      .select("id, website, primary_domain, industry")
      .limit(limit)

    if (industryFilter) {
      query = query.ilike("industry", `%${industryFilter}%`)
    }

    const { data: companies } = await query
    companyIds = (companies ?? []).map((row) => asString((row as Record<string, unknown>).id)).filter(Boolean)
    metrics.companies_total = companyIds.length
    metrics.companies_with_website = (companies ?? []).filter((row) => {
      const website = asString((row as Record<string, unknown>).website)
      const domain = asString((row as Record<string, unknown>).primary_domain)
      return Boolean(website || domain)
    }).length
  } else {
    metrics.companies_total = companyIds.length
    const { data: companies } = await admin
      .schema("growth")
      .from("companies")
      .select("id, website, primary_domain")
      .in("id", companyIds)
    metrics.companies_with_website = (companies ?? []).filter((row) => {
      const website = asString((row as Record<string, unknown>).website)
      const domain = asString((row as Record<string, unknown>).primary_domain)
      return Boolean(website || domain)
    }).length
  }

  if (companyIds.length === 0) {
    return { qa_marker: GROWTH_PROSPECT_GRAPH_EXPANSION_QA_MARKER, metrics }
  }

  const personIdSet = new Set<string>()
  const namedPersonIdSet = new Set<string>()
  let namedContactsWithoutPerson = 0

  const { data: contacts } = await admin
    .schema("growth")
    .from("company_contacts")
    .select(
      "canonical_person_id, full_name, title, source_type, source_evidence, metadata, last_verified_at, updated_at",
    )
    .in("company_id", companyIds)
    .neq("contact_status", "archived")

  const now = Date.now()
  for (const row of contacts ?? []) {
    const personId = asString((row as Record<string, unknown>).canonical_person_id)
    if (personId) personIdSet.add(personId)

    const fullName = asString((row as Record<string, unknown>).full_name)
    const isNamed = fullName && !isGenericIdentityName(fullName)
    if (isNamed) {
      if (personId) namedPersonIdSet.add(personId)
      else namedContactsWithoutPerson += 1
    }
    const title = asString((row as Record<string, unknown>).title)
    if (title) metrics.titles_total += 1

    const sourceType = asString((row as Record<string, unknown>).source_type)
    const mapped = mapCompanyContactSourceToProspectSource(sourceType)
    if (mapped) {
      metrics.source_attribution[mapped] = (metrics.source_attribution[mapped] ?? 0) + 1
    }

    const metadata =
      (row as Record<string, unknown>).metadata &&
      typeof (row as Record<string, unknown>).metadata === "object"
        ? ((row as Record<string, unknown>).metadata as Record<string, unknown>)
        : {}
    const pageType = asString(metadata.source_page_type)
    const pageMapped = mapPageTypeToProspectSource(pageType)
    if (pageMapped) {
      metrics.source_attribution[pageMapped] = (metrics.source_attribution[pageMapped] ?? 0) + 1
    }

    const sourceEvidence = Array.isArray((row as Record<string, unknown>).source_evidence)
      ? ((row as Record<string, unknown>).source_evidence as Array<{ source?: string }>)
      : []
    if (sourceEvidence.some((e) => asString(e.source).includes("schema"))) {
      metrics.source_attribution.schema_org = (metrics.source_attribution.schema_org ?? 0) + 1
    }

    const lastVerified =
      asString((row as Record<string, unknown>).last_verified_at) ||
      asString((row as Record<string, unknown>).updated_at)
    const observedSource = mapped ?? pageMapped
    if (!observedSource) {
      metrics.evidence_freshness.unknown_sources += 1
    } else if (!lastVerified) {
      metrics.evidence_freshness.unknown_sources += 1
    } else {
      const ageMs = now - new Date(lastVerified).getTime()
      const cadenceMs = resolveProspectSourceRefreshCadenceMs(observedSource)
      if (ageMs <= cadenceMs) metrics.evidence_freshness.fresh_sources += 1
      else metrics.evidence_freshness.stale_sources += 1
    }
  }

  metrics.persons_total = personIdSet.size

  if (personIdSet.size > 0) {
    const personIds = [...personIdSet]
    const [{ data: emails }, { data: phones }, { data: profiles }, { data: persons }] = await Promise.all([
      admin
        .schema("growth")
        .from("person_emails")
        .select("person_id")
        .in("person_id", personIds)
        .eq("verification_status", "verified"),
      admin
        .schema("growth")
        .from("person_phones")
        .select("person_id")
        .in("person_id", personIds)
        .eq("verification_status", "verified"),
      admin
        .schema("growth")
        .from("person_profiles")
        .select("person_id")
        .in("person_id", personIds)
        .eq("verification_status", "verified"),
      admin.schema("growth").from("persons").select("id, full_name").in("id", personIds),
    ])

    metrics.verified_emails_total = (emails ?? []).length
    metrics.verified_phones_total = (phones ?? []).length
    metrics.verified_profiles_total = (profiles ?? []).length

    for (const row of persons ?? []) {
      const personId = asString((row as Record<string, unknown>).id)
      const name = asString((row as Record<string, unknown>).full_name)
      if (personId && name && !isGenericIdentityName(name)) {
        namedPersonIdSet.add(personId)
      }
    }
  }

  metrics.named_persons_total = namedPersonIdSet.size + namedContactsWithoutPerson

  const { count: committeeCount } = await admin
    .schema("growth")
    .from("buying_committee_intelligence_members")
    .select("id", { count: "exact", head: true })
    .in("company_id", companyIds)
    .eq("verification_status", "verified")

  metrics.committee_members_verified = committeeCount ?? 0
  metrics.named_person_density_pct = pct(metrics.named_persons_total, Math.max(metrics.persons_total, 1))
  metrics.committee_density_pct = pct(metrics.committee_members_verified, Math.max(metrics.companies_total, 1))

  return { qa_marker: GROWTH_PROSPECT_GRAPH_EXPANSION_QA_MARKER, metrics }
}
