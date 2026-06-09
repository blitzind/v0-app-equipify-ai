/** Apollo search query audit runner — live Tier 1/2/3 evidence only. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { canonicalNormalizedDomain } from "@/lib/growth/canonical-companies/canonical-company-normalize"
import {
  APOLLO_SEARCH_QUERY_AUDIT_COMPANY_NAMES,
  auditApolloPeopleMapping,
  buildApolloSearchQueryAuditCompanyReport,
  buildApolloSearchQueryAuditTierEvidence,
  type ApolloSearchQueryAuditCompanyReport,
} from "@/lib/growth/apollo/apollo-search-query-audit"
import { searchApolloPeopleByCompany } from "@/lib/growth/providers/apollo/apollo-client"
import type { ApolloSearchTier } from "@/lib/growth/providers/apollo/apollo-query-builder"
import type { ApolloPersonRecord } from "@/lib/growth/providers/apollo/apollo-types"
import {
  beginApolloRunGuardrails,
  resetApolloRunGuardrails,
} from "@/lib/growth/providers/apollo/apollo-run-guardrails"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeCompanyName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "")
}

function companyNameMatches(target: string, candidate: string): boolean {
  const targetNorm = normalizeCompanyName(target)
  const candidateNorm = normalizeCompanyName(candidate)
  if (!targetNorm || !candidateNorm) return false
  return candidateNorm.includes(targetNorm) || targetNorm.includes(candidateNorm)
}

export async function resolveApolloSearchQueryAuditCompanies(
  admin: SupabaseClient,
): Promise<
  Array<{
    company_candidate_id: string
    company_name: string
    domain: string
    canonical_company_id: string
  }>
> {
  const { data: rows } = await admin
    .schema("growth")
    .from("discovery_candidates")
    .select("company_id, company_name, canonical_company_id, domain, website")
    .not("canonical_company_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(500)

  const resolved: Array<{
    company_candidate_id: string
    company_name: string
    domain: string
    canonical_company_id: string
  }> = []

  for (const targetName of APOLLO_SEARCH_QUERY_AUDIT_COMPANY_NAMES) {
    const match = (rows ?? []).find((raw) => {
      const row = raw as Record<string, unknown>
      return companyNameMatches(targetName, asString(row.company_name))
    })

    if (!match) {
      resolved.push({
        company_candidate_id: "",
        company_name: targetName,
        domain: "",
        canonical_company_id: "",
      })
      continue
    }

    const row = match as Record<string, unknown>
    resolved.push({
      company_candidate_id: asString(row.company_id),
      company_name: asString(row.company_name) || targetName,
      domain: canonicalNormalizedDomain(asString(row.domain), asString(row.website)) ?? "",
      canonical_company_id: asString(row.canonical_company_id),
    })
  }

  return resolved
}

export async function runApolloSearchQueryAudit(input?: {
  admin?: SupabaseClient
  companies?: Array<{ company_candidate_id: string; company_name: string; domain: string }>
  mock?: boolean
  env?: NodeJS.ProcessEnv
}): Promise<{
  ok: boolean
  mock: boolean
  audited_at: string
  companies: Array<ApolloSearchQueryAuditCompanyReport | { ok: false; error: string; company_name: string }>
  summary: Array<Record<string, unknown>>
}> {
  const mock = input?.mock ?? input?.env?.GROWTH_APOLLO_USE_MOCK === "true"
  const companies =
    input?.companies ??
    (input?.admin ? await resolveApolloSearchQueryAuditCompanies(input.admin) : [])

  beginApolloRunGuardrails()
  const reports: Array<
    ApolloSearchQueryAuditCompanyReport | { ok: false; error: string; company_name: string; company_candidate_id: string | null }
  > = []

  try {
    for (const company of companies) {
      if (!company.domain) {
        reports.push({
          ok: false,
          error: "missing_domain",
          company_name: company.company_name,
          company_candidate_id: company.company_candidate_id || null,
        })
        continue
      }

      const tierEvidenceFull = []
      const uniquePeople: ApolloPersonRecord[] = []
      const seenIds = new Set<string>()

      for (const tier of [1, 2, 3] as ApolloSearchTier[]) {
        const search = await searchApolloPeopleByCompany(
          {
            company_name: company.company_name,
            domain: company.domain,
            website_url: `https://www.${company.domain}`,
            limit: 25,
          },
          { mock, tier },
        )

        for (const person of search.people) {
          const id = asString(person.id) || JSON.stringify(person)
          if (!seenIds.has(id)) {
            seenIds.add(id)
            uniquePeople.push(person)
          }
        }

        tierEvidenceFull.push(
          buildApolloSearchQueryAuditTierEvidence({
            tier,
            search_input: {
              company_name: company.company_name,
              domain: company.domain,
              website_url: `https://www.${company.domain}`,
              limit: 25,
            },
            apollo_response_status: search.status,
            apollo_message: search.message,
            people: search.people,
            apollo_total_matches: search.total,
            mock: search.mock,
          }),
        )
      }

      const mapping_audit = auditApolloPeopleMapping({
        people: uniquePeople,
        company_name: company.company_name,
        domain: company.domain,
        mock,
      })

      reports.push(
        buildApolloSearchQueryAuditCompanyReport({
          company_name: company.company_name,
          company_candidate_id: company.company_candidate_id || null,
          domain: company.domain,
          tier_evidence: tierEvidenceFull,
          people: uniquePeople,
          mapping_audit,
        }),
      )
    }
  } finally {
    resetApolloRunGuardrails()
  }

  return {
    ok: true,
    mock,
    audited_at: new Date().toISOString(),
    companies: reports,
    summary: reports.map((row) =>
      "classification" in row
        ? {
            company_name: row.company_name,
            domain: row.domain,
            classification: row.classification,
            tier_1_people: row.tier_1.apollo_people_count,
            tier_2_people: row.tier_2.apollo_people_count,
            tier_3_people: row.tier_3.apollo_people_count,
            mapped_total: row.mapping_audit.filter((person) => person.accepted).length,
          }
        : row,
    ),
  }
}
