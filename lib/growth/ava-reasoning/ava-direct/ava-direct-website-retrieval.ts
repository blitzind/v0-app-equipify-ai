/**
 * AVA-DIRECT-PRODUCTION-CUTOVER-1A — Safe website text retrieval for Ava direct reasoning.
 * Software capability only — no business interpretation.
 */

import "server-only"

import { fetchPublicHtmlDocument } from "@/lib/growth/research-website-fetch"
import { stripHtmlToPlainText } from "@/lib/growth/research-website-html"
import { normalizeLeadWebsite } from "@/lib/growth/research-website-url"

export const AVA_DIRECT_WEBSITE_MAX_TEXT_CHARS = 48_000 as const
export const AVA_DIRECT_WEBSITE_PARTIAL_HTML_BYTES = 900_000 as const

export type AvaDirectWebsiteRetrievalResult =
  | {
      ok: true
      normalizedUrl: string
      sourceUrls: string[]
      text: string
      charCount: number
      truncated: boolean
      partialFetch: boolean
    }
  | {
      ok: false
      code:
        | "no_website"
        | "invalid_url"
        | "disabled"
        | "blocked"
        | "fetch_failed"
        | "empty"
      normalizedUrl: string | null
      message: string
    }

async function fetchPartialHtml(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "EquipifyGrowthResearch/1.0 (ava-direct)",
      },
      signal: AbortSignal.timeout(12_000),
    })
    if (!response.ok) return null
    return (await response.text()).slice(0, AVA_DIRECT_WEBSITE_PARTIAL_HTML_BYTES)
  } catch {
    return null
  }
}

export async function retrieveWebsiteTextForAvaDirect(
  websiteUrl: string | null | undefined,
): Promise<AvaDirectWebsiteRetrievalResult> {
  if (!websiteUrl?.trim()) {
    return {
      ok: false,
      code: "no_website",
      normalizedUrl: null,
      message: "No website URL available for this lead.",
    }
  }

  const normalized = normalizeLeadWebsite(websiteUrl)
  if (normalized.status !== "ready" || !normalized.url) {
    return {
      ok: false,
      code: normalized.status === "invalid_url" ? "invalid_url" : "fetch_failed",
      normalizedUrl: null,
      message: `Website URL is not crawl-ready: ${normalized.status}`,
    }
  }

  let partialFetch = false
  let htmlBody: string | null = null
  let sourceUrls: string[] = [normalized.url]

  const fetched = await fetchPublicHtmlDocument(normalized.url)
  if (fetched.status === "ok" && fetched.body?.trim()) {
    htmlBody = fetched.body
    sourceUrls = fetched.sourceUrls
  } else if (fetched.status === "skipped") {
    return {
      ok: false,
      code: "disabled",
      normalizedUrl: normalized.url,
      message: "Website retrieval is disabled by configuration.",
    }
  } else if (fetched.status === "blocked") {
    return {
      ok: false,
      code: "blocked",
      normalizedUrl: normalized.url,
      message: "Website destination was blocked by safety policy.",
    }
  } else {
    htmlBody = await fetchPartialHtml(normalized.url)
    partialFetch = Boolean(htmlBody)
  }

  if (!htmlBody?.trim()) {
    return {
      ok: false,
      code: "fetch_failed",
      normalizedUrl: normalized.url,
      message: `Website could not be retrieved (${fetched.status}).`,
    }
  }

  const plain = stripHtmlToPlainText(htmlBody).trim()
  if (!plain) {
    return {
      ok: false,
      code: "empty",
      normalizedUrl: normalized.url,
      message: "Website was retrieved but contained no usable text.",
    }
  }

  const truncated = plain.length > AVA_DIRECT_WEBSITE_MAX_TEXT_CHARS
  const text = truncated
    ? `${plain.slice(0, AVA_DIRECT_WEBSITE_MAX_TEXT_CHARS - 1)}…`
    : plain

  return {
    ok: true,
    normalizedUrl: normalized.url,
    sourceUrls,
    text,
    charCount: text.length,
    truncated,
    partialFetch,
  }
}
