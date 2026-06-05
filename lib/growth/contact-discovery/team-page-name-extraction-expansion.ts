/** Phase 7.PS-ID — Re-run team page extraction for promoted companies. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { runWebsiteContactDiscoveryForCompany } from "@/lib/growth/contact-discovery/company-contact-repository"
import { GROWTH_PS_HE_ANCHOR_COMPANIES } from "@/lib/growth/graph-expansion/person-committee-density-expansion-types"
import { classifyContactIdentity } from "@/lib/growth/human-identity-evidence/contact-identity-classification"
import { isGenericIdentityName } from "@/lib/growth/human-identity-evidence/human-identity-evidence-evidence"
import { countOutreachReadyCompanies } from "@/lib/growth/graph-expansion/person-committee-density-expansion"

export const GROWTH_TEAM_PAGE_NAME_EXTRACTION_EXPANSION_QA_MARKER =
  "growth-team-page-name-extraction-expansion-7-ps-id-v1" as const

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export type TeamPageNameExtractionDensitySnapshot = {
  companies: number
  named_person_companies: number
  titled_person_companies: number
  total_named_persons: number
  total_titled_persons: number
  generic_identities: number
  outreach_ready_companies: number
}

export type TeamPageNameExtractionExpansionMetrics = {
  companies_processed: number
  team_pages_analyzed: number
  websites_crawled: number
  names_recovered: number
  titles_recovered: number
  generic_identities_reduced: number
  fetch_failures: number
}

async function loadCompanyWebsite(admin: SupabaseClient, company_id: string): Promise<string | null> {
  const { data } = await admin
    .schema("growth")
    .from("companies")
    .select("website, primary_domain")
    .eq("id", company_id)
    .maybeSingle()
  const website = asString(data?.website) || asString(data?.primary_domain)
  if (!website) return null
  return website.startsWith("http") ? website : `https://${website}`
}

async function loadDensitySnapshot(
  admin: SupabaseClient,
  company_ids: string[],
): Promise<TeamPageNameExtractionDensitySnapshot> {
  if (company_ids.length === 0) {
    return {
      companies: 0,
      named_person_companies: 0,
      titled_person_companies: 0,
      total_named_persons: 0,
      total_titled_persons: 0,
      generic_identities: 0,
      outreach_ready_companies: 0,
    }
  }

  const { data: contacts } = await admin
    .schema("growth")
    .from("company_contacts")
    .select("company_id, full_name, title, canonical_person_id, email, phone, linkedin_url, source_type")
    .in("company_id", company_ids)
    .neq("contact_status", "archived")

  const byCompany = new Map<string, Array<Record<string, unknown>>>()
  for (const row of contacts ?? []) {
    const cid = asString(row.company_id)
    if (!byCompany.has(cid)) byCompany.set(cid, [])
    byCompany.get(cid)!.push(row as Record<string, unknown>)
  }

  let namedCompanies = 0
  let titledCompanies = 0
  let totalNamed = 0
  let totalTitled = 0
  let genericIdentities = 0

  for (const company_id of company_ids) {
    const rows = byCompany.get(company_id) ?? []
    let hasNamed = false
    let companyTitled = 0
    for (const row of rows) {
      const full_name = asString(row.full_name)
      if (isGenericIdentityName(full_name)) genericIdentities += 1
      const identity = classifyContactIdentity({
        full_name,
        title: asString(row.title),
        email: asString(row.email),
        phone: asString(row.phone),
        linkedin_url: asString(row.linkedin_url),
        source_type: asString(row.source_type),
      })
      if (identity.classification === "named_person") {
        totalNamed += 1
        hasNamed = true
      }
      if (asString(row.title)) {
        totalTitled += 1
        companyTitled += 1
      }
    }
    if (hasNamed) namedCompanies += 1
    if (companyTitled > 0) titledCompanies += 1
  }

  const outreach_ready_companies = await countOutreachReadyCompanies(admin, company_ids)

  return {
    companies: company_ids.length,
    named_person_companies: namedCompanies,
    titled_person_companies: titledCompanies,
    total_named_persons: totalNamed,
    total_titled_persons: totalTitled,
    generic_identities: genericIdentities,
    outreach_ready_companies,
  }
}

export async function loadTeamPageNameExtractionCohort(
  admin: SupabaseClient,
  input?: { include_last_promoted?: number },
): Promise<Array<{ company_id: string; company_name: string; website: string | null; cohort_kind: string }>> {
  const limit = input?.include_last_promoted ?? 100
  const cohort = new Map<string, { company_id: string; company_name: string; website: string | null; cohort_kind: string }>()

  for (const anchor of GROWTH_PS_HE_ANCHOR_COMPANIES) {
    cohort.set(anchor.canonical_company_id, {
      company_id: anchor.canonical_company_id,
      company_name: anchor.company_name,
      website: null,
      cohort_kind: "ps_he_anchor",
    })
  }

  const { data: teamContacts } = await admin
    .schema("growth")
    .from("company_contacts")
    .select("company_id")
    .eq("source_type", "team_page")
    .neq("contact_status", "archived")
  for (const row of teamContacts ?? []) {
    const company_id = asString(row.company_id)
    if (!company_id) continue
    if (!cohort.has(company_id)) {
      cohort.set(company_id, {
        company_id,
        company_name: company_id,
        website: null,
        cohort_kind: "existing_team_page_contact",
      })
    }
  }

  const { data: promoted } = await admin
    .schema("growth")
    .from("discovery_candidates")
    .select("canonical_company_id, company_name")
    .not("canonical_company_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(limit)

  for (const row of promoted ?? []) {
    const company_id = asString(row.canonical_company_id)
    if (!company_id) continue
    cohort.set(company_id, {
      company_id,
      company_name: asString(row.company_name) || company_id,
      website: null,
      cohort_kind: cohort.has(company_id) ? cohort.get(company_id)!.cohort_kind : "last_promoted",
    })
  }

  const rows = [...cohort.values()]
  await Promise.all(
    rows.map(async (entry) => {
      entry.website = await loadCompanyWebsite(admin, entry.company_id)
      if (entry.company_name === entry.company_id) {
        const { data } = await admin
          .schema("growth")
          .from("companies")
          .select("name")
          .eq("id", entry.company_id)
          .maybeSingle()
        entry.company_name = asString(data?.name) || entry.company_id
      }
    }),
  )

  return rows
}

function prioritizeCohortForCrawl(
  cohort: Array<{ company_id: string; company_name: string; website: string | null; cohort_kind: string }>,
): typeof cohort {
  const priority = (kind: string) => {
    if (kind === "ps_he_anchor") return 0
    if (kind === "existing_team_page_contact") return 1
    return 2
  }
  return [...cohort].sort((a, b) => priority(a.cohort_kind) - priority(b.cohort_kind))
}

export async function runTeamPageNameExtractionExpansion(
  admin: SupabaseClient,
  input?: { include_last_promoted?: number; dry_run?: boolean; max_website_crawls?: number },
): Promise<{
  qa_marker: typeof GROWTH_TEAM_PAGE_NAME_EXTRACTION_EXPANSION_QA_MARKER
  cohort_size: number
  before: TeamPageNameExtractionDensitySnapshot
  after: TeamPageNameExtractionDensitySnapshot
  metrics: TeamPageNameExtractionExpansionMetrics
  messages: string[]
}> {
  const cohort = await loadTeamPageNameExtractionCohort(admin, input)
  const company_ids = cohort.map((row) => row.company_id)
  const before = await loadDensitySnapshot(admin, company_ids)
  const messages: string[] = []

  const metrics: TeamPageNameExtractionExpansionMetrics = {
    companies_processed: 0,
    team_pages_analyzed: 0,
    websites_crawled: 0,
    names_recovered: 0,
    titles_recovered: 0,
    generic_identities_reduced: 0,
    fetch_failures: 0,
  }

  if (!input?.dry_run) {
    const crawlQueue = prioritizeCohortForCrawl(cohort).filter((entry) => Boolean(entry.website))
    const crawlLimit = input?.max_website_crawls ?? crawlQueue.length
    for (const entry of crawlQueue.slice(0, crawlLimit)) {
      metrics.companies_processed += 1
      const snapshot = await runWebsiteContactDiscoveryForCompany(admin, {
        company_id: entry.company_id,
        website: entry.website,
      })
      metrics.websites_crawled += 1
      metrics.team_pages_analyzed += snapshot.contacts.filter((c) => c.source_type === "team_page").length
      const named = snapshot.contacts.filter(
        (c) => !isGenericIdentityName(c.full_name) && c.source_type === "team_page",
      )
      metrics.names_recovered += named.length
      metrics.titles_recovered += named.filter((c) => c.title).length
      if (named.length > 0) {
        messages.push(`${entry.company_name}: ${named.length} team-page named contact(s)`)
      }
    }
  }

  const after = await loadDensitySnapshot(admin, company_ids)
  metrics.generic_identities_reduced = Math.max(0, before.generic_identities - after.generic_identities)
  metrics.names_recovered = Math.max(
    metrics.names_recovered,
    after.total_named_persons - before.total_named_persons,
  )
  metrics.titles_recovered = Math.max(
    metrics.titles_recovered,
    after.total_titled_persons - before.total_titled_persons,
  )

  return {
    qa_marker: GROWTH_TEAM_PAGE_NAME_EXTRACTION_EXPANSION_QA_MARKER,
    cohort_size: cohort.length,
    before,
    after,
    metrics,
    messages: messages.slice(0, 24),
  }
}
