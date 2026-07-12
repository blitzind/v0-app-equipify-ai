/** GE-AIOS-22 / 25C-1 — Prospect company website evidence collector (server-only). */

import "server-only"

import {
  classifyBusinessWebsitePageType,
  researchValueReasonForPageType,
  type EvidenceEngineBusinessPageType,
} from "@/lib/growth/evidence-engine/providers/website-business-page-classifier"
import { extractBusinessEvidenceFromHtml } from "@/lib/growth/evidence-engine/providers/website-business-extractor"
import { planBusinessWebsiteCrawlUrls } from "@/lib/growth/evidence-engine/providers/website-evidence-provider"
import type { EvidenceProviderRawItem } from "@/lib/growth/evidence-engine/evidence-engine-types"
import {
  filterCrawlPlanByRobotsPolicy,
  parseRobotsTxtPolicy,
  sanitizeUrlForCrawlDiagnostics,
  type RobotsTxtPolicy,
} from "@/lib/growth/contact-discovery/website-crawl-planner"
import { fetchPublicHtmlDocument } from "@/lib/growth/research-website-fetch"
import { normalizeLeadWebsite } from "@/lib/growth/research-website-url"
import {
  buildCompanyEvidenceProfileFromRawItems,
  collectCompanyEvidenceSourceUrls,
} from "@/lib/growth/research/company-evidence/build-company-evidence-profile"
import { buildCompanyEvidenceCacheKey } from "@/lib/growth/research/company-evidence/company-evidence-cache-key"
import {
  COMPANY_EVIDENCE_MAX_PAGES,
  evaluateCompanyEvidenceCrawlStop,
  finalizeCompanyEvidenceCrawlState,
} from "@/lib/growth/research/company-evidence/company-evidence-crawl-budget"
import { buildCompanyEvidenceQualificationExplanation } from "@/lib/growth/research/company-evidence/company-evidence-explainability"
import { compareCompanyEvidenceToMission } from "@/lib/growth/research/company-evidence/company-evidence-mission-comparison"
import { computeCompanyEvidenceQualityScores } from "@/lib/growth/research/company-evidence/company-evidence-quality-score"
import {
  GROWTH_COMPANY_EVIDENCE_22_QA_MARKER,
  type GrowthCompanyEvidenceBundle,
  type GrowthCompanyEvidenceCrawlState,
} from "@/lib/growth/research/company-evidence/company-evidence-types"
import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"
import type { GrowthLeadAdmissionState } from "@/lib/growth/revenue-workflow/growth-lead-admission-types"

export type CollectProspectCompanyEvidenceInput = {
  organizationId: string
  companyName: string
  websiteUrl: string | null
  homepageHtml?: string | null
  homepageFetchStatus?: string
  approvedProfile?: BusinessProfileDraftContent | null
  activeMissionTitle?: string | null
  admissionState?: GrowthLeadAdmissionState | null
  forceRefresh?: boolean
  maxPages?: number
}

export type CollectProspectCompanyEvidenceResult = {
  bundle: GrowthCompanyEvidenceBundle | null
  rawItemCount: number
  warnings: string[]
}

async function fetchHtml(url: string): Promise<{ status: string; body: string | null }> {
  const result = await fetchPublicHtmlDocument(url)
  return { status: result.status, body: result.body }
}

function emptyRobotsPolicy(status: RobotsTxtPolicy["fetchStatus"]): RobotsTxtPolicy {
  return {
    fetchStatus: status,
    sitemapUrls: [],
    disallowPaths: [],
    rulesApplied: false,
  }
}

