import type { GrowthRealWorldDiscoveryProviderRawCandidate } from "@/lib/growth/real-world-discovery/real-world-discovery-provider-types"
import type { SerpApiGoogleMapsLocalResult } from "@/lib/growth/real-world-discovery/providers/serp-types"

function parseSerpAddress(address: string | undefined): {
  city: string | null
  state: string | null
  country: string | null
} {
  return parseSerpAddressFromString(address)
}

export function parseSerpAddressFromString(address: string | undefined): {
  city: string | null
  state: string | null
  country: string | null
} {
  const raw = typeof address === "string" ? address.trim() : ""
  if (!raw) return { city: null, state: null, country: null }

  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean)
  if (parts.length < 2) return { city: null, state: null, country: null }

  const country = parts.length >= 3 ? parts[parts.length - 1]! : null
  const stateZip = parts.length >= 2 ? parts[parts.length - (country ? 2 : 1)]! : null
  const city = parts.length >= 3 ? parts[parts.length - (country ? 3 : 2)]! : parts[0]!

  const stateMatch = stateZip?.match(/\b([A-Z]{2})\b/)
  const state = stateMatch?.[1] ?? (stateZip && stateZip.length <= 3 ? stateZip : null)

  return { city: city || null, state, country }
}

function computeSerpConfidence(row: SerpApiGoogleMapsLocalResult): number {
  let confidence = 0.62
  if (row.website) confidence += 0.05
  if (typeof row.rating === "number" && row.rating >= 4) confidence += 0.05
  if (typeof row.reviews === "number" && row.reviews >= 10) confidence += 0.05
  return Math.min(0.82, confidence)
}

export function mapSerpLocalResultToCandidate(
  row: SerpApiGoogleMapsLocalResult,
  input: { query: string; source_rank: number },
): GrowthRealWorldDiscoveryProviderRawCandidate | null {
  const company_name = row.title?.trim() ?? ""
  if (!company_name || company_name.length < 2) return null

  const address = row.address?.trim() || null
  const { city, state, country } = parseSerpAddress(address ?? undefined)
  const location = [city, state, country].filter(Boolean).join(", ") || address
  const category = row.type?.trim() || row.types?.slice(0, 2).join(", ") || null
  const rating = typeof row.rating === "number" ? row.rating : null
  const review_count = typeof row.reviews === "number" ? row.reviews : null
  const confidence = computeSerpConfidence(row)
  const source_url = row.link?.trim() || row.website?.trim() || null
  const categories = (row.types ?? []).filter(Boolean)
  if (row.type && !categories.includes(row.type)) categories.unshift(row.type)

  const ratingNote =
    rating != null
      ? ` Rating ${rating}${review_count != null ? ` (${review_count} reviews)` : ""}.`
      : ""

  return {
    company_name,
    website: row.website?.trim() || null,
    phone: row.phone?.trim() || null,
    address,
    city,
    state,
    country,
    category,
    description: row.description?.trim() || null,
    location,
    rating,
    review_count,
    source_url,
    source_rank: input.source_rank,
    confidence,
    evidence: [
      {
        claim: "SERP local listing",
        evidence: `"${company_name}" returned by SerpAPI Google Maps for "${input.query}".${ratingNote}`,
        source: "growth.real_world_discovery.serp",
      },
    ],
    source_attribution: [
      {
        source: "growth.real_world_discovery.serp",
        provider_type: "serp",
        provider_name: "serp",
        signal: "serp_google_maps",
        evidence: `SerpAPI Google Maps search — query "${input.query}".`,
        confidence,
      },
    ],
    raw_payload_server_only: {
      source_provider: "serp",
      serp_place_id: row.place_id ?? null,
      categories,
      serp_engine: "google_maps",
    },
  }
}
