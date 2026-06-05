/** Phase 7.PS-HX — Acquire external evidence via public HTTP (no paid providers). Server-only. */

import "server-only"

import {
  extractCohortTargetedEvidenceFromHtml,
  extractExternalEvidenceFromHtml,
} from "@/lib/growth/external-evidence/external-evidence-extract"
import {
  listLiveExternalEvidenceSources,
  type ExternalEvidenceRegistryEntry,
} from "@/lib/growth/external-evidence/external-evidence-registry"
import type { ExternalEvidenceRecord } from "@/lib/growth/external-evidence/external-evidence-types"
import { fetchPublicHtmlDocument } from "@/lib/growth/research-website-fetch"

function buildCohortBusinessDirectorySources(
  cohort: Array<{ company_name: string }>,
): ExternalEvidenceRegistryEntry[] {
  return cohort.slice(0, 12).map((company, index) => ({
    key: `bbb_company_${index}`,
    source_type: "public_business_directory" as const,
    label: `BBB listing search: ${company.company_name}`,
    urls: [
      `https://www.bbb.org/search?find_text=${encodeURIComponent(company.company_name)}`,
    ],
    industry_scope: "biomedical",
    free_public_only: true,
    live: true,
  }))
}

export async function acquireExternalEvidenceFromRegistry(input?: {
  sources?: ExternalEvidenceRegistryEntry[]
  max_sources?: number
  cohort?: Array<{ company_name: string }>
}): Promise<{
  sources_queried: number
  sources_with_records: number
  records: ExternalEvidenceRecord[]
  messages: string[]
}> {
  const baseSources = input?.sources ?? listLiveExternalEvidenceSources()
  const cohortSources = input?.cohort?.length ? buildCohortBusinessDirectorySources(input.cohort) : []
  const sources = [...baseSources, ...cohortSources].slice(0, input?.max_sources ?? 24)
  const records: ExternalEvidenceRecord[] = []
  const messages: string[] = []
  let sources_with_records = 0

  for (const source of sources) {
    let sourceRecords = 0
    for (const url of source.urls) {
      const fetch = await fetchPublicHtmlDocument(url)
      if (fetch.status !== "ok" || !fetch.body) {
        messages.push(`${source.key}: fetch_${fetch.status} ${url}`)
        continue
      }
      const html = fetch.body
      const extracted = extractExternalEvidenceFromHtml({
        html,
        source_url: url,
        source_type: source.source_type,
      })
      const cohortTargeted =
        input?.cohort && input.cohort.length > 0
          ? extractCohortTargetedEvidenceFromHtml({
              html,
              source_url: url,
              source_type: source.source_type,
              cohort_companies: input.cohort,
            })
          : []
      const merged = [...extracted, ...cohortTargeted]
      records.push(...merged)
      sourceRecords += merged.length
      messages.push(
        `${source.key}: ${merged.length} record(s) from ${url} (cohort_targeted=${cohortTargeted.length})`,
      )
    }
    if (sourceRecords > 0) sources_with_records += 1
  }

  return {
    sources_queried: sources.length,
    sources_with_records,
    records,
    messages,
  }
}
