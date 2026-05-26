import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeDomain } from "@/lib/growth/company-identification/company-identification-normalize"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import type { NormalizedExternalCompanyCandidate } from "@/lib/growth/external-discovery/external-company-normalizer"

export type ExternalCompanyInternalMatches = {
  existing_customer_match: boolean
  existing_prospect_match: boolean
  existing_growth_lead_match: boolean
  matched_customer_id: string | null
  matched_prospect_id: string | null
  matched_growth_lead_id: string | null
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

export async function resolveExternalCompanyInternalMatches(
  admin: SupabaseClient,
  candidate: NormalizedExternalCompanyCandidate,
): Promise<ExternalCompanyInternalMatches> {
  const empty: ExternalCompanyInternalMatches = {
    existing_customer_match: false,
    existing_prospect_match: false,
    existing_growth_lead_match: false,
    matched_customer_id: null,
    matched_prospect_id: null,
    matched_growth_lead_id: null,
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

  try {
    const { data: leads } = await admin
      .schema("growth")
      .from("leads")
      .select("id, company_name, website")
      .is("archived_at", null)
      .limit(200)
    for (const row of leads ?? []) {
      const r = row as Record<string, unknown>
      const lDomain = normalizeDomain(asString(r.website))
      if (
        (domain && lDomain && domain === lDomain) ||
        nameMatches(candidate.company_name, asString(r.company_name))
      ) {
        return {
          ...empty,
          existing_growth_lead_match: true,
          matched_growth_lead_id: asString(r.id),
        }
      }
    }
  } catch {
    /* optional */
  }

  return empty
}
