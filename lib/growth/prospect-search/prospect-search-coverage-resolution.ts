import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { canonicalNormalizedDomain } from "@/lib/growth/canonical-companies/canonical-company-normalize"
import {
  resolveProspectSearchCompanyCoverage,
  type ProspectSearchDomainResolutionIndex,
} from "@/lib/growth/prospect-search/prospect-search-coverage-resolution-core"
import { personLinkageConfidence } from "@/lib/growth/prospect-search/prospect-search-coverage-metrics"
import type {
  ProspectSearchCompanyResolutionCoverage,
  ProspectSearchContactLinkageCoverage,
  ProspectSearchPersonLinkageMethod,
} from "@/lib/growth/prospect-search/prospect-search-coverage-types"
import type { GrowthProspectSearchSourceType } from "@/lib/growth/prospect-search/prospect-search-types"

export type ProspectSearchCanonicalPersonRef = {
  contact_id: string
  canonical_person_id_hint?: string | null
}

export type { ProspectSearchDomainResolutionIndex } from "@/lib/growth/prospect-search/prospect-search-coverage-resolution-core"
export { resolveProspectSearchCompanyCoverage } from "@/lib/growth/prospect-search/prospect-search-coverage-resolution-core"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function metaRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

export async function loadProspectSearchDomainResolutionIndex(
  admin: SupabaseClient,
  domains: string[],
  candidateIds: string[],
): Promise<ProspectSearchDomainResolutionIndex> {
  const by_normalized_domain = new Map<
    string,
    { company_id: string; method: "companies_primary_domain" | "company_domains_alias" }
  >()
  const staging_candidate_by_id = new Map<string, { canonical_company_id: string; table: string }>()
  const staging_candidate_by_domain = new Map<
    string,
    { canonical_company_id: string; table: string; candidate_id: string }
  >()

  const uniqueDomains = [...new Set(domains.filter(Boolean))]
  if (uniqueDomains.length > 0) {
    const { data: companies } = await admin
      .schema("growth")
      .from("companies")
      .select("id, primary_domain")
      .eq("status", "active")
      .in("primary_domain", uniqueDomains)

    for (const row of companies ?? []) {
      const domain = asString(row.primary_domain)
      const id = asString(row.id)
      if (domain && id && !by_normalized_domain.has(domain)) {
        by_normalized_domain.set(domain, { company_id: id, method: "companies_primary_domain" })
      }
    }

    const { data: aliasRows } = await admin
      .schema("growth")
      .from("company_domains")
      .select("company_id, normalized_domain")
      .in("normalized_domain", uniqueDomains)

    for (const row of aliasRows ?? []) {
      const domain = asString(row.normalized_domain)
      const id = asString(row.company_id)
      if (domain && id && !by_normalized_domain.has(domain)) {
        by_normalized_domain.set(domain, { company_id: id, method: "company_domains_alias" })
      }
    }
  }

  const uniqueCandidateIds = [...new Set(candidateIds.filter(Boolean))]
  for (const table of ["external_company_candidates", "real_world_company_candidates"] as const) {
    if (uniqueCandidateIds.length === 0) break
    const { data } = await admin
      .schema("growth")
      .from(table)
      .select("id, canonical_company_id, domain, website")
      .in("id", uniqueCandidateIds)

    for (const row of data ?? []) {
      const id = asString(row.id)
      const canonical = asString(row.canonical_company_id)
      if (id && canonical) {
        staging_candidate_by_id.set(id, { canonical_company_id: canonical, table })
      }
      const domain =
        canonicalNormalizedDomain(asString(row.domain), asString(row.website)) ?? null
      if (domain && canonical && !staging_candidate_by_domain.has(domain)) {
        staging_candidate_by_domain.set(domain, {
          canonical_company_id: canonical,
          table,
          candidate_id: id,
        })
      }
    }
  }

  if (uniqueDomains.length > 0) {
    for (const table of ["external_company_candidates", "real_world_company_candidates"] as const) {
      const { data } = await admin
        .schema("growth")
        .from(table)
        .select("id, canonical_company_id, domain, website")
        .not("canonical_company_id", "is", null)
        .in("domain", uniqueDomains)

      for (const row of data ?? []) {
        const domain = asString(row.domain) || canonicalNormalizedDomain(null, asString(row.website))
        const canonical = asString(row.canonical_company_id)
        const id = asString(row.id)
        if (domain && canonical && id && !staging_candidate_by_domain.has(domain)) {
          staging_candidate_by_domain.set(domain, { canonical_company_id: canonical, table, candidate_id: id })
        }
      }
    }
  }

  return { by_normalized_domain, staging_candidate_by_id, staging_candidate_by_domain }
}

