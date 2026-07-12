/** Website crawl URL planning — same-domain, bounded, robots-safe paths. Client-safe. */

import type { WebsitePageType } from "@/lib/growth/contact-discovery/website-extraction-acquisition-types"

export const DEFAULT_WEBSITE_CRAWL_MAX_PAGES = 24
export const DEFAULT_WEBSITE_CRAWL_MAX_DEPTH = 2

const SEED_PATHS = [
  "/",
  "/team",
  "/our-team",
  "/meet-the-team",
  "/meet-our-team",
  "/about",
  "/about-us",
  "/who-we-are",
  "/leadership",
  "/staff",
  "/our-staff",
  "/management",
  "/management-team",
  "/our-people",
  "/people",
  "/executives",
  "/company",
  "/careers",
  "/contact",
  "/contact-us",
  "/services",
  "/service",
  "/locations",
  "/location",
  "/service-area",
  "/service-areas",
  "/areas-we-serve",
  "/privacy",
  "/privacy-policy",
  "/terms",
  "/blog",
]

const RELEVANT_LINK_KEYWORDS =
  /\b(team|staff|leadership|about|contact|location|locations|branch|office|careers|jobs|service|services|dispatch|support|sales|privacy|terms|author|faq|help|resources|blog|news|press|case-stud|testimonial|review|pricing|product|industr|solution|partner|financing|warranty|capabilities|markets|success)\b/i

const PERSON_PAGE_LINK_KEYWORDS =
  /\b(team|teams|staff|leadership|management|our-people|our-team|meet-the-team|meet-our-team|about|about-us|who-we-are|people|executives|directors|board|founders?|employees?|bios?)\b/i

const SKIP_EXTENSIONS =
  /\.(pdf|jpg|jpeg|png|gif|svg|webp|zip|doc|docx|xls|xlsx|mp4|mp3|css|js|woff2?)(\?|$)/i

export type WebsiteCrawlPlanEntry = {
  url: string
  depth: number
  source: "seed" | "sitemap" | "internal_link"
}

export function classifyWebsitePageType(url: string): WebsitePageType {
  const lower = url.toLowerCase()
  if (lower.endsWith("/") || /\/index\.html?$/.test(lower)) return "homepage"
  if (lower.includes("/contact")) return "contact"
  if (lower.includes("/privacy")) return "privacy"
  if (lower.includes("/terms")) return "terms"
  if (lower.includes("/service-area") || lower.includes("/areas-we-serve")) return "locations"
  if (lower.includes("/location")) return lower.includes("branch") ? "branch" : "locations"
  if (lower.includes("/careers")) return "careers"
  if (lower.includes("/leadership") || lower.includes("/management") || lower.includes("/executives")) {
    return "leadership"
  }
  if (
    lower.includes("/team") ||
    lower.includes("/staff") ||
    lower.includes("/meet-the") ||
    lower.includes("/our-people") ||
    lower.includes("/people")
  ) {
    return "team"
  }
  if (lower.includes("/about") || lower.includes("/who-we-are") || lower.includes("/company")) {
    return "about"
  }
  if (lower.includes("/service")) return "services"
  if (lower.includes("/author") || lower.includes("/blog/")) return "blog_author"
  return "generic"
}

function normalizeSameDomainUrl(origin: string, href: string): string | null {
  try {
    const resolved = new URL(href, origin)
    if (resolved.origin !== origin) return null
    if (SKIP_EXTENSIONS.test(resolved.pathname)) return null
    resolved.hash = ""
    return resolved.toString().replace(/\/$/, "") || resolved.origin
  } catch {
    return null
  }
}

export function extractInternalLinksFromHtml(html: string, origin: string): string[] {
  const links = new Set<string>()
  for (const match of html.matchAll(/href=["']([^"'#]+)["']/gi)) {
    const href = match[1]?.trim()
    if (!href || href.startsWith("mailto:") || href.startsWith("tel:")) continue
    const normalized = normalizeSameDomainUrl(origin, href)
    if (!normalized) continue
    const path = new URL(normalized).pathname.toLowerCase()
    if (RELEVANT_LINK_KEYWORDS.test(path)) links.add(normalized)
  }
  return [...links]
}

