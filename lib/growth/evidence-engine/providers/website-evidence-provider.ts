/** GE-AIOS-8A-1 — Operator-scoped website evidence provider (server-only). */

import "server-only"

import type { WebsiteCrawlPlanEntry } from "@/lib/growth/contact-discovery/website-crawl-planner"
import {
  extractInternalLinksFromHtml,
  parseRobotsTxtSitemapUrls,
  parseSitemapUrls,
  planWebsiteCrawlUrls,
} from "@/lib/growth/contact-discovery/website-crawl-planner"
import { fetchPublicHtmlDocument } from "@/lib/growth/research-website-fetch"
import { normalizeLeadWebsite } from "@/lib/growth/research-website-url"
import type { EvidenceProviderCollectionOutput } from "@/lib/growth/evidence-engine/evidence-engine-types"
import { extractBusinessEvidenceFromHtml } from "@/lib/growth/evidence-engine/providers/website-business-extractor"
import {
  businessPagePriority,
  classifyBusinessWebsitePageType,
  EVIDENCE_ENGINE_BUSINESS_SEED_PATHS,
  type EvidenceEngineBusinessPageType,
} from "@/lib/growth/evidence-engine/providers/website-business-page-classifier"

export const EVIDENCE_ENGINE_WEBSITE_MAX_PAGES = 16 as const

export type WebsiteEvidenceProviderInput = {
  organizationId: string
  websiteUrl: string
  forceRefresh?: boolean
  maxPages?: number
  fetchHtml?: (url: string) => Promise<{ status: string; body: string | null }>
}

function planBusinessWebsiteCrawlUrls(input: {
  websiteUrl: string
  homepageHtml?: string | null
  sitemapXml?: string | null
  maxPages?: number
}): WebsiteCrawlPlanEntry[] {
  const maxPages = input.maxPages ?? EVIDENCE_ENGINE_WEBSITE_MAX_PAGES
  let origin = ""
  try {
    origin = new URL(input.websiteUrl).origin
  } catch {
    return []
  }

  const basePlan = planWebsiteCrawlUrls({
    websiteUrl: input.websiteUrl,
    homepageHtml: input.homepageHtml,
    sitemapXml: input.sitemapXml,
    prioritize_person_pages: false,
    maxPages: maxPages * 2,
  })

  const seen = new Set<string>()
  const merged: WebsiteCrawlPlanEntry[] = []

  function push(url: string, depth: number, source: WebsiteCrawlPlanEntry["source"]) {
    const normalized = url.replace(/\/$/, "") || origin
    if (seen.has(normalized)) return
    seen.add(normalized)
    merged.push({ url: normalized, depth, source })
  }

  push(input.websiteUrl.replace(/\/$/, "") || origin, 0, "seed")
  for (const path of EVIDENCE_ENGINE_BUSINESS_SEED_PATHS) {
    if (path === "/") continue
    push(`${origin}${path}`, 0, "seed")
  }

  for (const entry of basePlan) {
    push(entry.url, entry.depth, entry.source)
  }

  if (input.homepageHtml) {
    for (const url of extractInternalLinksFromHtml(input.homepageHtml, origin)) {
      const pageType = classifyBusinessWebsitePageType(url)
      if (pageType !== "generic") push(url, 1, "internal_link")
    }
  }

  return merged
    .sort((a, b) => {
      const pageTypeA = classifyBusinessWebsitePageType(a.url)
      const pageTypeB = classifyBusinessWebsitePageType(b.url)
      const priorityDelta = businessPagePriority(pageTypeA) - businessPagePriority(pageTypeB)
      if (priorityDelta !== 0) return priorityDelta
      if (a.depth !== b.depth) return a.depth - b.depth
      return a.url.localeCompare(b.url)
    })
    .slice(0, maxPages)
}

async function defaultFetchHtml(url: string): Promise<{ status: string; body: string | null }> {
  const result = await fetchPublicHtmlDocument(url)
  return { status: result.status, body: result.body }
}

