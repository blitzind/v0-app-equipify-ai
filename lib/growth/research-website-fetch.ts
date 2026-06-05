import "server-only"

import { getGrowthResearchWebsiteConfig } from "@/lib/growth/research-website-config"
import { isLikelyTextContent, stripHtmlToPlainText } from "@/lib/growth/research-website-html"
import {
  assertLeadWebsiteUrlSafe,
  hostnameForLog,
  normalizeLeadWebsite,
  truncateWebsiteExcerpt,
  type GrowthLeadWebsiteFetchStatus,
} from "@/lib/growth/research-website-url"

export type GrowthLeadWebsiteFetchResult = {
  status: GrowthLeadWebsiteFetchStatus
  normalizedUrl: string | null
  sourceUrls: string[]
  excerpt: string | null
  durationMs: number
  byteCount: number
}

const USER_AGENT = "EquipifyGrowthResearch/1.0 (internal)"

async function readResponseBodyLimited(
  response: Response,
  maxBytes: number,
): Promise<{ ok: true; body: string; byteCount: number } | { ok: false; status: "too_large" | "error" }> {
  const reader = response.body?.getReader()
  if (!reader) {
    const text = await response.text().catch(() => null)
    if (text == null) return { ok: false, status: "error" }
    if (text.length > maxBytes) return { ok: false, status: "too_large" }
    return { ok: true, body: text, byteCount: text.length }
  }

  const chunks: Uint8Array[] = []
  let byteCount = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    byteCount += value.byteLength
    if (byteCount > maxBytes) {
      await reader.cancel().catch(() => undefined)
      return { ok: false, status: "too_large" }
    }
    chunks.push(value)
  }

  const merged = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))
  return { ok: true, body: merged.toString("utf-8"), byteCount }
}

function failureResult(
  status: GrowthLeadWebsiteFetchStatus,
  url: string | null,
  sourceUrls: string[],
  started: number,
  byteCount = 0,
): GrowthLeadWebsiteFetchResult {
  return {
    status,
    normalizedUrl: url,
    sourceUrls,
    excerpt: null,
    durationMs: Date.now() - started,
    byteCount,
  }
}

export async function fetchLeadWebsite(rawWebsite: string | null | undefined): Promise<GrowthLeadWebsiteFetchResult> {
  const config = getGrowthResearchWebsiteConfig()
  const started = Date.now()

  if (!config.enabled) {
    return failureResult("skipped", null, [], started)
  }

  const normalized = normalizeLeadWebsite(rawWebsite)
  if (normalized.status === "skipped") {
    return failureResult("skipped", null, [], started)
  }
  if (normalized.status === "invalid_url") {
    return failureResult("invalid_url", null, [], started)
  }

  let currentUrl = normalized.url
  const sourceUrls = [currentUrl]

  for (let hop = 0; hop <= config.maxRedirects; hop++) {
    const safety = await assertLeadWebsiteUrlSafe(currentUrl)
    if (!safety.ok) {
      return failureResult("blocked", currentUrl, sourceUrls, started)
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), config.timeoutMs)

    try {
      const response = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: "text/html, text/plain;q=0.9, application/xhtml+xml;q=0.8, */*;q=0.1",
          "User-Agent": USER_AGENT,
        },
      })

      if (response.status >= 300 && response.status < 400) {
        if (hop >= config.maxRedirects) {
          return failureResult("error", currentUrl, sourceUrls, started)
        }
        const location = response.headers.get("location")
        if (!location) return failureResult("error", currentUrl, sourceUrls, started)

        let nextUrl: string
        try {
          nextUrl = new URL(location, currentUrl).href
        } catch {
          return failureResult("error", currentUrl, sourceUrls, started)
        }

        const nextNormalized = normalizeLeadWebsite(nextUrl)
        if (nextNormalized.status !== "ready") {
          return failureResult("blocked", currentUrl, sourceUrls, started)
        }

        currentUrl = nextNormalized.url
        if (!sourceUrls.includes(currentUrl)) sourceUrls.push(currentUrl)
        continue
      }

      if (!response.ok) {
        return failureResult("error", currentUrl, sourceUrls, started)
      }

      const bodyResult = await readResponseBodyLimited(response, config.maxBytes)
      if (!bodyResult.ok) {
        return failureResult(bodyResult.status, currentUrl, sourceUrls, started)
      }

      const contentType = response.headers.get("content-type")
      if (!isLikelyTextContent(contentType, bodyResult.body)) {
        return failureResult("error", currentUrl, sourceUrls, started, bodyResult.byteCount)
      }

      const plain =
        contentType?.toLowerCase().includes("text/plain")
          ? bodyResult.body.replace(/\s+/g, " ").trim()
          : stripHtmlToPlainText(bodyResult.body)

      if (!plain) {
        return failureResult("error", currentUrl, sourceUrls, started, bodyResult.byteCount)
      }

      return {
        status: "ok",
        normalizedUrl: currentUrl,
        sourceUrls: [currentUrl],
        excerpt: truncateWebsiteExcerpt(plain, config.excerptChars),
        durationMs: Date.now() - started,
        byteCount: bodyResult.byteCount,
      }
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === "AbortError"
      return failureResult(isTimeout ? "timeout" : "error", currentUrl, sourceUrls, started)
    } finally {
      clearTimeout(timer)
    }
  }

  return failureResult("error", currentUrl, sourceUrls, started)
}

