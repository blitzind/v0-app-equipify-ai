/** Phase 7.PS-HW — Title & role evidence expansion orchestrator. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { analyzeBuyingCommitteeCoverage } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-coverage"
import { classifyCommitteeRoleFromJobTitle } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-role-classification"
import type { GrowthBuyingCommitteeIntelligenceRole } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-types"
import { runWebsiteContactDiscoveryForCompany } from "@/lib/growth/contact-discovery/company-contact-repository"
import {
  diffProspectGraphExpansionMetrics,
  loadProspectGraphExpansionMetrics,
} from "@/lib/growth/graph-expansion/prospect-graph-expansion-metrics"
import { loadPersonCommitteeDensityExpansionCohort } from "@/lib/growth/graph-expansion/person-committee-density-expansion"
import type { PersonCommitteeDensityCohortCompany } from "@/lib/growth/graph-expansion/person-committee-density-expansion-types"
import { classifyContactIdentity } from "@/lib/growth/human-identity-evidence/contact-identity-classification"
import {
  collectTitleEvidenceForContact,
  selectBestTitleEvidence,
} from "@/lib/growth/human-identity-evidence/title-role-evidence-extract"
import {
  appendCompanyRoleEvidenceRepository,
  enrichPersonCompanyRoleFromTitleEvidence,
} from "@/lib/growth/human-identity-evidence/title-role-evidence-repository"
import {
  GROWTH_TITLE_ROLE_EVIDENCE_QA_MARKER,
  type TitleRoleEvidenceExpansionMetrics,
} from "@/lib/growth/human-identity-evidence/title-role-evidence-types"
import { PS_HP_CRITICAL_COMMITTEE_ROLES } from "@/lib/growth/prospect-search/prospect-search-buying-committee-foundation"
import { ensureBuyingCommitteeIntelligenceFoundation } from "@/lib/growth/prospect-search/prospect-search-buying-committee-foundation"
import { countOutreachReadyCompanies } from "@/lib/growth/graph-expansion/person-committee-density-expansion"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function emptyMetrics(): TitleRoleEvidenceExpansionMetrics {
  return {
    companies_processed: 0,
    persons_scanned: 0,
    titles_discovered: 0,
    persons_enriched: 0,
    roles_upserted: 0,
    committee_members_promoted: 0,
    critical_roles_detected: 0,
    website_contacts_with_titles: 0,
  }
}

async function loadCompanyWebsite(
  admin: SupabaseClient,
  company_id: string,
): Promise<string | null> {
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

async function countTitledPersons(admin: SupabaseClient, company_ids: string[]): Promise<number> {
  if (company_ids.length === 0) return 0
  const { count } = await admin
    .schema("growth")
    .from("person_company_roles")
    .select("id", { count: "exact", head: true })
    .in("company_id", company_ids)
    .not("title", "is", null)
    .neq("title", "")
  return count ?? 0
}

async function loadCommitteeCoverageForCompany(
  admin: SupabaseClient,
  company_id: string,
): Promise<ReturnType<typeof analyzeBuyingCommitteeCoverage>> {
  const { data } = await admin
    .schema("growth")
    .from("buying_committee_intelligence_members")
    .select("person_id, committee_role")
    .eq("company_id", company_id)
    .eq("verification_status", "verified")

  const verified_roles = (data ?? [])
    .map((row) => asString((row as Record<string, unknown>).committee_role))
    .filter(Boolean) as GrowthBuyingCommitteeIntelligenceRole[]
  const verified_person_ids = (data ?? [])
    .map((row) => asString((row as Record<string, unknown>).person_id))
    .filter(Boolean)

  return analyzeBuyingCommitteeCoverage({ verified_roles, verified_person_ids })
}

async function countCommitteeVerified(admin: SupabaseClient, company_ids: string[]): Promise<number> {
  if (company_ids.length === 0) return 0
  const { count } = await admin
    .schema("growth")
    .from("buying_committee_intelligence_members")
    .select("id", { count: "exact", head: true })
    .in("company_id", company_ids)
    .eq("verification_status", "verified")
  return count ?? 0
}

export async function runTitleRoleEvidenceExpansion(
  admin: SupabaseClient,
  input: {
    cohort?: PersonCommitteeDensityCohortCompany[]
    include_anchors?: boolean
    limit?: number
  } = {},
): Promise<{
  qa_marker: typeof GROWTH_TITLE_ROLE_EVIDENCE_QA_MARKER
  ok: boolean
  cohort: PersonCommitteeDensityCohortCompany[]
  metrics: TitleRoleEvidenceExpansionMetrics
  before: {
    titled_persons: number
    committee_members_verified: number
    critical_roles_present: number
    outreach_ready_companies: number
    graph_metrics: Awaited<ReturnType<typeof loadProspectGraphExpansionMetrics>>["metrics"]
  }
  after: {
    titled_persons: number
    committee_members_verified: number
    critical_roles_present: number
    outreach_ready_companies: number
    graph_metrics: Awaited<ReturnType<typeof loadProspectGraphExpansionMetrics>>["metrics"]
  }
  graph_delta: ReturnType<typeof diffProspectGraphExpansionMetrics>
  company_results: Array<{
    company_name: string
    canonical_company_id: string
    titles_discovered: number
    persons_enriched: number
    committee_promoted: number
    messages: string[]
  }>
  messages: string[]
}> {
  const metrics = emptyMetrics()
  const messages: string[] = []
  const company_results: Array<{
    company_name: string
    canonical_company_id: string
    titles_discovered: number
    persons_enriched: number
    committee_promoted: number
    messages: string[]
  }> = []

  const cohort =
    input.cohort ??
    (await loadPersonCommitteeDensityExpansionCohort(admin, {
      include_anchors: input.include_anchors,
      limit: input.limit,
    }))

  const companyIds = cohort.map((c) => c.canonical_company_id)

  const graph_before = await loadProspectGraphExpansionMetrics(admin, { company_ids: companyIds })
  const titled_before = await countTitledPersons(admin, companyIds)
  const committee_before = await countCommitteeVerified(admin, companyIds)
  const outreach_before = await countOutreachReadyCompanies(admin, companyIds)

  let critical_before = 0
  for (const company_id of companyIds) {
    const coverage = await loadCommitteeCoverageForCompany(admin, company_id)
    critical_before += PS_HP_CRITICAL_COMMITTEE_ROLES.filter((role) =>
      coverage.roles_present.includes(role),
    ).length
  }

  for (const target of cohort) {
    metrics.companies_processed += 1
    const resultMessages: string[] = []
    let companyTitles = 0
    let companyEnriched = 0
    let committeePromoted = 0

    const website = await loadCompanyWebsite(admin, target.canonical_company_id)
    if (website) {
      const snapshot = await runWebsiteContactDiscoveryForCompany(admin, {
        company_id: target.canonical_company_id,
        website,
      })
      if (snapshot.contacts.length > 0) {
        const withTitles = snapshot.contacts.filter((c) => asString(c.title)).length
        metrics.website_contacts_with_titles += withTitles
        resultMessages.push(
          `website_crawl: ${snapshot.contacts.length} contacts (${withTitles} with titles)`,
        )
      } else {
        resultMessages.push("website_crawl: no titled contacts extracted")
      }
    } else {
      resultMessages.push("website_crawl: skipped — no website")
    }

    const { data: contacts } = await admin
      .schema("growth")
      .from("company_contacts")
      .select(
        "id, company_id, canonical_person_id, full_name, title, email, phone, linkedin_url, source_type, source_evidence, metadata, updated_at",
      )
      .eq("company_id", target.canonical_company_id)
      .neq("contact_status", "archived")
      .limit(120)

    const repositoryRecords: Awaited<ReturnType<typeof collectTitleEvidenceForContact>>[] = []
    const seenPersons = new Set<string>()

    for (const row of contacts ?? []) {
      const record = row as Record<string, unknown>
      const person_id = asString(record.canonical_person_id)
      const full_name = asString(record.full_name)
      const identity = classifyContactIdentity({
        full_name,
        title: asString(record.title),
        email: asString(record.email),
        phone: asString(record.phone),
        linkedin_url: asString(record.linkedin_url),
        source_type: asString(record.source_type),
      })
      if (!identity.eligible_for_canonical_person && !person_id) continue
      if (!person_id) continue

      seenPersons.add(person_id)

      const metadata =
        record.metadata && typeof record.metadata === "object"
          ? (record.metadata as Record<string, unknown>)
          : {}

      const evidenceRows = collectTitleEvidenceForContact({
        full_name,
        title: asString(record.title),
        source_evidence: Array.isArray(record.source_evidence)
          ? (record.source_evidence as Array<{
              claim?: string
              evidence?: string
              source?: string
              page_url?: string | null
            }>)
          : [],
        metadata,
        company_contact_id: asString(record.id),
        person_id,
        company_id: target.canonical_company_id,
        observed_at: asString(record.updated_at) || new Date().toISOString(),
      })

      if (evidenceRows.length === 0) continue
      metrics.titles_discovered += evidenceRows.length
      companyTitles += evidenceRows.length
      repositoryRecords.push(...evidenceRows)

      const best = selectBestTitleEvidence(evidenceRows)
      if (!best) continue

      const pattern = classifyCommitteeRoleFromJobTitle({ job_title: best.title })
      if (pattern) metrics.critical_roles_detected += 1

      const enrich = await enrichPersonCompanyRoleFromTitleEvidence(admin, {
        person_id,
        company_id: target.canonical_company_id,
        company_contact_id: asString(record.id),
        evidence: best,
      })
      if (enrich.enriched) {
        metrics.persons_enriched += 1
        companyEnriched += 1
        if (enrich.created) metrics.roles_upserted += 1
      }
    }

    if (repositoryRecords.length > 0) {
      await appendCompanyRoleEvidenceRepository(admin, {
        company_id: target.canonical_company_id,
        records: repositoryRecords,
      })
    }

    metrics.persons_scanned += seenPersons.size

    const committee = await ensureBuyingCommitteeIntelligenceFoundation(admin, {
      company_id: target.canonical_company_id,
      force: companyEnriched > 0,
    })
    committeePromoted = committee.promoted_count
    metrics.committee_members_promoted += committeePromoted

    company_results.push({
      company_name: target.company_name,
      canonical_company_id: target.canonical_company_id,
      titles_discovered: companyTitles,
      persons_enriched: companyEnriched,
      committee_promoted: committeePromoted,
      messages: resultMessages,
    })

    messages.push(
      `${target.company_name}: titles=${companyTitles} enriched=${companyEnriched} committee=${committeePromoted}`,
    )
  }

  const graph_after = await loadProspectGraphExpansionMetrics(admin, { company_ids: companyIds })
  const titled_after = await countTitledPersons(admin, companyIds)
  const committee_after = await countCommitteeVerified(admin, companyIds)
  const outreach_after = await countOutreachReadyCompanies(admin, companyIds)

  let critical_after = 0
  for (const company_id of companyIds) {
    const coverage = await loadCommitteeCoverageForCompany(admin, company_id)
    critical_after += PS_HP_CRITICAL_COMMITTEE_ROLES.filter((role) =>
      coverage.roles_present.includes(role),
    ).length
  }

  const ok =
    metrics.companies_processed > 0 &&
    (metrics.persons_enriched > 0 ||
      metrics.titles_discovered > 0 ||
      metrics.committee_members_promoted > 0)

  return {
    qa_marker: GROWTH_TITLE_ROLE_EVIDENCE_QA_MARKER,
    ok,
    cohort,
    metrics,
    before: {
      titled_persons: titled_before,
      committee_members_verified: committee_before,
      critical_roles_present: critical_before,
      outreach_ready_companies: outreach_before,
      graph_metrics: graph_before.metrics,
    },
    after: {
      titled_persons: titled_after,
      committee_members_verified: committee_after,
      critical_roles_present: critical_after,
      outreach_ready_companies: outreach_after,
      graph_metrics: graph_after.metrics,
    },
    graph_delta: diffProspectGraphExpansionMetrics(graph_before.metrics, graph_after.metrics),
    company_results,
    messages,
  }
}
