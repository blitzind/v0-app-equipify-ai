/** Apollo AI-4 test company selection — server-only, one company max. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { ApolloLivePilotDryRunTargetCompany } from "@/lib/growth/apollo/apollo-live-pilot-dry-run"

export const APOLLO_LIVE_PILOT_TEST_COMPANY_SELECTOR_QA_MARKER =
  "apollo-live-pilot-test-company-selector-ai-4-v1" as const

const MAX_EXISTING_APOLLO_CONTACTS = 15

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function resolveDomain(row: Record<string, unknown>): string | null {
  return (
    asString(row.primary_domain) ||
    asString(row.domain) ||
    asString(row.website)?.replace(/^https?:\/\//, "").split("/")[0] ||
    null
  )
}

function assessSuitability(input: {
  company_name: string
  domain: string | null
  is_suppressed: boolean
  is_duplicate: boolean
  existing_contacts: number
}): { suitable: boolean; notes: string[] } {
  const notes: string[] = []
  if (!input.company_name) notes.push("Missing company name")
  if (!input.domain) notes.push("Missing domain/website for Apollo search")
  if (input.is_suppressed) notes.push("Company is suppressed")
  if (input.is_duplicate) notes.push("Marked duplicate")
  if (input.existing_contacts >= MAX_EXISTING_APOLLO_CONTACTS) {
    notes.push(`Already has ${input.existing_contacts} Apollo contact candidates (max ${MAX_EXISTING_APOLLO_CONTACTS})`)
  }
  return { suitable: notes.length === 0, notes }
}

async function countApolloContacts(
  admin: SupabaseClient,
  companyCandidateKey: string,
): Promise<number> {
  const { count } = await admin
    .schema("growth")
    .from("contact_candidates")
    .select("id", { count: "exact", head: true })
    .eq("provider_type", "future_apollo")
    .eq("company_candidate_id", companyCandidateKey)
  return count ?? 0
}

async function loadCandidateRow(
  admin: SupabaseClient,
  company_candidate_id: string,
): Promise<Record<string, unknown> | null> {
  const { data } = await admin
    .schema("growth")
    .from("discovery_candidates")
    .select(
      "id, company_id, company_name, domain, website, primary_domain, canonical_company_id, is_suppressed, is_duplicate",
    )
    .or(`id.eq.${company_candidate_id},company_id.eq.${company_candidate_id}`)
    .limit(1)
    .maybeSingle()
  return (data as Record<string, unknown> | null) ?? null
}

export async function resolveApolloLivePilotTestCompany(
  admin: SupabaseClient,
  input?: {
    company_candidate_id?: string | null
    company_name_search?: string | null
  },
): Promise<{
  ok: boolean
  company: ApolloLivePilotDryRunTargetCompany | null
  message: string
}> {
  const explicitId = input?.company_candidate_id?.trim()
  if (explicitId) {
    const row = await loadCandidateRow(admin, explicitId)
    if (!row) {
      return { ok: false, company: null, message: `No discovery_candidates row for ${explicitId}` }
    }
    const companyId = asString(row.company_id) || asString(row.id)
    const existing = await countApolloContacts(admin, companyId)
    const domain = resolveDomain(row)
    const suitability = assessSuitability({
      company_name: asString(row.company_name),
      domain,
      is_suppressed: row.is_suppressed === true,
      is_duplicate: row.is_duplicate === true,
      existing_contacts: existing,
    })
    return {
      ok: suitability.suitable,
      company: {
        company_candidate_id: companyId,
        company_name: asString(row.company_name) || companyId,
        domain,
        canonical_company_id: asString(row.canonical_company_id) || null,
        existing_apollo_contacts: existing,
        suitable: suitability.suitable,
        suitability_notes: suitability.notes,
      },
      message: suitability.suitable
        ? "Explicit company candidate validated for Apollo live pilot."
        : `Company not suitable: ${suitability.notes.join("; ")}`,
    }
  }

  let query = admin
    .schema("growth")
    .from("discovery_candidates")
    .select(
      "id, company_id, company_name, domain, website, primary_domain, canonical_company_id, is_suppressed, is_duplicate",
    )
    .eq("is_suppressed", false)
    .eq("is_duplicate", false)
    .order("discovered_at", { ascending: false })
    .limit(25)

  const nameSearch = input?.company_name_search?.trim()
  if (nameSearch) {
    query = query.ilike("company_name", `%${nameSearch}%`)
  }

  const { data: rows } = await query

  for (const raw of rows ?? []) {
    const row = raw as Record<string, unknown>
    const companyId = asString(row.company_id) || asString(row.id)
    const domain = resolveDomain(row)
    if (!domain) continue

    const existing = await countApolloContacts(admin, companyId)
    const suitability = assessSuitability({
      company_name: asString(row.company_name),
      domain,
      is_suppressed: false,
      is_duplicate: false,
      existing_contacts: existing,
    })

    if (!suitability.suitable) continue

    return {
      ok: true,
      company: {
        company_candidate_id: companyId,
        company_name: asString(row.company_name) || companyId,
        domain,
        canonical_company_id: asString(row.canonical_company_id) || null,
        existing_apollo_contacts: existing,
        suitable: true,
        suitability_notes: ["Selected: low existing Apollo contacts, valid domain, not suppressed"],
      },
      message: "Auto-selected one suitable test company (no bulk selection).",
    }
  }

  return {
    ok: false,
    company: null,
    message: nameSearch
      ? `No suitable company found matching "${nameSearch}".`
      : "No suitable discovery_candidates row found — add domain + non-suppressed company.",
  }
}