export type GrowthPublicHtmlFetchResult = {
  status: GrowthLeadWebsiteFetchStatus
  normalizedUrl: string | null
  sourceUrls: string[]
  body: string | null
  durationMs: number
  byteCount: number
}

/** Fetch public HTML document (full body, not plain-text excerpt) for external evidence extraction. */
export async function fetchPublicHtmlDocument(
  rawUrl: string | null | undefined,
): Promise<GrowthPublicHtmlFetchResult> {
  const config = getGrowthResearchWebsiteConfig()
  const started = Date.now()

  if (!config.enabled) {
    return { status: "skipped", normalizedUrl: null, sourceUrls: [], body: null, durationMs: Date.now() - started, byteCount: 0 }
  }

  const normalized = normalizeLeadWebsite(rawUrl)
  if (normalized.status === "skipped") {
    return { status: "skipped", normalizedUrl: null, sourceUrls: [], body: null, durationMs: Date.now() - started, byteCount: 0 }
  }
  if (normalized.status === "invalid_url") {
    return { status: "invalid_url", normalizedUrl: null, sourceUrls: [], body: null, durationMs: Date.now() - started, byteCount: 0 }
  }

  let currentUrl = normalized.url
  const sourceUrls = [currentUrl]

  for (let hop = 0; hop <= config.maxRedirects; hop++) {
    const safety = await assertLeadWebsiteUrlSafe(currentUrl)
    if (!safety.ok) {
      return { status: "blocked", normalizedUrl: currentUrl, sourceUrls, body: null, durationMs: Date.now() - started, byteCount: 0 }
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), config.timeoutMs)

    try {
      const response = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: "text/html, text/plain;q=0.9, application/xhtml+xml;q=0.8, */*;q=0.1",
          "User-Agent": USER_AGENT,
        },
      })

      if (response.status >= 300 && response.status < 400) {
        if (hop >= config.maxRedirects) {
          return { status: "error", normalizedUrl: currentUrl, sourceUrls, body: null, durationMs: Date.now() - started, byteCount: 0 }
        }
        const location = response.headers.get("location")
        if (!location) return { status: "error", normalizedUrl: currentUrl, sourceUrls, body: null, durationMs: Date.now() - started, byteCount: 0 }

        let nextUrl: string
        try {
          nextUrl = new URL(location, currentUrl).href
        } catch {
          return { status: "error", normalizedUrl: currentUrl, sourceUrls, body: null, durationMs: Date.now() - started, byteCount: 0 }
        }

        const nextNormalized = normalizeLeadWebsite(nextUrl)
        if (nextNormalized.status !== "ready") {
          return { status: "blocked", normalizedUrl: currentUrl, sourceUrls, body: null, durationMs: Date.now() - started, byteCount: 0 }
        }

        currentUrl = nextNormalized.url
        if (!sourceUrls.includes(currentUrl)) sourceUrls.push(currentUrl)
        continue
      }

      if (!response.ok) {
        return { status: "error", normalizedUrl: currentUrl, sourceUrls, body: null, durationMs: Date.now() - started, byteCount: 0 }
      }

      const bodyResult = await readResponseBodyLimited(response, config.maxBytes)
      if (!bodyResult.ok) {
        return {
          status: bodyResult.status,
          normalizedUrl: currentUrl,
          sourceUrls,
          body: null,
          durationMs: Date.now() - started,
          byteCount: 0,
        }
      }

      const contentType = response.headers.get("content-type")
      if (!isLikelyTextContent(contentType, bodyResult.body)) {
        return {
          status: "error",
          normalizedUrl: currentUrl,
          sourceUrls,
          body: null,
          durationMs: Date.now() - started,
          byteCount: bodyResult.byteCount,
        }
      }

      return {
        status: "ok",
        normalizedUrl: currentUrl,
        sourceUrls: [currentUrl],
        body: bodyResult.body,
        durationMs: Date.now() - started,
        byteCount: bodyResult.byteCount,
      }
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === "AbortError"
      return {
        status: isTimeout ? "timeout" : "error",
        normalizedUrl: currentUrl,
        sourceUrls,
        body: null,
        durationMs: Date.now() - started,
        byteCount: 0,
      }
    } finally {
      clearTimeout(timer)
    }
  }

  return { status: "error", normalizedUrl: currentUrl, sourceUrls, body: null, durationMs: Date.now() - started, byteCount: 0 }
}

export function websiteFetchLogHost(result: GrowthLeadWebsiteFetchResult): string | null {
  return hostnameForLog(result.normalizedUrl ?? result.sourceUrls[0] ?? null)
}
