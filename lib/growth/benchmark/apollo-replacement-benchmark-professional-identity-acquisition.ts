/** Phase 7.PS-IO — Acquire benchmark professional identity evidence from public sources. Server-only. */

import "server-only"

import {
  buildBenchmarkCompanyTargetedSources,
  listBenchmarkProfessionalIdentityRegistrySources,
} from "@/lib/growth/benchmark/apollo-replacement-benchmark-professional-identity-registry"
import {
  GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PROFESSIONAL_IDENTITY_EXPANSION_QA_MARKER,
  type BenchmarkProfessionalIdentityEvidenceRecord,
  type BenchmarkProfessionalIdentityRegistryEntry,
  type BenchmarkProfessionalIdentitySourceType,
} from "@/lib/growth/benchmark/apollo-replacement-benchmark-professional-identity-expansion-types"
import {
  extractCohortTargetedEvidenceFromHtml,
  extractExternalEvidenceFromHtml,
} from "@/lib/growth/external-evidence/external-evidence-extract"
import type { ExternalEvidenceSourceType } from "@/lib/growth/external-evidence/external-evidence-types"
import { fetchPublicHtmlDocument } from "@/lib/growth/research-website-fetch"

function mapSourceTypeForExtract(
  source_type: BenchmarkProfessionalIdentitySourceType,
): ExternalEvidenceSourceType {
  switch (source_type) {
    case "manufacturer_partner_directory":
      return "manufacturer_partner_directory"
    case "conference_exhibitor_staff":
      return "conference_exhibitor_directory"
    case "conference_speaker_page":
      return "conference_speaker_page"
    case "public_certification_directory":
      return "public_certification_directory"
    case "public_business_directory":
    case "state_business_registration":
      return "public_business_directory"
    case "vendor_locator_directory":
    case "oem_service_network":
    case "authorized_service_provider_directory":
      return "vendor_locator_directory"
    default:
      return "association_directory"
  }
}

function toBenchmarkRecord(
  record: {
    company_name: string
    person_name: string | null
    title: string | null
    source_url: string
    source_type: ExternalEvidenceSourceType
    evidence_excerpt: string
    observed_at: string
  },
  benchmark_source_type: BenchmarkProfessionalIdentitySourceType,
): BenchmarkProfessionalIdentityEvidenceRecord | null {
  if (!record.person_name) return null
  return {
    company_name: record.company_name,
    person_name: record.person_name,
    title: record.title,
    source_url: record.source_url,
    source_type: benchmark_source_type,
    evidence_excerpt: record.evidence_excerpt,
    observed_at: record.observed_at,
    qa_marker: GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PROFESSIONAL_IDENTITY_EXPANSION_QA_MARKER,
  }
}

export async function acquireBenchmarkProfessionalIdentityEvidence(input: {
  cohort: Array<{ company_name: string; state?: string | null }>
  max_registry_sources?: number
  include_company_targeted_sources?: boolean
}): Promise<{
  sources_queried: BenchmarkProfessionalIdentityRegistryEntry[]
  sources_with_records: number
  records: BenchmarkProfessionalIdentityEvidenceRecord[]
  messages: string[]
}> {
  const registrySources = listBenchmarkProfessionalIdentityRegistrySources().slice(
    0,
    input.max_registry_sources ?? 24,
  )
  const companySources = input.include_company_targeted_sources
    ? buildBenchmarkCompanyTargetedSources(input.cohort)
    : []
  const sources = [...registrySources, ...companySources]

  const records: BenchmarkProfessionalIdentityEvidenceRecord[] = []
  const messages: string[] = []
  let sources_with_records = 0

  for (const source of sources) {
    let sourceRecords = 0
    for (const url of source.urls.slice(0, 1)) {
      const fetch = await fetchPublicHtmlDocument(url)
      if (fetch.status !== "ok" || !fetch.body) {
        messages.push(`${source.key}: fetch_${fetch.status}`)
        continue
      }

      const extractType = mapSourceTypeForExtract(source.source_type)
      const generic = extractExternalEvidenceFromHtml({
        html: fetch.body,
        source_url: url,
        source_type: extractType,
      })
      const cohortTargeted = extractCohortTargetedEvidenceFromHtml({
        html: fetch.body,
        source_url: url,
        source_type: extractType,
        cohort_companies: input.cohort,
      })

      for (const row of [...generic, ...cohortTargeted]) {
        const mapped = toBenchmarkRecord(row, source.source_type)
        if (mapped) {
          records.push(mapped)
          sourceRecords += 1
        }
      }
      messages.push(`${source.key}: records=${sourceRecords}`)
    }
    if (sourceRecords > 0) sources_with_records += 1
  }

  return { sources_queried: sources, sources_with_records, records, messages }
}
