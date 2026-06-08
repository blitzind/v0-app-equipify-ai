/** Phase 7.PS-IP — Acquire company-specific officer/principal evidence. Server-only. */

import "server-only"

import { buildBenchmarkOfficerPrincipalSourcePlan } from "@/lib/growth/benchmark/apollo-replacement-benchmark-officer-principal-registry"
import {
  extractBbbProfileUrlsForCompany,
  extractOfficerPrincipalEvidenceFromHtml,
} from "@/lib/growth/benchmark/apollo-replacement-benchmark-officer-principal-extract"
import type {
  BenchmarkOfficerPrincipalEvidenceRecord,
  BenchmarkOfficerPrincipalSourceEntry,
} from "@/lib/growth/benchmark/apollo-replacement-benchmark-officer-principal-types"
import { fetchPublicHtmlDocument } from "@/lib/growth/research-website-fetch"

export async function acquireBenchmarkOfficerPrincipalEvidence(input: {
  cohort: Array<{ canonical_company_id: string; company_name: string; state?: string | null }>
}): Promise<{
  companies_queried: number
  sources_queried: BenchmarkOfficerPrincipalSourceEntry[]
  sources_with_records: number
  officer_records_found: number
  principal_records_found: number
  records: BenchmarkOfficerPrincipalEvidenceRecord[]
  messages: string[]
}> {
  const sources = buildBenchmarkOfficerPrincipalSourcePlan(input.cohort)
  const records: BenchmarkOfficerPrincipalEvidenceRecord[] = []
  const messages: string[] = []
  let sources_with_records = 0
  let officer_records_found = 0
  let principal_records_found = 0

  const batchSize = 16
  for (let offset = 0; offset < sources.length; offset += batchSize) {
    const chunk = sources.slice(offset, offset + batchSize)
    const chunkResults = await Promise.all(
      chunk.map(async (source) => {
        let sourceRecords = 0
        const chunkRecords: BenchmarkOfficerPrincipalEvidenceRecord[] = []
        const chunkMessages: string[] = []

        const urlsToFetch = [...source.urls.slice(0, 1)]
        for (const url of urlsToFetch) {
          const fetch = await fetchPublicHtmlDocument(url)
          if (fetch.status !== "ok" || !fetch.body) {
            chunkMessages.push(`${source.key}: fetch_${fetch.status}`)
            continue
          }

          const extracted = extractOfficerPrincipalEvidenceFromHtml({
            html: fetch.body,
            source_url: fetch.normalizedUrl ?? url,
            source_type: source.source_type,
            company_id: source.company_id,
            company_name: source.company_name,
          })

          for (const record of extracted) {
            chunkRecords.push(record)
            sourceRecords += 1
          }

          if (source.source_type === "bbb_ownership_principal") {
            const profileUrls = extractBbbProfileUrlsForCompany(fetch.body, source.company_name)
            for (const profileUrl of profileUrls.slice(0, 1)) {
              const profileFetch = await fetchPublicHtmlDocument(profileUrl)
              if (profileFetch.status !== "ok" || !profileFetch.body) {
                chunkMessages.push(`${source.key}_profile: fetch_${profileFetch.status}`)
                continue
              }
              const profileExtracted = extractOfficerPrincipalEvidenceFromHtml({
                html: profileFetch.body,
                source_url: profileFetch.normalizedUrl ?? profileUrl,
                source_type: "public_ownership_disclosure",
                company_id: source.company_id,
                company_name: source.company_name,
              })
              for (const record of profileExtracted) {
                chunkRecords.push(record)
                sourceRecords += 1
              }
              if (profileExtracted.length > 0) {
                chunkMessages.push(`${source.key}_profile: records=${profileExtracted.length}`)
              }
            }
          }
        }

        return { source, sourceRecords, chunkRecords, chunkMessages }
      }),
    )

    for (const result of chunkResults) {
      messages.push(...result.chunkMessages)
      records.push(...result.chunkRecords)
      for (const record of result.chunkRecords) {
        if (record.record_kind === "principal") principal_records_found += 1
        else officer_records_found += 1
      }
      if (result.sourceRecords > 0) {
        sources_with_records += 1
        messages.push(`${result.source.key}: records=${result.sourceRecords}`)
      }
    }
  }

  return {
    companies_queried: input.cohort.length,
    sources_queried: sources,
    sources_with_records,
    officer_records_found,
    principal_records_found,
    records,
    messages,
  }
}
