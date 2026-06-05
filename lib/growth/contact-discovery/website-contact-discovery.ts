/** Website contact discovery orchestration. Server-only. */

import "server-only"

import { createHash } from "node:crypto"
import { fetchLeadWebsite } from "@/lib/growth/research-website-fetch"
import { resolveReadyLeadWebsiteUrl } from "@/lib/growth/research-website-url"
import { extractAboutPageContacts } from "@/lib/growth/contact-discovery/extract/extract-about-page"
import { extractAuthorBylineContacts } from "@/lib/growth/contact-discovery/extract/extract-author-byline"
import { extractContactCardContacts } from "@/lib/growth/contact-discovery/extract/extract-contact-card"
import { extractContactPageContacts } from "@/lib/growth/contact-discovery/extract/extract-contact-page"
import { extractFooterContacts } from "@/lib/growth/contact-discovery/extract/extract-footer"
import { extractLeadershipPageContacts } from "@/lib/growth/contact-discovery/extract/extract-leadership-page"
import { extractSchemaOrgPersonContacts } from "@/lib/growth/contact-discovery/extract/extract-schema-org-person"
import { extractTeamPageContacts } from "@/lib/growth/contact-discovery/extract/extract-team-page"
import {
  dedupeExtractedContacts,
  type ExtractedWebsiteContact,
} from "@/lib/growth/contact-discovery/extract/extract-shared"
import {
  classifyWebsitePageType,
  DEFAULT_WEBSITE_CRAWL_MAX_PAGES,
  planWebsiteCrawlUrls,
} from "@/lib/growth/contact-discovery/website-crawl-planner"
import { enrichExtractedWebsiteContacts } from "@/lib/growth/contact-discovery/website-extraction-enrichment"
import {
  GROWTH_DEEP_CONTACT_ACQUISITION_QA_MARKER,
  GROWTH_WEBSITE_EXTRACTION_QUALITY_QA_MARKER,
  type WebsiteExtractionDiagnosticsSnapshot,
} from "@/lib/growth/contact-discovery/website-extraction-acquisition-types"
import {
  extractLinkedInCompanyReferences,
} from "@/lib/growth/contact-discovery/website-profile-references"

export type WebsiteContactDiscoveryResult = {
  website_url: string | null
  pages_crawled: string[]
  contacts: ExtractedWebsiteContact[]
  messages: string[]
  diagnostics: WebsiteExtractionDiagnosticsSnapshot
  linkedin_company_urls: string[]
}

function extractContactsFromPage(html: string, pageUrl: string, pageType: ReturnType<typeof classifyWebsitePageType>): ExtractedWebsiteContact[] {
  const contacts: ExtractedWebsiteContact[] = []
  contacts.push(...extractSchemaOrgPersonContacts(html, pageUrl))
  contacts.push(...extractFooterContacts(html, pageUrl))
  if (pageType === "team" || pageType === "staff") {
    contacts.push(...extractTeamPageContacts(html, pageUrl))
    contacts.push(...extractContactCardContacts(html, pageUrl))
  }
  if (pageType === "contact") contacts.push(...extractContactPageContacts(html, pageUrl))
  if (pageType === "about" || pageType === "careers") contacts.push(...extractAboutPageContacts(html, pageUrl))
  if (pageType === "leadership") contacts.push(...extractLeadershipPageContacts(html, pageUrl))
  if (pageType === "blog_author") contacts.push(...extractAuthorBylineContacts(html, pageUrl))
  if (pageType === "privacy" || pageType === "locations" || pageType === "branch") {
    contacts.push(...extractContactPageContacts(html, pageUrl))
  }
  if (pageType === "generic" || pageType === "homepage" || pageType === "services") {
    contacts.push(...extractTeamPageContacts(html, pageUrl))
    contacts.push(...extractAboutPageContacts(html, pageUrl))
    contacts.push(...extractContactPageContacts(html, pageUrl))
  }
  return contacts.map((contact) => ({
    ...contact,
    source_page_type: contact.source_page_type ?? pageType,
    source_page_url: contact.source_page_url ?? pageUrl,
  }))
}

function buildDiagnostics(input: {
  pages_crawled: string[]
  pages_skipped: string[]
  pages_failed: string[]
  contacts: ExtractedWebsiteContact[]
  linkedin_company_urls: string[]
  warnings: string[]
  failure_reason: string | null
  unreachable: boolean
}): WebsiteExtractionDiagnosticsSnapshot {
  const emails = new Set(input.contacts.map((c) => c.email).filter(Boolean))
  const phones = new Set(input.contacts.map((c) => c.phone).filter(Boolean))
  const linkedinRefs = input.contacts.filter((c) => c.linkedin_url || c.linkedin_company_url).length

  let summary: string | null = null
  if (input.contacts.length === 0 && input.pages_crawled.length === 0) {
    summary = "Website unreachable or blocked — no pages crawled"
  } else if (input.contacts.length === 0) {
    summary = "Website crawl found no team/contact pages with evidence-backed contacts"
  } else if (input.contacts.every((c) => c.full_name === "Company contact")) {
    summary = "Only generic role emails or phones found — no named decision makers"
  } else if (linkedinRefs === 0 && input.linkedin_company_urls.length > 0) {
    summary = "LinkedIn company page found — no public staff profile links on website"
  }

  return {
    qa_marker: GROWTH_WEBSITE_EXTRACTION_QUALITY_QA_MARKER,
    pages_crawled: input.pages_crawled,
    pages_skipped: input.pages_skipped,
    pages_failed: input.pages_failed,
    contacts_found: input.contacts.length,
    emails_found: emails.size,
    phones_found: phones.size,
    linkedin_references_found: linkedinRefs + input.linkedin_company_urls.length,
    extraction_warnings: input.warnings.slice(0, 8),
    failure_reason: input.failure_reason,
    robots_or_blocked: input.unreachable && input.pages_crawled.length === 0,
    unreachable: input.unreachable,
    last_crawl_at: new Date().toISOString(),
    summary,
  }
}

