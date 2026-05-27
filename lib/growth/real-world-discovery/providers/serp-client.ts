import "server-only"

import type {
  SerpApiGoogleMapsLocalResult,
  SerpApiGoogleMapsResponse,
} from "@/lib/growth/real-world-discovery/providers/serp-types"

const SERPAPI_SEARCH_URL = "https://serpapi.com/search.json"

export function getSerpApiKey(): string | null {
  return (
    process.env.SERPAPI_API_KEY?.trim() ||
    process.env.SERP_API_KEY?.trim() ||
    process.env.SERPAPI_KEY?.trim() ||
    null
  )
}

export function isSerpApiConfigured(): boolean {
  return Boolean(getSerpApiKey())
}

export async function searchSerpGoogleMaps(
  query: string,
  options?: { limit?: number; apiKey?: string },
): Promise<SerpApiGoogleMapsLocalResult[]> {
  const apiKey = options?.apiKey ?? getSerpApiKey()
  if (!apiKey) {
    throw new Error("SERPAPI_API_KEY or SERP_API_KEY is not configured.")
  }

  const params = new URLSearchParams({
    engine: "google_maps",
    q: query,
    type: "search",
    api_key: apiKey,
  })

  const res = await fetch(`${SERPAPI_SEARCH_URL}?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  })

  const payload = (await res.json()) as SerpApiGoogleMapsResponse

  if (!res.ok) {
    throw new Error(payload.error ?? `SerpAPI request failed (${res.status}).`)
  }

  if (payload.error) {
    throw new Error(payload.error)
  }

  const local = payload.local_results ?? []
  if (local.length) {
    const limit = options?.limit ?? 20
    return local.slice(0, Math.min(limit, 20))
  }

  if (payload.place_results?.title) {
    return [payload.place_results]
  }

  return []
}
