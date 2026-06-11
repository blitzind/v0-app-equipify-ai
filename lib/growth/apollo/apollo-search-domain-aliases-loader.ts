/** Load Apollo search domain aliases from persisted candidates/contacts — server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildApolloSearchDomainAliasEvidence,
  extractDomainFromEmail,
  type ApolloSearchDomainAliasEvidence,
} from "@/lib/growth/apollo/apollo-search-domain-aliases"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export async function loadApolloSearchDomainAliasesForCompany(
  admin: SupabaseClient,
  input: {
    company_candidate_id: string
    primary_domain: string | null
    canonical_company_id?: string | null
  },
): Promise<ApolloSearchDomainAliasEvidence> {
  const emailDomains: string[] = []

  const { data: candidates } = await admin
    .schema("growth")
    .from("contact_candidates")
    .select("email, provider_type")
    .eq("company_candidate_id", input.company_candidate_id)
    .eq("provider_type", "future_apollo")

  for (const raw of candidates ?? []) {
    const row = raw as Record<string, unknown>
    const domain = extractDomainFromEmail(asString(row.email))
    if (domain) emailDomains.push(domain)
  }

  const canonicalCompanyId = asString(input.canonical_company_id)
  if (canonicalCompanyId) {
    const { data: contacts } = await admin
      .schema("growth")
      .from("company_contacts")
      .select("email")
      .eq("company_id", canonicalCompanyId)

    for (const raw of contacts ?? []) {
      const domain = extractDomainFromEmail(asString((raw as Record<string, unknown>).email))
      if (domain) emailDomains.push(domain)
    }
  }

  return buildApolloSearchDomainAliasEvidence({
    primary_domain: input.primary_domain,
    email_domains: emailDomains,
  })
}