export async function discoverWebsiteContacts(rawWebsite: string | null | undefined): Promise<WebsiteContactDiscoveryResult> {
  const websiteUrl = resolveReadyLeadWebsiteUrl(rawWebsite ?? "")
  if (!websiteUrl) {
    const diagnostics = buildDiagnostics({
      pages_crawled: [],
      pages_skipped: [],
      pages_failed: [],
      contacts: [],
      linkedin_company_urls: [],
      warnings: [],
      failure_reason: "No website URL provided",
      unreachable: true,
    })
    return {
      website_url: null,
      pages_crawled: [],
      contacts: [],
      messages: ["No website URL provided."],
      diagnostics,
      linkedin_company_urls: [],
    }
  }

  const contacts: ExtractedWebsiteContact[] = []
  const pages_crawled: string[] = []
  const pages_failed: string[] = []
  const pages_skipped: string[] = []
  const messages: string[] = []
  const warnings: string[] = []
  let homepageHtml: string | null = null
  let sitemapXml: string | null = null
  let linkedinCompanyUrls: string[] = []
  let companyDomain: string | null = null

  try {
    companyDomain = new URL(websiteUrl).hostname.replace(/^www\./, "")
  } catch {
    companyDomain = null
  }

  const homepageFetch = await fetchLeadWebsite(websiteUrl)
  if (homepageFetch.status === "ok" && homepageFetch.excerpt) {
    homepageHtml = homepageFetch.excerpt
    linkedinCompanyUrls = extractLinkedInCompanyReferences(homepageHtml)
  } else {
    messages.push(`${websiteUrl}: homepage fetch ${homepageFetch.status}`)
  }

  try {
    const origin = new URL(websiteUrl).origin
    const sitemapFetch = await fetchLeadWebsite(`${origin}/sitemap.xml`)
    if (sitemapFetch.status === "ok" && sitemapFetch.excerpt) {
      sitemapXml = sitemapFetch.excerpt
    }
  } catch {
    // Sitemap optional
  }

  const crawlPlan = planWebsiteCrawlUrls({
    websiteUrl,
    homepageHtml,
    sitemapXml,
    maxPages: DEFAULT_WEBSITE_CRAWL_MAX_PAGES,
  })

  const websiteUrlNoTrailingSlash = websiteUrl.replace(/\/$/, "")

  for (const entry of crawlPlan) {
    if (entry.depth > 0 && pages_crawled.length >= DEFAULT_WEBSITE_CRAWL_MAX_PAGES) {
      pages_skipped.push(entry.url)
      continue
    }

    let html =
      entry.url === websiteUrlNoTrailingSlash || entry.url === websiteUrl ? homepageHtml : null
    if (!html) {
      try {
        const fetch = await fetchLeadWebsite(entry.url)
        if (fetch.status !== "ok" || !fetch.excerpt) {
          pages_failed.push(entry.url)
          messages.push(`${entry.url}: fetch ${fetch.status}`)
          if (fetch.status === "blocked" || fetch.status === "timeout") {
            warnings.push(`${entry.url}: ${fetch.status}`)
          }
          continue
        }
        html = fetch.excerpt
      } catch (err) {
        pages_failed.push(entry.url)
        messages.push(`${entry.url}: ${err instanceof Error ? err.message : "fetch failed"}`)
        continue
      }
    }

    pages_crawled.push(entry.url)
    const pageType = classifyWebsitePageType(entry.url)
    try {
      const pageContacts = extractContactsFromPage(html, entry.url, pageType)
      contacts.push(...pageContacts)
      if (pageType === "homepage" || pageType === "footer") {
        linkedinCompanyUrls = [
          ...new Set([...linkedinCompanyUrls, ...extractLinkedInCompanyReferences(html)]),
        ]
      }
    } catch (err) {
      warnings.push(
        `${entry.url}: extraction failed (${err instanceof Error ? err.message : "unknown"})`,
      )
    }
  }

  const deduped = dedupeExtractedContacts(contacts)
  const enriched = enrichExtractedWebsiteContacts({
    contacts: deduped,
    companyDomain,
    linkedinCompanyUrls,
  })

  const diagnostics = buildDiagnostics({
    pages_crawled,
    pages_skipped,
    pages_failed,
    contacts: enriched,
    linkedin_company_urls: linkedinCompanyUrls,
    warnings,
    failure_reason: pages_crawled.length === 0 ? messages[0] ?? "No pages fetched" : null,
    unreachable: pages_crawled.length === 0,
  })

  return {
    website_url: websiteUrl,
    pages_crawled,
    contacts: enriched,
    messages: [
      ...messages,
      `${GROWTH_DEEP_CONTACT_ACQUISITION_QA_MARKER}: ${enriched.length} contact(s), ${pages_crawled.length} page(s) crawled`,
    ],
    diagnostics,
    linkedin_company_urls: linkedinCompanyUrls,
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
