/** Multi-source website evidence discovery. Server-only. */

import "server-only"

import { createHash } from "node:crypto"
import { fetchLeadWebsite } from "@/lib/growth/research-website-fetch"
import { normalizeLeadWebsite } from "@/lib/growth/research-website-url"
import { CAREERS_CRAWL_PATHS, detectCareersPageEvidence } from "@/lib/growth/company-growth-signals/detectors/careers-hiring-detector"
import { detectTechStackSignals } from "@/lib/growth/company-growth-signals/detectors/tech-stack-signal-detector"
import type {
  RawEvidenceSourceCandidate,
  RawGrowthSignalCandidate,
} from "@/lib/growth/company-growth-signals/company-growth-signal-types"
import { fetchPressExpansionSignalsStub } from "@/lib/growth/company-growth-signals/providers/press-provider-stub"
import { fetchReviewReputationSignalsStub } from "@/lib/growth/company-growth-signals/providers/review-provider-stub"

export type MultiSourceEvidenceDiscoveryResult = {
  pages_crawled: string[]
  evidence: RawEvidenceSourceCandidate[]
  signals: RawGrowthSignalCandidate[]
  messages: string[]
}

const BASE_PATHS = ["/", ...CAREERS_CRAWL_PATHS, "/team", "/about", "/contact"]

function buildPaths(website: string): string[] {
  const normalized = normalizeLeadWebsite(website)
  if (!normalized) return []
  const origin = new URL(normalized).origin
  return [...new Set([normalized, ...BASE_PATHS.map((path) => `${origin}${path}`)])]
}

function dedupeEvidence(items: RawEvidenceSourceCandidate[]): RawEvidenceSourceCandidate[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = `${item.source_type}|${item.source_url ?? ""}|${item.evidence_excerpt.slice(0, 80)}`
    if (seen.has(key)) return false
    seen.add(key)
    return item.evidence_excerpt.trim().length > 0
  })
}

function dedupeSignals(items: RawGrowthSignalCandidate[]): RawGrowthSignalCandidate[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = `${item.signal_type}|${item.evidence_excerpt.slice(0, 80)}`
    if (seen.has(key)) return false
    seen.add(key)
    return item.evidence_excerpt.trim().length > 0
  })
}

export function evidenceDedupeHash(companyId: string, sourceType: string, excerpt: string): string {
  return createHash("sha256").update(`${companyId}|${sourceType}|${excerpt.slice(0, 120)}`).digest("hex").slice(0, 32)
}

export function signalDedupeHash(companyId: string, signalType: string, excerpt: string): string {
  return createHash("sha256").update(`${companyId}|${signalType}|${excerpt.slice(0, 120)}`).digest("hex").slice(0, 32)
}

export async function discoverMultiSourceEvidence(input: {
  website: string | null | undefined
  company_name: string
  description?: string | null
  review_count?: number | null
  rating?: number | null
  domain?: string | null
}): Promise<MultiSourceEvidenceDiscoveryResult> {
  const paths = buildPaths(input.website ?? input.domain ?? "")
  const evidence: RawEvidenceSourceCandidate[] = []
  const signals: RawGrowthSignalCandidate[] = []
  const pages_crawled: string[] = []
  const messages: string[] = []

  for (const pageUrl of paths) {
    const fetch = await fetchLeadWebsite(pageUrl)
    if (fetch.status !== "ok" || !fetch.excerpt) {
      messages.push(`${pageUrl}: ${fetch.status}`)
      continue
    }
    pages_crawled.push(pageUrl)
    const html = fetch.excerpt
    const plainText = html.replace(/<[^>]+>/g, " ")

    const careers = detectCareersPageEvidence({ pageUrl, html, plainText })
    evidence.push(...careers.evidence)
    signals.push(...careers.signals)

    const tech = detectTechStackSignals({ pageUrl, html, plainText })
    evidence.push(...tech.evidence)
    signals.push(...tech.signals)

    if (pageUrl.endsWith("/") || pageUrl.split("/").length <= 4) {
      evidence.push({
        source_type: "website",
        source_url: pageUrl,
        confidence_score: 65,
        evidence_excerpt: plainText.slice(0, 240),
      })
    }
  }

  const reviewStub = fetchReviewReputationSignalsStub({
    company_name: input.company_name,
    domain: input.domain ?? null,
    review_count: input.review_count,
    rating: input.rating,
  })
  evidence.push(...reviewStub.evidence)
  signals.push(...reviewStub.signals)

  const pressStub = fetchPressExpansionSignalsStub({
    company_name: input.company_name,
    description: input.description,
  })
  evidence.push(...pressStub.evidence)
  signals.push(...pressStub.signals)

  return {
    pages_crawled,
    evidence: dedupeEvidence(evidence),
    signals: dedupeSignals(signals),
    messages,
  }
}
