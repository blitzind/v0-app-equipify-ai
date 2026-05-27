/** Website contact discovery orchestration. Server-only. */

import "server-only"

import { createHash } from "node:crypto"
import { fetchLeadWebsite } from "@/lib/growth/research-website-fetch"
import { normalizeLeadWebsite } from "@/lib/growth/research-website-url"
import { extractAboutPageContacts } from "@/lib/growth/contact-discovery/extract/extract-about-page"
import { extractContactPageContacts } from "@/lib/growth/contact-discovery/extract/extract-contact-page"
import { extractLeadershipPageContacts } from "@/lib/growth/contact-discovery/extract/extract-leadership-page"
import { extractSchemaOrgPersonContacts } from "@/lib/growth/contact-discovery/extract/extract-schema-org-person"
import { extractTeamPageContacts } from "@/lib/growth/contact-discovery/extract/extract-team-page"
import {
  dedupeExtractedContacts,
  type ExtractedWebsiteContact,
} from "@/lib/growth/contact-discovery/extract/extract-shared"

const TEAM_PATHS = ["/team", "/about", "/leadership", "/staff", "/management", "/company", "/careers", "/contact"]

export type WebsiteContactDiscoveryResult = {
  website_url: string | null
  pages_crawled: string[]
  contacts: ExtractedWebsiteContact[]
  messages: string[]
}

function buildCandidatePaths(baseUrl: string): string[] {
  const normalized = normalizeLeadWebsite(baseUrl)
  if (!normalized) return []
  const origin = new URL(normalized).origin
  return [normalized, ...TEAM_PATHS.map((path) => `${origin}${path}`)]
}

function classifyPage(url: string): "team" | "contact" | "about" | "leadership" | "generic" {
  const lower = url.toLowerCase()
  if (lower.includes("/contact")) return "contact"
  if (lower.includes("/leadership") || lower.includes("/management")) return "leadership"
  if (lower.includes("/team") || lower.includes("/staff")) return "team"
  if (lower.includes("/about") || lower.includes("/company")) return "about"
  return "generic"
}

export async function discoverWebsiteContacts(rawWebsite: string | null | undefined): Promise<WebsiteContactDiscoveryResult> {
  const paths = buildCandidatePaths(rawWebsite ?? "")
  if (paths.length === 0) {
    return { website_url: null, pages_crawled: [], contacts: [], messages: ["No website URL provided."] }
  }

  const contacts: ExtractedWebsiteContact[] = []
  const pages_crawled: string[] = []
  const messages: string[] = []

  for (const pageUrl of paths) {
    const fetch = await fetchLeadWebsite(pageUrl)
    if (fetch.status !== "ok" || !fetch.excerpt) {
      messages.push(`${pageUrl}: fetch ${fetch.status}`)
      continue
    }
    pages_crawled.push(pageUrl)
    const html = fetch.excerpt
    const pageType = classifyPage(pageUrl)

    contacts.push(...extractSchemaOrgPersonContacts(html, pageUrl))
    if (pageType === "team") contacts.push(...extractTeamPageContacts(html, pageUrl))
    if (pageType === "contact") contacts.push(...extractContactPageContacts(html, pageUrl))
    if (pageType === "about") contacts.push(...extractAboutPageContacts(html, pageUrl))
    if (pageType === "leadership") contacts.push(...extractLeadershipPageContacts(html, pageUrl))
    if (pageType === "generic") {
      contacts.push(...extractTeamPageContacts(html, pageUrl))
      contacts.push(...extractAboutPageContacts(html, pageUrl))
    }
  }

  return {
    website_url: paths[0] ?? null,
    pages_crawled,
    contacts: dedupeExtractedContacts(contacts),
    messages,
  }
}

export function companyContactDedupeHash(input: {
  company_id: string
  full_name: string
  title: string | null
  email: string | null
}): string {
  const payload = [
    input.company_id,
    input.full_name.trim().toLowerCase(),
    (input.title ?? "").trim().toLowerCase(),
    (input.email ?? "").trim().toLowerCase(),
  ].join("|")
  return createHash("sha256").update(payload).digest("hex").slice(0, 32)
}
