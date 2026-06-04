import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  fetchStagingCanonicalCompanyId,
  resolveCanonicalCompanyIdForLead,
} from "@/lib/growth/canonical-persons/canonical-person-repository"
import type { GrowthProspectSearchSourceType } from "@/lib/growth/prospect-search/prospect-search-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function resolveCompanyDomain(website: string | null | undefined): string | null {
  try {
    const raw = website?.trim()
    if (!raw) return null
    return new URL(raw.startsWith("http") ? raw : `https://${raw}`).hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}

async function resolveCanonicalCompanyIdByDomain(
  admin: SupabaseClient,
  website: string | null | undefined,
): Promise<string | null> {
  const domain = resolveCompanyDomain(website)
  if (!domain) return null

  const { data: company } = await admin
    .schema("growth")
    .from("companies")
    .select("id")
    .eq("primary_domain", domain)
    .eq("status", "active")
    .maybeSingle()

  return company?.id ? asString(company.id) : null
}

export async function resolveProspectSearchCanonicalCompanyId(
  admin: SupabaseClient,
  input: {
    source_type: GrowthProspectSearchSourceType
    id: string
    growth_lead_id: string | null
    website?: string | null
  },
): Promise<string | null> {
  if (input.growth_lead_id) {
    const fromLead = await resolveCanonicalCompanyIdForLead(admin, input.growth_lead_id)
    if (fromLead) return fromLead
  }

  if (input.source_type === "external_discovered") {
    const fromCandidate = await fetchStagingCanonicalCompanyId(admin, input.id)
    if (fromCandidate) return fromCandidate
  }

  return resolveCanonicalCompanyIdByDomain(admin, input.website)
}

export async function resolveProspectSearchCanonicalCompanyIdsBatch(
  admin: SupabaseClient,
  companies: Array<{
    key: string
    source_type: GrowthProspectSearchSourceType
    id: string
    growth_lead_id: string | null
    website?: string | null
  }>,
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>()
  if (companies.length === 0) return map

  await Promise.allSettled(
    companies.map(async (company) => {
      try {
        const canonical_company_id = await resolveProspectSearchCanonicalCompanyId(admin, company)
        map.set(company.key, canonical_company_id)
      } catch {
        map.set(company.key, null)
      }
    }),
  )

  return map
}

export type ProspectSearchCanonicalPersonRef = {
  contact_id: string
  canonical_person_id_hint?: string | null
}

export async function resolveProspectSearchCanonicalPersonIdsBatch(
  admin: SupabaseClient,
  refs: ProspectSearchCanonicalPersonRef[],
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>()
  if (refs.length === 0) return map

  const hintedIds = refs
    .map((ref) => ({
      contact_id: ref.contact_id,
      person_id: asString(ref.canonical_person_id_hint),
    }))
    .filter((row) => row.contact_id && row.person_id)

  for (const row of hintedIds) {
    map.set(row.contact_id, row.person_id)
  }

  const unresolved = refs
    .map((ref) => ref.contact_id)
    .filter((contactId) => contactId && !map.has(contactId))

  if (unresolved.length === 0) return map

  const { data: companyContacts } = await admin
    .schema("growth")
    .from("company_contacts")
    .select("id, canonical_person_id")
    .in("id", unresolved)

  for (const row of companyContacts ?? []) {
    const contact_id = asString(row.id)
    const person_id = asString(row.canonical_person_id)
    if (contact_id && person_id) map.set(contact_id, person_id)
  }

  const stillUnresolved = unresolved.filter((id) => !map.has(id))
  if (stillUnresolved.length === 0) return map

  const { data: lineageRows } = await admin
    .schema("growth")
    .from("person_source_lineage")
    .select("source_id, person_id")
    .eq("source_table", "company_contacts")
    .in("source_id", stillUnresolved)

  for (const row of lineageRows ?? []) {
    const contact_id = asString(row.source_id)
    const person_id = asString(row.person_id)
    if (contact_id && person_id) map.set(contact_id, person_id)
  }

  const dmUnresolved = stillUnresolved.filter((id) => !map.has(id))
  if (dmUnresolved.length === 0) return map

  const { data: decisionMakers } = await admin
    .schema("growth")
    .from("lead_decision_makers")
    .select("id, canonical_person_id")
    .in("id", dmUnresolved)

  for (const row of decisionMakers ?? []) {
    const contact_id = asString(row.id)
    const person_id = asString(row.canonical_person_id)
    if (contact_id && person_id) map.set(contact_id, person_id)
  }

  return map
}
