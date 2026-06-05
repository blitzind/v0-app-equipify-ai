/** Phase 7.PS-HY — Acquire public professional identity corroboration signals. Server-only. */

import "server-only"

import { listLiveExternalEvidenceSources } from "@/lib/growth/external-evidence/external-evidence-registry"
import {
  extractCorroborationFromPublicPage,
  extractCorroborationFromSearchSnippets,
  extractLinkedInReferencesFromPublicPage,
  extractPublicSearchResultSnippets,
} from "@/lib/growth/professional-identity-corroboration/professional-identity-corroboration-extract"
import type {
  EvidenceBackedPersonTarget,
  ProfessionalIdentityCorroborationSignal,
} from "@/lib/growth/professional-identity-corroboration/professional-identity-corroboration-types"
import { fetchPublicHtmlDocument } from "@/lib/growth/research-website-fetch"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function buildPublicSearchUrl(target: EvidenceBackedPersonTarget): string {
  const query = `"${target.full_name}" "${target.company_name}"`
  return `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
}

function mapRegistrySourceType(
  source_type: string,
): "association_page" | "conference_page" | "company_website_reference" {
  if (source_type.includes("conference")) return "conference_page"
  if (source_type.includes("association")) return "association_page"
  return "company_website_reference"
}

export async function acquireProfessionalIdentityCorroborationSignals(
  target: EvidenceBackedPersonTarget,
): Promise<{
  signals: ProfessionalIdentityCorroborationSignal[]
  messages: string[]
}> {
  const signals: ProfessionalIdentityCorroborationSignal[] = []
  const messages: string[] = []
  const seen = new Set<string>()

  const pushSignal = (signal: ProfessionalIdentityCorroborationSignal | null) => {
    if (!signal) return
    const key = `${signal.source_type}:${signal.source_url}:${signal.matched_title ?? ""}:${signal.linkedin_url ?? ""}`
    if (seen.has(key)) return
    seen.add(key)
    signals.push(signal)
  }

  const searchUrl = buildPublicSearchUrl(target)
  const searchFetch = await fetchPublicHtmlDocument(searchUrl)
  if (searchFetch.status === "ok" && searchFetch.body) {
    const snippets = extractPublicSearchResultSnippets(searchFetch.body)
    const searchSignals = extractCorroborationFromSearchSnippets({ snippets, target })
    for (const signal of searchSignals) pushSignal(signal)
    messages.push(`public_search: ${searchSignals.length} signal(s)`)
  } else {
    messages.push(`public_search: fetch_${searchFetch.status}`)
  }

  if (target.website_url) {
    const websiteFetch = await fetchPublicHtmlDocument(target.website_url)
    if (websiteFetch.status === "ok" && websiteFetch.body) {
      pushSignal(
        extractCorroborationFromPublicPage({
          html: websiteFetch.body,
          source_url: websiteFetch.normalizedUrl ?? target.website_url,
          source_type: "company_website_reference",
          target,
        }),
      )
      for (const signal of extractLinkedInReferencesFromPublicPage({
        html: websiteFetch.body,
        source_url: websiteFetch.normalizedUrl ?? target.website_url,
        target,
      })) {
        pushSignal(signal)
      }
      messages.push(`company_website: ${signals.length} total signal(s)`)
    } else {
      messages.push(`company_website: fetch_${websiteFetch.status}`)
    }
  } else {
    messages.push("company_website: skipped — no website")
  }

  const registrySources = listLiveExternalEvidenceSources().slice(0, 4)
  for (const source of registrySources) {
    for (const url of source.urls.slice(0, 1)) {
      const fetch = await fetchPublicHtmlDocument(url)
      if (fetch.status !== "ok" || !fetch.body) continue
      pushSignal(
        extractCorroborationFromPublicPage({
          html: fetch.body,
          source_url: url,
          source_type: mapRegistrySourceType(source.source_type),
          target,
        }),
      )
    }
  }
  messages.push(`registry_pages: scanned=${registrySources.length}`)

  return { signals, messages }
}
