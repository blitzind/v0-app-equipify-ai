/** Phase 7.PS-IO — Benchmark public professional identity source registry. Client-safe. */

import {
  GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PROFESSIONAL_IDENTITY_EXPANSION_QA_MARKER,
  type BenchmarkProfessionalIdentityRegistryEntry,
} from "@/lib/growth/benchmark/apollo-replacement-benchmark-professional-identity-expansion-types"
import { listLiveExternalEvidenceSources } from "@/lib/growth/external-evidence/external-evidence-registry"

export { GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PROFESSIONAL_IDENTITY_EXPANSION_QA_MARKER }

/** Curated public professional identity sources — no paid enrichment, no LinkedIn scraping. */
export const GROWTH_BENCHMARK_PROFESSIONAL_IDENTITY_REGISTRY: BenchmarkProfessionalIdentityRegistryEntry[] =
  [
    {
      key: "aami_leadership",
      source_type: "association_directory",
      label: "AAMI leadership directory",
      urls: ["https://www.aami.org/about-aami/leadership"],
      industry_scope: "biomedical",
      free_public_only: true,
      live: true,
      reproducible: true,
    },
    {
      key: "aami_members",
      source_type: "htm_biomedical_association",
      label: "AAMI membership / community",
      urls: ["https://www.aami.org/membership"],
      industry_scope: "biomedical",
      free_public_only: true,
      live: true,
      reproducible: true,
    },
    {
      key: "ecri_leadership",
      source_type: "association_directory",
      label: "ECRI leadership",
      urls: ["https://www.ecri.org/about-ecri/leadership"],
      industry_scope: "biomedical",
      free_public_only: true,
      live: true,
      reproducible: true,
    },
    {
      key: "aami_conference_speakers",
      source_type: "conference_speaker_page",
      label: "AAMI conference speaker bios",
      urls: ["https://www.aami.org/conferences"],
      industry_scope: "biomedical",
      free_public_only: true,
      live: true,
      reproducible: true,
    },
    {
      key: "mdm_exhibitors",
      source_type: "conference_exhibitor_staff",
      label: "MD&M exhibitor listings",
      urls: ["https://www.mdmwest.com/en/exhibitor-list.html"],
      industry_scope: "medical equipment",
      free_public_only: true,
      live: true,
      reproducible: true,
    },
    {
      key: "biomed_cert_cbet",
      source_type: "public_certification_directory",
      label: "AAMI certification public references",
      urls: ["https://www.aami.org/certification"],
      industry_scope: "biomedical",
      free_public_only: true,
      live: true,
      reproducible: true,
    },
    {
      key: "philips_partner_locator",
      source_type: "manufacturer_partner_directory",
      label: "Philips service partner locator",
      urls: ["https://www.usa.philips.com/healthcare/about/support/service-solutions"],
      industry_scope: "medical equipment",
      free_public_only: true,
      live: true,
      reproducible: true,
    },
    {
      key: "ge_vendor_locator",
      source_type: "oem_service_network",
      label: "GE HealthCare service locator",
      urls: ["https://www.gehealthcare.com/support/service"],
      industry_scope: "medical equipment",
      free_public_only: true,
      live: true,
      reproducible: true,
    },
    {
      key: "siemens_service_network",
      source_type: "authorized_service_provider_directory",
      label: "Siemens Healthineers service network",
      urls: ["https://www.siemens-healthineers.com/support-services"],
      industry_scope: "medical equipment",
      free_public_only: true,
      live: true,
      reproducible: true,
    },
    {
      key: "htm_association",
      source_type: "htm_biomedical_association",
      label: "ACCE / HTM professional association",
      urls: ["https://www.accenet.org/"],
      industry_scope: "biomedical",
      free_public_only: true,
      live: true,
      reproducible: true,
    },
  ]

function mapHxSourceType(
  source_type: string,
): BenchmarkProfessionalIdentityRegistryEntry["source_type"] {
  if (source_type === "vendor_locator_directory") return "vendor_locator_directory"
  if (source_type === "manufacturer_partner_directory") return "manufacturer_partner_directory"
  if (source_type === "conference_exhibitor_directory") return "conference_exhibitor_staff"
  if (source_type === "conference_speaker_page") return "conference_speaker_page"
  if (source_type === "public_certification_directory") return "public_certification_directory"
  if (source_type === "public_business_directory") return "public_business_directory"
  if (source_type === "association_directory") return "association_directory"
  return "association_directory"
}

export function listBenchmarkProfessionalIdentityRegistrySources(): BenchmarkProfessionalIdentityRegistryEntry[] {
  const hxMapped = listLiveExternalEvidenceSources().map((entry) => ({
    key: `hx_${entry.key}`,
    source_type: mapHxSourceType(entry.source_type),
    label: entry.label,
    urls: entry.urls,
    industry_scope: entry.industry_scope,
    free_public_only: entry.free_public_only,
    live: entry.live,
    reproducible: true,
  }))
  const seen = new Set<string>()
  const merged: BenchmarkProfessionalIdentityRegistryEntry[] = []
  for (const entry of [...GROWTH_BENCHMARK_PROFESSIONAL_IDENTITY_REGISTRY, ...hxMapped]) {
    if (!entry.live || seen.has(entry.key)) continue
    seen.add(entry.key)
    merged.push(entry)
  }
  return merged
}

export function buildBenchmarkCompanyTargetedSources(
  cohort: Array<{ company_name: string; state?: string | null }>,
): BenchmarkProfessionalIdentityRegistryEntry[] {
  const sources: BenchmarkProfessionalIdentityRegistryEntry[] = []
  for (const [index, company] of cohort.entries()) {
    const encoded = encodeURIComponent(company.company_name)
    sources.push({
      key: `bbb_${index}`,
      source_type: "public_business_directory",
      label: `BBB listing: ${company.company_name}`,
      urls: [`https://www.bbb.org/search?find_text=${encoded}`],
      industry_scope: "biomedical",
      free_public_only: true,
      live: true,
      reproducible: true,
    })
    sources.push({
      key: `public_search_${index}`,
      source_type: "public_professional_profile_page",
      label: `Public search: ${company.company_name}`,
      urls: [
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`"${company.company_name}" owner president biomedical`)}`,
      ],
      industry_scope: "biomedical",
      free_public_only: true,
      live: true,
      reproducible: true,
    })
    if (company.state) {
      const state = company.state.trim().toLowerCase()
      sources.push({
        key: `state_reg_${index}`,
        source_type: "state_business_registration",
        label: `State business search: ${company.company_name}`,
        urls: [
          `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`"${company.company_name}" ${state} secretary of state business registration officer owner`)}`,
        ],
        industry_scope: "biomedical",
        free_public_only: true,
        live: true,
        reproducible: true,
      })
    }
  }
  return sources
}
