/** Observable keyword extraction — never claims private search query access. */

export const GROWTH_SEARCH_QUERY_PARAM_KEYS = ["q", "query", "search", "s", "keyword"] as const

const SEARCH_ENGINE_REFERRER_HOSTS = [
  "google.",
  "bing.",
  "duckduckgo.",
  "yahoo.",
  "search.brave.",
  "ecosia.",
]

export function normalizeKeyword(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 200)
}

export function isEmptyKeyword(keyword: string): boolean {
  const n = normalizeKeyword(keyword)
  return !n || n.length < 2 || /^[\W_]+$/.test(n)
}

function tryParseUrl(value: string): URL | null {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

/** Extract query from referrer URL only when browser sent it (e.g. ?q= on search result links). */
export function extractKeywordFromReferrerUrl(referrer: string): {
  keyword: string | null
  pattern: string | null
  source_name: string | null
} {
  const url = tryParseUrl(referrer)
  if (!url) return { keyword: null, pattern: null, source_name: null }

  const host = url.hostname.toLowerCase()
  const isSearchEngine = SEARCH_ENGINE_REFERRER_HOSTS.some((h) => host.includes(h))
  if (!isSearchEngine) return { keyword: null, pattern: null, source_name: host }

  for (const key of GROWTH_SEARCH_QUERY_PARAM_KEYS) {
    const value = url.searchParams.get(key)
    if (value && !isEmptyKeyword(value)) {
      return {
        keyword: normalizeKeyword(decodeURIComponent(value.replace(/\+/g, " "))),
        pattern: `referrer:${key}`,
        source_name: host,
      }
    }
  }

  return { keyword: null, pattern: null, source_name: host }
}

export function extractKeywordFromPageUrl(pageUrl: string): {
  keyword: string | null
  pattern: string | null
} {
  const url = tryParseUrl(pageUrl)
  if (!url) return { keyword: null, pattern: null }

  for (const key of GROWTH_SEARCH_QUERY_PARAM_KEYS) {
    const value = url.searchParams.get(key)
    if (value && !isEmptyKeyword(value)) {
      return {
        keyword: normalizeKeyword(decodeURIComponent(value.replace(/\+/g, " "))),
        pattern: `page_url:${key}`,
      }
    }
  }

  return { keyword: null, pattern: null }
}

export function extractKeywordsFromContentPath(path: string): string[] {
  const normalized = path.toLowerCase().split("?")[0] ?? ""
  const segments = normalized.split("/").filter((s) => s.length > 2 && !/^\d+$/.test(s))
  return segments.slice(0, 3).map((s) => normalizeKeyword(s.replace(/-/g, " ")))
}

export function inferSourceNameFromReferrer(referrer: string): string | null {
  const url = tryParseUrl(referrer)
  return url?.hostname ?? null
}

export function isPaidSearchMedium(medium: string): boolean {
  const m = medium.toLowerCase()
  return m === "cpc" || m === "paid" || m === "ppc" || m === "paidsearch"
}

export function isOrganicSearchReferrer(referrer: string): boolean {
  const url = tryParseUrl(referrer)
  if (!url) return false
  const host = url.hostname.toLowerCase()
  return SEARCH_ENGINE_REFERRER_HOSTS.some((h) => host.includes(h))
}