/** Nav/header/footer links likely to contain named staff evidence. */
export function extractPersonPageLinksFromHtml(html: string, origin: string): string[] {
  const links = new Set<string>()
  const sections = [
    ...html.matchAll(/<(?:nav|header|footer)[^>]*>([\s\S]*?)<\/(?:nav|header|footer)>/gi),
  ].map((match) => match[1] ?? "")

  const scanBlocks = sections.length > 0 ? sections : [html]
  for (const block of scanBlocks) {
    for (const match of block.matchAll(/href=["']([^"'#]+)["']/gi)) {
      const href = match[1]?.trim()
      if (!href || href.startsWith("mailto:") || href.startsWith("tel:")) continue
      const normalized = normalizeSameDomainUrl(origin, href)
      if (!normalized) continue
      const path = new URL(normalized).pathname.toLowerCase()
      if (PERSON_PAGE_LINK_KEYWORDS.test(path)) links.add(normalized)
    }
  }
  return [...links]
}

export function parseRobotsTxtSitemapUrls(robotsTxt: string): string[] {
  const urls: string[] = []
  for (const line of robotsTxt.split("\n")) {
    const match = line.match(/^\s*sitemap:\s*(.+)\s*$/i)
    const loc = match?.[1]?.trim()
    if (loc) urls.push(loc)
  }
  return urls
}

/** GE-AIOS-25C-1 — strip query/hash before diagnostics logging. */
export function sanitizeUrlForCrawlDiagnostics(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.search = ""
    parsed.hash = ""
    return parsed.toString().replace(/\/$/, "") || parsed.origin
  } catch {
    return url.split("?")[0]?.split("#")[0] ?? url
  }
}

export type RobotsTxtFetchStatus = "ok" | "missing" | "error" | "malformed" | "skipped"

export type RobotsTxtPolicy = {
  fetchStatus: RobotsTxtFetchStatus
  sitemapUrls: string[]
  disallowPaths: string[]
  rulesApplied: boolean
}

/**
 * Parse User-agent / Disallow rules for matching agent (default *).
 * Fail-safe: malformed input yields empty disallow list with malformed status.
 */
export function parseRobotsTxtPolicy(
  robotsTxt: string | null | undefined,
  userAgent = "*",
): RobotsTxtPolicy {
  const sitemapUrls = robotsTxt ? parseRobotsTxtSitemapUrls(robotsTxt) : []
  if (robotsTxt == null || !String(robotsTxt).trim()) {
    return {
      fetchStatus: "missing",
      sitemapUrls: [],
      disallowPaths: [],
      rulesApplied: false,
    }
  }

  try {
    const lines = String(robotsTxt).split(/\r?\n/)
    const uaTarget = userAgent.trim().toLowerCase() || "*"
    type Group = { agents: string[]; disallows: string[] }
    const groups: Group[] = []
    let current: Group | null = null

    for (const raw of lines) {
      const line = raw.replace(/#.*$/, "").trim()
      if (!line) continue

      const uaMatch = line.match(/^user-agent:\s*(.+)$/i)
      if (uaMatch) {
        const agent = (uaMatch[1] ?? "*").trim().toLowerCase()
        if (!current || current.disallows.length > 0) {
          current = { agents: [agent], disallows: [] }
          groups.push(current)
        } else {
          current.agents.push(agent)
        }
        continue
      }

      const disallowMatch = line.match(/^disallow:\s*(.*)$/i)
      if (disallowMatch && current) {
        const path = (disallowMatch[1] ?? "").trim()
        if (path) current.disallows.push(path)
        continue
      }
    }

    const exact = groups.find((g) => g.agents.includes(uaTarget))
    const star = groups.find((g) => g.agents.includes("*"))
    const chosen = exact ?? star
    const merged = [...new Set(chosen?.disallows ?? [])]

    return {
      fetchStatus: "ok",
      sitemapUrls,
      disallowPaths: merged,
      rulesApplied: merged.length > 0,
    }
  } catch {
    return {
      fetchStatus: "malformed",
      sitemapUrls,
      disallowPaths: [],
      rulesApplied: false,
    }
  }
}

/** Path-prefix Disallow matching (robots.txt common case). */
export function isUrlDisallowedByRobots(url: string, disallowPaths: string[]): boolean {
  if (!disallowPaths.length) return false
  let pathname = "/"
  try {
    pathname = new URL(url).pathname || "/"
  } catch {
    pathname = url.startsWith("/") ? url : `/${url}`
  }

  for (const rule of disallowPaths) {
    if (!rule) continue
    if (rule === "/") return true
    if (rule.includes("*")) {
      const escaped = rule.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")
      if (new RegExp(`^${escaped}`).test(pathname)) return true
      continue
    }
    if (pathname === rule) return true
    if (pathname.startsWith(rule.endsWith("/") ? rule : `${rule}/`)) return true
    if (!rule.endsWith("/") && pathname.startsWith(rule)) {
      const next = pathname.charAt(rule.length)
      if (!next || next === "/" || next === "?" || next === "#") return true
    }
  }
  return false
}

export function filterCrawlPlanByRobotsPolicy(
  plan: WebsiteCrawlPlanEntry[],
  policy: RobotsTxtPolicy,
): { allowed: WebsiteCrawlPlanEntry[]; blocked: WebsiteCrawlPlanEntry[] } {
  if (!policy.rulesApplied || policy.disallowPaths.length === 0) {
    return { allowed: plan, blocked: [] }
  }
  const allowed: WebsiteCrawlPlanEntry[] = []
  const blocked: WebsiteCrawlPlanEntry[] = []
  for (const entry of plan) {
    if (isUrlDisallowedByRobots(entry.url, policy.disallowPaths)) blocked.push(entry)
    else allowed.push(entry)
  }
  return { allowed, blocked }
}

export function parseSitemapIndexUrls(xml: string, origin: string, max = 6): string[] {
  const urls: string[] = []
  for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/gi)) {
    const loc = match[1]?.trim()
    if (!loc) continue
    try {
      const parsed = new URL(loc)
      if (parsed.origin !== origin && !loc.endsWith(".xml")) continue
      urls.push(parsed.toString())
    } catch {
      continue
    }
    if (urls.length >= max) break
  }
  return urls
}

