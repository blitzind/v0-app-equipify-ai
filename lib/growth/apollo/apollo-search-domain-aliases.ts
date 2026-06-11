/** Apollo search domain alias resolution — client-safe. */

export type ApolloCurrentRunAttributionSource = "fresh_search" | "historical_revalidated" | "mixed"

export const APOLLO_SEARCH_DOMAIN_ALIASES_QA_MARKER = "apollo-search-domain-aliases-v1" as const

export type ApolloSearchDomainAliasEvidence = {
  qa_marker: typeof APOLLO_SEARCH_DOMAIN_ALIASES_QA_MARKER
  primary_domain: string | null
  alias_domains: string[]
  domains_attempted: string[]
  domain_sources: Record<string, string[]>
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export function normalizeApolloSearchDomain(domain: string | null | undefined): string | null {
  const normalized = asString(domain).replace(/^www\./i, "").toLowerCase()
  if (!normalized || !normalized.includes(".")) return null
  return normalized
}

export function extractDomainFromEmail(email: string | null | undefined): string | null {
  const value = asString(email)
  const at = value.lastIndexOf("@")
  if (at <= 0) return null
  return normalizeApolloSearchDomain(value.slice(at + 1))
}

export function buildApolloSearchDomainAliasEvidence(input: {
  primary_domain: string | null
  email_domains: string[]
}): ApolloSearchDomainAliasEvidence {
  const primary = normalizeApolloSearchDomain(input.primary_domain)
  const domain_sources: Record<string, string[]> = {}
  const aliasSet = new Set<string>()

  for (const emailDomain of input.email_domains) {
    const domain =
      emailDomain.includes("@") ? extractDomainFromEmail(emailDomain) : normalizeApolloSearchDomain(emailDomain)
    if (!domain) continue
    if (primary && domain === primary) continue
    aliasSet.add(domain)
    const sources = domain_sources[domain] ?? []
    if (!sources.includes("candidate_or_contact_email")) {
      sources.push("candidate_or_contact_email")
    }
    domain_sources[domain] = sources
  }

  const alias_domains = [...aliasSet].sort()
  const domains_attempted = [...new Set([...(primary ? [primary] : []), ...alias_domains])]

  return {
    qa_marker: APOLLO_SEARCH_DOMAIN_ALIASES_QA_MARKER,
    primary_domain: primary,
    alias_domains,
    domains_attempted,
    domain_sources,
  }
}

export function resolveApolloOrganizationDomainsForSearch(
  evidence: ApolloSearchDomainAliasEvidence,
): string[] {
  return evidence.domains_attempted
}