export async function collectProspectCompanyEvidence(
  input: CollectProspectCompanyEvidenceInput,
): Promise<CollectProspectCompanyEvidenceResult> {
  const warnings: string[] = []
  const skipReasons: string[] = []
  const maxPages = input.maxPages ?? COMPANY_EVIDENCE_MAX_PAGES

  if (!input.websiteUrl?.trim()) {
    return { bundle: null, rawItemCount: 0, warnings: ["No website URL available for evidence collection."] }
  }

  const normalized = normalizeLeadWebsite(input.websiteUrl)
  if (normalized.status !== "ready" || !normalized.url) {
    return {
      bundle: null,
      rawItemCount: 0,
      warnings: [`Website URL is not crawl-ready: ${normalized.status}`],
    }
  }

  const websiteUrl = normalized.url
  let homepageHtml = input.homepageHtml ?? null
  let websiteFetchOk = input.homepageFetchStatus === "ok"

  if (!homepageHtml) {
    const homepageFetch = await fetchHtml(websiteUrl)
    websiteFetchOk = homepageFetch.status === "ok"
    homepageHtml = homepageFetch.body
    if (!websiteFetchOk || !homepageHtml) {
      return {
        bundle: null,
        rawItemCount: 0,
        warnings: [`Homepage fetch failed: ${homepageFetch.status}`],
      }
    }
  }

  let sitemapXml: string | null = null
  let robotsPolicy = emptyRobotsPolicy("skipped")
  try {
    const origin = new URL(websiteUrl).origin
    const robots = await fetchHtml(`${origin}/robots.txt`)
    if (robots.status === "ok" && robots.body) {
      robotsPolicy = parseRobotsTxtPolicy(robots.body, "*")
      if (robotsPolicy.fetchStatus === "ok" && robotsPolicy.sitemapUrls[0]) {
        const sitemap = await fetchHtml(robotsPolicy.sitemapUrls[0])
        if (sitemap.status === "ok" && sitemap.body) sitemapXml = sitemap.body
      }
    } else if (robots.status === "ok") {
      robotsPolicy = emptyRobotsPolicy("malformed")
    } else {
      robotsPolicy = emptyRobotsPolicy("missing")
    }
    if (!sitemapXml) {
      const sitemap = await fetchHtml(`${origin}/sitemap.xml`)
      if (sitemap.status === "ok" && sitemap.body) sitemapXml = sitemap.body
    }
  } catch {
    warnings.push("Sitemap/robots discovery skipped due to fetch error.")
    if (robotsPolicy.fetchStatus === "skipped") robotsPolicy = emptyRobotsPolicy("error")
  }

  const planned = planBusinessWebsiteCrawlUrls({
    websiteUrl,
    homepageHtml,
    sitemapXml,
    maxPages: maxPages * 2,
  })

  const { allowed, blocked } = filterCrawlPlanByRobotsPolicy(planned, robotsPolicy)
  for (const entry of blocked) {
    skipReasons.push(`robots_blocked:${sanitizeUrlForCrawlDiagnostics(entry.url)}`)
  }

  const pageSelections: NonNullable<GrowthCompanyEvidenceCrawlState["pageSelections"]> = [
    ...blocked.map((entry) => ({
      url: sanitizeUrlForCrawlDiagnostics(entry.url),
      pageType: classifyBusinessWebsitePageType(entry.url),
      source: entry.source,
      reason: researchValueReasonForPageType(classifyBusinessWebsitePageType(entry.url)),
      status: "blocked_robots" as const,
      skipReason: "robots_disallow",
    })),
  ]

  const rawItems: EvidenceProviderRawItem[] = []
  const fetchedBodies = new Map<string, string>()
  fetchedBodies.set(websiteUrl.replace(/\/$/, "") || websiteUrl, homepageHtml)

  const websiteCoverage: string[] = []
  let pagesCrawled = 0
  let pagesSkipped = blocked.length
  let stopReason: string | null = null

  for (const entry of allowed) {
    if (pagesCrawled >= maxPages) {
      stopReason = "max_pages_reached"
      pageSelections.push({
        url: sanitizeUrlForCrawlDiagnostics(entry.url),
        pageType: classifyBusinessWebsitePageType(entry.url),
        source: entry.source,
        reason: researchValueReasonForPageType(classifyBusinessWebsitePageType(entry.url)),
        status: "page_cap",
        skipReason: "page_cap_reached",
      })
      pagesSkipped += 1
      skipReasons.push("page_cap_reached")
      break
    }

    const pageType: EvidenceEngineBusinessPageType = classifyBusinessWebsitePageType(entry.url)
    const reason = researchValueReasonForPageType(pageType)
    const safeUrl = sanitizeUrlForCrawlDiagnostics(entry.url)

    let html = fetchedBodies.get(entry.url) ?? null
    if (!html) {
      const fetched = await fetchHtml(entry.url)
      if (fetched.status !== "ok" || !fetched.body) {
        pagesSkipped += 1
        pageSelections.push({
          url: safeUrl,
          pageType,
          source: entry.source,
          reason,
          status: "fetch_failed",
          skipReason: `fetch_${fetched.status}`,
        })
        skipReasons.push(`fetch_failed:${safeUrl}`)
        continue
      }
      html = fetched.body
      fetchedBodies.set(entry.url, html)
    }

    pagesCrawled += 1
    websiteCoverage.push(safeUrl)
    pageSelections.push({
      url: safeUrl,
      pageType,
      source: entry.source,
      reason,
      status: "crawled",
    })

    rawItems.push(
      ...extractBusinessEvidenceFromHtml({
        html,
        pageUrl: entry.url,
        pageType,
      }),
    )

    const interimProfile = buildCompanyEvidenceProfileFromRawItems(rawItems)
    const interimScores = computeCompanyEvidenceQualityScores({
      profile: interimProfile,
      websiteFetchOk,
      pagesCrawled,
      hasVerifiedDomain: true,
    })
    const stop = evaluateCompanyEvidenceCrawlStop({
      profile: interimProfile,
      qualityScores: interimScores,
      pagesCrawled,
      maxPages,
    })
    if (stop.shouldStop) {
      stopReason = stop.reason
      break
    }
  }

  // Mark remaining allowed URLs not visited due to early stop
  if (stopReason && stopReason !== "max_pages_reached") {
    const crawled = new Set(websiteCoverage)
    for (const entry of allowed) {
      const safeUrl = sanitizeUrlForCrawlDiagnostics(entry.url)
      if (crawled.has(safeUrl)) continue
      if (pageSelections.some((p) => p.url === safeUrl)) continue
      pageSelections.push({
        url: safeUrl,
        pageType: classifyBusinessWebsitePageType(entry.url),
        source: entry.source,
        reason: researchValueReasonForPageType(classifyBusinessWebsitePageType(entry.url)),
        status: "skipped",
        skipReason: stopReason,
      })
      pagesSkipped += 1
    }
  }

  if (rawItems.length === 0) {
    warnings.push("No website evidence extracted from crawled pages.")
  }

  const profile = buildCompanyEvidenceProfileFromRawItems(rawItems)
  const qualityScores = computeCompanyEvidenceQualityScores({
    profile,
    websiteFetchOk,
    pagesCrawled,
    hasVerifiedDomain: true,
  })

  const crawlState = finalizeCompanyEvidenceCrawlState({
    pagesPlanned: Math.min(allowed.length, maxPages),
    pagesCrawled,
    websiteCoverage,
    profile,
    stopResult: {
      shouldStop: Boolean(stopReason),
      reason: stopReason,
    },
  })

  crawlState.pagesSkipped = pagesSkipped
  crawlState.robots = {
    robots_checked: true,
    robots_fetch_status: robotsPolicy.fetchStatus,
    robots_rules_applied: robotsPolicy.rulesApplied,
    robots_blocked_url_count: blocked.length,
    robots_disallow_count: robotsPolicy.disallowPaths.length,
  }
  crawlState.pageSelections = pageSelections.slice(0, 40)
  crawlState.skipReasons = [...new Set(skipReasons)].slice(0, 30)

  const missionComparison = compareCompanyEvidenceToMission({
    profile,
    approvedProfile: input.approvedProfile ?? null,
    activeMissionTitle: input.activeMissionTitle ?? null,
  })

  const evidenceSources = collectCompanyEvidenceSourceUrls(profile)
  const qualificationExplanation = buildCompanyEvidenceQualificationExplanation({
    profile,
    qualityScores,
    missionComparison,
    admissionState: input.admissionState,
    evidenceSources,
    missingEvidence: crawlState.missingInformation,
  })

  const bundle: GrowthCompanyEvidenceBundle = {
    qaMarker: GROWTH_COMPANY_EVIDENCE_22_QA_MARKER,
    collectedAt: new Date().toISOString(),
    websiteUrl,
    profile,
    qualityScores,
    crawlState,
    missionComparison,
    qualificationExplanation,
    evidenceSources,
    cacheKey: buildCompanyEvidenceCacheKey({
      companyName: input.companyName,
      website: websiteUrl,
      missionTitle: input.activeMissionTitle ?? null,
    }),
  }

  return { bundle, rawItemCount: rawItems.length, warnings }
}