function personPagePriority(url: string): number {
  const lower = url.toLowerCase()
  if (/\/(team|staff|our-people|people|meet-the|meet-our|leadership|management|executives)\b/.test(lower)) {
    return 0
  }
  if (/\/(about|who-we-are|company)\b/.test(lower)) return 1
  if (/\/contact/.test(lower)) return 3
  return 2
}

export function rankCrawlPlanForPersonDiscovery(plan: WebsiteCrawlPlanEntry[]): WebsiteCrawlPlanEntry[] {
  return [...plan].sort((a, b) => {
    const priorityDelta = personPagePriority(a.url) - personPagePriority(b.url)
    if (priorityDelta !== 0) return priorityDelta
    if (a.depth !== b.depth) return a.depth - b.depth
    return a.url.localeCompare(b.url)
  })
}

export function parseSitemapUrls(xml: string, origin: string, max = 12): string[] {
  const urls: string[] = []
  for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/gi)) {
    const loc = match[1]?.trim()
    if (!loc) continue
    try {
      const parsed = new URL(loc)
      if (parsed.origin !== origin) continue
      if (SKIP_EXTENSIONS.test(parsed.pathname)) continue
      if (RELEVANT_LINK_KEYWORDS.test(parsed.pathname.toLowerCase())) {
        urls.push(parsed.toString().replace(/\/$/, "") || parsed.origin)
      }
    } catch {
      continue
    }
    if (urls.length >= max) break
  }
  return urls
}

export function planWebsiteCrawlUrls(input: {
  websiteUrl: string
  homepageHtml?: string | null
  sitemapXml?: string | null
  personPageLinks?: string[]
  maxPages?: number
  prioritize_person_pages?: boolean
}): WebsiteCrawlPlanEntry[] {
  const maxPages = input.maxPages ?? DEFAULT_WEBSITE_CRAWL_MAX_PAGES
  let origin = ""
  try {
    origin = new URL(input.websiteUrl).origin
  } catch {
    return []
  }

  const seen = new Set<string>()
  const plan: WebsiteCrawlPlanEntry[] = []

  function push(url: string, depth: number, source: WebsiteCrawlPlanEntry["source"]) {
    const normalized = url.replace(/\/$/, "") || origin
    if (seen.has(normalized) || plan.length >= maxPages) return
    seen.add(normalized)
    plan.push({ url: normalized, depth, source })
  }

  push(input.websiteUrl.replace(/\/$/, "") || origin, 0, "seed")
  for (const path of SEED_PATHS) {
    if (path === "/") continue
    push(`${origin}${path}`, 0, "seed")
  }

  if (input.sitemapXml) {
    for (const url of parseSitemapUrls(input.sitemapXml, origin)) {
      push(url, 1, "sitemap")
    }
  }

  if (input.homepageHtml) {
    for (const url of extractInternalLinksFromHtml(input.homepageHtml, origin)) {
      push(url, 1, "internal_link")
    }
    for (const url of extractPersonPageLinksFromHtml(input.homepageHtml, origin)) {
      push(url, 1, "internal_link")
    }
  }

  for (const url of input.personPageLinks ?? []) {
    push(url, 1, "internal_link")
  }

  const ranked = input.prioritize_person_pages === false ? plan : rankCrawlPlanForPersonDiscovery(plan)
  return ranked.slice(0, maxPages)
}
