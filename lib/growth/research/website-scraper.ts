import "server-only"

import { fetchLeadWebsite } from "@/lib/growth/research-website-fetch"
import { stripHtmlToPlainText } from "@/lib/growth/research-website-html"
import type { GrowthWebsiteScrapeResult } from "@/lib/growth/research/research-types"

const SERVICE_KEYWORDS = [
  "service",
  "repair",
  "maintenance",
  "installation",
  "inspection",
  "replacement",
  "emergency",
]

const CONTACT_PATTERNS = [
  /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g,
  /\(\d{3}\)\s*\d{3}[-.\s]?\d{4}/g,
  /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/g,
]

function extractListItems(html: string, pattern: RegExp, limit = 8): string[] {
  const matches = html.match(pattern) ?? []
  return [...new Set(matches.map((entry) => entry.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()))]
    .filter((entry) => entry.length > 2 && entry.length < 120)
    .slice(0, limit)
}

function extractServices(html: string, plainText: string): string[] {
  const headingMatches = extractListItems(html, /<h[2-4][^>]*>([^<]{4,80})<\/h[2-4]>/gi, 12)
  const keywordLines = plainText
    .split(/\n|\.|•/)
    .map((line) => line.trim())
    .filter((line) => line.length > 8 && line.length < 100 && SERVICE_KEYWORDS.some((word) => line.toLowerCase().includes(word)))
  return [...new Set([...headingMatches, ...keywordLines])].slice(0, 8)
}

function extractServiceAreas(plainText: string): string[] {
  const areaMatches = plainText.match(/(?:serving|service area|areas served|we serve)[^.]{0,120}/gi) ?? []
  return areaMatches
    .map((entry) => entry.replace(/\s+/g, " ").trim())
    .filter((entry) => entry.length > 12)
    .slice(0, 5)
}

function extractContactMethods(html: string, plainText: string): string[] {
  const methods = new Set<string>()
  if (/mailto:/i.test(html) || CONTACT_PATTERNS[0].test(plainText)) methods.add("email")
  if (/tel:/i.test(html) || CONTACT_PATTERNS[1].test(plainText) || CONTACT_PATTERNS[2].test(plainText)) methods.add("phone")
  if (/contact\s*form|request\s*service|get\s*a\s*quote/i.test(html)) methods.add("contact_form")
  if (/schedule|book\s*(online|now|appointment)/i.test(html)) methods.add("online_scheduling")
  return [...methods]
}

function readMetaContent(html: string, name: string): string | null {
  const match = html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)`, "i"))
  return match?.[1]?.trim() ?? null
}

function readTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]{1,160})<\/title>/i)
  return match?.[1]?.replace(/\s+/g, " ").trim() ?? null
}

export async function scrapeProspectWebsite(rawWebsite: string | null | undefined): Promise<GrowthWebsiteScrapeResult> {
  const fetch = await fetchLeadWebsite(rawWebsite)
  const html = fetch.excerpt ? `<body>${fetch.excerpt}</body>` : ""
  const plainText = fetch.excerpt ? stripHtmlToPlainText(fetch.excerpt) : ""

  return {
    url: fetch.normalizedUrl,
    fetchStatus: fetch.status,
    title: html ? readTitle(html) : null,
    metaDescription: html ? readMetaContent(html, "description") : null,
    services: html ? extractServices(html, plainText) : [],
    serviceAreas: plainText ? extractServiceAreas(plainText) : [],
    contactMethods: html ? extractContactMethods(html, plainText) : [],
    plainText,
    html,
    hasSsl: Boolean(fetch.normalizedUrl?.startsWith("https://")),
    hasMobileViewport: /viewport/i.test(html),
  }
}