export async function resolveProspectSearchCompanyCoverageBatch(
  admin: SupabaseClient,
  companies: Array<{
    key: string
    source_type: GrowthProspectSearchSourceType
    id: string
    growth_lead_id: string | null
    website?: string | null
    lead_metadata?: Record<string, unknown> | null
  }>,
): Promise<Map<string, ProspectSearchCompanyResolutionCoverage>> {
  const map = new Map<string, ProspectSearchCompanyResolutionCoverage>()
  if (companies.length === 0) return map

  const domains: string[] = []
  const candidateIds: string[] = []
  for (const company of companies) {
    const domain = canonicalNormalizedDomain(null, company.website)
    if (domain) domains.push(domain)
    if (company.source_type === "external_discovered") candidateIds.push(company.id)
    if (company.lead_metadata) {
      const metadata = metaRecord(company.lead_metadata)
      const cid =
        asString(metadata.company_candidate_id) ||
        asString(metadata.external_company_candidate_id) ||
        asString(metadata.real_world_company_candidate_id)
      if (cid) candidateIds.push(cid)
    }
  }

  const index = await loadProspectSearchDomainResolutionIndex(admin, domains, candidateIds)

  for (const company of companies) {
    map.set(company.key, resolveProspectSearchCompanyCoverage({ ...company, index }))
  }

  return map
}

export async function resolveProspectSearchCanonicalCompanyIdsBatch(
  admin: SupabaseClient,
  companies: Array<{
    key: string
    source_type: GrowthProspectSearchSourceType
    id: string
    growth_lead_id: string | null
    website?: string | null
    lead_metadata?: Record<string, unknown> | null
  }>,
): Promise<Map<string, string | null>> {
  const coverage = await resolveProspectSearchCompanyCoverageBatch(admin, companies)
  const map = new Map<string, string | null>()
  for (const [key, row] of coverage) {
    map.set(key, row.canonical_company_id)
  }
  return map
}

