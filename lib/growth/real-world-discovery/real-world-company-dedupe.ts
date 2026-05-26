import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeDomain } from "@/lib/growth/company-identification/company-identification-normalize"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import type { NormalizedRealWorldCompanyCandidate } from "@/lib/growth/real-world-discovery/real-world-company-normalizer"

export type RealWorldCompanyInternalMatches = {
  existing_customer_match: boolean
  existing_prospect_match: boolean
  existing_growth_lead_match: boolean
  existing_lead_inbox_match: boolean
  existing_external_candidate_match: boolean
  existing_real_world_candidate_match: boolean
  matched_customer_id: string | null
  matched_prospect_id: string | null
  matched_growth_lead_id: string | null
  matched_lead_inbox_id: string | null
  matched_external_candidate_id: string | null
  matched_real_world_candidate_id: string | null
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function nameMatches(a: string, b: string): boolean {
  const left = a.toLowerCase().replace(/[^a-z0-9]/g, "")
  const right = b.toLowerCase().replace(/[^a-z0-9]/g, "")
  if (!left || !right) return false
  return left === right || left.includes(right) || right.includes(left)
}

async function matchGrowthTable(
  admin: SupabaseClient,
  table: string,
  select: string,
  candidate: NormalizedRealWorldCompanyCandidate,
  nameField: string,
  websiteField: string,
): Promise<{ id: string } | null> {
  const domain = normalizeDomain(candidate.domain)
  try {
    const { data } = await admin.schema("growth").from(table).select(select).limit(200)
    for (const row of data ?? []) {
      const r = row as Record<string, unknown>
      const rowDomain = normalizeDomain(asString(r[websiteField]))
      if (
        (domain && rowDomain && domain === rowDomain) ||
        nameMatches(candidate.company_name, asString(r[nameField]))
      ) {
        return { id: asString(r.id) }
      }
    }
  } catch {
    /* optional */
  }
  return null
}

export async function resolveRealWorldCompanyInternalMatches(
  admin: SupabaseClient,
  candidate: NormalizedRealWorldCompanyCandidate,
): Promise<RealWorldCompanyInternalMatches> {
  const empty: RealWorldCompanyInternalMatches = {
    existing_customer_match: false,
    existing_prospect_match: false,
    existing_growth_lead_match: false,
    existing_lead_inbox_match: false,
    existing_external_candidate_match: false,
    existing_real_world_candidate_match: false,
    matched_customer_id: null,
    matched_prospect_id: null,
    matched_growth_lead_id: null,
    matched_lead_inbox_id: null,
    matched_external_candidate_id: null,
    matched_real_world_candidate_id: null,
  }

  const domain = normalizeDomain(candidate.domain)
  const orgId = getGrowthEngineAiOrgId()

  if (orgId) {
    try {
      const { data: prospects } = await admin
        .from("prospects")
        .select("id, company_name, website")
        .eq("org_id", orgId)
        .limit(200)
      for (const row of prospects ?? []) {
        const r = row as Record<string, unknown>
        const pDomain = normalizeDomain(asString(r.website))
        if (
          (domain && pDomain && domain === pDomain) ||
          nameMatches(candidate.company_name, asString(r.company_name))
        ) {
          return {
            ...empty,
            existing_prospect_match: true,
            matched_prospect_id: asString(r.id),
          }
        }
      }
    } catch {
      /* optional */
    }

    try {
      const { data: customers } = await admin
        .from("customers")
        .select("id, company_name, website")
        .eq("org_id", orgId)
        .limit(200)
      for (const row of customers ?? []) {
        const r = row as Record<string, unknown>
        const cDomain = normalizeDomain(asString(r.website))
        if (
          (domain && cDomain && domain === cDomain) ||
          nameMatches(candidate.company_name, asString(r.company_name))
        ) {
          return {
            ...empty,
            existing_customer_match: true,
            matched_customer_id: asString(r.id),
          }
        }
      }
    } catch {
      /* optional */
    }
  }

  const leadHit = await matchGrowthTable(
    admin,
    "leads",
    "id, company_name, website",
    candidate,
    "company_name",
    "website",
  )
  if (leadHit) {
    return {
      ...empty,
      existing_growth_lead_match: true,
      matched_growth_lead_id: leadHit.id,
    }
  }

  const inboxHit = await matchGrowthTable(
    admin,
    "lead_inbox",
    "id, company_name, website",
    candidate,
    "company_name",
    "website",
  )
  if (inboxHit) {
    return {
      ...empty,
      existing_lead_inbox_match: true,
      matched_lead_inbox_id: inboxHit.id,
    }
  }

  if (candidate.dedupe_hash) {
    try {
      const { data: ext } = await admin
        .schema("growth")
        .from("external_company_candidates")
        .select("id, dedupe_hash, domain, company_name")
        .eq("dedupe_hash", candidate.dedupe_hash)
        .limit(1)
        .maybeSingle()
      if (ext) {
        return {
          ...empty,
          existing_external_candidate_match: true,
          matched_external_candidate_id: asString((ext as Record<string, unknown>).id),
        }
      }
    } catch {
      /* optional */
    }

    try {
      const { data: rw } = await admin
        .schema("growth")
        .from("real_world_company_candidates")
        .select("id, dedupe_hash")
        .eq("dedupe_hash", candidate.dedupe_hash)
        .limit(1)
        .maybeSingle()
      if (rw) {
        return {
          ...empty,
          existing_real_world_candidate_match: true,
          matched_real_world_candidate_id: asString((rw as Record<string, unknown>).id),
        }
      }
    } catch {
      /* optional */
    }
  }

  return empty
}
