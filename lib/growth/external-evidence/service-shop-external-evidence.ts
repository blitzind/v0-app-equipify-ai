/** Phase 7.PS-IG — Service-shop targeted public external evidence sources. Server-only. */

import "server-only"

import { acquireExternalEvidenceFromRegistry } from "@/lib/growth/external-evidence/external-evidence-acquisition"
import { listLiveExternalEvidenceSources } from "@/lib/growth/external-evidence/external-evidence-registry"
import type { ExternalEvidenceRegistryEntry } from "@/lib/growth/external-evidence/external-evidence-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

const SERVICE_SHOP_REGISTRY_KEYS = new Set([
  "bbb_biomedical",
  "biomed_cert_cbet",
  "philips_partner_locator",
  "ge_vendor_locator",
  "aami_about",
])

export function buildServiceShopExternalEvidenceSources(input: {
  company_name: string
  city?: string | null
  state?: string | null
}): ExternalEvidenceRegistryEntry[] {
  const company = asString(input.company_name)
  if (!company) return []

  const location = [asString(input.city), asString(input.state)].filter(Boolean).join(", ")
  const sources: ExternalEvidenceRegistryEntry[] = [
    {
      key: "service_shop_bbb",
      source_type: "public_business_directory",
      label: `BBB profile search: ${company}`,
      urls: [`https://www.bbb.org/search?find_text=${encodeURIComponent(company)}`],
      industry_scope: "biomedical",
      free_public_only: true,
      live: true,
    },
    {
      key: "service_shop_opencorporates",
      source_type: "public_business_directory",
      label: `OpenCorporates registry: ${company}`,
      urls: [`https://opencorporates.com/companies?q=${encodeURIComponent(company)}`],
      industry_scope: "biomedical",
      free_public_only: true,
      live: true,
    },
  ]

  if (location) {
    sources.push({
      key: "service_shop_yelp",
      source_type: "public_business_directory",
      label: `Yelp local service search: ${company}`,
      urls: [
        `https://www.yelp.com/search?find_desc=${encodeURIComponent("biomedical equipment repair")}&find_loc=${encodeURIComponent(location)}`,
      ],
      industry_scope: "biomedical",
      free_public_only: true,
      live: true,
    })
    sources.push({
      key: "service_shop_manta",
      source_type: "public_business_directory",
      label: `Manta local business profile: ${company}`,
      urls: [
        `https://www.manta.com/search?search=${encodeURIComponent(`${company} biomedical repair ${location}`)}`,
      ],
      industry_scope: "biomedical",
      free_public_only: true,
      live: true,
    })
  }

  sources.push({
    key: "service_shop_vendor_partner",
    source_type: "manufacturer_partner_directory",
    label: `Manufacturer partner search: ${company}`,
    urls: [
      `https://www.usa.philips.com/healthcare/about/support/service-solutions`,
      `https://www.gehealthcare.com/support/service`,
    ],
    industry_scope: "medical equipment",
    free_public_only: true,
    live: true,
  })

  sources.push({
    key: "service_shop_cert_lookup",
    source_type: "public_certification_directory",
    label: `Certification/provider lookup: ${company}`,
    urls: [`https://www.aami.org/certification`],
    industry_scope: "biomedical",
    free_public_only: true,
    live: true,
  })

  return sources
}

export async function acquireServiceShopExternalEvidence(input: {
  company_name: string
  city?: string | null
  state?: string | null
  max_sources?: number
}): Promise<{
  sources_queried: number
  sources_with_records: number
  records: import("@/lib/growth/external-evidence/external-evidence-types").ExternalEvidenceRecord[]
  messages: string[]
  source_contribution: Array<{
    source_key: string
    source_type: string
    records: number
    names: number
  }>
}> {
  const targeted = buildServiceShopExternalEvidenceSources(input)
  const shared = listLiveExternalEvidenceSources().filter((entry) =>
    SERVICE_SHOP_REGISTRY_KEYS.has(entry.key),
  )
  const sources = [...targeted, ...shared]

  const acquisition = await acquireExternalEvidenceFromRegistry({
    sources,
    max_sources: input.max_sources ?? 8,
    cohort: [{ company_name: input.company_name }],
  })

  const byType = new Map<string, { records: number; names: number }>()
  for (const record of acquisition.records) {
    const cur = byType.get(record.source_type) ?? { records: 0, names: 0 }
    cur.records += 1
    if (record.person_name) cur.names += 1
    byType.set(record.source_type, cur)
  }

  const source_contribution = [...byType.entries()].map(([source_type, stats]) => ({
    source_key: source_type,
    source_type,
    records: stats.records,
    names: stats.names,
  }))

  return {
    ...acquisition,
    source_contribution,
  }
}
