/** Phase 7.PS-IP — Company-specific officer/principal source registry. Client-safe. */

import type { BenchmarkOfficerPrincipalSourceEntry } from "@/lib/growth/benchmark/apollo-replacement-benchmark-officer-principal-types"

export function buildCompanyOfficerPrincipalSources(input: {
  company_id: string
  company_name: string
  state?: string | null
  index: number
}): BenchmarkOfficerPrincipalSourceEntry[] {
  const encoded = encodeURIComponent(input.company_name)
  const state = input.state?.trim() || ""
  const stateToken = state ? ` ${state}` : ""
  const idx = input.index

  const sources: BenchmarkOfficerPrincipalSourceEntry[] = [
    {
      key: `bbb_principal_${idx}`,
      company_id: input.company_id,
      company_name: input.company_name,
      source_type: "bbb_ownership_principal",
      label: `BBB ownership/principal: ${input.company_name}`,
      urls: [`https://www.bbb.org/search?find_text=${encoded}`],
      free_public_only: true,
      reproducible: true,
    },
    {
      key: `sos_registry_${idx}`,
      company_id: input.company_id,
      company_name: input.company_name,
      source_type: "secretary_of_state_filing",
      label: `Secretary of State filing: ${input.company_name}`,
      urls: [
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`"${input.company_name}"${stateToken} secretary of state business entity officers registered agent`)}`,
      ],
      free_public_only: true,
      reproducible: true,
    },
  ]

  return sources
}

export function buildBenchmarkOfficerPrincipalSourcePlan(
  cohort: Array<{ canonical_company_id: string; company_name: string; state?: string | null }>,
): BenchmarkOfficerPrincipalSourceEntry[] {
  return cohort.flatMap((company, index) =>
    buildCompanyOfficerPrincipalSources({
      company_id: company.canonical_company_id,
      company_name: company.company_name,
      state: company.state,
      index,
    }),
  )
}
