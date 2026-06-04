/** Build PDL Person Search queries — client-safe. */

import type { PdlPersonSearchInput } from "@/lib/growth/providers/pdl/pdl-types"

function normalizeDomain(domain: string | null | undefined): string | null {
  const raw = domain?.trim().toLowerCase()
  if (!raw) return null
  return raw.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? null
}

export function buildPdlPersonSearchQuery(input: PdlPersonSearchInput): {
  query: Record<string, unknown>
  summary: string
} {
  const domain = normalizeDomain(input.domain)
  const companyName = input.company_name.trim()
  const must: Array<Record<string, unknown>> = []

  if (domain) {
    must.push({ term: { job_company_website: domain } })
  } else if (companyName) {
    must.push({ term: { job_company_name: companyName.toLowerCase() } })
  }

  // PDL Person Search rejects explicit minimum_should_match (nested or top-level).
  // Inner bool with only `should` uses Elasticsearch default: at least one should clause must match.
  if (input.prefer_reachable !== false) {
    must.push({
      bool: {
        should: [
          { exists: { field: "work_email" } },
          { exists: { field: "emails" } },
          { exists: { field: "phone_numbers" } },
          { exists: { field: "mobile_phone" } },
        ],
      },
    })
  }

  const bool: Record<string, unknown> = { must }

  const summary = domain
    ? `PDL person search for ${domain}`
    : companyName
      ? `PDL person search for ${companyName}`
      : "PDL person search"

  return {
    query: {
      query: {
        bool,
      },
    },
    summary,
  }
}