export async function resolveProspectSearchPersonLinkageBatch(
  admin: SupabaseClient,
  refs: ProspectSearchCanonicalPersonRef[],
  options?: { committee_person_ids?: string[] },
): Promise<Map<string, ProspectSearchContactLinkageCoverage>> {
  const map = new Map<string, ProspectSearchContactLinkageCoverage>()
  if (refs.length === 0) return map

  const committeeIds = new Set((options?.committee_person_ids ?? []).map(asString).filter(Boolean))

  function finish(
    contact_id: string,
    person_id: string | null,
    method: ProspectSearchPersonLinkageMethod,
    evidence: string[],
    reasons: string[] = [],
  ): void {
    const linked = Boolean(person_id)
    map.set(contact_id, {
      contact_id,
      canonical_person_id: person_id,
      linked,
      confidence: personLinkageConfidence(method),
      method,
      reasons,
      evidence,
      unresolved_contact: !linked,
    })
  }

  for (const ref of refs) {
    const hint = asString(ref.canonical_person_id_hint)
    if (ref.contact_id && hint) {
      finish(ref.contact_id, hint, "overlay_hint", ["Contact overlay already carries canonical_person_id"])
    }
  }

  const unresolved = refs.map((r) => r.contact_id).filter((id) => id && !map.has(id))
  if (unresolved.length === 0) return map

  const { data: companyContacts } = await admin
    .schema("growth")
    .from("company_contacts")
    .select("id, canonical_person_id")
    .in("id", unresolved)

  for (const row of companyContacts ?? []) {
    const contact_id = asString(row.id)
    const person_id = asString(row.canonical_person_id)
    if (contact_id && person_id && !map.has(contact_id)) {
      finish(contact_id, person_id, "company_contacts_column", [
        "company_contacts.canonical_person_id is set",
      ])
    }
  }

  const afterContacts = unresolved.filter((id) => !map.has(id))
  if (afterContacts.length > 0) {
    const { data: lineageRows } = await admin
      .schema("growth")
      .from("person_source_lineage")
      .select("source_id, person_id")
      .eq("source_table", "company_contacts")
      .in("source_id", afterContacts)

    for (const row of lineageRows ?? []) {
      const contact_id = asString(row.source_id)
      const person_id = asString(row.person_id)
      if (contact_id && person_id && !map.has(contact_id)) {
        finish(contact_id, person_id, "company_contacts_lineage", [
          "person_source_lineage source_table=company_contacts",
        ])
      }
    }
  }

  const afterCcLineage = unresolved.filter((id) => !map.has(id))
  if (afterCcLineage.length > 0) {
    const { data: decisionMakers } = await admin
      .schema("growth")
      .from("lead_decision_makers")
      .select("id, canonical_person_id")
      .in("id", afterCcLineage)

    for (const row of decisionMakers ?? []) {
      const contact_id = asString(row.id)
      const person_id = asString(row.canonical_person_id)
      if (contact_id && person_id && !map.has(contact_id)) {
        finish(contact_id, person_id, "lead_decision_makers_column", [
          "lead_decision_makers.canonical_person_id is set",
        ])
      }
    }
  }

  const afterDm = unresolved.filter((id) => !map.has(id))
  if (afterDm.length > 0) {
    const { data: dmLineage } = await admin
      .schema("growth")
      .from("person_source_lineage")
      .select("source_id, person_id")
      .eq("source_table", "lead_decision_makers")
      .in("source_id", afterDm)

    for (const row of dmLineage ?? []) {
      const contact_id = asString(row.source_id)
      const person_id = asString(row.person_id)
      if (contact_id && person_id && !map.has(contact_id)) {
        finish(contact_id, person_id, "lead_decision_makers_lineage", [
          "person_source_lineage source_table=lead_decision_makers",
        ])
      }
    }
  }

  const afterDmLineage = unresolved.filter((id) => !map.has(id))
  if (afterDmLineage.length > 0) {
    const { data: candidates } = await admin
      .schema("growth")
      .from("contact_candidates")
      .select("id, canonical_person_id")
      .in("id", afterDmLineage)

    for (const row of candidates ?? []) {
      const contact_id = asString(row.id)
      const person_id = asString(row.canonical_person_id)
      if (contact_id && person_id && !map.has(contact_id)) {
        finish(contact_id, person_id, "contact_candidates_column", [
          "contact_candidates.canonical_person_id is set",
        ])
      }
    }
  }

  const afterCandidates = unresolved.filter((id) => !map.has(id))
  if (afterCandidates.length > 0) {
    const { data: candLineage } = await admin
      .schema("growth")
      .from("person_source_lineage")
      .select("source_id, person_id")
      .eq("source_table", "contact_candidates")
      .in("source_id", afterCandidates)

    for (const row of candLineage ?? []) {
      const contact_id = asString(row.source_id)
      const person_id = asString(row.person_id)
      if (contact_id && person_id && !map.has(contact_id)) {
        finish(contact_id, person_id, "contact_candidates_lineage", [
          "person_source_lineage source_table=contact_candidates",
        ])
      }
    }
  }

  for (const contact_id of unresolved) {
    if (map.has(contact_id)) continue
    const hint = asString(refs.find((r) => r.contact_id === contact_id)?.canonical_person_id_hint)
    if (hint && committeeIds.has(hint)) {
      finish(contact_id, hint, "committee_member_person_id", [
        "Canonical person_id matches verified buying committee member (7.7)",
      ])
      continue
    }
    finish(contact_id, null, "unresolved", [], [
      "No canonical_person_id on company_contacts, lead_decision_makers, contact_candidates, or lineage",
    ])
  }

  return map
}

export async function resolveProspectSearchCanonicalPersonIdsBatch(
  admin: SupabaseClient,
  refs: ProspectSearchCanonicalPersonRef[],
  options?: { committee_person_ids?: string[] },
): Promise<Map<string, string | null>> {
  const linkage = await resolveProspectSearchPersonLinkageBatch(admin, refs, options)
  const map = new Map<string, string | null>()
  for (const [contact_id, row] of linkage) {
    map.set(contact_id, row.canonical_person_id)
  }
  return map
}

export async function resolveProspectSearchCanonicalCompanyId(
  admin: SupabaseClient,
  input: {
    source_type: GrowthProspectSearchSourceType
    id: string
    growth_lead_id: string | null
    website?: string | null
    lead_metadata?: Record<string, unknown> | null
  },
): Promise<string | null> {
  let lead_metadata = input.lead_metadata ?? null
  if (!lead_metadata && input.growth_lead_id) {
    const { data } = await admin
      .schema("growth")
      .from("leads")
      .select("metadata")
      .eq("id", input.growth_lead_id)
      .maybeSingle()
    lead_metadata = metaRecord(data?.metadata)
  }

  const index = await loadProspectSearchDomainResolutionIndex(
    admin,
    [canonicalNormalizedDomain(null, input.website)].filter((d): d is string => Boolean(d)),
    input.source_type === "external_discovered" ? [input.id] : [],
  )

  return resolveProspectSearchCompanyCoverage({ ...input, lead_metadata, index }).canonical_company_id
}