export async function collectWebsiteEvidence(
  input: WebsiteEvidenceProviderInput,
): Promise<EvidenceProviderCollectionOutput> {
  const warnings: string[] = []
  const diagnostics: Record<string, unknown> = {
    force_refresh: Boolean(input.forceRefresh),
    max_pages: input.maxPages ?? EVIDENCE_ENGINE_WEBSITE_MAX_PAGES,
  }

  const normalized = normalizeLeadWebsite(input.websiteUrl)
  if (normalized.status !== "ready") {
    return {
      organization_id: input.organizationId,
      provider: "website",
      raw_items: [],
      warnings: [`Website URL is not crawl-ready: ${normalized.status}`],
      diagnostics: { ...diagnostics, website_status: normalized.status },
    }
  }

  const websiteUrl = normalized.url
  const fetchHtml = input.fetchHtml ?? defaultFetchHtml
  const pagesCrawled: Array<{ url: string; page_type: EvidenceEngineBusinessPageType; status: string }> = []

  const homepageFetch = await fetchHtml(websiteUrl)
  if (homepageFetch.status !== "ok" || !homepageFetch.body) {
    return {
      organization_id: input.organizationId,
      provider: "website",
      raw_items: [],
      warnings: [`Homepage fetch failed: ${homepageFetch.status}`],
      diagnostics: { ...diagnostics, homepage_status: homepageFetch.status, website_url: websiteUrl },
    }
  }

  let sitemapXml: string | null = null
  try {
    const origin = new URL(websiteUrl).origin
    const robots = await fetchHtml(`${origin}/robots.txt`)
    if (robots.status === "ok" && robots.body) {
      const sitemapUrls = parseRobotsTxtSitemapUrls(robots.body)
      if (sitemapUrls[0]) {
        const sitemap = await fetchHtml(sitemapUrls[0])
        if (sitemap.status === "ok" && sitemap.body) sitemapXml = sitemap.body
      }
    }
    if (!sitemapXml) {
      const sitemap = await fetchHtml(`${origin}/sitemap.xml`)
      if (sitemap.status === "ok" && sitemap.body) sitemapXml = sitemap.body
    }
    if (sitemapXml) {
      diagnostics.sitemap_urls = parseSitemapUrls(sitemapXml, origin, 12)
    }
  } catch {
    warnings.push("Sitemap discovery skipped due to fetch error.")
  }

  const crawlPlan = planBusinessWebsiteCrawlUrls({
    websiteUrl,
    homepageHtml: homepageFetch.body,
    sitemapXml,
    maxPages: input.maxPages ?? EVIDENCE_ENGINE_WEBSITE_MAX_PAGES,
  })

  diagnostics.crawl_plan_count = crawlPlan.length
  diagnostics.crawl_plan_urls = crawlPlan.map((entry) => entry.url)

  const rawItems = []
  const fetchedBodies = new Map<string, string>()
  fetchedBodies.set(websiteUrl, homepageFetch.body)

  for (const entry of crawlPlan) {
    let html = fetchedBodies.get(entry.url) ?? null
    if (!html) {
      const fetched = await fetchHtml(entry.url)
      pagesCrawled.push({
        url: entry.url,
        page_type: classifyBusinessWebsitePageType(entry.url),
        status: fetched.status,
      })
      if (fetched.status !== "ok" || !fetched.body) continue
      html = fetched.body
      fetchedBodies.set(entry.url, html)
    } else {
      pagesCrawled.push({
        url: entry.url,
        page_type: classifyBusinessWebsitePageType(entry.url),
        status: "ok",
      })
    }

    const pageType = classifyBusinessWebsitePageType(entry.url)
    rawItems.push(
      ...extractBusinessEvidenceFromHtml({
        html,
        pageUrl: entry.url,
        pageType,
      }),
    )
  }

  diagnostics.pages_crawled = pagesCrawled
  diagnostics.raw_item_count = rawItems.length

  if (rawItems.length === 0) {
    warnings.push("No website evidence extracted from crawled pages.")
  }

  const hasStructuredExtraction = rawItems.some((item) => item.decision_tier === "structured_extraction")
  if (!hasStructuredExtraction) {
    warnings.push("Structured extraction did not produce evidence; only explicit website evidence is available.")
  }

  return {
    organization_id: input.organizationId,
    provider: "website",
    raw_items: rawItems,
    warnings,
    diagnostics: {
      ...diagnostics,
      website_url: websiteUrl,
      has_structured_extraction: hasStructuredExtraction,
    },
  }
}
