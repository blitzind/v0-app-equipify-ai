/** Apollo AI-4 test company selection — server-only, one company max. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { ApolloLivePilotDryRunTargetCompany } from "@/lib/growth/apollo/apollo-live-pilot-dry-run"
import { mergeApolloLivePilotTestCompanySeedEnv } from "@/lib/growth/apollo/apollo-live-pilot-test-company-presets"
import {
  APOLLO_LIVE_PILOT_TEST_COMPANY_SOURCE_MARKER,
  normalizeApolloTestCompanyDomain,
} from "@/lib/growth/apollo/apollo-live-pilot-test-company-seed"

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
    .select("id, company_id, company_name, domain, website, is_suppressed, is_duplicate")
    .or(`id.eq.${company_candidate_id},company_id.eq.${company_candidate_id}`)
    .limit(1)
    .maybeSingle()
  return (data as Record<string, unknown> | null) ?? null
}

async function loadSeededCandidateRow(
  admin: SupabaseClient,
  domain?: string | null,
): Promise<Record<string, unknown> | null> {
  let query = admin
    .schema("growth")
    .from("discovery_candidates")
    .select(
      "id, company_id, company_name, domain, website, is_suppressed, is_duplicate, metadata",
    )
    .eq("is_suppressed", false)
    .eq("is_duplicate", false)
    .contains("metadata", { source_marker: APOLLO_LIVE_PILOT_TEST_COMPANY_SOURCE_MARKER })
    .order("discovered_at", { ascending: false })
    .limit(5)

  if (domain?.trim()) {
    query = query.eq("domain", normalizeApolloTestCompanyDomain(domain))
  }

  const { data: rows } = await query
  return (rows?.[0] as Record<string, unknown> | undefined) ?? null
}

export async function resolveApolloLivePilotTestCompany(
  admin: SupabaseClient,
  input?: {
    company_candidate_id?: string | null
    company_name_search?: string | null
    prefer_seeded?: boolean
    seeded_domain?: string | null
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
        canonical_company_id: null,
        existing_apollo_contacts: existing,
        suitable: suitability.suitable,
        suitability_notes: suitability.notes,
      },
      message: suitability.suitable
        ? "Explicit company candidate validated for Apollo live pilot."
        : `Company not suitable: ${suitability.notes.join("; ")}`,
    }
  }

  if (input?.prefer_seeded) {
    const seeded = await loadSeededCandidateRow(admin, input.seeded_domain)
    if (seeded) {
      const companyId = asString(seeded.company_id) || asString(seeded.id)
      const domain = resolveDomain(seeded)
      const existing = await countApolloContacts(admin, companyId)
      const suitability = assessSuitability({
        company_name: asString(seeded.company_name),
        domain,
        is_suppressed: seeded.is_suppressed === true,
        is_duplicate: seeded.is_duplicate === true,
        existing_contacts: existing,
      })
      if (suitability.suitable) {
        return {
          ok: true,
          company: {
            company_candidate_id: companyId,
            company_name: asString(seeded.company_name) || companyId,
            domain,
            canonical_company_id: null,
            existing_apollo_contacts: existing,
            suitable: true,
            suitability_notes: ["Selected LE-3 seeded Apollo live pilot test company"],
          },
          message: "Selected seeded test company (APOLLO_TEST_COMPANY_PREFER_SEEDED=1).",
        }
      }
    }
  }

  let query = admin
    .schema("growth")
    .from("discovery_candidates")
    .select("id, company_id, company_name, domain, website, is_suppressed, is_duplicate")
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
        canonical_company_id: null,
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
      : "No suitable discovery_candidates row found — run pnpm seed:apollo-live-pilot-test-company",
  }
}

export function resolveApolloLivePilotTestCompanySelectionFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): {
  company_candidate_id: string | null
  company_name_search: string | null
  prefer_seeded: boolean
  seeded_domain: string | null
} {
  const merged = mergeApolloLivePilotTestCompanySeedEnv(env)
  const explicitId =
    env.APOLLO_AI_4_COMPANY_CANDIDATE_ID?.trim() ||
    env.GROWTH_APOLLO_AI_3_COMPANY_CANDIDATE_ID?.trim() ||
    null
  const seededDomain =
    env.APOLLO_TEST_COMPANY_DOMAIN?.trim() || merged.domain || null
  const nameSearch =
    env.APOLLO_AI_4_COMPANY_NAME_SEARCH?.trim() ||
    env.APOLLO_TEST_COMPANY_NAME?.trim() ||
    (seededDomain ? null : merged.company_name || null)
  const preferSeeded =
    env.APOLLO_TEST_COMPANY_PREFER_SEEDED === "1" ||
    Boolean(seededDomain) ||
    Boolean(env.APOLLO_TEST_COMPANY_PROFILE?.trim())

  return {
    company_candidate_id: explicitId,
    company_name_search: nameSearch,
    prefer_seeded: preferSeeded,
    seeded_domain: seededDomain ? normalizeApolloTestCompanyDomain(seededDomain) : null,
  }
}
